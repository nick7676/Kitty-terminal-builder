import { useOverlays } from '@/entities/overlay'
import { isDirtyState, useWorkspace } from '@/entities/workspace'
import { isTauri } from '@/shared/api'

export function useDirty() {
  const configDirty = useWorkspace((state) => isDirtyState(state.document, state.original))
  const layoutDirty = useOverlays((state) => state.layoutDirty)
  return configDirty || layoutDirty
}

function pendingChanges() {
  const state = useWorkspace.getState()
  return isDirtyState(state.document, state.original) || useOverlays.getState().layoutDirty
}

export function confirmDiscard(message: string) {
  return !pendingChanges() || confirm(message)
}

function confirmOverwrite(file: string) {
  const configDirty = isDirtyState(useWorkspace.getState().document, useWorkspace.getState().original)
  return confirm(configDirty ? `Write ${file}, create a backup and reload kitty?` : 'Reload kitty with the new overlay layout?')
}

export async function confirmAndSave() {
  if (!isTauri() || !pendingChanges()) return
  const state = useWorkspace.getState()
  if (!confirmOverwrite(state.activeFile)) return
  if (isDirtyState(state.document, state.original)) await state.saveAndReload()
  else await state.reloadKitty()
  useOverlays.getState().markLayoutSaved()
}

export function useSaveDocument(after?: () => Promise<void>) {
  const discardConfig = useWorkspace((state) => state.discard)
  const toast = useWorkspace((state) => state.toast)
  const dirty = useDirty()
  const save = async () => {
    try {
      await confirmAndSave()
      if (!useOverlays.getState().layoutDirty) await after?.()
    } catch (error) {
      toast(`Save failed:\n${String(error)}`)
    }
  }
  const discard = () => {
    discardConfig()
    useOverlays.getState().revertLayout()
  }
  return { dirty, discard, save }
}
