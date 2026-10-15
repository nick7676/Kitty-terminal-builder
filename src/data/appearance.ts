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
  'cursor_shape', 'cursor_blink_interval', 'background_opacity', 'background_blur', 'background_tint',
  'background_image', 'background_image_layout', 'window_padding_width', 'hide_window_decorations',
  'tab_bar_style', 'tab_bar_edge', 'tab_bar_align', 'tab_separator', 'tab_title_template', 'tab_bar_min_tabs',
  'enabled_layouts', 'startup_session',
] as const

export const themeKeys = [
  ...surfaceSlots.map(([key]) => key),
  ...ansiSlots.map(([key]) => key),
]

export const fontChoices = ['monospace', 'Menlo', 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Hack', 'IBM Plex Mono', 'Iosevka', 'Noto Sans Mono']
export const cursorShapes = ['block', 'beam', 'underline'] as const
export const tabStyles = ['fade', 'separator', 'slant', 'powerline', 'hidden', 'custom'] as const
export const imageLayouts = ['cscaled', 'scaled', 'tiled', 'mirror-tiled', 'clamped', 'centered'] as const
export const windowLayouts = ['tall', 'fat', 'grid', 'horizontal', 'vertical', 'stack'] as const

export function activeLayout(value: string) {
  const first = value.trim().split(/[\s,]+/)[0]
  return !first || first === '*' ? 'tall' : first
}

export function layoutOrder(layout: string) {
  return [layout, ...windowLayouts.filter((item) => item !== layout)].join(',')
}

export function kittyString(value: string) {
  const bare = value.trim().replace(/^"(.*)"$/, '$1')
  if (!bare || bare === 'none') return 'none'
  return /[\s"]/.test(bare) ? `"${bare.replaceAll('"', '')}"` : bare
}

export function plainPath(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'none') return ''
  return trimmed.replace(/^"(.*)"$/, '$1')
}
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

export interface TerminalScene {
  id: string
  name: string
  note: string
  sessionPath: string
  session: string
  values: Record<string, string>
}

const splitsSession = `new_tab fish
layout tall
launch --cwd=current
launch --cwd=current
launch --cwd=current
new_tab dotfiles
layout tall
launch --cwd=current
new_tab nvim
layout stack
launch --cwd=current
`

const wallpaperSession = `new_tab home
layout stack
launch --cwd=current
`

export const scenes: TerminalScene[] = [
  {
    id: 'splits',
    name: 'Splits',
    note: 'Tabs, a tall layout and a translucent window',
    sessionPath: 'sessions/splits.session',
    session: splitsSession,
    values: {
      ...palette('#1a1d2a', '#d7dced', '#8fb4ff', '#2c3558', [
        '#1a1d2a', '#f2a2c0', '#8fd4b0', '#e6c07b', '#8fb4ff', '#c9a6f2', '#7fd6e8', '#d7dced',
        '#5c647c', '#ffb3c7', '#b6ebc8', '#f3d7a1', '#b3cdff', '#e0c6ff', '#b7eef6', '#ffffff',
      ], ['#d7dced', '#1a1d2a', '#8b93ab', '#1a1d2a']),
      background_opacity: '0.9',
      background_blur: '16',
      background_tint: '0.2',
      window_padding_width: '8',
      hide_window_decorations: 'no',
      tab_bar_edge: 'top',
      tab_bar_style: 'custom',
      tab_bar_align: 'left',
      tab_separator: ' · ',
      tab_title_template: '{index} {title}',
      tab_bar_min_tabs: '1',
      enabled_layouts: layoutOrder('tall'),
      font_size: '13',
      cursor_shape: 'beam',
      startup_session: 'sessions/splits.session',
    },
  },
  {
    id: 'wallpaper',
    name: 'Wallpaper',
    note: 'One pane over a scaled background image',
    sessionPath: 'sessions/wallpaper.session',
    session: wallpaperSession,
    values: {
      ...palette('#102033', '#e7f2ff', '#7fd6e8', '#1d3d5c', [
        '#102033', '#ff6b8a', '#7ddea0', '#ffe08a', '#8eb6ff', '#d2b4ff', '#7fd6e8', '#d5e4f5',
        '#5d7894', '#ffb086', '#b6ebc8', '#fff0b8', '#b7d0ff', '#e6d2ff', '#b7eef6', '#ffffff',
      ], ['#e7f2ff', '#102033', '#8eb6c9', '#102033']),
      background_opacity: '1',
      background_blur: '0',
      background_tint: '0.34',
      background_image_layout: 'cscaled',
      window_padding_width: '18',
      hide_window_decorations: 'no',
      tab_bar_style: 'hidden',
      tab_bar_edge: 'top',
      tab_bar_min_tabs: '2',
      enabled_layouts: layoutOrder('stack'),
      font_size: '14',
      cursor_shape: 'beam',
      startup_session: 'sessions/wallpaper.session',
    },
  },
]

export function cssColor(value: string | undefined, fallback: string) {
  const raw = (value ?? '').trim()
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${[...raw.slice(1)].map((part) => part + part).join('')}`
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw
  if (/^#[0-9a-f]{8}$/i.test(raw)) return raw.slice(0, 7)
  return fallback
}
