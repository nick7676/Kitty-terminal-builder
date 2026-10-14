import { useEffect } from 'react'
import { isTauri } from '../core/tauri'
import { integrationCategories, integrationDocs, integrations } from '../data/integrations'
import { PageHead } from '../app/shell'
import { useWorkspace } from '../store/workspace'

export function IntegrationsPage() {
  const status = useWorkspace((state) => state.status)
  const detected = useWorkspace((state) => state.detected)
  const managed = useWorkspace((state) => state.managed)
  const query = useWorkspace((state) => state.integrationQuery)
  const category = useWorkspace((state) => state.integrationCategory)
  const setQuery = useWorkspace((state) => state.setIntegrationQuery)
  const setCategory = useWorkspace((state) => state.setIntegrationCategory)
  const loadIntegrations = useWorkspace((state) => state.loadIntegrations)
  const runPackage = useWorkspace((state) => state.runPackage)
  const toast = useWorkspace((state) => state.toast)

  useEffect(() => {
    if (!isTauri()) return
    const commands = [...new Set(integrations.flatMap((item) => item.binary ? [item.binary] : []))]
    void loadIntegrations(commands).catch((error) => toast(String(error)))
  }, [loadIntegrations, toast])

  const needle = query.toLowerCase()
  const visible = integrations.filter((item) => (!category || item.category === category) && (!needle || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(needle)))

  return (
    <div className="page">
      <PageHead eyebrow="Official ecosystem" title="Integrations" lead={`${integrations.length} tools listed by the kitty project. Deterministic package-manager installs can run after explicit confirmation; all others link to official instructions.`} />
      <div className="filters">
        <div className="search-wrap"><input id="integration-search" className="input" placeholder="Search integrations…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {integrationCategories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="grid catalog">
        {visible.map((integration) => {
          const managers = status?.packageManagers ?? []
          const method = integration.install.find((item) => managers.includes(item.manager === 'brew-cask' ? 'brew' : item.manager))
          const installed = Boolean(integration.binary && detected[integration.binary])
          const owned = integration.install.find((candidate) => managed.some((item) => item.manager === candidate.manager && item.package === candidate.package))
          const command = method ? `${method.manager === 'brew-cask' ? 'brew install --cask' : method.manager === 'npm' ? 'npm install -g' : `${method.manager} install`} ${method.package}` : ''
          const act = (action: string, manager: string, packageName: string) => {
            const preview = manager === 'brew-cask' ? `brew ${action} --cask ${packageName}` : `${manager} ${action} ${packageName}`
            if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} ${integration.name}?\n\nCommand: ${preview}\n\nThird-party integrations run with your user permissions.`)) return
            void runPackage(manager, action, packageName, integration.name).then(() => loadIntegrations(integrations.flatMap((item) => item.binary ? [item.binary] : []))).catch((error) => toast(String(error)))
          }
          return (
            <article className="card integration" key={integration.id}>
              <div className="integration-head"><h3>{integration.name}</h3>{installed ? <span className="tag active">Installed</span> : <span className="tag">{integration.category}</span>}</div>
              <p>{integration.description}</p>
              {command && !installed ? <div className="command-preview">{command}</div> : null}
              <div className="integration-actions">
                {owned ? (
                  <>
                    <button className="btn" type="button" onClick={() => act('upgrade', owned.manager, owned.package)}>Update</button>
                    <button className="btn danger" type="button" onClick={() => act('uninstall', owned.manager, owned.package)}>Remove</button>
                  </>
                ) : !installed && method ? <button className="btn primary" type="button" onClick={() => act('install', method.manager, method.package)}>Install</button>
                  : !installed ? <span className="tag">Manual setup</span> : <span className="tag">Externally managed</span>}
                <a className="btn small" href={integrationDocs(integration.id)} target="_blank" rel="noreferrer">Docs ↗</a>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
