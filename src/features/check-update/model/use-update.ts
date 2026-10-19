import { useEffect, useState } from 'react'
import { isTauri } from '@/shared/api'

export function useAppUpdate() {
  const [available, setAvailable] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    void import('@tauri-apps/plugin-updater')
      .then(({ check }) => check())
      .then((update) => {
        if (!cancelled && update) setAvailable(update.version)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function install() {
    if (!isTauri() || busy) return
    setBusy(true)
    setError('')
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const { relaunch } = await import('@tauri-apps/plugin-process')
      const update = await check()
      if (!update) {
        setAvailable(null)
        setBusy(false)
        return
      }
      await update.downloadAndInstall()
      await relaunch()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setBusy(false)
    }
  }

  return { available, busy, error, install }
}
