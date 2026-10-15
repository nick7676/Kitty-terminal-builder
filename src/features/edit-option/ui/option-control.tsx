import { cursorShapes } from '@/entities/appearance'
import { useWorkspace, valuesOf } from '@/entities/workspace'
import type { KittyOption } from '@/shared/api'
import { Button } from '@/shared/ui'

function controlKind(option: KittyOption) {
  if (option.name === 'cursor_shape') return 'choice' as const
  return option.kind
}

function choicesOf(option: KittyOption) {
  return option.name === 'cursor_shape' ? [...cursorShapes] : option.choices ?? []
}

export function OptionControl({ option }: { option: KittyOption }) {
  const document = useWorkspace((state) => state.document)
  const editValue = useWorkspace((state) => state.editValue)
  const editValues = useWorkspace((state) => state.editValues)
  const values = valuesOf(document, option.name)
  const value = values.at(-1) ?? option.default ?? ''
  const kind = controlKind(option)
  if (kind === 'bool') {
    return <label className="toggle-row"><input className="switch" type="checkbox" checked={value === 'yes'} onChange={(event) => editValue(option.name, event.target.checked ? 'yes' : 'no')} /><span>{value === 'yes' ? 'Enabled' : 'Disabled'}</span></label>
  }
  if (kind === 'choice' && choicesOf(option).length) {
    return <select className="select mono" value={value} onChange={(event) => editValue(option.name, event.target.value)}>{choicesOf(option).map((choice) => <option key={choice}>{choice}</option>)}</select>
  }
  if (kind === 'color') {
    const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
    return <div className="color-row"><input type="color" value={hex} onChange={(event) => editValue(option.name, event.target.value)} /><input className="input" value={value} onChange={(event) => editValue(option.name, event.target.value)} /></div>
  }
  if (kind === 'multi') {
    return <textarea className="textarea" value={values.length ? values.join('\n') : (option.defaults ?? []).join('\n')} onChange={(event) => editValues(option.name, event.target.value.split('\n').filter(Boolean))} />
  }
  return <input className="input" type={kind === 'int' || kind === 'float' ? 'number' : 'text'} step={kind === 'float' ? 'any' : undefined} value={value} onChange={(event) => editValue(option.name, event.target.value)} />
}

export function OptionCard({ option }: { option: KittyOption }) {
  const document = useWorkspace((state) => state.document)
  const resetOption = useWorkspace((state) => state.resetOption)
  const configured = valuesOf(document, option.name).length > 0
  return (
    <article className="card option">
      <div className="option-top">
        <div>
          <span className="option-name">{option.name}</span> {configured ? <span className="tag active">Configured</span> : null} {option.multi ? <span className="tag">Repeatable</span> : null}
          <p className="option-group">{option.group}</p>
        </div>
        {configured ? <Button size="sm" onClick={() => resetOption(option.name)}>↺ Default</Button> : null}
      </div>
      <div className="option-control"><OptionControl option={option} /></div>
      {option.doc ? <details><summary className="option-doc" style={{ cursor: 'pointer' }}>Official documentation</summary><p className="option-doc">{option.doc}</p></details> : null}
    </article>
  )
}
