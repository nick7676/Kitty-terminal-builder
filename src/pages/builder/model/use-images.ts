import { useCallback, useEffect, useRef, useState } from 'react'
import { kittyString, plainPath } from '@/entities/appearance'
import { envValue, removeEnv, setValue, upsertEnv, useWorkspace, valuesOf } from '@/entities/workspace'
import { useOption } from '@/features/edit-option'
import { backend, isTauri } from '@/shared/api'
import { swapBlob } from '@/shared/lib'

type ImageSize = { w: number; h: number }

function cellsFor(size: ImageSize) {
  return { cols: Math.min(80, Math.max(6, Math.round(size.w / 9))), rows: Math.min(40, Math.max(4, Math.round(size.h / 20))) }
}

function storedSize(): ImageSize {
  try {
    const saved = JSON.parse(localStorage.getItem('kitty-builder-pane-size') ?? '') as ImageSize
    if (saved.w > 0 && saved.h > 0) return saved
  } catch { /* keep the default size */ }
  return { w: 220, h: 160 }
}

export function useBuilderImages() {
  const status = useWorkspace((state) => state.status)
  const editValue = useWorkspace((state) => state.editValue)
  const updateDocument = useWorkspace((state) => state.updateDocument)
  const resetKeys = useWorkspace((state) => state.resetKeys)
  const toast = useWorkspace((state) => state.toast)
  const imagePath = useOption('background_image', 'none')
  const fileRef = useRef<HTMLInputElement>(null)
  const paneFileRef = useRef<HTMLInputElement>(null)
  const [remoteImage, setRemoteImage] = useState('')
  const [localImage, setLocalImage] = useState('')
  const [panePath, setPanePath] = useState(() => localStorage.getItem('kitty-builder-pane-image') ?? '')
  const [paneUrl, setPaneUrl] = useState('')
  const [paneSize, setPaneSize] = useState<ImageSize>(storedSize)
  const configuredImage = plainPath(imagePath.raw)

  useEffect(() => {
    if (!isTauri() || !configuredImage.startsWith('/')) {
      setRemoteImage('')
      return
    }
    let cancel = false
    void backend.imagePreview(configuredImage).then((url) => {
      if (!cancel) setRemoteImage(url)
    }).catch(() => {
      if (!cancel) setRemoteImage('')
    })
    return () => { cancel = true }
  }, [configuredImage])

  useEffect(() => {
    if (!panePath || panePath.startsWith('blob:')) {
      setPaneUrl(panePath)
      return
    }
    if (!isTauri()) return
    let cancel = false
    void backend.imagePreview(panePath).then((url) => {
      if (!cancel) setPaneUrl(url)
    }).catch(() => {
      if (!cancel) setPaneUrl('')
    })
    return () => { cancel = true }
  }, [panePath])

  const chooseImage = async () => {
    try {
      if (!isTauri()) {
        fileRef.current?.click()
        return
      }
      const selected = await backend.pickImage()
      if (selected) editValue('background_image', kittyString(selected))
    } catch (error) {
      toast(String(error))
    }
  }
  const installPaneImage = useCallback(async (selected: string, announce = true) => {
    const configDir = status?.configDir
    if (!isTauri() || !configDir) {
      setPanePath(selected)
      return
    }
    const kitten = status?.kittyPath?.replace(/kitty$/, 'kitten') || 'kitten'
    const script = `#!/bin/sh\nimage="\${KITTY_BUILDER_PANE_IMAGE:-}"\nimage="\${image#\\"}"\nimage="\${image%\\"}"\ncols="\${KITTY_BUILDER_PANE_COLS:-24}"\nrows="\${KITTY_BUILDER_PANE_ROWS:-12}"\nreal="\${KITTY_BUILDER_SHELL:-/bin/zsh}"\nkitten='${kitten.replaceAll("'", '')}'\nif [ -n "$image" ] && [ -f "$image" ]; then\n  if [ ! -x "$kitten" ]; then kitten=kitten; fi\n  "$kitten" icat --stdin=no --align left --scale-up --place "\${cols}x\${rows}@0x1" "$image" || true\nfi\nexec "$real" -l\n`
    await backend.write('builder-shell', script)
    updateDocument((document) => {
      upsertEnv(document, 'KITTY_BUILDER_PANE_IMAGE', selected)
      const { cols, rows } = cellsFor(paneSize)
      upsertEnv(document, 'KITTY_BUILDER_PANE_COLS', String(cols))
      upsertEnv(document, 'KITTY_BUILDER_PANE_ROWS', String(rows))
      const shell = valuesOf(document, 'shell').at(-1) ?? ''
      if (!shell.includes('builder-shell')) {
        if (shell.trim()) upsertEnv(document, 'KITTY_BUILDER_SHELL', shell.trim().split(/\s+/)[0] ?? shell.trim())
        setValue(document, 'shell', `/bin/sh ${configDir}/builder-shell`)
      }
    })
    localStorage.setItem('kitty-builder-pane-image', selected)
    setPanePath(selected)
    if (announce) toast('Image added. Save, then open a new kitty window.')
  }, [paneSize, status?.configDir, status?.kittyPath, toast, updateDocument])
  const installedPane = useRef('')
  useEffect(() => {
    if (!isTauri() || !status?.configDir || !panePath || panePath.startsWith('blob:') || installedPane.current === panePath) return
    if (envValue(useWorkspace.getState().document, 'KITTY_BUILDER_PANE_IMAGE') === panePath) {
      installedPane.current = panePath
      return
    }
    installedPane.current = panePath
    void installPaneImage(panePath, false).catch((error) => toast(String(error)))
  }, [panePath, status?.configDir, installPaneImage, toast])
  const choosePaneImage = async () => {
    try {
      if (!isTauri()) {
        paneFileRef.current?.click()
        return
      }
      const selected = await backend.pickImage()
      if (selected) await installPaneImage(selected)
    } catch (error) {
      toast(String(error))
    }
  }
  const resizePane = (width: number, height: number, done: boolean) => {
    const next = { w: width, h: height }
    setPaneSize(next)
    if (!done) return
    localStorage.setItem('kitty-builder-pane-size', JSON.stringify(next))
    const { cols, rows } = cellsFor(next)
    updateDocument((document) => {
      upsertEnv(document, 'KITTY_BUILDER_PANE_COLS', String(cols))
      upsertEnv(document, 'KITTY_BUILDER_PANE_ROWS', String(rows))
    })
  }
  const clearPaneImage = () => {
    localStorage.removeItem('kitty-builder-pane-image')
    if (panePath.startsWith('blob:')) URL.revokeObjectURL(panePath)
    setPanePath('')
    setPaneUrl('')
    updateDocument((document) => {
      removeEnv(document, 'KITTY_BUILDER_PANE_IMAGE')
      removeEnv(document, 'KITTY_BUILDER_PANE_COLS')
      removeEnv(document, 'KITTY_BUILDER_PANE_ROWS')
      removeEnv(document, 'KITTY_BUILDER_SHELL')
      document.nodes = document.nodes.filter((node) => node.type !== 'directive' || node.key !== 'shell' || !node.value.includes('builder-shell'))
    })
  }

  return {
    imagePath,
    previewUrl: remoteImage || localImage,
    paneUrl,
    panePath,
    paneSize,
    fileRef,
    paneFileRef,
    chooseImage,
    choosePaneImage,
    clearBackground: () => { resetKeys(['background_image']); setLocalImage(''); setRemoteImage('') },
    clearPaneImage,
    resizePane,
    onLocalFile: (file: File) => setLocalImage((current) => swapBlob(current, file)),
    onPaneFile: (file: File) => setPanePath((current) => swapBlob(current, file)),
  }
}
