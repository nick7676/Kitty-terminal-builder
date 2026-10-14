import { Link } from '@tanstack/react-router'
import { isTauri } from '../core/tauri'
import { DirtyPill, PageHead } from '../app/shell'
import { useWorkspace } from '../store/workspace'

export function OverviewPage() {
  const registry = useWorkspace((state) => state.registry)
  const files = useWorkspace((state) => state.files)
  const activeFile = useWorkspace((state) => state.activeFile)
  const status = useWorkspace((state) => state.status)
  const stats = [
    [registry.options.length, 'Official options', `${registry.sections.length} complete sections`, '⚙'],
    [registry.maps.length, 'Default shortcuts', 'Version-aware mappings', '⌨'],
    [files.length, 'Configuration files', activeFile, '▤'],
    [status?.os ?? 'Web', 'Platform', status?.arch ?? 'Preview', '◫'],
  ] as const

  return (
    <div className="page">
      <PageHead eyebrow={`kitty ${registry.kittyVersion}`} title="Your complete kitty workspace" lead="Every official option, companion file and supported integration in one safe native desktop application." action={<DirtyPill />} />
      {!isTauri() ? <div className="notice">This browser preview cannot access kitty. Run <code>npm run desktop</code> to load all 479 options and your real configuration.</div> : null}
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
