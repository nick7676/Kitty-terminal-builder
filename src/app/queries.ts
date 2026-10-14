import { useQuery } from '@tanstack/react-query'
import { backend, isTauri } from '../core/tauri'

export function useBackups(path: string) {
  return useQuery({
    queryKey: ['backups', path],
    queryFn: () => backend.backups(path),
    enabled: isTauri() && Boolean(path),
  })
}
