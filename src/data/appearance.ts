export const ansiSlots = [
  ['color0', 'Black'], ['color1', 'Red'], ['color2', 'Green'], ['color3', 'Yellow'],
  ['color4', 'Blue'], ['color5', 'Magenta'], ['color6', 'Cyan'], ['color7', 'White'],
  ['color8', 'Bright black'], ['color9', 'Bright red'], ['color10', 'Bright green'], ['color11', 'Bright yellow'],
  ['color12', 'Bright blue'], ['color13', 'Bright magenta'], ['color14', 'Bright cyan'], ['color15', 'Bright white'],
] as const

export const surfaceSlots = [
  ['foreground', 'Text', '#dddddd'],
  ['background', 'Background', '#000000'],
  ['cursor', 'Cursor', '#cccccc'],
  ['cursor_text_color', 'Cursor text', '#111111'],
  ['selection_background', 'Selection', '#fffacd'],
  ['selection_foreground', 'Selection text', '#000000'],
  ['url_color', 'Links', '#0087bd'],
  ['active_tab_foreground', 'Active tab text', '#000000'],
  ['active_tab_background', 'Active tab', '#eeeeee'],
  ['inactive_tab_foreground', 'Inactive tab text', '#444444'],
  ['inactive_tab_background', 'Inactive tab', '#999999'],
] as const

export const styleKeys = [
  'font_family', 'bold_font', 'italic_font', 'bold_italic_font', 'font_size',
  'cursor_shape', 'cursor_blink_interval', 'background_opacity', 'background_blur',
  'window_padding_width', 'tab_bar_style',
] as const

export const themeKeys = [
  ...surfaceSlots.map(([key]) => key),
  ...ansiSlots.map(([key]) => key),
]

export const fontChoices = ['monospace', 'Menlo', 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Hack', 'IBM Plex Mono', 'Iosevka']
export const cursorShapes = ['block', 'beam', 'underline'] as const
export const tabStyles = ['fade', 'separator', 'slant', 'powerline', 'hidden', 'custom'] as const
export const blinkChoices = [
  ['-1', 'Default'],
  ['0', 'Off'],
  ['0.5', 'Steady'],
  ['1', 'Slow'],
] as const

export interface TerminalPreset {
  id: string
  name: string
  note: string
  values: Record<string, string>
}

const palette = (
  background: string, foreground: string, cursor: string, selection: string,
  ansi: string[],
  tabs: [string, string, string, string],
): Record<string, string> => ({
  background, foreground, cursor,
  cursor_text_color: background,
  selection_background: selection,
  selection_foreground: foreground,
  url_color: ansi[4],
  active_tab_foreground: tabs[0],
  active_tab_background: tabs[1],
  inactive_tab_foreground: tabs[2],
  inactive_tab_background: tabs[3],
  ...Object.fromEntries(ansi.map((color, index) => [`color${index}`, color])),
})

export const presets: TerminalPreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    note: 'Upstream kitty defaults',
    values: palette('#000000', '#dddddd', '#cccccc', '#fffacd', [
      '#000000', '#cc0403', '#19cb00', '#cecb00', '#0d73cc', '#cb1ed1', '#0dcdcd', '#dddddd',
      '#767676', '#f2201f', '#23fd00', '#fffd00', '#1a8fff', '#fd28ff', '#14ffff', '#ffffff',
    ], ['#000000', '#eeeeee', '#444444', '#999999']),
  },
  {
    id: 'carbon',
    name: 'Carbon',
    note: 'Cool dark, blue accent',
    values: palette('#0d1117', '#e6edf3', '#58a6ff', '#264f78', [
      '#484f58', '#ff7b72', '#3fb950', '#d29922', '#58a6ff', '#bc8cff', '#39c5cf', '#b1bac4',
      '#6e7681', '#ffa198', '#56d364', '#e3b341', '#79c0ff', '#d2a8ff', '#56d4dd', '#ffffff',
    ], ['#e6edf3', '#1f6feb', '#8b949e', '#161b22']),
  },
  {
    id: 'dusk',
    name: 'Dusk',
    note: 'Violet night',
    values: palette('#16121f', '#f3e9fb', '#c38bec', '#3d2a55', [
      '#3a3348', '#ff6b8a', '#7ddea0', '#e6c27a', '#b794f6', '#f0a3ff', '#8ad4e8', '#ddd4ea',
      '#6d657c', '#ff8fa3', '#9cf0b8', '#f3d7a1', '#d2b4ff', '#ffc2ff', '#b7ecf6', '#ffffff',
    ], ['#1b1224', '#c38bec', '#b7a8c9', '#2a2236']),
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    note: 'Deep teal',
    values: palette('#071c22', '#d7f6f2', '#5eead4', '#134e4a', [
      '#1d3b44', '#fb7185', '#34d399', '#fbbf24', '#38bdf8', '#c084fc', '#2dd4bf', '#c9e7e4',
      '#5d7a82', '#fda4af', '#6ee7b7', '#fcd34d', '#7dd3fc', '#d8b4fe', '#5eead4', '#f0fdfa',
    ], ['#042f2e', '#5eead4', '#99f6e4', '#0f2f33']),
  },
  {
    id: 'ember',
    name: 'Ember',
    note: 'Warm dark amber',
    values: palette('#1c1410', '#f6e7d8', '#ffb86b', '#5c3b24', [
      '#4a3b32', '#ff6b4a', '#b6d97a', '#ffb86b', '#7eb6ff', '#ff8bd2', '#7ddec8', '#e6d3c4',
      '#8a7568', '#ff957a', '#d4eea4', '#ffd29a', '#b3d4ff', '#ffb3e0', '#b6f3e4', '#fff7ef',
    ], ['#2a1d16', '#ffb86b', '#c4aa96', '#140e0b']),
  },
  {
    id: 'paper',
    name: 'Paper',
    note: 'Light writing surface',
    values: palette('#f7f3ea', '#2c2825', '#c4552a', '#f3d7a1', [
      '#f7f3ea', '#b42318', '#3f7d4e', '#8a5a00', '#1d4e89', '#7a3e78', '#0f6f6a', '#5c564e',
      '#d9d2c5', '#d14332', '#4f9d62', '#b45309', '#2563eb', '#9d4edd', '#0f9488', '#2c2825',
    ], ['#2c2825', '#efe7d6', '#6f675e', '#e7e0d2']),
  },
]

export function cssColor(value: string | undefined, fallback: string) {
  const raw = (value ?? '').trim()
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${[...raw.slice(1)].map((part) => part + part).join('')}`
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw
  if (/^#[0-9a-f]{8}$/i.test(raw)) return raw.slice(0, 7)
  return fallback
}
