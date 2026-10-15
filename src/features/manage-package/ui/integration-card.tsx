import { integrationBinaries, integrationDocs, matchingInstall, packageCommand } from '@/entities/integration'
import type { Integration } from '@/shared/api'
import { useWorkspace } from '@/entities/workspace'
import { Button, Tag, buttonClass } from '@/shared/ui'

export function IntegrationCard({ integration }: { integration: Integration }) {
  const status = useWorkspace((state) => state.status)
  const detected = useWorkspace((state) => state.detected)
  const managed = useWorkspace((state) => state.managed)
  const loadIntegrations = useWorkspace((state) => state.loadIntegrations)
  const runPackage = useWorkspace((state) => state.runPackage)
  const toast = useWorkspace((state) => state.toast)
  const managers = status?.packageManagers ?? []
  const method = matchingInstall(integration.install, managers)
  const installed = Boolean(integration.binary && detected[integration.binary])
  const owned = integration.install.find((candidate) => managed.some((item) => item.manager === candidate.manager && item.package === candidate.package))
  const command = method ? packageCommand(method.manager, 'install', method.package) : ''
  const act = (action: string, manager: string, packageName: string) => {
    const preview = packageCommand(manager, action, packageName)
    if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} ${integration.name}?\n\nCommand: ${preview}\n\nThird-party integrations run with your user permissions.`)) return
    void runPackage(manager, action, packageName, integration.name).then(() => loadIntegrations(integrationBinaries())).catch((error) => toast(String(error)))
  }
  return (
    <article className="card integration">
      <div className="integration-head"><h3>{integration.name}</h3>{installed ? <Tag active>Installed</Tag> : <Tag>{integration.category}</Tag>}</div>
      <p>{integration.description}</p>
      {command && !installed ? <div className="command-preview">{command}</div> : null}
      <div className="integration-actions">
        {owned ? (
          <>
            <Button onClick={() => act('upgrade', owned.manager, owned.package)}>Update</Button>
            <Button variant="danger" onClick={() => act('uninstall', owned.manager, owned.package)}>Remove</Button>
          </>
        ) : !installed && method ? <Button variant="primary" onClick={() => act('install', method.manager, method.package)}>Install</Button>
          : !installed ? <Tag>Manual setup</Tag> : <Tag>Externally managed</Tag>}
        <a className={buttonClass('default', 'sm')} href={integrationDocs(integration.id)} target="_blank" rel="noreferrer">Docs ↗</a>
      </div>
    </article>
  )
}
