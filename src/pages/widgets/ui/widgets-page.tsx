import { useOverlays, widgetCatalog, type TerminalWidget } from '@/entities/overlay'
import { Button, Field, PageHead, Panel, Segmented, SelectField, SliderField, TextField } from '@/shared/ui'

function WidgetEditor({ widget }: { widget: TerminalWidget }) {
  const updateWidget = useOverlays((state) => state.updateWidget)
  const updatePlacement = useOverlays((state) => state.updatePlacement)
  const removeWidget = useOverlays((state) => state.removeWidget)
  const place = (patch: Partial<TerminalWidget['placement']>) => updatePlacement(widget.id, { ...widget.placement, ...patch })
  return (
    <Panel title={widget.label || widget.kind} extra={<Button size="sm" onClick={() => removeWidget(widget.id)}>Remove</Button>}>
      <TextField label="Label" value={widget.label} onChange={(label) => updateWidget(widget.id, { label })} />
      <div className="split-fields">
        <label className="field"><span>Text color</span><input type="color" value={widget.foreground} onChange={(event) => updateWidget(widget.id, { foreground: event.target.value })} /></label>
        <label className="field"><span>Background</span><input type="color" value={widget.background} onChange={(event) => updateWidget(widget.id, { background: event.target.value })} /></label>
      </div>
      {widget.kind === 'clock' ? <Field label="Clock format"><Segmented value={widget.clock24 ? '24' : '12'} options={[{ value: '24', label: '24 hour' }, { value: '12', label: '12 hour' }]} onChange={(value) => updateWidget(widget.id, { clock24: value === '24' })} /></Field> : null}
      <Field label="Anchoring"><Segmented value={widget.placement.pinned ? 'pinned' : 'flowing'} options={[{ value: 'pinned', label: 'Pinned' }, { value: 'flowing', label: 'Scrolls' }]} onChange={(value) => place({ pinned: value === 'pinned' })} /></Field>
      {widget.placement.pinned ? (
        <SelectField label="Edge" value={widget.placement.edge} onChange={(edge) => place({ edge: edge as TerminalWidget['placement']['edge'] })}>
          {['left', 'right', 'top', 'bottom'].map((edge) => <option key={edge}>{edge}</option>)}
        </SelectField>
      ) : null}
      <div className="split-fields">
        <SliderField label="Width" value={String(widget.placement.w)} min={80} max={420} step={1} onChange={(w) => place({ w: Number(w) })} />
        <SliderField label="Height" value={String(widget.placement.h)} min={56} max={300} step={1} onChange={(h) => place({ h: Number(h) })} />
      </div>
      <div className="split-fields">
        <SliderField label="Horizontal" value={String(widget.placement.x)} min={0} max={700} step={1} onChange={(x) => place({ x: Number(x) })} />
        <SliderField label="Vertical" value={String(widget.placement.y)} min={0} max={340} step={1} onChange={(y) => place({ y: Number(y) })} />
      </div>
    </Panel>
  )
}

export function WidgetsPage() {
  const widgets = useOverlays((state) => state.widgets)
  const addWidget = useOverlays((state) => state.addWidget)
  return (
    <div className="page widgets-page">
      <PageHead eyebrow="Terminal overlays" title="Widgets" lead="Add resource and time panels. Widgets are pinned by default, so terminal output keeps its own space." />
      <div className="widget-catalog">
        {widgetCatalog.map((item) => (
          <button className="card widget-choice" type="button" key={item.kind} onClick={() => addWidget(item.kind)}>
            <b>+ {item.label}</b><span>{item.description}</span>
          </button>
        ))}
      </div>
      <div className="widget-editors">
        {widgets.map((widget) => <WidgetEditor key={widget.id} widget={widget} />)}
        {widgets.length === 0 ? <p className="card-desc">Choose a widget to begin.</p> : null}
      </div>
    </div>
  )
}
