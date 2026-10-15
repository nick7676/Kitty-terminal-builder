import { Link } from '@tanstack/react-router'
import { isTauri } from '../core/tauri'
import { PageHead } from '../app/shell'
import { useWorkspace } from '../store/workspace'

const linuxInstall = 'curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin'

export function SetupPage() {
  const status = useWorkspace((state) => state.status)
  const refreshStatus = useWorkspace((state) => state.refreshStatus)
  const reloadKitty = useWorkspace((state) => state.reloadKitty)
  const manageKitty = useWorkspace((state) => state.manageKitty)
  const toast = useWorkspace((state) => state.toast)
  const brew = status?.packageManagers.includes('brew')
  const canManage = status?.os === 'macos' && brew
  const action = status?.kittyInstalled ? 'upgrade' : 'install'

  return (
    <div className="page">
      <PageHead eyebrow="System" title="Kitty setup" lead="Detect, install, update and connect kitty without exposing an unrestricted command shell." />
      <div className="grid setup-grid">
        <div className="card card-pad">
          <h2>Installation status</h2>
          <div className="check-list">
            <div className="check"><span>kitty binary</span><span className={`tag ${status?.kittyInstalled ? 'active' : ''}`}>{status?.kittyInstalled ? 'Installed' : 'Missing'}</span></div>
            <div className="check"><span>Version</span><code>{status?.kittyVersion ?? '—'}</code></div>
            <div className="check"><span>Binary path</span><code>{status?.kittyPath ?? '—'}</code></div>
            <div className="check"><span>Running now</span><span className={`tag ${status?.kittyRunning ? 'active' : ''}`}>{status?.kittyRunning ? 'Yes' : 'No'}</span></div>
            <div className="check"><span>Config directory</span><code>{status?.configDir ?? '—'}</code></div>
            <div className="check"><span>kitty.conf</span><span className={`tag ${status?.kittyConfExists ? 'active' : ''}`}>{status?.kittyConfExists ? 'Present' : 'Not created'}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            {status?.kittyInstalled ? <Link className="btn" to="/builder">Open builder</Link> : null}
            {canManage ? <button className="btn primary" type="button" disabled={!isTauri()} onClick={() => {
              const command = action === 'install' ? 'brew install --cask kitty' : 'brew upgrade --cask kitty'
              if (!confirm(`${action === 'install' ? 'Install' : 'Update'} kitty?\n\n${command}`)) return
              void manageKitty(action).catch((error) => toast(String(error)))
            }}>{status?.kittyInstalled ? 'Update kitty' : 'Install kitty'}</button> : null}
            <button className="btn" type="button" onClick={() => void refreshStatus()}>Refresh detection</button>
            {status?.kittyInstalled ? <button className="btn" type="button" disabled={!isTauri()} onClick={() => void reloadKitty()}>Reload config</button> : null}
          </div>
        </div>
        <div className="card card-pad">
          <h2>{status?.os === 'macos' ? 'macOS' : 'Linux'} installation</h2>
          {status?.os === 'macos'
            ? <><p className="card-desc">Kitty Builder uses Homebrew Cask when available. You see and approve the exact operation before it runs.</p><pre className="code-block">brew {status?.kittyInstalled ? 'upgrade --cask' : 'install --cask'} kitty</pre></>
            : <><p className="card-desc">The official Linux installer is shown but never executed automatically because it pipes remote code into a shell.</p><pre className="code-block">{linuxInstall}</pre></>}
          <p className="card-desc" style={{ marginTop: 14 }}>Detected package managers</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {status?.packageManagers.map((manager) => <span className="tag active" key={manager}>{manager}</span>) ?? <span className="tag">None</span>}
          </div>
        </div>
      </div>
      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h2>Security boundaries</h2>
        <div className="grid stats" style={{ marginTop: 12 }}>
          <div className="check">Filesystem <span className="tag active">Kitty config only</span></div>
          <div className="check">Commands <span className="tag active">Allowlist only</span></div>
          <div className="check">Writes <span className="tag active">Atomic + backup</span></div>
          <div className="check">Remote scripts <span className="tag active">Never automatic</span></div>
        </div>
      </div>
    </div>
  )
}
