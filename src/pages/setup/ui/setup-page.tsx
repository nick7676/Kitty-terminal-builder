import { Link } from '@tanstack/react-router'
import { useWorkspace } from '@/entities/workspace'
import { isTauri } from '@/shared/api'
import { Button, Card, CheckList, PageHead, Tag, buttonClass } from '@/shared/ui'

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
  const present = (on: boolean | undefined, yes: string, no: string) => <Tag active={Boolean(on)}>{on ? yes : no}</Tag>

  return (
    <div className="page">
      <PageHead eyebrow="System" title="Kitty setup" lead="Detect, install, update and connect kitty without exposing an unrestricted command shell." />
      <div className="grid setup-grid">
        <Card padded>
          <h2>Installation status</h2>
          <CheckList items={[
            { label: 'kitty binary', detail: present(status?.kittyInstalled, 'Installed', 'Missing') },
            { label: 'Version', detail: <code>{status?.kittyVersion ?? '—'}</code> },
            { label: 'Binary path', detail: <code>{status?.kittyPath ?? '—'}</code> },
            { label: 'Running now', detail: present(status?.kittyRunning, 'Yes', 'No') },
            { label: 'Config directory', detail: <code>{status?.configDir ?? '—'}</code> },
            { label: 'kitty.conf', detail: present(status?.kittyConfExists, 'Present', 'Not created') },
          ]} />
          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            {status?.kittyInstalled ? <Link className={buttonClass()} to="/builder">Open builder</Link> : null}
            {canManage ? <Button variant="primary" disabled={!isTauri()} onClick={() => {
              const command = action === 'install' ? 'brew install --cask kitty' : 'brew upgrade --cask kitty'
              if (!confirm(`${action === 'install' ? 'Install' : 'Update'} kitty?\n\n${command}`)) return
              void manageKitty(action).catch((error) => toast(String(error)))
            }}>{status?.kittyInstalled ? 'Update kitty' : 'Install kitty'}</Button> : null}
            <Button onClick={() => void refreshStatus()}>Refresh detection</Button>
            {status?.kittyInstalled ? <Button disabled={!isTauri()} onClick={() => void reloadKitty()}>Reload config</Button> : null}
          </div>
        </Card>
        <Card padded>
          <h2>{status?.os === 'macos' ? 'macOS' : 'Linux'} installation</h2>
          {status?.os === 'macos'
            ? <><p className="card-desc">Kitty Builder uses Homebrew Cask when available. You see and approve the exact operation before it runs.</p><pre className="code-block">brew {status?.kittyInstalled ? 'upgrade --cask' : 'install --cask'} kitty</pre></>
            : <><p className="card-desc">The official Linux installer is shown but never executed automatically because it pipes remote code into a shell.</p><pre className="code-block">{linuxInstall}</pre></>}
          <p className="card-desc" style={{ marginTop: 14 }}>Detected package managers</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {status?.packageManagers.map((manager) => <Tag active key={manager}>{manager}</Tag>) ?? <Tag>None</Tag>}
          </div>
        </Card>
      </div>
      <Card padded style={{ marginTop: 16 }}>
        <h2>Security boundaries</h2>
        <div className="grid stats" style={{ marginTop: 12 }}>
          <div className="check">Filesystem <Tag active>Kitty config only</Tag></div>
          <div className="check">Commands <Tag active>Allowlist only</Tag></div>
          <div className="check">Writes <Tag active>Atomic + backup</Tag></div>
          <div className="check">Remote scripts <Tag active>Never automatic</Tag></div>
        </div>
      </Card>
    </div>
  )
}
