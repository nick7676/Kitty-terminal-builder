export type LayoutNode =
  | { kind: 'pane'; id: string; label: string }
  | { kind: 'split'; id: string; axis: 'x' | 'y'; ratio: number; first: LayoutNode; second: LayoutNode }

const pane = (id: string, label: string): LayoutNode => ({ kind: 'pane', id, label })
const split = (id: string, axis: 'x' | 'y', ratio: number, first: LayoutNode, second: LayoutNode): LayoutNode => ({ kind: 'split', id, axis, ratio, first, second })

export const presetTrees: Record<string, LayoutNode> = {
  stack: pane('main', 'fetch'),
  tall: split('root', 'x', 0.58, pane('editor', 'editor'), split('side', 'y', 0.55, pane('image', 'image'), pane('shell', 'shell'))),
  fat: split('root', 'y', 0.62, pane('editor', 'editor'), split('bottom', 'x', 0.5, pane('image', 'image'), pane('shell', 'shell'))),
  grid: split('root', 'y', 0.5, split('top', 'x', 0.5, pane('editor', 'editor'), pane('image', 'image')), split('bottom', 'x', 0.5, pane('shell', 'shell'), pane('logs', 'logs'))),
  horizontal: split('root', 'x', 0.4, pane('editor', 'editor'), split('rest', 'x', 0.5, pane('image', 'image'), pane('shell', 'shell'))),
  vertical: split('root', 'y', 0.4, pane('editor', 'editor'), split('rest', 'y', 0.5, pane('image', 'image'), pane('shell', 'shell'))),
  custom: pane('main', 'shell'),
}

export function cloneTree(node: LayoutNode): LayoutNode {
  return structuredClone(node)
}

export function firstPane(node: LayoutNode): string {
  return node.kind === 'pane' ? node.id : firstPane(node.first)
}

export function paneCount(node: LayoutNode): number {
  return node.kind === 'pane' ? 1 : paneCount(node.first) + paneCount(node.second)
}

export function rootRatio(node: LayoutNode) {
  return node.kind === 'split' ? node.ratio : 1
}

export function setRatio(node: LayoutNode, id: string, ratio: number): LayoutNode {
  if (node.kind === 'pane') return node
  if (node.id === id) return { ...node, ratio }
  return { ...node, first: setRatio(node.first, id, ratio), second: setRatio(node.second, id, ratio) }
}

export function splitPane(node: LayoutNode, id: string, axis: 'x' | 'y'): LayoutNode {
  if (node.kind === 'pane') {
    if (node.id !== id) return node
    const stamp = Math.random().toString(36).slice(2, 7)
    return split(`s-${stamp}`, axis, 0.5, node, pane(`p-${stamp}`, 'shell'))
  }
  return { ...node, first: splitPane(node.first, id, axis), second: splitPane(node.second, id, axis) }
}

export function removePane(node: LayoutNode, id: string): LayoutNode {
  if (node.kind === 'pane') return node
  if (node.first.kind === 'pane' && node.first.id === id) return node.second
  if (node.second.kind === 'pane' && node.second.id === id) return node.first
  return { ...node, first: removePane(node.first, id), second: removePane(node.second, id) }
}

export function sessionFor(node: LayoutNode, name: string) {
  const lines = [`new_tab ${name}`, 'layout splits']
  emit(node, lines, null)
  return `${lines.join('\n')}\n`
}

function emit(node: LayoutNode, lines: string[], existing: string | null) {
  if (node.kind === 'pane') {
    if (!existing) lines.push(`launch --cwd=current --title=${node.id}`)
    return
  }
  const origin = firstPane(node.first)
  if (!existing) lines.push(`launch --cwd=current --title=${origin}`)
  const second = firstPane(node.second)
  const location = node.axis === 'x' ? 'vsplit' : 'hsplit'
  lines.push(`focus_matching_window title:${origin}`)
  lines.push(`launch --location=${location} --cwd=current --title=${second}`)
  if (node.first.kind === 'split') emit(node.first, lines, origin)
  if (node.second.kind === 'split') emit(node.second, lines, second)
}

export function enabledFor(mode: string, tree: LayoutNode) {
  const named = ['tall', 'fat', 'grid', 'horizontal', 'vertical', 'stack']
  if (mode === 'custom') return ['splits', ...named].join(',')
  const bias = Math.round(rootRatio(tree) * 100)
  const current = named.includes(mode) ? `${mode}:bias=${bias}` : mode
  return [current, ...named.filter((item) => item !== mode), 'splits'].join(',')
}
