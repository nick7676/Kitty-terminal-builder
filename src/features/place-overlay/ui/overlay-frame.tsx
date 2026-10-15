import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { normalizePlacement, type Placement } from '@/entities/overlay'

export function OverlayFrame({ placement, selected = false, children, onChange, onSelect }: {
  placement: Placement
  selected?: boolean
  children: ReactNode
  onChange: (placement: Placement, done: boolean) => void
  onSelect?: () => void
}) {
  const bounds = (target: HTMLElement) => target.closest<HTMLElement>('.overlay-stage')?.getBoundingClientRect()
  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, .overlay-resize')) return
    event.preventDefault()
    onSelect?.()
    const box = bounds(event.currentTarget)
    if (!box) return
    const origin = { x: event.clientX, y: event.clientY, left: placement.x, top: placement.y }
    const move = (pointer: PointerEvent) => onChange(normalizePlacement({
      ...placement,
      x: origin.left + pointer.clientX - origin.x,
      y: origin.top + pointer.clientY - origin.y,
    }, box.width, box.height), false)
    const stop = (pointer: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      move(pointer)
      onChange(normalizePlacement({
        ...placement,
        x: origin.left + pointer.clientX - origin.x,
        y: origin.top + pointer.clientY - origin.y,
      }, box.width, box.height), true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const box = bounds(event.currentTarget)
    if (!box) return
    const origin = { x: event.clientX, y: event.clientY, w: placement.w, h: placement.h }
    const next = (pointer: PointerEvent) => normalizePlacement({
      ...placement,
      w: origin.w + pointer.clientX - origin.x,
      h: origin.h + pointer.clientY - origin.y,
    }, box.width, box.height)
    const move = (pointer: PointerEvent) => onChange(next(pointer), false)
    const stop = (pointer: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      onChange(next(pointer), true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  return (
    <div
      className={`overlay-frame ${placement.pinned ? 'pinned' : 'flowing'} ${selected ? 'selected-overlay' : ''}`}
      style={{ left: placement.x, top: placement.y, width: placement.w, height: placement.h }}
      onPointerDown={drag}
    >
      <button
        className="overlay-pin"
        type="button"
        title={placement.pinned ? 'Unpin' : 'Pin to nearest edge'}
        onClick={() => {
          const stage = document.querySelector<HTMLElement>('.overlay-stage')
          const rect = stage?.getBoundingClientRect()
          const next = { ...placement, pinned: !placement.pinned }
          onChange(rect ? normalizePlacement(next, rect.width, rect.height) : next, true)
        }}
      >{placement.pinned ? '●' : '○'}</button>
      {children}
      <div className="overlay-resize" onPointerDown={resize} />
    </div>
  )
}
