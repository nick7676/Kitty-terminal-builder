import { Link } from '@tanstack/react-router'
import { isTauri } from '../core/tauri'
import { DirtyPill, PageHead } from '../app/shell'
import { useWorkspace } from '../store/workspace'

export function OverviewPage() {
  const registry = useWorkspace((state) => state.registry)
  const files = useWorkspace((state) => state.files)
  const activeFile = useWorkspace((state) => state.activeFile)
  const status = useWorkspace((state) => state.status)
  const loading = useWorkspace((state) => state.loading)
  const stats = [
    [registry.options.length, 'Official options', `${registry.sections.length} complete sections`, '⚙'],
    [registry.maps.length, 'Default shortcuts', 'Version-aware mappings', '⌨'],
    [files.length, 'Configuration files', activeFile, '▤'],
    [status?.os ?? 'Web', 'Platform', status?.arch ?? 'Preview', '◫'],
  ] as const

  const installed = Boolean(status?.kittyInstalled)
  return (
    <div className="page">
      <PageHead eyebrow={installed ? (status?.kittyVersion ?? 'kitty') : 'Terminal'} title="Your complete kitty workspace" lead="See whether kitty is installed, then shape its preset from a live preview." action={<DirtyPill />} />
      {!isTauri() && status?.arch === 'web' ? <div className="notice">This preview cannot see the machine. Run <code>npm run desktop</code> for detection, the full option list and saving.</div> : null}
      {loading && !status ? <section className="card vision"><p className="eyebrow">Terminal</p><h2>Checking this machine…</h2></section> : null}
      {!loading || status ? <section className={`card vision ${installed ? 'ready' : 'missing'}`}>
        <div>
          <p className="eyebrow">{installed ? 'Installed' : 'Not installed'}</p>
          <h2>{installed ? (status?.kittyVersion ?? 'kitty is installed') : 'kitty was not found'}</h2>
          <p className="card-desc">{installed ? 'The binary, config directory and running state come from a direct lookup, including the macOS app bundle when kitty is not on PATH.' : 'Looked through PATH, Homebrew, /Applications/kitty.app and the official ~/.local install.'}</p>
          <div className="vision-actions">
            <Link className="btn primary" to="/builder">Open builder</Link>
            <Link className="btn" to="/setup">{installed ? 'Setup details' : 'Install kitty'}</Link>
          </div>
        </div>
        <dl className="vision-facts">
          <div><dt>Binary</dt><dd>{status?.kittyPath ?? 'Not found'}</dd></div>
          <div><dt>Config directory</dt><dd>{status?.configDir ?? '~/.config/kitty'}{status?.configExists ? '' : ' · missing'}</dd></div>
          <div><dt>kitty.conf</dt><dd>{status?.kittyConfExists ? 'Present' : 'Not created yet'}</dd></div>
          <div><dt>Process</dt><dd>{status?.kittyRunning ? 'Running' : 'Not running'}</dd></div>
        </dl>
      </section> : null}
      <div className="grid stats">
        {stats.map(([value, label, detail, icon]) => (
          <div className="card stat" key={label}><div><strong>{value}</strong><b>{label}</b><small>{detail}</small></div><span className="stat-icon">{icon}</span></div>
        ))}
      </div>
      <div className="grid two-cols" style={{ marginTop: 18 }}>
        <div className="card card-pad">
          <h2>Start building</h2>
          <p className="card-desc">The registry comes directly from your installed kitty, so it always matches your version.</p>
          <div className="action-list">
            <Link className="action-item" to="/builder"><span><b>Design the terminal</b><small>Colors, font, cursor, opacity and tab bar with a live preview.</small></span><span>→</span></Link>
            <Link className="action-item" to="/config/$section" params={{ section: 'fonts' }}><span><b>Open all settings</b><small>Search and edit every directive with official documentation.</small></span><span>→</span></Link>
            <Link className="action-item" to="/files"><span><b>Manage files and sessions</b><small>Themes, actions, SSH, shaders, sessions and Python hooks.</small></span><span>→</span></Link>
            <Link className="action-item" to="/integrations"><span><b>Browse all integrations</b><small>Editors, viewers, file managers, security and AI tools.</small></span><span>→</span></Link>
          </div>
        </div>
        <div className="card card-pad">
          <h2>Safe by design</h2>
          <p className="card-desc">There is no generic shell command. Every write is atomic, every overwrite is backed up, and installers are strictly allowlisted.</p>
          <div className="check-list">
            <div className="check"><span>Lossless configuration</span><span className="tag active">Active</span></div>
            <div className="check"><span>Atomic backups</span><span className="tag active">Active</span></div>
            <div className="check"><span>Command allowlist</span><span className="tag active">Active</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
