import { backend, isTauri } from './tauri'
import { parseDocument, serializeDocument, type ConfigDocument } from './document'
import type { ConfigFile, KittyRegistry, SystemStatus } from './types'

const sections = [
  ['fonts', 'Fonts'], ['cursor', 'Text cursor'], ['scrollback', 'Scrollback'], ['mouse', 'Mouse'],
  ['performance', 'Performance'], ['bell', 'Terminal bell'], ['window', 'Window layout'],
  ['tabbar', 'Tab bar'], ['colors', 'Color scheme'], ['advanced', 'Advanced'],
  ['os', 'OS tweaks'], ['shortcuts', 'Keyboard shortcuts'],
].map(([id, title]) => ({ id, title }))

export const fallbackRegistry: KittyRegistry = { kittyVersion: 'desktop required', sections, options: [], maps: [] }

export interface AppState {
  status?: SystemStatus
  registry: KittyRegistry
  files: ConfigFile[]
  activeFile: string
  original: string
  document: ConfigDocument
  loading: boolean
  error: string
  log: string
}

export const state: AppState = {
  registry: fallbackRegistry,
  files: [],
  activeFile: 'kitty.conf',
  original: '',
  document: parseDocument(''),
  loading: true,
  error: '',
  log: '',
}

export const content = () => serializeDocument(state.document)
export const isDirty = () => content() !== state.original

export async function initialize(): Promise<void> {
  state.loading = true
  state.error = ''
  try {
    state.status = await backend.status()
    if (!isTauri()) return
    if (state.status.kittyInstalled) state.registry = await backend.registry()
    state.files = await backend.files()
    state.activeFile = 'kitty.conf'
    await openFile(state.activeFile)
  } catch (error) {
    state.error = String(error)
  } finally {
    state.loading = false
  }
}

export async function openFile(path: string): Promise<void> {
  const snapshot = await backend.read(path)
  state.activeFile = path
  state.original = snapshot.content
  state.document = parseDocument(snapshot.content)
}

export async function saveFile(): Promise<void> {
  const current = content()
  const result = await backend.write(state.activeFile, current)
  state.original = current
  state.files = await backend.files()
  state.log = `Saved ${result.path}${result.backupPath ? `\nBackup: ${result.backupPath}` : ''}`
}

export async function createFile(path: string, initialContent: string): Promise<void> {
  await backend.write(path, initialContent)
  state.files = await backend.files()
  await openFile(path)
}
