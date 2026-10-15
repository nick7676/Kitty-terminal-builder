import { create } from 'zustand'
import { backend, isTauri } from '@/shared/api'
import type { ConfigFile, KittyRegistry, ManagedPackage, SystemStatus } from '@/shared/api'
import { parseDocument, removeValue, serializeDocument, setValue, setValues, type ConfigDocument } from './document'

const sections = [
  ['fonts', 'Fonts'], ['cursor', 'Text cursor'], ['scrollback', 'Scrollback'], ['mouse', 'Mouse'],
  ['performance', 'Performance'], ['bell', 'Terminal bell'], ['window', 'Window layout'],
  ['tabbar', 'Tab bar'], ['colors', 'Color scheme'], ['advanced', 'Advanced'],
  ['os', 'OS tweaks'], ['shortcuts', 'Keyboard shortcuts'],
].map(([id, title]) => ({ id, title }))

export const fallbackRegistry: KittyRegistry = { kittyVersion: 'desktop required', sections, options: [], maps: [] }

const clone = (document: ConfigDocument) => structuredClone(document)

interface Workspace {
  status?: SystemStatus
  registry: KittyRegistry
  files: ConfigFile[]
  activeFile: string
  original: string
  document: ConfigDocument
  loading: boolean
  error: string
  log: string
  filesMode: 'source' | 'diff'
  detected: Record<string, boolean>
  managed: ManagedPackage[]
  optionQuery: string
  integrationQuery: string
  integrationCategory: string
  helpOpen: boolean
  initialize: () => Promise<void>
  openFile: (path: string) => Promise<void>
  editValue: (key: string, value: string) => void
  editValues: (key: string, values: string[]) => void
  applyEntries: (entries: [string, string][]) => void
  updateDocument: (recipe: (document: ConfigDocument) => void) => void
  resetKeys: (keys: string[]) => void
  resetOption: (key: string) => void
  replaceSource: (source: string) => void
  discard: () => void
  saveAndReload: () => Promise<void>
  createFromTemplate: (path: string, template: string, includeProfile: boolean) => Promise<void>
  restoreBackup: (backupPath: string) => Promise<void>
  refreshStatus: () => Promise<void>
  reloadKitty: () => Promise<void>
  manageKitty: (action: string) => Promise<void>
  loadIntegrations: (commands: string[]) => Promise<void>
  runPackage: (manager: string, action: string, packageName: string, name: string) => Promise<void>
  setFilesMode: (mode: 'source' | 'diff') => void
  setOptionQuery: (query: string) => void
  setIntegrationQuery: (query: string) => void
  setIntegrationCategory: (category: string) => void
  setHelpOpen: (open: boolean) => void
  toast: (message: string) => void
}

export const contentOf = (document: ConfigDocument) => serializeDocument(document)
export const isDirtyState = (document: ConfigDocument, original: string) => contentOf(document) !== original

let booted = false

export const useWorkspace = create<Workspace>((set, get) => ({
  registry: fallbackRegistry,
  files: [],
  activeFile: 'kitty.conf',
  original: '',
  document: parseDocument(''),
  loading: true,
  error: '',
  log: '',
  filesMode: 'source',
  detected: {},
  managed: [],
  optionQuery: '',
  integrationQuery: '',
  integrationCategory: '',
  helpOpen: false,
  toast: (message) => {
    set({ log: message })
    window.setTimeout(() => set({ log: '' }), 3500)
  },
  initialize: async () => {
    if (booted) return
    booted = true
    set({ loading: true, error: '' })
    try {
      const status = await backend.status()
      set({ status })
      if (!isTauri()) return
      let registry = get().registry
      if (status.kittyInstalled) {
        try {
          registry = await backend.registry()
        } catch (error) {
          set({ error: `Option registry unavailable: ${String(error)}` })
        }
      }
      const files = await backend.files()
      const snapshot = await backend.read('kitty.conf')
      set({
        registry,
        files,
        activeFile: 'kitty.conf',
        original: snapshot.content,
        document: parseDocument(snapshot.content),
      })
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ loading: false })
    }
  },
  openFile: async (path) => {
    const snapshot = await backend.read(path)
    set({ activeFile: path, original: snapshot.content, document: parseDocument(snapshot.content), filesMode: 'source' })
  },
  editValue: (key, value) => set((state) => {
    const document = clone(state.document)
    setValue(document, key, value)
    return { document }
  }),
  editValues: (key, values) => set((state) => {
    const document = clone(state.document)
    setValues(document, key, values)
    return { document }
  }),
  applyEntries: (entries) => set((state) => {
    const document = clone(state.document)
    for (const [key, value] of entries) setValue(document, key, value)
    return { document }
  }),
  updateDocument: (recipe) => set((state) => {
    const document = clone(state.document)
    recipe(document)
    return { document }
  }),
  resetKeys: (keys) => set((state) => {
    const document = clone(state.document)
    for (const key of keys) removeValue(document, key)
    return { document }
  }),
  resetOption: (key) => set((state) => {
    const document = clone(state.document)
    removeValue(document, key)
    return { document }
  }),
  replaceSource: (source) => set({ document: parseDocument(source) }),
  discard: () => set((state) => ({ document: parseDocument(state.original) })),
  saveAndReload: async () => {
    const current = contentOf(get().document)
    const result = await backend.write(get().activeFile, current)
    set({ original: current })
    try {
      set({ files: await backend.files() })
    } catch {
      // The file is already saved if the directory listing fails.
    }
    let detail = ''
    try {
      const reload = await backend.reload()
      detail = reload.success ? reload.stdout : reload.stderr
    } catch (error) {
      detail = String(error)
    }
    const backup = result.backupPath ? `\nBackup: ${result.backupPath}` : ''
    get().toast(detail ? `Saved${backup}\n${detail}` : `Saved${backup}`)
  },
  createFromTemplate: async (path, template, includeProfile) => {
    await backend.write(path, template)
    if (includeProfile) {
      const main = await backend.read('kitty.conf')
      const mainDocument = parseDocument(main.content)
      const includes = mainDocument.nodes.flatMap((node) => node.type === 'directive' && node.key === 'include' ? [node.value] : [])
      if (!includes.includes(path)) setValues(mainDocument, 'include', [...includes, path])
      await backend.write('kitty.conf', serializeDocument(mainDocument))
    }
    const files = await backend.files()
    const snapshot = await backend.read(path)
    set({ files, activeFile: path, original: snapshot.content, document: parseDocument(snapshot.content) })
    get().toast(`Created ${path}`)
  },
  restoreBackup: async (backupPath) => {
    await backend.restore(backupPath, get().activeFile)
    await get().openFile(get().activeFile)
    get().toast('Backup restored')
  },
  refreshStatus: async () => set({ status: await backend.status() }),
  reloadKitty: async () => {
    const result = await backend.reload()
    get().toast(result.success ? 'kitty configuration reloaded' : result.stderr)
  },
  manageKitty: async (action) => {
    const result = await backend.packageAction('brew-cask', action, 'kitty')
    set({ status: await backend.status() })
    get().toast(result.success ? result.stdout || 'Operation completed' : result.stderr)
  },
  loadIntegrations: async (commands) => {
    const [detected, managed] = await Promise.all([backend.detectCommands(commands), backend.managedPackages()])
    set({ detected, managed })
  },
  runPackage: async (manager, action, packageName, name) => {
    const result = await backend.packageAction(manager, action, packageName)
    get().toast(result.success ? `${name}: ${action} completed\n${result.stdout}` : `Operation failed\n${result.stderr}`)
  },
  setFilesMode: (filesMode) => set({ filesMode }),
  setOptionQuery: (optionQuery) => set({ optionQuery }),
  setIntegrationQuery: (integrationQuery) => set({ integrationQuery }),
  setIntegrationCategory: (integrationCategory) => set({ integrationCategory }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}))
