import { useEffect } from 'react'
import { isTauri } from '../core/tauri'
import { valuesOf } from '../core/document'
import {
  ansiSlots, blinkChoices, cssColor, cursorShapes, fontChoices, presets, styleKeys, surfaceSlots, tabStyles, themeKeys,
} from '../data/appearance'
import { isDirtyState, useWorkspace } from '../store/workspace'

function useOption(key: string, fallback: string) {
  const document = useWorkspace((state) => state.document)
  const raw = valuesOf(document, key).at(-1) ?? ''
  return { raw, effective: raw.trim() ? raw : fallback }
}

function TerminalPreview() {
  const background = useOption('background', '#000000')
  const foreground = useOption('foreground', '#dddddd')
  const cursor = useOption('cursor', '#cccccc')
  const cursorText = useOption('cursor_text_color', '#111111')
  const selection = useOption('selection_background', '#fffacd')
  const selectionText = useOption('selection_foreground', '#000000')
  const font = useOption('font_family', 'monospace')
  const size = useOption('font_size', '11')
  const shape = useOption('cursor_shape', 'block')
  const blink = useOption('cursor_blink_interval', '-1')
  const opacity = useOption('background_opacity', '1')
  const blur = useOption('background_blur', '0')
  const padding = useOption('window_padding_width', '0')
  const tabStyle = useOption('tab_bar_style', 'fade')
  const activeTab = useOption('active_tab_background', '#eeeeee')
  const activeTabText = useOption('active_tab_foreground', '#000000')
  const inactiveTab = useOption('inactive_tab_background', '#999999')
  const inactiveTabText = useOption('inactive_tab_foreground', '#444444')
  const document = useWorkspace((state) => state.document)
  const classic = presets[0]?.values ?? {}
  const ansi = ansiSlots.map(([key, label]) => {
    const raw = valuesOf(document, key).at(-1) ?? ''
    const fallback = classic[key] ?? '#888888'
    return { key, label, raw, effective: raw.trim() ? raw : fallback }
  })
  const color = (slot: string, fallback: string) => cssColor(ansi.find((item) => item.key === slot)?.effective, fallback)
  const pad = Number.parseFloat(padding.effective) || 0
  const fontSize = Math.min(22, Math.max(11, Number.parseFloat(size.effective) || 13))
  const hiddenTabs = tabStyle.effective === 'hidden'

  return (
    <div className="preview-stage">
      <div
        className={`term style-${tabStyle.effective}`}
        style={{
          ['--term-bg' as string]: cssColor(background.effective, '#000000'),
          ['--term-fg' as string]: cssColor(foreground.effective, '#dddddd'),
          ['--term-cursor' as string]: cssColor(cursor.effective, '#cccccc'),
          ['--term-cursor-text' as string]: cssColor(cursorText.effective, '#111111'),
          ['--term-selection' as string]: cssColor(selection.effective, '#fffacd'),
          ['--term-selection-text' as string]: cssColor(selectionText.effective, '#000000'),
          ['--term-opacity' as string]: String(Math.min(1, Math.max(0.15, Number.parseFloat(opacity.effective) || 1))),
          ['--term-blur' as string]: `${Math.max(0, Number.parseFloat(blur.effective) || 0)}px`,
          ['--term-pad' as string]: `${Math.min(48, Math.max(0, pad))}px`,
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
        <div className="term-chrome"><span /><span /><span /><b>kitty — builder</b></div>
        {hiddenTabs ? null : (
          <div className="term-tabs">
            <span className="term-tab active">main</span>
            <span className="term-tab">logs</span>
            <span className="term-tab">ssh</span>
          </div>
        )}
        <div className="term-screen">
          <p><span className="c-blue">~/config/kitty</span> <span className="c-dim">main</span></p>
          <p><span className="c-cyan">&gt;</span> git status</p>
          <p>On branch <span className="c-magenta">main</span></p>
          <p className="selected">  modified: kitty.conf</p>
          <p><span className="c-green">  themes/</span> <span className="c-blue">sessions/</span></p>
          <p><span className="c-cyan">&gt;</span> echo $TERM</p>
          <p>xterm-kitty<span className={`caret shape-${shape.effective} ${blink.effective === '0' ? 'still' : ''}`} /></p>
          <div className="term-palette">
            {ansi.slice(0, 16).map((slot) => <i key={slot.key} title={slot.label} style={{ background: cssColor(slot.effective, '#888') }} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BuilderPage() {
  const activeFile = useWorkspace((state) => state.activeFile)
  const document = useWorkspace((state) => state.document)
  const original = useWorkspace((state) => state.original)
  const editValue = useWorkspace((state) => state.editValue)
  const applyEntries = useWorkspace((state) => state.applyEntries)
  const resetKeys = useWorkspace((state) => state.resetKeys)
  const openFile = useWorkspace((state) => state.openFile)
  const discard = useWorkspace((state) => state.discard)
  const saveAndReload = useWorkspace((state) => state.saveAndReload)
  const toast = useWorkspace((state) => state.toast)
  const dirty = isDirtyState(document, original)
  const blink = useOption('cursor_blink_interval', '-1')
  const shape = useOption('cursor_shape', 'block')
  const tabStyle = useOption('tab_bar_style', 'fade')
  const font = useOption('font_family', 'monospace')
  const size = useOption('font_size', '11')
  const opacity = useOption('background_opacity', '1')
  const blur = useOption('background_blur', '0')
  const padding = useOption('window_padding_width', '0')
  const bold = useOption('bold_font', 'auto')
  const italic = useOption('italic_font', 'auto')

  useEffect(() => {
    if (!isTauri() || activeFile === 'kitty.conf' || isDirtyState(useWorkspace.getState().document, useWorkspace.getState().original)) return
    void openFile('kitty.conf')
  }, [activeFile, openFile])

  const save = async () => {
    if (!confirm(`Write ${activeFile}, create a backup and reload kitty?`)) return
    try { await saveAndReload() } catch (error) { toast(`Save failed:\n${String(error)}`) }
  }
  const switchToMain = () => {
    if (dirty && !confirm('Discard unsaved changes and open kitty.conf?')) return
    void openFile('kitty.conf')
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
        {!isTauri() ? <div className="notice">The preview is live. Writing <code>kitty.conf</code> requires the desktop app.</div> : null}

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
            <input type="range" min="0.4" max="1" step="0.05" value={Number.parseFloat(opacity.effective) || 1} onChange={(event) => editValue('background_opacity', event.target.value)} />
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
      <TerminalPreview />
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
