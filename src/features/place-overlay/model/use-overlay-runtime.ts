import { useEffect } from 'react'
import { activeLayout } from '@/entities/appearance'
import { useOverlays } from '@/entities/overlay'
import { envValue, removeEnv, removeValue, setValue, upsertEnv, useWorkspace, valuesOf } from '@/entities/workspace'
import { backend, isTauri } from '@/shared/api'

export function useOverlayRuntime() {
  const images = useOverlays((state) => state.images)
  const widgets = useOverlays((state) => state.widgets)
  const stageWidth = useOverlays((state) => state.stageWidth)
  const stageHeight = useOverlays((state) => state.stageHeight)
  const background = useWorkspace((state) => valuesOf(state.document, 'background').at(-1) ?? '')
  const setImageUrl = useOverlays((state) => state.setImageUrl)
  const loading = useWorkspace((state) => state.loading)
  const updateDocument = useWorkspace((state) => state.updateDocument)
  const toast = useWorkspace((state) => state.toast)

  useEffect(() => {
    if (!isTauri() || loading) return
    for (const image of images) {
      if (image.url || !image.path.startsWith('/')) continue
      void backend.imagePreview(image.path).then((url) => setImageUrl(image.id, url)).catch(() => setImageUrl(image.id, ''))
    }
  }, [images, loading, setImageUrl])

  useEffect(() => {
    if (!isTauri() || loading) return
    const timer = window.setTimeout(() => {
      const persistentImages = images
        .filter((image) => image.path.startsWith('/'))
        .map(({ url: _url, ...image }) => image)
      void backend.applyOverlays({ images: persistentImages, widgets, stageWidth, stageHeight, background }).then((result) => {
        updateDocument((document) => {
          const hasOverlays = persistentImages.length + widgets.length > 0
          if (!hasOverlays) {
            removeEnv(document, 'KITTY_BUILDER_SHELL')
            const shell = valuesOf(document, 'shell').at(-1) ?? ''
            if (shell.includes('builder-shell')) removeValue(document, 'shell')
            if ((valuesOf(document, 'startup_session').at(-1) ?? '').includes('overlays.session')) removeValue(document, 'startup_session')
            return
          }
          const shell = valuesOf(document, 'shell').at(-1) ?? ''
          const floatImages = widgets.length === 0 && persistentImages.length > 0
          if (floatImages && shell.includes('builder-shell')) {
            const original = envValue(document, 'KITTY_BUILDER_SHELL') || '/bin/zsh'
            setValue(document, 'shell', original)
          } else if (!floatImages && !shell.includes('builder-shell')) {
            const original = envValue(document, 'KITTY_BUILDER_SHELL') || shell.trim().split(/\s+/)[0] || '/bin/zsh'
            upsertEnv(document, 'KITTY_BUILDER_SHELL', original)
            setValue(document, 'shell', `"${result.shellPath.replaceAll('"', '')}"`)
          }
          if (widgets.length > 0 || persistentImages.length > 0) setValue(document, 'startup_session', result.sessionPath)
          else if ((valuesOf(document, 'startup_session').at(-1) ?? '').includes('overlays.session')) {
            const layout = activeLayout(valuesOf(document, 'enabled_layouts').at(-1) ?? 'custom')
            setValue(document, 'startup_session', `sessions/${layout}.session`)
          }
        })
      }).catch((error) => toast(String(error)))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [background, images, loading, stageHeight, stageWidth, widgets, toast, updateDocument])
}
