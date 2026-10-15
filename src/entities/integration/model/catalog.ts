import type { InstallMethod, Integration } from '@/shared/api'

const install = (...values: string[]): InstallMethod[] => values.map((value) => {
  const [manager, ...packageParts] = value.split(':')
  return { manager, package: packageParts.join(':') }
})

const make = (category: string, entries: [string, string, string?, string[]?][]): Integration[] =>
  entries.map(([name, description, binary, methods]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name, category, description, binary, install: methods ? install(...methods) : [],
  }))

export const integrations: Integration[] = [
  ...make('Images & documents', [
    ['bookokrat', 'Terminal PDF and EPUB viewer.'], ['termpdf.py', 'PDF, DJVU and CBR viewer.'],
    ['tdf', 'Fast terminal PDF viewer.', 'tdf', ['cargo:tdf']], ['fancy-cat', 'Render rich documents in kitty.'],
    ['meowpdf', 'Rust PDF viewer with Vim controls.'], ['mcat', 'Display many file formats with images.'],
    ['dawn', 'Markdown editor using kitty protocols.'], ['presenterm', 'Markdown presentations with images.', 'presenterm', ['brew:presenterm', 'cargo:presenterm']],
    ['mdfried', 'Markdown viewer with images.'], ['kmv', 'Markdown viewer built for kitty.'],
    ['term-image', 'Browse images in the terminal.', 'term-image', ['pipx:term-image']], ['koneko', 'Browse Pixiv images in kitty.'],
    ['viu', 'Fast terminal image viewer.', 'viu', ['brew:viu', 'cargo:viu']], ['nb', 'Notes and knowledge base with images.', 'nb', ['brew:nb']],
    ['w3m', 'Text web browser with kitty graphics.', 'w3m', ['brew:w3m', 'apt:w3m', 'dnf:w3m', 'pacman:w3m']],
    ['terminal-browser', 'Chromium rendered in the terminal.'], ['chawan', 'Modern text-mode browser.', 'cha', ['brew:chawan']],
    ['mpv', 'Play video through kitty graphics.', 'mpv', ['brew:mpv', 'apt:mpv', 'dnf:mpv', 'pacman:mpv']],
    ['timg', 'Multithreaded image and video viewer.', 'timg', ['brew:timg', 'apt:timg', 'pacman:timg']],
  ]),
  ...make('File managers', [
    ['ranger', 'File manager with image previews.', 'ranger', ['brew:ranger', 'apt:ranger', 'dnf:ranger', 'pacman:ranger']],
    ['nnn', 'Tiny file manager with previews.', 'nnn', ['brew:nnn', 'apt:nnn', 'dnf:nnn', 'pacman:nnn']],
    ['Yazi', 'Graphics, drag-and-drop and clipboard.', 'yazi', ['brew:yazi', 'cargo:yazi-fm', 'pacman:yazi']],
    ['clifm', 'Shell-like file manager.', 'clifm', ['brew:clifm', 'apt:clifm', 'pacman:clifm']],
    ['hunter', 'File manager with image previews.'], ['far2l', 'Dual-panel manager and terminal emulator.'], ['elio', 'Previews and drag-and-drop.'],
  ]),
  ...make('Data & system', [
    ['neofetch', 'System information with images.', 'neofetch', ['brew:neofetch', 'apt:neofetch', 'pacman:neofetch']],
    ['matplotlib', 'Plot through kitty backends.'], ['KittyTerminalImages.jl', 'Display Julia images.'],
    ['euporie', 'Jupyter notebooks with plots.', 'euporie', ['pipx:euporie']],
    ['gnuplot', 'kittygd and kittycairo backends.', 'gnuplot', ['brew:gnuplot', 'apt:gnuplot', 'dnf:gnuplot', 'pacman:gnuplot']],
    ['k-nine', 'Command-line plotnine charts.'], ['tgutui', 'Terminal operating test equipment.'],
    ['onefetch', 'Rich repository information.', 'onefetch', ['brew:onefetch', 'cargo:onefetch', 'pacman:onefetch']],
    ['patat', 'Pandoc terminal presentations.', 'patat', ['brew:patat', 'apt:patat', 'pacman:patat']],
    ['wttr.in', 'Weather in the terminal.', 'curl'], ['wl-clipboard-manager', 'Wayland clipboard manager.'], ['NEMU', 'QEMU manager with kitty display.'],
  ]),
  ...make('Editors', [
    ['kakoune', 'Native kitty windows for panels and REPLs.', 'kak', ['brew:kakoune', 'apt:kakoune', 'dnf:kakoune', 'pacman:kakoune']],
    ['orbiton', 'Rich Markdown and image previews.', 'o', ['brew:orbiton']], ['vim-slime', 'Send Vim code to a kitty REPL.'],
    ['vim-kitty-navigator', 'Navigate Vim and kitty splits.'], ['vim-test', 'Run tests in terminal windows.'],
    ['snacks.nvim', 'Inline images for Neovim.'], ['image.nvim', 'Render images in Neovim.'],
    ['image_preview.nvim', 'Image preview for Neovim.'], ['hologram.nvim', 'Images inside Neovim.'], ['kitty-graphics.el', 'Images in Emacs.'],
  ]),
  ...make('Scrollback', [
    ['kitty-search-incremental', 'Live incremental scrollback search.'], ['kitty-scrollback.nvim', 'Browse scrollback with Neovim.'],
    ['kitty-search', 'Live search of scrollback.'], ['kitty-grab', 'Keyboard text selection.'], ['kitty-smart-scroll', 'Context-aware scroll keys.'],
  ]),
  ...make('Desktop & security', [
    ['kitty panel', 'Terminal-based system panel.'], ['pawbar', 'Desktop kitten panel.'],
    ['1Password', 'Inject credentials with 1Password.', 'op', ['brew:1password-cli']],
    ['BitWarden', 'Inject Bitwarden credentials.', 'bw', ['brew:bitwarden-cli', 'npm:@bitwarden/cli']],
    ['kitti3', 'Drop-down kitty terminal for i3.'],
  ]),
  ...make('AI & misc', [
    ['captain-miao', 'Monitor AI coding sessions.'], ['gattino', 'Natural language to shell commands.'],
    ['DOOM', 'Play DOOM in kitty.'], ['kitty-smart-tab', 'Context-aware tab control.'],
    ['weechat-hints', 'URL hints for WeeChat.'], ['glkitty', 'C library for OpenGL shaders.'],
  ]),
]

export const integrationCategories = [...new Set(integrations.map((item) => item.category))]
export const integrationDocs = (id: string) => `https://sw.kovidgoyal.net/kitty/integrations/#${id}`

export function integrationBinaries() {
  return [...new Set(integrations.flatMap((item) => item.binary ? [item.binary] : []))]
}

export function packageCommand(manager: string, action: string, packageName: string) {
  if (manager === 'brew-cask') return `brew ${action === 'install' ? 'install --cask' : `${action} --cask`} ${packageName}`
  if (action === 'install' && manager === 'npm') return `npm install -g ${packageName}`
  if (action === 'install') return `${manager} install ${packageName}`
  return `${manager} ${action} ${packageName}`
}

export function matchingInstall(methods: InstallMethod[], managers: string[]) {
  return methods.find((item) => managers.includes(item.manager === 'brew-cask' ? 'brew' : item.manager))
}
