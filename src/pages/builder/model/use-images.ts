import { useEffect, useRef, useState } from 'react'
import { kittyString, plainPath } from '@/entities/appearance'
import { useOverlays } from '@/entities/overlay'
import { useWorkspace } from '@/entities/workspace'
import { useOption } from '@/features/edit-option'
import { backend, isTauri } from '@/shared/api'
import { swapBlob } from '@/shared/lib'

export function useBuilderImages() {
  const editValue = useWorkspace((state) => state.editValue)
  const resetKeys = useWorkspace((state) => state.resetKeys)
  const toast = useWorkspace((state) => state.toast)
  const overlayImages = useOverlays((state) => state.images)
  const addImage = useOverlays((state) => state.addImage)
  const setImagePath = useOverlays((state) => state.setImagePath)
  const removeImage = useOverlays((state) => state.removeImage)
  const imagePath = useOption('background_image', 'none')
  const fileRef = useRef<HTMLInputElement>(null)
  const paneFileRef = useRef<HTMLInputElement>(null)
  const [remoteImage, setRemoteImage] = useState('')
  const [localImage, setLocalImage] = useState('')
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

  const keyGreenscreen = async (mode: 'background' | 'overlay') => {
    if (!isTauri()) {
      toast('Removing a greenscreen requires the desktop app')
      return ''
    }
    const selected = await backend.pickGreenscreen()
    if (!selected) return ''
    toast('Removing the backdrop…')
    return backend.removeGreenscreen(selected, mode)
  }
  const removeGreenscreen = async () => {
    try {
      const keyed = await keyGreenscreen('background')
      if (!keyed) return
      editValue('background_image', kittyString(keyed))
      editValue('background_image_layout', 'clamped')
      editValue('background_tint', '0')
      toast('Greenscreen removed. Save & reload, then open a new Kitty window.')
    } catch (error) {
      toast(String(error))
    }
  }
  const addKeyedImage = async () => {
    try {
      const keyed = await keyGreenscreen('overlay')
      if (!keyed) return
      addImage(keyed)
      toast('Movable image added. Drag it in the preview, then save.')
    } catch (error) {
      toast(String(error))
    }
  }
  const keyExistingImage = async (id: string, path: string) => {
    try {
      if (!path.startsWith('/')) {
        toast('This image has no file to key')
        return
      }
      toast('Removing the backdrop…')
      const keyed = await backend.removeGreenscreen(path, 'overlay')
      setImagePath(id, keyed)
      toast('Greenscreen removed from the movable image.')
    } catch (error) {
      toast(String(error))
    }
  }
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
  const choosePaneImage = async () => {
    try {
      if (!isTauri()) {
        paneFileRef.current?.click()
        return
      }
      const selected = await backend.pickImage()
      if (selected) addImage(selected)
    } catch (error) {
      toast(String(error))
    }
  }
  return {
    imagePath,
    previewUrl: remoteImage || localImage,
    overlayImages,
    fileRef,
    paneFileRef,
    chooseImage,
    removeGreenscreen,
    addKeyedImage,
    keyExistingImage,
    choosePaneImage,
    clearBackground: () => { resetKeys(['background_image']); setLocalImage(''); setRemoteImage('') },
    removeImage,
    onLocalFile: (file: File) => setLocalImage((current) => swapBlob(current, file)),
    onPaneFile: (file: File) => {
      const url = URL.createObjectURL(file)
      addImage(url, url)
    },
  }
}
