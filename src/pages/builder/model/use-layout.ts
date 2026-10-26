import { useEffect, useRef, useState } from 'react'
import { addPane, loadPanes, removePane, resizePair, sessionFor, type TerminalPane } from '@/entities/appearance'
import { useOverlays } from '@/entities/overlay'
import { useWorkspace, valuesOf } from '@/entities/workspace'
import { backend, isTauri } from '@/shared/api'

export function useLayoutEditor() {
  const editValue = useWorkspace((state) => state.editValue)
  const toast = useWorkspace((state) => state.toast)
  const loading = useWorkspace((state) => state.loading)
  const shellPath = useOverlays((state) => state.shellPath)
  const widgets = useOverlays((state) => state.widgets.length)
  const [panes, setPanes] = useState<TerminalPane[]>(() => loadPanes(localStorage.getItem('kitty-builder-panes')))
  const [selectedPane, setSelectedPane] = useState(() => panes[0]?.id ?? 't1')
  const panesRef = useRef(panes)
  panesRef.current = panes

  const remember = (next: TerminalPane[]) => {
    panesRef.current = next
    setPanes(next)
    localStorage.setItem('kitty-builder-panes', JSON.stringify(next))
  }

  const commit = async (next: TerminalPane[], shell: string) => {
    if (widgets > 0 || useWorkspace.getState().loading) return
    const state = useWorkspace.getState()
    const session = valuesOf(state.document, 'startup_session').at(-1) ?? ''
    const layouts = valuesOf(state.document, 'enabled_layouts').at(-1) ?? ''
    if (session !== 'sessions/layout.session') editValue('startup_session', 'sessions/layout.session')
    if (!layouts.split(/[\s,]+/)[0]?.startsWith('splits')) editValue('enabled_layouts', 'splits')
    if (!isTauri()) return
    try { await backend.write('sessions/layout.session', sessionFor(next, shell)) } catch (error) { toast(String(error)) }
  }

  useEffect(() => {
    if (loading) return
    void commit(panesRef.current, shellPath)
  }, [loading, shellPath, widgets])

  return {
    panes,
    selectedPane,
    setSelectedPane,
    canAdd: panes.length < 6,
    canRemove: panes.length > 1,
    add: () => {
      const next = addPane(panes)
      const added = next.at(-1)
      if (added) setSelectedPane(added.id)
      remember(next)
      void commit(next, shellPath)
    },
    remove: () => {
      const next = removePane(panes, selectedPane)
      setSelectedPane(next[0]?.id ?? 't1')
      remember(next)
      void commit(next, shellPath)
    },
    onResize: (index: number, fraction: number) => remember(resizePair(panesRef.current, index, fraction)),
    onCommit: () => { void commit(panesRef.current, shellPath) },
  }
}
