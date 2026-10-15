import { useEffect } from 'react'
import tabBarPy from '../../../../scripts/studio-tab-bar.py?raw'
import {
  ansiSlots, blinkChoices, cursorShapes, fontChoices, imageLayouts, presets, scenes, styleKeys, surfaceSlots, tabStyles, themeKeys, windowLayouts,
} from '@/entities/appearance'
import { isDirtyState, useWorkspace } from '@/entities/workspace'
import { ColorField, useOption } from '@/features/edit-option'
import { confirmDiscard, SaveActions } from '@/features/save-document'
import { backend, isTauri } from '@/shared/api'
import { Button, ChoiceGrid, Field, ImageFileInput, Notice, Panel, Segmented, SelectField, SliderField, TextField } from '@/shared/ui'
import { useBuilderImages } from '../model/use-images'
import { useLayoutEditor } from '../model/use-layout'

function useApplyScene() {
  const applyEntries = useWorkspace((state) => state.applyEntries)
  const toast = useWorkspace((state) => state.toast)
  return async (scene: (typeof scenes)[number]) => {
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
}

export function BuilderControls({ layout, images }: { layout: ReturnType<typeof useLayoutEditor>; images: ReturnType<typeof useBuilderImages> }) {
  const activeFile = useWorkspace((state) => state.activeFile)
  const openFile = useWorkspace((state) => state.openFile)
  const editValue = useWorkspace((state) => state.editValue)
  const applyEntries = useWorkspace((state) => state.applyEntries)
  const resetKeys = useWorkspace((state) => state.resetKeys)
  const applyScene = useApplyScene()
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
  const knownBlink = blinkChoices.some(([value]) => value === blink.effective)

  return (
    <div className="builder-controls">
      <header className="builder-head">
        <div>
          <p className="eyebrow">Preset</p>
          <h1>Terminal builder</h1>
        </div>
        <SaveActions />
      </header>
      {activeFile !== 'kitty.conf' ? (
        <Notice>These edits are going into <code>{activeFile}</code>. <Button size="sm" onClick={() => {
          if (!confirmDiscard('Discard unsaved changes and open kitty.conf?')) return
          void openFile('kitty.conf')
        }}>Open kitty.conf</Button></Notice>
      ) : null}
      {!isTauri() ? <Notice>The preview is live. Writing <code>kitty.conf</code> and the startup session requires the desktop app.</Notice> : null}

      <Panel title="Scenes">
        <div className="preset-grid">
          {scenes.map((scene) => (
            <button key={scene.id} className="preset" type="button" onClick={() => void applyScene(scene)}>
              <span className={`scene-mark ${scene.id}`} />
              <span><b>{scene.name}</b><small>{scene.note}</small></span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Layout">
        <ChoiceGrid value={layout.layout} options={[...windowLayouts, 'custom']} onChange={layout.selectLayout} />
        <p className="card-desc">Drag the dividers in the preview. Custom starts empty: select a pane, then split it.</p>
        <div className="split-fields">
          <Button disabled={!layout.canSplit} onClick={layout.splitRight}>Split right</Button>
          <Button disabled={!layout.canSplit} onClick={layout.splitDown}>Split down</Button>
          <Button disabled={!layout.canRemove} onClick={layout.remove}>Remove</Button>
        </div>
        <Field label="Background image">
          <div className="split-fields">
            <Button onClick={() => void images.chooseImage()}>Choose image</Button>
            <Button onClick={images.clearBackground}>Clear</Button>
          </div>
          <input className="input" value={images.imagePath.raw} placeholder="none" onChange={(event) => editValue('background_image', event.target.value)} />
          <Field label="Pane image">
            <div className="split-fields">
              <Button onClick={() => void images.choosePaneImage()}>Choose image</Button>
              <span />
            </div>
            <p className="card-desc">PNG, JPEG, WebP or GIF. Every image can be moved, resized and pinned from the preview.</p>
            <div className="overlay-list">
              {images.overlayImages.map((image, index) => (
                <div className="overlay-list-item" key={image.id}>
                  <span>Image {index + 1}<small>{image.placement.pinned ? `Pinned ${image.placement.edge}` : 'Scrolls with content'}</small></span>
                  <Button size="sm" onClick={() => images.removeImage(image.id)}>Remove</Button>
                </div>
              ))}
            </div>
          </Field>
          <ImageFileInput inputRef={images.paneFileRef} onFile={images.onPaneFile} />
          <ImageFileInput inputRef={images.fileRef} onFile={images.onLocalFile} />
        </Field>
        <SelectField label="Image fit" value={imageLayouts.includes(imageLayout.effective as typeof imageLayouts[number]) ? imageLayout.effective : 'cscaled'} onChange={(value) => editValue('background_image_layout', value)}>
          {imageLayouts.map((item) => <option key={item}>{item}</option>)}
        </SelectField>
        <SliderField label="Image tint" value={tint.effective} min={0} max={0.8} step={0.02} onChange={(value) => editValue('background_tint', value)} />
      </Panel>

      <Panel title="Themes" extra={<Button size="sm" onClick={() => resetKeys(themeKeys)}>Clear colors</Button>}>
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
      </Panel>

      <Panel title="Type & cursor" extra={<Button size="sm" onClick={() => resetKeys([...styleKeys])}>Clear style</Button>}>
        <ColorField name="foreground" label="Terminal text" fallback="#dddddd" />
        <TextField label="Font family" list="kitty-fonts" suggestions={fontChoices} value={font.raw} placeholder="monospace" onChange={(value) => editValue('font_family', value)} />
        <div className="split-fields">
          <TextField label="Bold" value={bold.raw} placeholder="auto" onChange={(value) => editValue('bold_font', value)} />
          <TextField label="Italic" value={italic.raw} placeholder="auto" onChange={(value) => editValue('italic_font', value)} />
        </div>
        <SliderField label="Size" value={size.effective} min={8} max={28} step={0.5} fallback={11} onChange={(value) => editValue('font_size', value)} />
        <Field label="Cursor"><Segmented value={shape.effective} options={cursorShapes} onChange={(value) => editValue('cursor_shape', value)} /></Field>
        <SelectField label="Blink" value={knownBlink ? blink.effective : blink.raw} onChange={(value) => editValue('cursor_blink_interval', value)}>
          {blinkChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {knownBlink ? null : <option value={blink.raw}>{blink.raw}</option>}
        </SelectField>
      </Panel>

      <Panel title="Window">
        <SliderField label="Opacity" value={opacity.effective} min={0.35} max={1} step={0.01} fallback={1} onChange={(value) => editValue('background_opacity', value)} />
        <SliderField label="Blur" value={blur.effective} min={0} max={64} step={1} onChange={(value) => editValue('background_blur', value)} />
        <SliderField label="Padding" value={padding.effective} min={0} max={40} step={1} onChange={(value) => editValue('window_padding_width', value)} />
        <SelectField label="Tab bar" value={tabStyle.effective} onChange={(value) => editValue('tab_bar_style', value)}>
          {tabStyles.map((choice) => <option key={choice}>{choice}</option>)}
        </SelectField>
        <Field label="Tab edge"><Segmented value={tabEdge.effective} options={['top', 'bottom']} onChange={(value) => editValue('tab_bar_edge', value)} /></Field>
        <Field label="Title bar">
          <Segmented value={decorations.effective === 'yes' ? 'yes' : 'no'} options={[{ value: 'no', label: 'Shown' }, { value: 'yes', label: 'Hidden' }]} onChange={(value) => editValue('hide_window_decorations', value)} />
        </Field>
      </Panel>

      <Panel title="Palette">
        <div className="palette-grid">
          {surfaceSlots.filter(([key]) => key !== 'foreground').map(([key, label, fallback]) => <ColorField key={key} name={key} label={label} fallback={fallback} />)}
        </div>
        <div className="ansi-grid">
          {ansiSlots.map(([key, label]) => <ColorField key={key} name={key} label={label} fallback={presets[0]?.values[key] ?? '#888888'} compact />)}
        </div>
      </Panel>
    </div>
  )
}

export function useOpenMainConfig() {
  const activeFile = useWorkspace((state) => state.activeFile)
  const openFile = useWorkspace((state) => state.openFile)
  useEffect(() => {
    if (!isTauri() || activeFile === 'kitty.conf' || isDirtyState(useWorkspace.getState().document, useWorkspace.getState().original)) return
    void openFile('kitty.conf')
  }, [activeFile, openFile])
}
