import { Link } from '@tanstack/react-router'
import { DirtyStatus } from '@/features/save-document'
import { useWorkspace } from '@/entities/workspace'
import { isTauri } from '@/shared/api'
import { buttonClass, Card, Notice, PageHead, Tag } from '@/shared/ui'

const shortcuts = [
  { to: '/builder', params: undefined, title: 'Design the terminal', detail: 'Colors, font, cursor, opacity and tab bar with a live preview.' },
  { to: '/config/$section', params: { section: 'fonts' }, title: 'Open all settings', detail: 'Search and edit every directive with official documentation.' },
  { to: '/files', params: undefined, title: 'Manage files and sessions', detail: 'Themes, actions, SSH, shaders, sessions and Python hooks.' },
  { to: '/integrations', params: undefined, title: 'Browse all integrations', detail: 'Editors, viewers, file managers, security and AI tools.' },
] as const

export function OverviewPage() {
  const registry = useWorkspace((state) => state.registry)
  const files = useWorkspace((state) => state.files)
  const activeFile = useWorkspace((state) => state.activeFile)
  const status = useWorkspace((state) => state.status)
  const loading = useWorkspace((state) => state.loading)
  const installed = Boolean(status?.kittyInstalled)
  const stats = [
    [registry.options.length, 'Official options', `${registry.sections.length} complete sections`, '⚙'],
    [registry.maps.length, 'Default shortcuts', 'Version-aware mappings', '⌨'],
    [files.length, 'Configuration files', activeFile, '▤'],
    [status?.os ?? 'Web', 'Platform', status?.arch ?? 'Preview', '◫'],
  ] as const

  return (
    <div className="page">
      <PageHead eyebrow={installed ? (status?.kittyVersion ?? 'kitty') : 'Terminal'} title="Your complete kitty workspace" lead="See whether kitty is installed, then shape its preset from a live preview." action={<DirtyStatus labels={['Unsaved changes', 'Configuration synced']} />} />
      {!isTauri() && status?.arch === 'web' ? <Notice>This preview cannot see the machine. Run <code>npm run desktop</code> for detection, the full option list and saving.</Notice> : null}
      {loading && !status ? <Card className="vision"><p className="eyebrow">Terminal</p><h2>Checking this machine…</h2></Card> : null}
      {!loading || status ? <Card className={`vision ${installed ? 'ready' : 'missing'}`}>
        <div>
          <p className="eyebrow">{installed ? 'Installed' : 'Not installed'}</p>
          <h2>{installed ? (status?.kittyVersion ?? 'kitty is installed') : 'kitty was not found'}</h2>
          <p className="card-desc">{installed ? 'The binary, config directory and running state come from a direct lookup, including the macOS app bundle when kitty is not on PATH.' : 'Looked through PATH, Homebrew, /Applications/kitty.app and the official ~/.local install.'}</p>
          <div className="vision-actions">
            <Link className={buttonClass('primary')} to="/builder">Open builder</Link>
            <Link className={buttonClass()} to="/setup">{installed ? 'Setup details' : 'Install kitty'}</Link>
          </div>
        </div>
        <dl className="vision-facts">
          <div><dt>Binary</dt><dd>{status?.kittyPath ?? 'Not found'}</dd></div>
          <div><dt>Config directory</dt><dd>{status?.configDir ?? '~/.config/kitty'}{status?.configExists ? '' : ' · missing'}</dd></div>
          <div><dt>kitty.conf</dt><dd>{status?.kittyConfExists ? 'Present' : 'Not created yet'}</dd></div>
          <div><dt>Process</dt><dd>{status?.kittyRunning ? 'Running' : 'Not running'}</dd></div>
        </dl>
      </Card> : null}
      <div className="grid stats">
        {stats.map(([value, label, detail, icon]) => (
          <Card className="stat" key={label}><div><strong>{value}</strong><b>{label}</b><small>{detail}</small></div><span className="stat-icon">{icon}</span></Card>
        ))}
      </div>
      <div className="grid two-cols" style={{ marginTop: 18 }}>
        <Card padded>
          <h2>Start building</h2>
          <p className="card-desc">The registry comes directly from your installed kitty, so it always matches your version.</p>
          <div className="action-list">
            {shortcuts.map((item) => (
              <Link key={item.title} className="action-item" to={item.to} params={item.params}><span><b>{item.title}</b><small>{item.detail}</small></span><span>→</span></Link>
            ))}
          </div>
        </Card>
        <Card padded>
          <h2>Safe by design</h2>
          <p className="card-desc">There is no generic shell command. Every write is atomic, every overwrite is backed up, and installers are strictly allowlisted.</p>
          <div className="check-list">
            <div className="check"><span>Lossless configuration</span><Tag active>Active</Tag></div>
            <div className="check"><span>Atomic backups</span><Tag active>Active</Tag></div>
            <div className="check"><span>Command allowlist</span><Tag active>Active</Tag></div>
          </div>
        </Card>
      </div>
    </div>
  )
}
