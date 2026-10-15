export type ConfigNode =
  | { type: 'raw'; raw: string }
  | { type: 'directive'; raw: string; key: string; value: string; indent: string; dirty: boolean }

export interface ConfigDocument {
  nodes: ConfigNode[]
  trailingNewline: boolean
}

const directivePattern = /^(\s*)([A-Za-z_][\w-]*)(?:\s+(.*?))?\s*$/

export function parseDocument(source: string): ConfigDocument {
  const trailingNewline = source.endsWith('\n')
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  if (trailingNewline) lines.pop()
  return {
    trailingNewline,
    nodes: lines.map((raw, index) => {
      if (!raw.trim() || raw.trimStart().startsWith('#') || (index > 0 && lines[index - 1].trimEnd().endsWith('\\'))) return { type: 'raw', raw }
      const match = raw.match(directivePattern)
      return match
        ? { type: 'directive', raw, indent: match[1], key: match[2], value: match[3] ?? '', dirty: false }
        : { type: 'raw', raw }
    }),
  }
}

export function serializeDocument(document: ConfigDocument): string {
  const content = document.nodes.map((node) =>
    node.type === 'directive' && node.dirty
      ? `${node.indent}${node.key}${node.value ? ` ${node.value}` : ''}`
      : node.raw
  ).join('\n')
  return content + (document.trailingNewline ? '\n' : '')
}

export function valuesOf(document: ConfigDocument, key: string): string[] {
  return document.nodes.filter((node): node is Extract<ConfigNode, { type: 'directive' }> => node.type === 'directive' && node.key === key).map((node) => node.value)
}

export function setValue(document: ConfigDocument, key: string, value: string): void {
  const index = document.nodes.findLastIndex((node) => node.type === 'directive' && node.key === key)
  if (index >= 0) {
    const node = document.nodes[index]
    if (node.type === 'directive') document.nodes[index] = { ...node, value, dirty: true }
  } else {
    if (document.nodes.length && document.nodes.at(-1)?.raw !== '') document.nodes.push({ type: 'raw', raw: '' })
    document.nodes.push({ type: 'raw', raw: '# Managed by Kitty Builder' })
    document.nodes.push({ type: 'directive', raw: '', key, value, indent: '', dirty: true })
  }
}

export function setValues(document: ConfigDocument, key: string, values: string[]): void {
  const first = document.nodes.findIndex((node) => node.type === 'directive' && node.key === key)
  document.nodes = document.nodes.filter((node) => node.type !== 'directive' || node.key !== key)
  const index = first < 0 ? document.nodes.length : first
  document.nodes.splice(index, 0, ...values.map((value) => ({ type: 'directive' as const, raw: '', key, value, indent: '', dirty: true })))
}

export function removeValue(document: ConfigDocument, key: string): void {
  document.nodes = document.nodes.filter((node) => node.type !== 'directive' || node.key !== key)
}

function envName(value: string) {
  const eq = value.indexOf('=')
  const space = value.indexOf(' ')
  if (eq >= 0 && (space < 0 || eq < space)) return value.slice(0, eq)
  return space < 0 ? value : value.slice(0, space)
}

export function envValue(document: ConfigDocument, name: string) {
  const raw = valuesOf(document, 'env').find((value) => envName(value) === name)
  if (!raw) return ''
  const rest = raw.slice(name.length).trim().replace(/^=/, '')
  return rest.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
}

export function upsertEnv(document: ConfigDocument, name: string, value: string) {
  const full = `${name}=${value.replaceAll('"', '')}`
  const index = document.nodes.findIndex((node) => node.type === 'directive' && node.key === 'env' && envName(node.value) === name)
  if (index >= 0) {
    const node = document.nodes[index]
    if (node.type === 'directive') document.nodes[index] = { ...node, value: full, dirty: true }
    return
  }
  if (document.nodes.length && document.nodes.at(-1)?.type === 'raw' && document.nodes.at(-1)?.raw !== '') document.nodes.push({ type: 'raw', raw: '' })
  document.nodes.push({ type: 'raw', raw: '# Managed by Kitty Builder' })
  document.nodes.push({ type: 'directive', raw: '', key: 'env', value: full, indent: '', dirty: true })
}

export function removeEnv(document: ConfigDocument, name: string) {
  document.nodes = document.nodes.filter((node) => node.type !== 'directive' || node.key !== 'env' || envName(node.value) !== name)
}
