import { isTauri } from '@/shared/api'
import { isDirtyState, useWorkspace } from '@/entities/workspace'

export function useDirty() {
  return useWorkspace((state) => isDirtyState(state.document, state.original))
}

export function confirmDiscard(message: string) {
  const state = useWorkspace.getState()
  return !isDirtyState(state.document, state.original) || confirm(message)
}

function confirmOverwrite(file: string) {
  return confirm(`Write ${file}, create a backup and reload kitty?`)
}

export async function confirmAndSave() {
  const state = useWorkspace.getState()
  if (!isTauri() || !isDirtyState(state.document, state.original)) return
  if (!confirmOverwrite(state.activeFile)) return
  await state.saveAndReload()
}

export function useSaveDocument(after?: () => Promise<void>) {
  const activeFile = useWorkspace((state) => state.activeFile)
  const saveAndReload = useWorkspace((state) => state.saveAndReload)
  const discard = useWorkspace((state) => state.discard)
  const toast = useWorkspace((state) => state.toast)
  const dirty = useDirty()
  const save = async () => {
    if (!confirmOverwrite(activeFile)) return
    try {
      await saveAndReload()
      await after?.()
    } catch (error) {
      toast(`Save failed:\n${String(error)}`)
    }
  }
  return { dirty, discard, save }
}
