import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { confirmAndSave } from '@/features/save-document'
import { useWorkspace } from '@/entities/workspace'
import { isTauri } from '@/shared/api'
import { CheckList, Pill } from '@/shared/ui'

const nav = [
  { to: '/', label: 'Overview', icon: '⌂' },
  { to: '/builder', label: 'Builder', icon: '▣' },
  { to: '/widgets', label: 'Widgets', icon: '◫' },
  { to: '/config/$section', params: { section: 'fonts' }, label: 'All settings', icon: '⚙' },
  { to: '/files', label: 'Files & profiles', icon: '▤' },
  { to: '/integrations', label: 'Integrations', icon: '◇' },
  { to: '/setup', label: 'Kitty setup', icon: '⌘' },
] as const

function Hotkey({ keys, enableOnFormTags = false, useKey = false, onFire }: {
  keys: string
  enableOnFormTags?: boolean
  useKey?: boolean
  onFire: (event: KeyboardEvent) => void
}) {
  useHotkeys(keys, onFire, { enableOnFormTags, useKey })
  return null
}

function isCurrent(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to.split('/$')[0])
}

export function Shell({ children }: { children: ReactNode }) {
  const status = useWorkspace((state) => state.status)
  const loading = useWorkspace((state) => state.loading)
  const error = useWorkspace((state) => state.error)
  const log = useWorkspace((state) => state.log)
  const helpOpen = useWorkspace((state) => state.helpOpen)
  const setHelpOpen = useWorkspace((state) => state.setHelpOpen)
  const reloadKitty = useWorkspace((state) => state.reloadKitty)
  const toast = useWorkspace((state) => state.toast)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const openHelp = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    setHelpOpen(true)
  }

  return (
    <>
      <Hotkey keys="mod+s" enableOnFormTags onFire={(event) => {
        event.preventDefault()
        if (!isTauri()) return
        void confirmAndSave().catch((reason) => toast(String(reason)))
      }} />
      <Hotkey keys="mod+k" enableOnFormTags onFire={(event) => {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('#option-search, #integration-search')?.focus()
      }} />
      <Hotkey keys="mod+shift+r" enableOnFormTags onFire={(event) => {
        event.preventDefault()
        if (status?.kittyInstalled) void reloadKitty()
      }} />
      {nav.map((link, index) => (
        <Hotkey key={link.label} keys={`mod+${index + 1}`} onFire={() => void navigate({ to: link.to, params: 'params' in link ? link.params : undefined })} />
      ))}
      <Hotkey keys="shift+slash" onFire={openHelp} />
      <Hotkey keys="?" useKey onFire={openHelp} />
      <Hotkey keys="escape" enableOnFormTags onFire={() => setHelpOpen(false)} />
      <header className="app-header">
        <Link className="brand" to="/"><span className="brand-mark">›_</span><span><b>Kitty Builder</b><small>Tauri desktop studio</small></span></Link>
        <div className="status-bar">
          {loading ? <Pill>Loading…</Pill> : null}
          {error ? <Pill tone="warning">Backend issue</Pill> : null}
          <Pill tone={status?.kittyInstalled ? 'success' : 'warning'}><i className="dot" />{status?.kittyInstalled ? (status.kittyVersion ?? 'kitty installed') : 'kitty not installed'}</Pill>
          <Pill>{status?.os ?? 'web'} · {status?.arch ?? 'preview'}</Pill>
        </div>
      </header>
      <aside className="sidebar">
        <nav className="nav">
          {nav.map((link) => (
            <Link key={link.label} className={`nav-link ${isCurrent(pathname, link.to) ? 'active' : ''}`} to={link.to} params={'params' in link ? link.params : undefined}>
              <span className="nav-icon">{link.icon}</span><span>{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="config-path"><b>{status?.configDir ?? '~/.config/kitty'}</b><small>Config directory · ? shortcuts</small></div>
      </aside>
      <main className="main">{children}</main>
      {log ? <div className="toast">{log}</div> : null}
      {helpOpen ? (
        <div className="help-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="card card-pad help-panel" onClick={(event) => event.stopPropagation()}>
            <h2>Keyboard shortcuts</h2>
            <CheckList items={[
              { label: 'Save and reload', detail: <code>⌘/Ctrl S</code> },
              { label: 'Focus search', detail: <code>⌘/Ctrl K</code> },
              { label: 'Reload kitty', detail: <code>⌘/Ctrl ⇧ R</code> },
              { label: 'Navigate pages', detail: <code>⌘/Ctrl 1–7</code> },
              { label: 'Close this panel', detail: <code>Esc</code> },
            ]} />
          </div>
        </div>
      ) : null}
    </>
  )
}
