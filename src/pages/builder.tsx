import { useEffect, useRef, useState } from 'react'
import tabBarPy from '../../scripts/studio-tab-bar.py?raw'
import { backend, isTauri } from '../core/tauri'
import { envValue, removeEnv, setValue, upsertEnv, valuesOf } from '../core/document'
import {
  activeLayout, ansiSlots, blinkChoices, cssColor, cursorShapes, fontChoices, imageLayouts, kittyString, layoutOrder,
  plainPath, presets, scenes, styleKeys, surfaceSlots, tabStyles, themeKeys, windowLayouts,
} from '../data/appearance'
import { isDirtyState, useWorkspace } from '../store/workspace'

function useOption(key: string, fallback: string) {
  const document = useWorkspace((state) => state.document)
  const raw = valuesOf(document, key).at(-1) ?? ''
  return { raw, effective: raw.trim() ? raw : fallback }
}

function imageFit(layout: string) {
  if (layout === 'centered' || layout === 'clamped') return 'contain'
  if (layout === 'tiled' || layout === 'mirror-tiled') return 'tile'
  return 'cover'
}

function TerminalPreview({ imageUrl, paneUrl }: { imageUrl: string; paneUrl: string }) {
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
  const layouts = useOption('enabled_layouts', 'tall')
  const activeTab = useOption('active_tab_background', '#eeeeee')
  const activeTabText = useOption('active_tab_foreground', '#000000')
  const inactiveTab = useOption('inactive_tab_background', '#999999')
  const inactiveTabText = useOption('inactive_tab_foreground', '#444444')
  const document = useWorkspace((state) => state.document)
  const classic = presets[0]?.values ?? {}
  const ansi = ansiSlots.map(([key, label]) => {
    const raw = valuesOf(document, key).at(-1) ?? ''
    const fallback = classic[key] ?? '#888888'
    return { key, label, effective: raw.trim() ? raw : fallback }
  })
  const color = (slot: string, fallback: string) => cssColor(ansi.find((item) => item.key === slot)?.effective, fallback)
  const layout = activeLayout(layouts.effective)
  const fontSize = Math.min(18, Math.max(11, Number.parseFloat(size.effective) || 13))
  const hiddenTabs = tabStyle.effective === 'hidden' || (layout === 'stack' && tabStyle.effective !== 'custom')
  const textTabs = tabStyle.effective === 'custom' || tabStyle.effective === 'fade' || tabStyle.effective === 'separator'
  const art = Boolean(imageUrl)
  const caret = `caret shape-${shape.effective} ${blink.effective === '0' ? 'still' : ''}`

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
        <div className="term-canvas" style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}>
          <div className="term-wash" />
          <div className={`panes layout-${layout}`}>
            {layout === 'stack' ? <FetchPane dots={ansi} caret={caret} paneUrl={paneUrl} /> : (
              <>
                <EditorPane caret={caret} />
                <PicturePane paneUrl={paneUrl} />
                {layout === 'horizontal' || layout === 'grid' || layout === 'fat' ? <PromptPane title="ssh" /> : null}
                {layout === 'grid' ? <PromptPane title="logs" /> : null}
                {layout === 'tall' || layout === 'vertical' ? <PromptPane title="~/config/fish" /> : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
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

function PicturePane({ paneUrl }: { paneUrl: string }) {
  return (
    <section className="pane">
      {paneUrl ? <img className="pane-image" alt="" src={paneUrl} /> : <p className="c-dim">$</p>}
    </section>
  )
}

function PromptPane({ title }: { title: string }) {
  return (
    <section className="pane">
      <p className="c-cyan">{title}</p>
      <p><span className="c-green">$</span> <span className="c-dim">ready</span></p>
    </section>
  )
}

function FetchPane({ dots, caret, paneUrl }: { dots: { key: string; effective: string }[]; caret: string; paneUrl: string }) {
  const rows = [
    ['c-red', 'os', 'this machine'],
    ['c-green', 'wm', 'kitty'],
    ['c-yellow', 'font', 'monospace'],
    ['c-blue', 'term', 'xterm-kitty'],
  ]
  return (
    <section className={`pane fetch ${paneUrl ? 'with-image' : ''}`}>
      {paneUrl ? <img className="pane-image" alt="" src={paneUrl} /> : null}
      <div>
        <p><b>builder</b><span className="c-dim">@kitty</span></p>
        {rows.map(([tone, label, value]) => <p key={label}><span className={tone}>{label}</span> {value}</p>)}
        <div className="term-palette">{dots.slice(0, 8).map((dot) => <i key={dot.key} style={{ background: cssColor(dot.effective, '#888') }} />)}</div>
        <p className="prompt-line"><span className="c-cyan">~</span> $<span className={caret} /></p>
      </div>
    </section>
  )
}

export function BuilderPage() {
  const activeFile = useWorkspace((state) => state.activeFile)
  const document = useWorkspace((state) => state.document)
  const original = useWorkspace((state) => state.original)
  const status = useWorkspace((state) => state.status)
  const editValue = useWorkspace((state) => state.editValue)
  const applyEntries = useWorkspace((state) => state.applyEntries)
  const updateDocument = useWorkspace((state) => state.updateDocument)
  const resetKeys = useWorkspace((state) => state.resetKeys)
  const openFile = useWorkspace((state) => state.openFile)
  const discard = useWorkspace((state) => state.discard)
  const saveAndReload = useWorkspace((state) => state.saveAndReload)
  const toast = useWorkspace((state) => state.toast)
  const dirty = isDirtyState(document, original)
  const blink = useOption('cursor_blink_interval', '-1')
  const shape = useOption('cursor_shape', 'block')
  const tabStyle = useOption('tab_bar_style', 'fade')
  const tabEdge = useOption('tab_bar_edge', 'bottom')
  const decorations = useOption('hide_window_decorations', 'no')
  const font = useOption('font_family', 'monospace')
  const size = useOption('font_size', '11')
  const opacity = useOption('background_opacity', '1')
  const blur = useOption('background_blur', '0')
  const tint = useOption('background_tint', '0')
  const padding = useOption('window_padding_width', '0')
  const bold = useOption('bold_font', 'auto')
  const italic = useOption('italic_font', 'auto')
  const imageLayout = useOption('background_image_layout', 'cscaled')
  const imagePath = useOption('background_image', 'none')
  const layouts = useOption('enabled_layouts', 'tall')
  const layout = activeLayout(layouts.effective)
  const fileRef = useRef<HTMLInputElement>(null)
  const paneFileRef = useRef<HTMLInputElement>(null)
  const [remoteImage, setRemoteImage] = useState('')
  const [localImage, setLocalImage] = useState('')
  const [panePath, setPanePath] = useState(() => localStorage.getItem('kitty-builder-pane-image') ?? '')
  const [paneUrl, setPaneUrl] = useState('')
  const configuredImage = plainPath(imagePath.raw)

  useEffect(() => {
    if (!isTauri() || activeFile === 'kitty.conf' || isDirtyState(useWorkspace.getState().document, useWorkspace.getState().original)) return
    void openFile('kitty.conf')
  }, [activeFile, openFile])

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

  const save = async () => {
    if (!confirm(`Write ${activeFile}, create a backup and reload kitty?`)) return
    try { await saveAndReload() } catch (error) { toast(`Save failed:\n${String(error)}`) }
  }
  const switchToMain = () => {
    if (dirty && !confirm('Discard unsaved changes and open kitty.conf?')) return
    void openFile('kitty.conf')
  }
  const useScene = async (scene: (typeof scenes)[number]) => {
    const entries = Object.entries(scene.values)
    if (isTauri()) {
      try {
        if (scene.values.tab_bar_style === 'custom') await backend.write('tab_bar.py', tabBarPy)
        await backend.write(scene.sessionPath, scene.session)
        toast(`Session written to ${scene.sessionPath}. Save kitty.conf to launch it.`)
      } catch (error) {
        toast(String(error))
        applyEntries(entries.filter(([key]) => key !== 'startup_session'))
        return
      }
    }
    applyEntries(entries)
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
  const installPaneImage = async (selected: string, announce = true) => {
    const configDir = status?.configDir
    if (!isTauri() || !configDir) {
      setPanePath(selected)
      return
    }
    const kitten = status?.kittyPath?.replace(/kitty$/, 'kitten') || 'kitten'
    const script = `#!/bin/sh\nimage="\${KITTY_BUILDER_PANE_IMAGE:-}"\nimage="\${image#\\"}"\nimage="\${image%\\"}"\nreal="\${KITTY_BUILDER_SHELL:-/bin/zsh}"\nkitten='${kitten.replaceAll("'", '')}'\nif [ -n "$image" ] && [ -f "$image" ]; then\n  if [ ! -x "$kitten" ]; then kitten=kitten; fi\n  "$kitten" icat --stdin=no --align left "$image" || true\nfi\nexec "$real" -l\n`
    await backend.write('builder-shell', script)
    updateDocument((document) => {
      upsertEnv(document, 'KITTY_BUILDER_PANE_IMAGE', selected)
      const shell = valuesOf(document, 'shell').at(-1) ?? ''
      if (!shell.includes('builder-shell')) {
        if (shell.trim()) upsertEnv(document, 'KITTY_BUILDER_SHELL', shell.trim().split(/\s+/)[0] ?? shell.trim())
        setValue(document, 'shell', `/bin/sh ${configDir}/builder-shell`)
      }
    })
    localStorage.setItem('kitty-builder-pane-image', selected)
    setPanePath(selected)
    if (announce) toast('Image added. Save, then open a new kitty window.')
  }
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
  const clearPaneImage = () => {
    localStorage.removeItem('kitty-builder-pane-image')
    if (panePath.startsWith('blob:')) URL.revokeObjectURL(panePath)
    setPanePath('')
    setPaneUrl('')
    updateDocument((document) => {
      removeEnv(document, 'KITTY_BUILDER_PANE_IMAGE')
      removeEnv(document, 'KITTY_BUILDER_SHELL')
      document.nodes = document.nodes.filter((node) => node.type !== 'directive' || node.key !== 'shell' || !node.value.includes('builder-shell'))
    })
  }

  return (
    <div className="builder">
      <div className="builder-controls">
        <header className="builder-head">
          <div>
            <p className="eyebrow">Preset</p>
            <h1>Terminal builder</h1>
          </div>
          <div className="toolbar-actions">
            <span className={`pill ${dirty ? 'warning' : 'success'}`}>{dirty ? 'Modified' : 'Saved'}</span>
            <button className="btn" type="button" disabled={!dirty} onClick={discard}>Discard</button>
            <button className="btn primary" type="button" disabled={!dirty || !isTauri()} onClick={() => void save()}>Save & reload</button>
          </div>
        </header>
        {activeFile !== 'kitty.conf' ? (
          <div className="notice">These edits are going into <code>{activeFile}</code>. <button className="btn small" type="button" onClick={switchToMain}>Open kitty.conf</button></div>
        ) : null}
        {!isTauri() ? <div className="notice">The preview is live. Writing <code>kitty.conf</code> and the startup session requires the desktop app.</div> : null}

        <section className="card card-pad">
          <b>Scenes</b>
          <div className="preset-grid">
            {scenes.map((scene) => (
              <button key={scene.id} className="preset" type="button" onClick={() => void useScene(scene)}>
                <span className={`scene-mark ${scene.id}`} />
                <span><b>{scene.name}</b><small>{scene.note}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <b>Layout</b>
          <div className="choice-grid">
            {windowLayouts.map((item) => (
              <button key={item} className={layout === item ? 'active' : ''} type="button" onClick={() => editValue('enabled_layouts', layoutOrder(item))}>{item}</button>
            ))}
          </div>
          <div className="field"><span>Background image</span>
            <div className="split-fields">
              <button className="btn" type="button" onClick={() => void chooseImage()}>Choose image</button>
              <button className="btn" type="button" onClick={() => { resetKeys(['background_image']); setLocalImage(''); setRemoteImage('') }}>Clear</button>
            </div>
            <input className="input" value={imagePath.raw} placeholder="none" onChange={(event) => editValue('background_image', event.target.value)} />
            <div className="field"><span>Pane image</span>
              <div className="split-fields">
                <button className="btn" type="button" onClick={() => void choosePaneImage()}>Choose image</button>
                <button className="btn" type="button" disabled={!panePath} onClick={clearPaneImage}>Clear</button>
              </div>
              <p className="card-desc">Optional. After saving, it is shown when a new kitty window opens.</p>
            </div>
            <input ref={paneFileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const url = URL.createObjectURL(file)
              setPanePath((current) => {
                if (current.startsWith('blob:')) URL.revokeObjectURL(current)
                return url
              })
            }} />
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setLocalImage((current) => {
                if (current.startsWith('blob:')) URL.revokeObjectURL(current)
                return URL.createObjectURL(file)
              })
            }} />
          </div>
          <label className="field"><span>Image fit</span>
            <select className="select" value={imageLayouts.includes(imageLayout.effective as typeof imageLayouts[number]) ? imageLayout.effective : 'cscaled'} onChange={(event) => editValue('background_image_layout', event.target.value)}>
              {imageLayouts.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field slider-row"><span>Image tint <b>{tint.effective}</b></span>
            <input type="range" min="0" max="0.8" step="0.02" value={Number.parseFloat(tint.effective) || 0} onChange={(event) => editValue('background_tint', event.target.value)} />
          </label>
        </section>

        <section className="card card-pad">
          <div className="panel-title"><b>Themes</b><button className="btn small" type="button" onClick={() => resetKeys(themeKeys)}>Clear colors</button></div>
          <div className="preset-grid">
            {presets.map((preset) => (
              <button key={preset.id} className="preset" type="button" onClick={() => applyEntries(Object.entries(preset.values))}>
                <span className="preset-dots">
                  <i style={{ background: preset.values.background }} />
                  <i style={{ background: preset.values.foreground }} />
                  <i style={{ background: preset.values.color4 }} />
                  <i style={{ background: preset.values.color2 }} />
                </span>
                <span><b>{preset.name}</b><small>{preset.note}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <div className="panel-title"><b>Type & cursor</b><button className="btn small" type="button" onClick={() => resetKeys([...styleKeys])}>Clear style</button></div>
          <label className="field"><span>Font family</span>
            <input className="input" list="kitty-fonts" value={font.raw} placeholder="monospace" onChange={(event) => editValue('font_family', event.target.value)} />
            <datalist id="kitty-fonts">{fontChoices.map((choice) => <option key={choice} value={choice} />)}</datalist>
          </label>
          <div className="split-fields">
            <label className="field"><span>Bold</span><input className="input" value={bold.raw} placeholder="auto" onChange={(event) => editValue('bold_font', event.target.value)} /></label>
            <label className="field"><span>Italic</span><input className="input" value={italic.raw} placeholder="auto" onChange={(event) => editValue('italic_font', event.target.value)} /></label>
          </div>
          <label className="field slider-row"><span>Size <b>{size.effective}</b></span>
            <input type="range" min="8" max="28" step="0.5" value={Number.parseFloat(size.effective) || 11} onChange={(event) => editValue('font_size', event.target.value)} />
          </label>
          <div className="field"><span>Cursor</span>
            <div className="segment">{cursorShapes.map((choice) => (
              <button key={choice} className={shape.effective === choice ? 'active' : ''} type="button" onClick={() => editValue('cursor_shape', choice)}>{choice}</button>
            ))}</div>
          </div>
          <label className="field"><span>Blink</span>
            <select className="select" value={blinkChoices.some(([value]) => value === blink.effective) ? blink.effective : blink.raw} onChange={(event) => editValue('cursor_blink_interval', event.target.value)}>
              {blinkChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              {blinkChoices.some(([value]) => value === blink.effective) ? null : <option value={blink.raw}>{blink.raw}</option>}
            </select>
          </label>
        </section>

        <section className="card card-pad">
          <b>Window</b>
          <label className="field slider-row"><span>Opacity <b>{opacity.effective}</b></span>
            <input type="range" min="0.35" max="1" step="0.01" value={Number.parseFloat(opacity.effective) || 1} onChange={(event) => editValue('background_opacity', event.target.value)} />
          </label>
          <label className="field slider-row"><span>Blur <b>{blur.effective}</b></span>
            <input type="range" min="0" max="64" step="1" value={Number.parseFloat(blur.effective) || 0} onChange={(event) => editValue('background_blur', event.target.value)} />
          </label>
          <label className="field slider-row"><span>Padding <b>{padding.effective}</b></span>
            <input type="range" min="0" max="40" step="1" value={Number.parseFloat(padding.effective) || 0} onChange={(event) => editValue('window_padding_width', event.target.value)} />
          </label>
          <label className="field"><span>Tab bar</span>
            <select className="select" value={tabStyle.effective} onChange={(event) => editValue('tab_bar_style', event.target.value)}>
              {tabStyles.map((choice) => <option key={choice}>{choice}</option>)}
            </select>
          </label>
          <div className="field"><span>Tab edge</span>
            <div className="segment">
              {(['top', 'bottom'] as const).map((edge) => (
                <button key={edge} className={tabEdge.effective === edge ? 'active' : ''} type="button" onClick={() => editValue('tab_bar_edge', edge)}>{edge}</button>
              ))}
            </div>
          </div>
          <div className="field"><span>Title bar</span>
            <div className="segment">
              <button className={decorations.effective !== 'yes' ? 'active' : ''} type="button" onClick={() => editValue('hide_window_decorations', 'no')}>Shown</button>
              <button className={decorations.effective === 'yes' ? 'active' : ''} type="button" onClick={() => editValue('hide_window_decorations', 'yes')}>Hidden</button>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <b>Palette</b>
          <div className="palette-grid">
            {surfaceSlots.map(([key, label, fallback]) => <ColorField key={key} name={key} label={label} fallback={fallback} />)}
          </div>
          <div className="ansi-grid">
            {ansiSlots.map(([key, label]) => <ColorField key={key} name={key} label={label} fallback={presets[0]?.values[key] ?? '#888888'} compact />)}
          </div>
        </section>
      </div>
      <TerminalPreview imageUrl={remoteImage || localImage} paneUrl={paneUrl} />
    </div>
  )
}

function ColorField({ name, label, fallback, compact = false }: { name: string; label: string; fallback: string; compact?: boolean }) {
  const editValue = useWorkspace((state) => state.editValue)
  const option = useOption(name, fallback)
  return (
    <label className={`swatch ${compact ? 'compact' : ''}`} title={label}>
      <input type="color" aria-label={label} value={cssColor(option.effective, fallback)} onChange={(event) => editValue(name, event.target.value)} />
      <span><b>{compact ? label.replace('Bright ', 'B.') : label}</b>
        <input className="input" value={option.raw} placeholder={fallback} onChange={(event) => editValue(name, event.target.value)} />
      </span>
    </label>
  )
}
