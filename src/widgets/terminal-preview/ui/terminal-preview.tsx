import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ansiSlots, cssColor, presets } from '@/entities/appearance'
import type { LayoutNode } from '@/entities/appearance'
import { overlayInsets, useOverlays, type TerminalWidget } from '@/entities/overlay'
import { useWorkspace, valuesOf } from '@/entities/workspace'
import { useOption } from '@/features/edit-option'
import { OverlayFrame } from '@/features/place-overlay'

function imageFit(layout: string) {
  if (layout === 'centered' || layout === 'clamped') return 'contain'
  if (layout === 'tiled' || layout === 'mirror-tiled') return 'tile'
  return 'cover'
}

function EditorPane({ caret }: { caret: string }) {
  const lines = [
    ['c-magenta', 'set -gx EDITOR nvim'],
    ['c-cyan', 'set fish_color_command brcyan'],
    ['c-dim', '# greeting pictures via kitty icat'],
    ['', 'function fish_greeting'],
    ['c-yellow', '  kitty icat --align=left ~/pictures'],
    ['', 'end'],
  ]
  return (
    <section className="pane pane-main editor-mock">
      {lines.map(([tone, text], index) => <p key={text}><span className="ln">{index + 1}</span><span className={tone}>{text}</span></p>)}
      <p className="prompt-line"><span className="c-green">~/config</span> fish<span className={caret} /></p>
    </section>
  )
}

function PicturePane() {
  const count = useOverlays((state) => state.images.length)
  return <section className="pane"><p className="c-dim">{count ? `${count} image overlay${count === 1 ? '' : 's'}` : '$'}</p></section>
}

function PromptPane({ title }: { title: string }) {
  return (
    <section className="pane">
      <p className="c-cyan">{title}</p>
      <p><span className="c-green">$</span> <span className="c-dim">ready</span></p>
    </section>
  )
}

function FetchPane({ dots, caret }: { dots: { key: string; effective: string }[]; caret: string }) {
  const rows = [
    ['c-red', 'os', 'this machine'],
    ['c-green', 'wm', 'kitty'],
    ['c-yellow', 'font', 'monospace'],
    ['c-blue', 'term', 'xterm-kitty'],
  ]
  return (
    <section className="pane fetch">
      <div>
        <p><b>builder</b><span className="c-dim">@kitty</span></p>
        {rows.map(([tone, label, value]) => <p key={label}><span className={tone}>{label}</span> {value}</p>)}
        <div className="term-palette">{dots.slice(0, 8).map((dot) => <i key={dot.key} style={{ background: cssColor(dot.effective, '#888') }} />)}</div>
        <p className="prompt-line"><span className="c-cyan">~</span> $<span className={caret} /></p>
      </div>
    </section>
  )
}

function WidgetBody({ widget }: { widget: TerminalWidget }) {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    if (widget.kind !== 'clock') return
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [widget.kind])
  const metric = widget.kind === 'cpu' ? '38%' : widget.kind === 'memory' ? '61%' : widget.kind === 'disk' ? '47%' : time.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !widget.clock24,
  })
  return <div className="terminal-widget" style={{ color: widget.foreground, background: widget.background }}><small>{widget.label}</small><b>{metric}</b></div>
}

function OverlayLayers({ pinned }: { pinned: boolean }) {
  const images = useOverlays((state) => state.images)
  const widgets = useOverlays((state) => state.widgets)
  const updatePlacement = useOverlays((state) => state.updatePlacement)
  return (
    <>
      {images.filter((image) => image.placement.pinned === pinned).map((image) => (
        <OverlayFrame key={image.id} placement={image.placement} onChange={(next) => updatePlacement(image.id, next)}>
          {image.url ? <img className="overlay-image" src={image.url} alt="" /> : <div className="overlay-missing">Image unavailable</div>}
        </OverlayFrame>
      ))}
      {widgets.filter((widget) => widget.placement.pinned === pinned).map((widget) => (
        <OverlayFrame key={widget.id} placement={widget.placement} onChange={(next) => updatePlacement(widget.id, next)}>
          <WidgetBody widget={widget} />
        </OverlayFrame>
      ))}
    </>
  )
}

function SplitView({ node, selected, onSelect, onRatio, onCommit, caret, dots }: {
  node: LayoutNode
  selected: string
  onSelect: (id: string) => void
  onRatio: (id: string, ratio: number) => void
  onCommit: () => void
  caret: string
  dots: { key: string; effective: string }[]
}) {
  if (node.kind === 'pane') {
    const body = node.label === 'editor' ? <EditorPane caret={caret} /> : node.label === 'image' ? <PicturePane /> : node.label === 'fetch' ? <FetchPane dots={dots} caret={caret} /> : <PromptPane title={node.label} />
    return <div className={`pane-wrap ${selected === node.id ? 'selected' : ''}`} onClick={() => onSelect(node.id)}>{body}</div>
  }
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds) return
    const move = (pointer: PointerEvent) => {
      const raw = node.axis === 'x' ? (pointer.clientX - bounds.left) / bounds.width : (pointer.clientY - bounds.top) / bounds.height
      onRatio(node.id, Math.min(0.85, Math.max(0.15, raw)))
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      onCommit()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  return (
    <div className={`split axis-${node.axis}`}>
      <div className="split-slot" style={{ flexBasis: `${node.ratio * 100}%` }}>
        <SplitView node={node.first} selected={selected} onSelect={onSelect} onRatio={onRatio} onCommit={onCommit} caret={caret} dots={dots} />
      </div>
      <div className={`split-handle ${node.axis}`} onPointerDown={start} />
      <div className="split-slot grow">
        <SplitView node={node.second} selected={selected} onSelect={onSelect} onRatio={onRatio} onCommit={onCommit} caret={caret} dots={dots} />
      </div>
    </div>
  )
}

export function TerminalPreview({ imageUrl, tree, selected, onSelect, onRatio, onCommit }: {
  imageUrl: string
  tree: LayoutNode
  selected: string
  onSelect: (id: string) => void
  onRatio: (id: string, ratio: number) => void
  onCommit: () => void
}) {
  const background = useOption('background', '#000000')
  const foreground = useOption('foreground', '#dddddd')
  const cursor = useOption('cursor', '#cccccc')
  const shape = useOption('cursor_shape', 'block')
  const blink = useOption('cursor_blink_interval', '-1')
  const font = useOption('font_family', 'monospace')
  const size = useOption('font_size', '11')
  const opacity = useOption('background_opacity', '1')
  const blur = useOption('background_blur', '0')
  const tint = useOption('background_tint', '0')
  const padding = useOption('window_padding_width', '0')
  const tabStyle = useOption('tab_bar_style', 'fade')
  const tabEdge = useOption('tab_bar_edge', 'bottom')
  const decorations = useOption('hide_window_decorations', 'no')
  const imageLayout = useOption('background_image_layout', 'tiled')
  const activeTab = useOption('active_tab_background', '#eeeeee')
  const activeTabText = useOption('active_tab_foreground', '#000000')
  const inactiveTab = useOption('inactive_tab_background', '#999999')
  const inactiveTabText = useOption('inactive_tab_foreground', '#444444')
  const document = useWorkspace((state) => state.document)
  const overlayImages = useOverlays((state) => state.images)
  const terminalWidgets = useOverlays((state) => state.widgets)
  const classic = presets[0]?.values ?? {}
  const ansi = ansiSlots.map(([key, label]) => {
    const raw = valuesOf(document, key).at(-1) ?? ''
    const fallback = classic[key] ?? '#888888'
    return { key, label, effective: raw.trim() ? raw : fallback }
  })
  const color = (slot: string, fallback: string) => cssColor(ansi.find((item) => item.key === slot)?.effective, fallback)
  const fontSize = Math.min(18, Math.max(11, Number.parseFloat(size.effective) || 13))
  const hiddenTabs = tabStyle.effective === 'hidden' || (tree.kind === 'pane' && tree.label === 'fetch' && tabStyle.effective !== 'custom')
  const textTabs = tabStyle.effective === 'custom' || tabStyle.effective === 'fade' || tabStyle.effective === 'separator'
  const art = Boolean(imageUrl)
  const caret = `caret shape-${shape.effective} ${blink.effective === '0' ? 'still' : ''}`
  const insets = overlayInsets([...overlayImages.map((item) => item.placement), ...terminalWidgets.map((item) => item.placement)])
  const stageRef = useRef<HTMLDivElement>(null)
  const setStage = useOverlays((state) => state.setStage)
  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const publish = () => {
      const rect = node.getBoundingClientRect()
      if (rect.width > 40 && rect.height > 40) setStage(rect.width, rect.height)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(node)
    return () => observer.disconnect()
  }, [setStage])

  return (
    <div className="preview-stage">
        <div
          className={`term style-${tabStyle.effective} edge-${tabEdge.effective} ${decorations.effective === 'yes' ? 'frameless' : ''} ${art ? 'has-art' : ''} fit-${imageFit(imageLayout.effective)}`}
          style={{
            ['--term-bg' as string]: cssColor(background.effective, '#000000'),
            ['--term-fg' as string]: cssColor(foreground.effective, '#dddddd'),
            ['--term-cursor' as string]: cssColor(cursor.effective, '#cccccc'),
            ['--term-opacity' as string]: String(Math.min(1, Math.max(0.2, Number.parseFloat(opacity.effective) || 1))),
            ['--term-blur' as string]: `${Math.max(0, Number.parseFloat(blur.effective) || 0)}px`,
            ['--term-tint' as string]: String(Math.min(0.85, Math.max(0, Number.parseFloat(tint.effective) || 0))),
            ['--term-pad' as string]: `${Math.min(28, Math.max(4, Number.parseFloat(padding.effective) || 8))}px`,
            ['--term-font' as string]: font.effective === 'monospace' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : `"${font.effective}", ui-monospace, monospace`,
            ['--term-size' as string]: `${fontSize}px`,
            ['--tab-active' as string]: cssColor(activeTab.effective, '#eeeeee'),
            ['--tab-active-text' as string]: cssColor(activeTabText.effective, '#000000'),
            ['--tab-idle' as string]: cssColor(inactiveTab.effective, '#999999'),
            ['--tab-idle-text' as string]: cssColor(inactiveTabText.effective, '#444444'),
            ['--ansi-green' as string]: color('color2', '#19cb00'),
            ['--ansi-yellow' as string]: color('color3', '#cecb00'),
            ['--ansi-blue' as string]: color('color4', '#0d73cc'),
            ['--ansi-magenta' as string]: color('color5', '#cb1ed1'),
            ['--ansi-cyan' as string]: color('color6', '#0dcdcd'),
            ['--ansi-dim' as string]: color('color8', '#767676'),
            ['--ansi-red' as string]: color('color1', '#cc0403'),
          }}
        >
          <div className="term-chrome"><span /><span /><span /><b>kitty</b></div>
          {hiddenTabs ? null : textTabs ? (
            <div className="term-tabs text">
              <span className="term-tab active">1 fish</span><span className="sep">·</span>
              <span className="term-tab">2 dotfiles</span><span className="sep">·</span>
              <span className="term-tab">3 nvim</span>
              <span className="tab-badges"><i style={{ background: color('color5', '#c9a6f2') }}>tall</i><i style={{ background: color('color2', '#8fd4b0') }}>studio</i></span>
            </div>
          ) : (
            <div className="term-tabs">
              <span className="term-tab active">fish</span>
              <span className="term-tab">dotfiles</span>
              <span className="term-tab">nvim</span>
            </div>
          )}
          <div ref={stageRef} className="term-canvas overlay-stage" style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}>
            <div className="term-wash" />
            <div className="terminal-scroll-layer" style={{ paddingLeft: insets.left, paddingRight: insets.right, paddingTop: insets.top, paddingBottom: insets.bottom }}>
              <SplitView node={tree} selected={selected} onSelect={onSelect} onRatio={onRatio} onCommit={onCommit} caret={caret} dots={ansi} />
              <OverlayLayers pinned={false} />
            </div>
            <OverlayLayers pinned />
          </div>
        </div>
    </div>
  )
}
