import { useEffect } from 'react'
import { useWorkspace } from '@/entities/workspace'
import { isTauri } from '@/shared/api'
import { Button } from '@/shared/ui'
import { useAppUpdate } from '../model/use-update'

export function UpdateButton() {
  const { available, busy, error, install } = useAppUpdate()
  const toast = useWorkspace((state) => state.toast)

  useEffect(() => {
    if (error) toast(error)
  }, [error, toast])

  if (!isTauri() || (!available && !busy)) return null
  return (
    <Button variant="primary" size="sm" disabled={busy} onClick={() => void install()}>
      {busy ? 'Updating…' : `Update to ${available}`}
    </Button>
  )
}
