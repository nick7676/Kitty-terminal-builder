import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { BuilderPage } from '@/pages/builder'
import { ConfigPage } from '@/pages/config'
import { FilesPage } from '@/pages/files'
import { IntegrationsPage } from '@/pages/integrations'
import { OverviewPage } from '@/pages/overview'
import { SetupPage } from '@/pages/setup'
import { Shell } from '@/widgets/app-shell'

const rootRoute = createRootRoute({
  component: () => <Shell><Outlet /></Shell>,
})

const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: OverviewPage })
const builderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/builder', component: BuilderPage })
const configRoute = createRoute({ getParentRoute: () => rootRoute, path: '/config/$section', component: ConfigPage })
const filesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/files', component: FilesPage })
const integrationsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/integrations', component: IntegrationsPage })
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/setup', component: SetupPage })

const routeTree = rootRoute.addChildren([overviewRoute, builderRoute, configRoute, filesRoute, integrationsRoute, setupRoute])

export const router = createRouter({ routeTree, history: createHashHistory() })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
