export interface TerminalPane {
  id: string
  weight: number
}

export function defaultPanes(): TerminalPane[] {
  return [{ id: 't1', weight: 1 }]
}

export function loadPanes(raw: string | null): TerminalPane[] {
  try {
    const parsed = JSON.parse(raw ?? '') as TerminalPane[]
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((pane) => typeof pane.id === 'string' && pane.weight > 0)) return parsed.slice(0, 6)
  } catch { /* keep the single terminal */ }
  return defaultPanes()
}

export function addPane(panes: TerminalPane[]): TerminalPane[] {
  if (panes.length >= 6) return panes
  return [...panes, { id: `t-${Math.random().toString(36).slice(2, 7)}`, weight: 1 }]
}

export function removePane(panes: TerminalPane[], id: string): TerminalPane[] {
  if (panes.length <= 1) return panes
  const next = panes.filter((pane) => pane.id !== id)
  return next.length ? next : panes
}

export function resizePair(panes: TerminalPane[], index: number, fraction: number): TerminalPane[] {
  const left = panes[index]
  const right = panes[index + 1]
  if (!left || !right) return panes
  const share = Math.min(0.85, Math.max(0.15, fraction))
  const total = left.weight + right.weight
  const next = panes.slice()
  next[index] = { ...left, weight: total * share }
  next[index + 1] = { ...right, weight: total * (1 - share) }
  return next
}

function quote(path: string) {
  return `'${path.replaceAll('\'', '\'"\'"\'')}'`
}

export function sessionFor(panes: TerminalPane[], shellPath = '') {
  const lines = ['new_tab layout', 'layout splits']
  const total = panes.reduce((sum, pane) => sum + pane.weight, 0) || 1
  let origin = 0
  panes.forEach((pane, index) => {
    const width = pane.weight / total
    const command = shellPath ? ` ${quote(shellPath)} ${origin.toFixed(4)} ${width.toFixed(4)}` : ''
    if (index === 0) lines.push(`launch --cwd=current --title=${pane.id}${command}`)
    else {
      const rest = panes.slice(index).reduce((sum, pane) => sum + pane.weight, 0)
      const group = panes.slice(index - 1).reduce((sum, pane) => sum + pane.weight, 0)
      const bias = Math.min(85, Math.max(15, Math.round((rest / group) * 100)))
      lines.push(`launch --location=vsplit --bias=${bias} --cwd=current --title=${pane.id}${command}`)
    }
    origin += width
  })
  return `${lines.join('\n')}\n`
}
