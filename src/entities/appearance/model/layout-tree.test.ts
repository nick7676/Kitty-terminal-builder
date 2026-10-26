import { describe, expect, it } from 'vitest'
import { sessionFor, type TerminalPane } from './layout-tree'

const panes = (weights: number[]): TerminalPane[] => weights.map((weight, index) => ({ id: `t${index + 1}`, weight }))

describe('sessionFor', () => {
  it('opens a single terminal until another is added', () => {
    const text = sessionFor(panes([1]))
    expect(text.match(/^launch /gm)).toHaveLength(1)
    expect(text).not.toContain('vsplit')
  })

  it('adds the next terminal to the right at the dragged size', () => {
    const text = sessionFor(panes([3, 1]))
    expect(text).toContain('launch --location=vsplit --bias=25 --cwd=current --title=t2')
    expect(text.match(/^launch /gm)).toHaveLength(2)
  })
})
