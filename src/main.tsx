import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { useWorkspace } from '@/entities/workspace'
import '@/app/styles.css'

void useWorkspace.getState().initialize()

createRoot(document.querySelector('#app')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
