import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOverlayRuntime } from '@/features/place-overlay'

const queryClient = new QueryClient()

function OverlayRuntime() {
  useOverlayRuntime()
  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}><OverlayRuntime />{children}</QueryClientProvider>
}
