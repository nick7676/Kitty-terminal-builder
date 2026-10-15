import { useEffect } from 'react'
import { integrationBinaries, integrationCategories, integrations } from '@/entities/integration'
import { useWorkspace } from '@/entities/workspace'
import { IntegrationCard } from '@/features/manage-package'
import { isTauri } from '@/shared/api'
import { PageHead, SearchField } from '@/shared/ui'

export function IntegrationsPage() {
  const query = useWorkspace((state) => state.integrationQuery)
  const category = useWorkspace((state) => state.integrationCategory)
  const setQuery = useWorkspace((state) => state.setIntegrationQuery)
  const setCategory = useWorkspace((state) => state.setIntegrationCategory)
  const loadIntegrations = useWorkspace((state) => state.loadIntegrations)
  const toast = useWorkspace((state) => state.toast)

  useEffect(() => {
    if (!isTauri()) return
    void loadIntegrations(integrationBinaries()).catch((error) => toast(String(error)))
  }, [loadIntegrations, toast])

  const needle = query.toLowerCase()
  const visible = integrations.filter((item) => (!category || item.category === category) && (!needle || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(needle)))

  return (
    <div className="page">
      <PageHead eyebrow="Official ecosystem" title="Integrations" lead={`${integrations.length} tools listed by the kitty project. Deterministic package-manager installs can run after explicit confirmation; all others link to official instructions.`} />
      <div className="filters">
        <SearchField id="integration-search" placeholder="Search integrations…" value={query} onChange={setQuery} />
        <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {integrationCategories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="grid catalog">
        {visible.map((integration) => <IntegrationCard key={integration.id} integration={integration} />)}
      </div>
    </div>
  )
}
