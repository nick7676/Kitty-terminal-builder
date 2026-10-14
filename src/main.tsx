import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { router } from './app/router'
import './styles.css'
import { useWorkspace } from './store/workspace'

const queryClient = new QueryClient()
void useWorkspace.getState().initialize()

createRoot(document.querySelector('#app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
