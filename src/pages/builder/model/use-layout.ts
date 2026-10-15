import { useRef, useState } from 'react'
import { activeLayout, cloneTree, enabledFor, firstPane, paneCount, presetTrees, removePane, sessionFor, setRatio, splitPane, type LayoutNode } from '@/entities/appearance'
import { useWorkspace } from '@/entities/workspace'
import { useOption } from '@/features/edit-option'
import { backend, isTauri } from '@/shared/api'

export function useLayoutEditor() {
  const editValue = useWorkspace((state) => state.editValue)
  const toast = useWorkspace((state) => state.toast)
  const layouts = useOption('enabled_layouts', 'tall')
  const layout = activeLayout(layouts.effective)
  const [trees, setTrees] = useState<Record<string, LayoutNode>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kitty-builder-layouts') ?? '{}') as Record<string, LayoutNode>
      return { ...Object.fromEntries(Object.entries(presetTrees).map(([key, value]) => [key, cloneTree(value)])), ...saved }
    } catch {
      return Object.fromEntries(Object.entries(presetTrees).map(([key, value]) => [key, cloneTree(value)]))
    }
  })
  const [selectedPane, setSelectedPane] = useState('editor')
  const tree = trees[layout] ?? cloneTree(presetTrees[layout] ?? presetTrees.custom)
  const treeRef = useRef(tree)
  const layoutRef = useRef(layout)
  treeRef.current = tree
  layoutRef.current = layout
  const remember = (next: Record<string, LayoutNode>) => {
    setTrees(next)
    localStorage.setItem('kitty-builder-layouts', JSON.stringify(next))
  }
  const commitLayout = async (mode: string, nextTree: LayoutNode) => {
    editValue('enabled_layouts', enabledFor(mode, nextTree))
    editValue('startup_session', `sessions/${mode}.session`)
    if (!isTauri()) return
    try { await backend.write(`sessions/${mode}.session`, sessionFor(nextTree, mode)) } catch (error) { toast(String(error)) }
  }
  const updateTree = (next: LayoutNode, commit = false) => {
    treeRef.current = next
    remember({ ...trees, [layoutRef.current]: next })
    if (commit) void commitLayout(layoutRef.current, next)
  }
  return {
    layout,
    tree,
    selectedPane,
    setSelectedPane,
    canSplit: Boolean(selectedPane),
    canRemove: Boolean(selectedPane) && paneCount(tree) >= 2,
    splitRight: () => updateTree(splitPane(tree, selectedPane, 'x'), true),
    splitDown: () => updateTree(splitPane(tree, selectedPane, 'y'), true),
    remove: () => updateTree(removePane(tree, selectedPane), true),
    selectLayout: (item: string) => {
      const next = trees[item] ?? cloneTree(presetTrees[item] ?? presetTrees.custom)
      setSelectedPane(firstPane(next))
      remember({ ...trees, [item]: next })
      void commitLayout(item, next)
    },
    onRatio: (id: string, ratio: number) => updateTree(setRatio(treeRef.current, id, ratio)),
    onCommit: () => { void commitLayout(layoutRef.current, treeRef.current) },
  }
}
