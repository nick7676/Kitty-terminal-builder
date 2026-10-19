import { create } from 'zustand'

export type OverlayEdge = 'left' | 'right' | 'top' | 'bottom'

export interface Placement {
  id: string
  x: number
  y: number
  w: number
  h: number
  pinned: boolean
  edge: OverlayEdge
}

export interface OverlayImage {
  id: string
  path: string
  url: string
  placement: Placement
}

export type WidgetKind = 'clock' | 'cpu' | 'memory' | 'disk'

export interface TerminalWidget {
  id: string
  kind: WidgetKind
  label: string
  foreground: string
  background: string
  clock24: boolean
  placement: Placement
}

export const widgetCatalog: readonly { kind: WidgetKind; label: string; description: string }[] = [
  { kind: 'clock', label: 'Clock', description: 'Current local time' },
  { kind: 'cpu', label: 'CPU', description: 'Processor utilization' },
  { kind: 'memory', label: 'Memory', description: 'Memory utilization' },
  { kind: 'disk', label: 'Disk', description: 'Root disk utilization' },
]

const placement = (id: string, pinned: boolean): Placement => ({
  id, x: pinned ? 560 : 24, y: 24, w: pinned ? 190 : 220, h: pinned ? 92 : 160, pinned, edge: 'right',
})

export function closestEdge(value: Placement, width: number, height: number): OverlayEdge {
  const distances: [OverlayEdge, number][] = [
    ['left', value.x],
    ['right', width - value.x - value.w],
    ['top', value.y],
    ['bottom', height - value.y - value.h],
  ]
  return distances.sort((left, right) => left[1] - right[1])[0]?.[0] ?? 'right'
}

export function normalizePlacement(value: Placement, width: number, height: number): Placement {
  const w = Math.min(Math.max(80, value.w), Math.max(80, width))
  const h = Math.min(Math.max(56, value.h), Math.max(56, height))
  const x = Math.min(Math.max(0, value.x), Math.max(0, width - w))
  const y = Math.min(Math.max(0, value.y), Math.max(0, height - h))
  const edge = value.pinned ? closestEdge({ ...value, x, y, w, h }, width, height) : value.edge
  if (!value.pinned) return { ...value, x, y, w, h, edge }
  if (edge === 'left') return { ...value, x: 0, y, w, h, edge }
  if (edge === 'right') return { ...value, x: width - w, y, w, h, edge }
  if (edge === 'top') return { ...value, x, y: 0, w, h, edge }
  return { ...value, x, y: height - h, w, h, edge }
}

type PersistedState = { images: Omit<OverlayImage, 'url'>[]; widgets: TerminalWidget[]; stageWidth?: number; stageHeight?: number }

function loadState(): PersistedState {
  try {
    const saved = JSON.parse(localStorage.getItem('kitty-builder-overlays') ?? '') as PersistedState
    if (Array.isArray(saved.images) && Array.isArray(saved.widgets)) return saved
  } catch { /* migrate or use defaults */ }
  const legacy = localStorage.getItem('kitty-builder-pane-image')
  if (!legacy) return { images: [], widgets: [] }
  const id = crypto.randomUUID()
  return { images: [{ id, path: legacy, placement: placement(id, false) }], widgets: [] }
}

const initial = loadState()

interface OverlayState {
  images: OverlayImage[]
  widgets: TerminalWidget[]
  savedImages: Omit<OverlayImage, 'url'>[]
  savedWidgets: TerminalWidget[]
  layoutDirty: boolean
  addImage: (path: string, url?: string) => void
  setImagePath: (id: string, path: string) => void
  removeImage: (id: string) => void
  addWidget: (kind: WidgetKind) => void
  removeWidget: (id: string) => void
  updatePlacement: (id: string, next: Placement) => void
  updateWidget: (id: string, patch: Partial<Omit<TerminalWidget, 'id' | 'placement'>>) => void
  setImageUrl: (id: string, url: string) => void
  stageWidth: number
  stageHeight: number
  setStage: (width: number, height: number) => void
  markLayoutSaved: () => void
  revertLayout: () => void
}

function samePlacement(left: Placement, right: Placement) {
  return left.x === right.x && left.y === right.y && left.w === right.w && left.h === right.h && left.pinned === right.pinned && left.edge === right.edge
}

function persist(images: OverlayImage[], widgets: TerminalWidget[], stageWidth: number, stageHeight: number) {
  localStorage.setItem('kitty-builder-overlays', JSON.stringify({
    images: images.map(({ url: _url, ...image }) => image),
    widgets,
    stageWidth,
    stageHeight,
  }))
}

const loadedImages = initial.images.map((image) => ({ ...image, url: image.path.startsWith('blob:') ? image.path : '' }))

export const useOverlays = create<OverlayState>((set) => ({
  images: loadedImages,
  widgets: initial.widgets,
  savedImages: initial.images,
  savedWidgets: initial.widgets,
  layoutDirty: false,
  stageWidth: initial.stageWidth ?? 0,
  stageHeight: initial.stageHeight ?? 0,
  addImage: (path, url = '') => set((state) => {
    const id = crypto.randomUUID()
    const images = [...state.images, { id, path, url, placement: placement(id, false) }]
    persist(images, state.widgets, state.stageWidth, state.stageHeight)
    return { images, layoutDirty: true }
  }),
  setImagePath: (id, path) => set((state) => {
    const images = state.images.map((image) => image.id === id ? { ...image, path, url: '' } : image)
    persist(images, state.widgets, state.stageWidth, state.stageHeight)
    return { images, layoutDirty: true }
  }),
  removeImage: (id) => set((state) => {
    const removed = state.images.find((image) => image.id === id)
    if (removed?.url.startsWith('blob:')) URL.revokeObjectURL(removed.url)
    const images = state.images.filter((image) => image.id !== id)
    persist(images, state.widgets, state.stageWidth, state.stageHeight)
    return { images, layoutDirty: true }
  }),
  addWidget: (kind) => set((state) => {
    const id = crypto.randomUUID()
    const metadata = widgetCatalog.find((item) => item.kind === kind)
    const widgets = [...state.widgets, {
      id, kind, label: metadata?.label ?? kind, foreground: '#f3e9fb', background: '#21182a',
      clock24: true, placement: placement(id, true),
    }]
    persist(state.images, widgets, state.stageWidth, state.stageHeight)
    return { widgets, layoutDirty: true }
  }),
  removeWidget: (id) => set((state) => {
    const widgets = state.widgets.filter((widget) => widget.id !== id)
    persist(state.images, widgets, state.stageWidth, state.stageHeight)
    return { widgets, layoutDirty: true }
  }),
  updatePlacement: (id, next) => set((state) => {
    const current = [...state.images, ...state.widgets].find((item) => item.id === id)
    if (current && samePlacement(current.placement, next)) return state
    const images = state.images.map((image) => image.id === id ? { ...image, placement: next } : image)
    const widgets = state.widgets.map((widget) => widget.id === id ? { ...widget, placement: next } : widget)
    persist(images, widgets, state.stageWidth, state.stageHeight)
    return { images, widgets, layoutDirty: true }
  }),
  updateWidget: (id, patch) => set((state) => {
    const widgets = state.widgets.map((widget) => widget.id === id ? { ...widget, ...patch } : widget)
    persist(state.images, widgets, state.stageWidth, state.stageHeight)
    return { widgets, layoutDirty: true }
  }),
  setImageUrl: (id, url) => set((state) => ({
    images: state.images.map((image) => image.id === id ? { ...image, url } : image),
  })),
  setStage: (width, height) => set((state) => {
    const stageWidth = Math.round(width)
    const stageHeight = Math.round(height)
    if (Math.abs(state.stageWidth - stageWidth) < 4 && Math.abs(state.stageHeight - stageHeight) < 4) return state
    persist(state.images, state.widgets, stageWidth, stageHeight)
    return { stageWidth, stageHeight }
  }),
  markLayoutSaved: () => set((state) => ({
    layoutDirty: false,
    savedImages: state.images.map(({ url: _url, ...image }) => image),
    savedWidgets: state.widgets,
  })),
  revertLayout: () => set((state) => {
    const images = state.savedImages.map((image) => ({
      ...image,
      url: state.images.find((item) => item.id === image.id)?.url ?? (image.path.startsWith('blob:') ? image.path : ''),
    }))
    persist(images, state.savedWidgets, state.stageWidth, state.stageHeight)
    return { images, widgets: state.savedWidgets, layoutDirty: false }
  }),
}))

export function overlayInsets(items: Placement[]) {
  return items.filter((item) => item.pinned).reduce((result, item) => ({
    ...result,
    [item.edge]: Math.max(result[item.edge], item.edge === 'left' || item.edge === 'right' ? item.w : item.h),
  }), { left: 0, right: 0, top: 0, bottom: 0 })
}
