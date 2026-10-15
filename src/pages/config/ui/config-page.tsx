import { Link, useParams } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { OptionCard } from '@/features/edit-option'
import { DirtyStatus } from '@/features/save-document'
import { useWorkspace, valuesOf } from '@/entities/workspace'
import { Button, Empty, Pill, SearchField } from '@/shared/ui'

export function ConfigPage() {
  const { section } = useParams({ from: '/config/$section' })
  const registry = useWorkspace((state) => state.registry)
  const query = useWorkspace((state) => state.optionQuery)
  const setOptionQuery = useWorkspace((state) => state.setOptionQuery)
  const document = useWorkspace((state) => state.document)
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
  const activeMaps = valuesOf(document, 'map')

  return (
    <div className="config-layout">
      <aside className="section-list">
        <SearchField id="option-search" placeholder={`Search ${registry.options.length} options…`} value={query} onChange={setOptionQuery} />
        {registry.sections.map((item) => (
          <Link key={item.id} className={`section-link ${item.id === valid ? 'active' : ''}`} to="/config/$section" params={{ section: item.id }}>
            {item.title}<span>{item.id === 'shortcuts' ? registry.maps.length : registry.options.filter((option) => option.section === item.id && option.documented).length}</span>
          </Link>
        ))}
      </aside>
      <section className="options-pane">
        <header className="options-head">
          <div><p className="eyebrow">Complete configuration</p><h1>{sectionInfo.title}</h1></div>
          <div><Pill>{items.length} items</Pill> <DirtyStatus /></div>
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
          {items.length === 0 ? <Empty>Run the Tauri desktop app to load the complete option registry from kitty.</Empty> : (
            <div className="options-virtual" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((virtual) => {
                const item = items[virtual.index]
                return (
                  <div key={virtual.key} data-index={virtual.index} ref={virtualizer.measureElement} style={{ position: 'absolute', top: 0, left: 25, right: 25, transform: `translateY(${virtual.start}px)`, paddingBottom: 10 }}>
                    {'definition' in item ? (
                      <article className="card option">
                        <div className="option-top">
                          <div><b className="option-name">{item.title || item.name}</b><p className="option-group">{item.group}{item.only ? ` · ${item.only}` : ''}</p></div>
                          <Button size="sm" onClick={() => editValues('map', [...activeMaps, item.definition])}>+ Add</Button>
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
