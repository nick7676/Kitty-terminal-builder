import { describe, expect, it } from 'vitest'
import { parseDocument, removeValue, serializeDocument, setValue, setValues, valuesOf } from './document'

describe('kitty configuration document', () => {
  it('round-trips comments, unknown directives and whitespace exactly', () => {
    const source = '# Personal config\n\nfuture_kitty_option value with spaces\nmap ctrl+x launch --type=tab vim\n'
    expect(serializeDocument(parseDocument(source))).toBe(source)
  })

  it('changes only the last effective occurrence', () => {
    const document = parseDocument('font_size 11\n# override\nfont_size 13\n')
    setValue(document, 'font_size', '15')
    expect(serializeDocument(document)).toBe('font_size 11\n# override\nfont_size 15\n')
  })

  it('preserves repeated directives as ordered values', () => {
    const document = parseDocument('map ctrl+a action_one\nmap ctrl+b action_two\n')
    expect(valuesOf(document, 'map')).toEqual(['ctrl+a action_one', 'ctrl+b action_two'])
    setValues(document, 'map', ['ctrl+c action_three', 'ctrl+d action_four'])
    expect(serializeDocument(document)).toBe('map ctrl+c action_three\nmap ctrl+d action_four\n')
  })

  it('adds and removes managed values without damaging raw lines', () => {
    const document = parseDocument('# Header\nunknown future\n')
    setValue(document, 'font_family', 'JetBrains Mono')
    removeValue(document, 'font_family')
    expect(serializeDocument(document)).toContain('# Header\nunknown future')
  })
})
