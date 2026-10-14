import { Link, useParams } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { valuesOf } from '../core/document'
import type { KittyOption } from '../core/types'
import { isDirtyState, useWorkspace } from '../store/workspace'

const cursorShapes = ['block', 'beam', 'underline']

function controlKind(option: KittyOption) {
  if (option.name === 'cursor_shape') return 'choice' as const
  return option.kind
}

function choicesOf(option: KittyOption) {
  return option.name === 'cursor_shape' ? cursorShapes : option.choices ?? []
}

function OptionControl({ option }: { option: KittyOption }) {
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

function OptionCard({ option }: { option: KittyOption }) {
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
        {configured ? <button className="btn small" type="button" onClick={() => resetOption(option.name)}>↺ Default</button> : null}
      </div>
      <div className="option-control"><OptionControl option={option} /></div>
      {option.doc ? <details><summary className="option-doc" style={{ cursor: 'pointer' }}>Official documentation</summary><p className="option-doc">{option.doc}</p></details> : null}
    </article>
  )
}

export function ConfigPage() {
  const { section } = useParams({ from: '/config/$section' })
  const registry = useWorkspace((state) => state.registry)
  const query = useWorkspace((state) => state.optionQuery)
  const setOptionQuery = useWorkspace((state) => state.setOptionQuery)
  const document = useWorkspace((state) => state.document)
  const original = useWorkspace((state) => state.original)
  const editValues = useWorkspace((state) => state.editValues)
  const valid = registry.sections.some((item) => item.id === section) ? section : 'fonts'
  const sectionInfo = registry.sections.find((item) => item.id === valid) ?? registry.sections[0]
  const needle = query.toLowerCase()
  const options = registry.options.filter((option) => option.section === valid && option.documented && (!needle || `${option.name} ${option.group} ${option.doc}`.toLowerCase().includes(needle)))
  const maps = registry.maps.filter((map) => !needle || `${map.name} ${map.title} ${map.group}`.toLowerCase().includes(needle))
  const items = valid === 'shortcuts' ? maps : options
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => valid === 'shortcuts' ? 96 : 156,
    overscan: 6,
    getItemKey: (index) => valid === 'shortcuts' ? maps[index]?.definition ?? index : options[index]?.name ?? index,
  })
  useEffect(() => { parentRef.current?.scrollTo({ top: 0 }) }, [valid])
  const dirty = isDirtyState(document, original)
  const activeMaps = valuesOf(document, 'map')

  return (
    <div className="config-layout">
      <aside className="section-list">
        <div className="search-wrap"><input id="option-search" className="input" placeholder={`Search ${registry.options.length} options…`} value={query} onChange={(event) => setOptionQuery(event.target.value)} /></div>
        {registry.sections.map((item) => (
          <Link key={item.id} className={`section-link ${item.id === valid ? 'active' : ''}`} to="/config/$section" params={{ section: item.id }}>
            {item.title}<span>{item.id === 'shortcuts' ? registry.maps.length : registry.options.filter((option) => option.section === item.id && option.documented).length}</span>
          </Link>
        ))}
      </aside>
      <section className="options-pane">
        <header className="options-head">
          <div><p className="eyebrow">Complete configuration</p><h1>{sectionInfo.title}</h1></div>
          <div><span className="pill">{items.length} items</span> <span className={`pill ${dirty ? 'warning' : 'success'}`}>{dirty ? 'Modified' : 'Saved'}</span></div>
        </header>
        {valid === 'shortcuts' ? (
          <div className="options-list">
            <article className="card option">
              <h2>Active mappings</h2>
              <p className="card-desc">One mapping per line. Modal and alias syntax are preserved.</p>
              <textarea className="textarea" style={{ minHeight: 220, marginTop: 14 }} value={activeMaps.join('\n')} onChange={(event) => editValues('map', event.target.value.split('\n').filter(Boolean))} />
            </article>
          </div>
        ) : null}
        <div className="options-scroll" ref={parentRef}>
          {items.length === 0 ? <div className="empty">Run the Tauri desktop app to load the complete option registry from kitty.</div> : (
            <div className="options-virtual" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtual) => {
                const item = items[virtual.index]
                return (
                  <div key={virtual.key} data-index={virtual.index} ref={virtualizer.measureElement} style={{ position: 'absolute', top: 0, left: 25, right: 25, transform: `translateY(${virtual.start}px)`, paddingBottom: 10 }}>
                    {'definition' in item ? (
                      <article className="card option">
                        <div className="option-top">
                          <div><b className="option-name">{item.title || item.name}</b><p className="option-group">{item.group}{item.only ? ` · ${item.only}` : ''}</p></div>
                          <button className="btn small" type="button" onClick={() => editValues('map', [...activeMaps, item.definition])}>+ Add</button>
                        </div>
                        <code className="option-doc">{item.definition}</code>
                      </article>
                    ) : <OptionCard option={item} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
