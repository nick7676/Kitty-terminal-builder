import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { isTauri } from '../core/tauri'
import { isDirtyState, useWorkspace } from '../store/workspace'

const links = [
  { to: '/', label: 'Overview', icon: '⌂' },
  { to: '/builder', label: 'Builder', icon: '▣' },
  { to: '/config/$section', params: { section: 'fonts' }, label: 'All settings', icon: '⚙' },
  { to: '/files', label: 'Files & profiles', icon: '▤' },
  { to: '/integrations', label: 'Integrations', icon: '◇' },
  { to: '/setup', label: 'Kitty setup', icon: '⌘' },
] as const

export function Shell({ children }: { children: ReactNode }) {
  const status = useWorkspace((state) => state.status)
  const loading = useWorkspace((state) => state.loading)
  const error = useWorkspace((state) => state.error)
  const log = useWorkspace((state) => state.log)
  const helpOpen = useWorkspace((state) => state.helpOpen)
  const setHelpOpen = useWorkspace((state) => state.setHelpOpen)
  const saveAndReload = useWorkspace((state) => state.saveAndReload)
  const reloadKitty = useWorkspace((state) => state.reloadKitty)
  const toast = useWorkspace((state) => state.toast)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()

  useHotkeys('mod+s', (event) => {
    event.preventDefault()
    const state = useWorkspace.getState()
    if (!isTauri() || !isDirtyState(state.document, state.original)) return
    if (!confirm(`Write ${state.activeFile}, create a backup and reload kitty?`)) return
    void saveAndReload().catch((reason) => toast(String(reason)))
  }, { enableOnFormTags: true })
  useHotkeys('mod+k', (event) => {
    event.preventDefault()
    document.querySelector<HTMLInputElement>('#option-search, #integration-search')?.focus()
  }, { enableOnFormTags: true })
  useHotkeys('mod+shift+r', (event) => {
    event.preventDefault()
    if (status?.kittyInstalled) void reloadKitty()
  }, { enableOnFormTags: true })
  useHotkeys('mod+1', () => void navigate({ to: '/' }))
  useHotkeys('mod+2', () => void navigate({ to: '/builder' }))
  useHotkeys('mod+3', () => void navigate({ to: '/config/$section', params: { section: 'fonts' } }))
  useHotkeys('mod+4', () => void navigate({ to: '/files' }))
  useHotkeys('mod+5', () => void navigate({ to: '/integrations' }))
  useHotkeys('mod+6', () => void navigate({ to: '/setup' }))
  const openHelp = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    setHelpOpen(true)
  }
  useHotkeys('shift+slash', openHelp)
  useHotkeys('?', openHelp, { useKey: true })
  useHotkeys('escape', () => setHelpOpen(false), { enableOnFormTags: true })

  return (
    <>
      <header className="app-header">
        <Link className="brand" to="/"><span className="brand-mark">›_</span><span><b>Kitty Builder</b><small>Tauri desktop studio</small></span></Link>
        <div className="status-bar">
          {loading ? <span className="pill">Loading…</span> : null}
          {error ? <span className="pill warning">Backend issue</span> : null}
          <span className={`pill ${status?.kittyInstalled ? 'success' : 'warning'}`}><i className="dot" />{status?.kittyInstalled ? (status.kittyVersion ?? 'kitty installed') : 'kitty not installed'}</span>
          <span className="pill">{status?.os ?? 'web'} · {status?.arch ?? 'preview'}</span>
        </div>
      </header>
      <aside className="sidebar">
        <nav className="nav">
          {links.map((link) => {
            const active = link.to === '/' ? pathname === '/' : pathname.startsWith(link.to.split('/$')[0])
            return (
              <Link key={link.label} className={`nav-link ${active ? 'active' : ''}`} to={link.to} params={'params' in link ? link.params : undefined}>
                <span className="nav-icon">{link.icon}</span><span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="config-path"><b>{status?.configDir ?? '~/.config/kitty'}</b><small>Config directory · ? shortcuts</small></div>
      </aside>
      <main className="main">{children}</main>
      {log ? <div className="toast">{log}</div> : null}
      {helpOpen ? (
        <div className="help-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="card card-pad help-panel" onClick={(event) => event.stopPropagation()}>
            <h2>Keyboard shortcuts</h2>
            <div className="check-list">
              <div className="check"><span>Save and reload</span><code>⌘/Ctrl S</code></div>
              <div className="check"><span>Focus search</span><code>⌘/Ctrl K</code></div>
              <div className="check"><span>Reload kitty</span><code>⌘/Ctrl ⇧ R</code></div>
              <div className="check"><span>Navigate pages</span><code>⌘/Ctrl 1–6</code></div>
              <div className="check"><span>Close this panel</span><code>Esc</code></div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function PageHead({ eyebrow, title, lead, action }: { eyebrow: string; title: string; lead: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{lead}</p></div>
      {action}
    </div>
  )
}

export function DirtyPill() {
  const dirty = useWorkspace((state) => isDirtyState(state.document, state.original))
  return <span className={`pill ${dirty ? 'warning' : 'success'}`}>{dirty ? 'Unsaved changes' : 'Configuration synced'}</span>
}
