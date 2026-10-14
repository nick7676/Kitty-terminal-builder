import { diffLines } from 'diff'
import './styles.css'
import { parseDocument, removeValue, serializeDocument, setValue, setValues, valuesOf } from './core/document'
import { backend, isTauri } from './core/tauri'
import { content, createFile, initialize, isDirty, openFile, saveFile, state } from './core/store'
import type { KittyOption } from './core/types'
import { integrationCategories, integrationDocs, integrations } from './data/integrations'

const app = document.querySelector<HTMLDivElement>('#app')!
let filesMode: 'source' | 'diff' = 'source'
let backupsLoadedFor = ''
let backups: Awaited<ReturnType<typeof backend.backups>> = []
let integrationStateLoaded = false
let detectedCommands: Record<string, boolean> = {}
let managedPackages: Awaited<ReturnType<typeof backend.managedPackages>> = []

const fileTemplates: Record<string, string> = {
  'open-actions.conf': '# Open clicked files and URLs\nprotocol file\nmime text/*\naction launch --type=overlay $EDITOR $FILE_PATH\n',
  'launch-actions.conf': '# Handle launched files\nprotocol file\nmime text/*\naction launch --type=os-window $EDITOR $FILE_PATH\n',
  'ssh.conf': '# SSH kitten configuration\n# hostname example.com\n# remote_dir /tmp/kitty-ssh-kitten\n',
  'diff.conf': '# kitty-diff configuration\nsyntax_aliases py:python\n',
  'sessions/workspace.session': '# Kitty session\nnew_tab Workspace\nlayout splits\nlaunch --cwd=current\n',
  'profiles/work.conf': '# Modular kitty profile\n# This file is included from kitty.conf\n',
  'themes/custom.conf': '# Custom theme\nforeground #dddddd\nbackground #000000\n',
  'shaders/custom.slang': '// Kitty Slang shader\nvec4 mainImage(vec4 color, vec2 fragCoord) {\n    return color;\n}\n',
  'shaders/custom.pipeline': '# Shader pipeline\nshader custom.slang\n',
  'tab_bar.py': 'from kitty.tab_bar import DrawData, ExtraData, TabBarData\n\n\ndef draw_tab(draw_data: DrawData, screen, tab: TabBarData, before: int, max_title_length: int, index: int, is_last: bool, extra_data: ExtraData) -> int:\n    screen.draw(tab.title)\n    return screen.cursor.x\n',
  'window_title_bar.py': '# Custom window title bar\n',
  'notifications.py': '# Notification filters and handlers\n',
  'paste-actions.py': '# Paste filtering hooks\n',
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!)
}

function currentRoute(): { page: string; detail: string } {
  const [page = 'overview', detail = 'fonts'] = location.hash.replace(/^#\/?/, '').split('/')
  return { page: page || 'overview', detail }
}

function navLink(path: string, label: string, icon: string, active: boolean): string {
  return `<a class="nav-link ${active ? 'active' : ''}" href="#/${path}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`
}

function shell(body: string): string {
  const route = currentRoute()
  const status = state.status
  return `
    <header class="app-header">
      <a class="brand" href="#/overview"><span class="brand-mark">›_</span><span><b>Kitty Builder</b><small>Tauri desktop studio</small></span></a>
      <div class="status-bar">
        ${state.loading ? '<span class="pill">Loading…</span>' : ''}
        ${state.error ? '<span class="pill warning">Backend issue</span>' : ''}
        <span class="pill ${status?.kittyInstalled ? 'success' : 'warning'}"><i class="dot"></i>${escapeHtml(status?.kittyVersion ?? 'kitty not detected')}</span>
        <span class="pill">${escapeHtml(status?.os ?? 'web')} · ${escapeHtml(status?.arch ?? 'preview')}</span>
      </div>
    </header>
    <aside class="sidebar"><nav class="nav">
      ${navLink('overview', 'Overview', '⌂', route.page === 'overview')}
      ${navLink('config/fonts', 'All settings', '⚙', route.page === 'config')}
      ${navLink('files', 'Files & profiles', '▤', route.page === 'files')}
      ${navLink('integrations', 'Integrations', '◇', route.page === 'integrations')}
      ${navLink('setup', 'Kitty setup', '⌘', route.page === 'setup')}
    </nav><div class="config-path"><b>${escapeHtml(status?.configDir ?? '~/.config/kitty')}</b><small>Config directory</small></div></aside>
    <main class="main">${body}</main>
    ${state.log ? `<div class="toast">${escapeHtml(state.log)}</div>` : ''}
  `
}

function pageHead(eyebrow: string, title: string, lead: string, action = ''): string {
  return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="lead">${lead}</p></div>${action}</div>`
}

function renderOverview(): string {
  const stats = [
    [state.registry.options.length, 'Official options', `${state.registry.sections.length} complete sections`, '⚙'],
    [state.registry.maps.length, 'Default shortcuts', 'Version-aware mappings', '⌨'],
    [state.files.length, 'Configuration files', state.activeFile, '▤'],
    [state.status?.os ?? 'Web', 'Platform', state.status?.arch ?? 'Preview', '◫'],
  ]
  return `<div class="page">
    ${pageHead('kitty ' + state.registry.kittyVersion, 'Your complete kitty workspace', 'Every official option, companion file and supported integration in one safe native desktop application.', `<span class="pill ${isDirty() ? 'warning' : 'success'}">${isDirty() ? 'Unsaved changes' : 'Configuration synced'}</span>`)}
    ${!isTauri() ? '<div class="notice">This browser preview cannot access kitty. Run <code>npm run desktop</code> to load all 479 options and your real configuration.</div>' : ''}
    <div class="grid stats">${stats.map(([value, label, detail, icon]) => `<div class="card stat"><div><strong>${escapeHtml(value)}</strong><b>${label}</b><small>${escapeHtml(detail)}</small></div><span class="stat-icon">${icon}</span></div>`).join('')}</div>
    <div class="grid two-cols" style="margin-top:18px">
      <div class="card card-pad"><h2>Start building</h2><p class="card-desc">The registry comes directly from your installed kitty, so it always matches your version.</p><div class="action-list">
        <a class="action-item" href="#/config/fonts"><span><b>Open all settings</b><small>Search and edit every directive with official documentation.</small></span><span>→</span></a>
        <a class="action-item" href="#/files"><span><b>Manage files and sessions</b><small>Themes, actions, SSH, shaders, sessions and Python hooks.</small></span><span>→</span></a>
        <a class="action-item" href="#/integrations"><span><b>Browse all integrations</b><small>Editors, viewers, file managers, security and AI tools.</small></span><span>→</span></a>
      </div></div>
      <div class="card card-pad"><h2>Safe by design</h2><p class="card-desc">There is no generic shell command. Every write is atomic, every overwrite is backed up, and installers are strictly allowlisted.</p><div class="check-list"><div class="check"><span>Lossless configuration</span><span class="tag active">Active</span></div><div class="check"><span>Atomic backups</span><span class="tag active">Active</span></div><div class="check"><span>Command allowlist</span><span class="tag active">Active</span></div></div></div>
    </div>
  </div>`
}

function optionControl(option: KittyOption): string {
  const values = valuesOf(state.document, option.name)
  const value = values.at(-1) ?? option.default ?? ''
  if (option.kind === 'bool') return `<label class="toggle-row"><input class="switch option-input" data-name="${option.name}" type="checkbox" ${value === 'yes' ? 'checked' : ''}><span>${value === 'yes' ? 'Enabled' : 'Disabled'}</span></label>`
  if (option.kind === 'choice' && option.choices?.length) return `<select class="select option-input mono" data-name="${option.name}">${option.choices.map((choice) => `<option ${choice === value ? 'selected' : ''}>${escapeHtml(choice)}</option>`).join('')}</select>`
  if (option.kind === 'color') return `<div class="color-row"><input class="option-color" data-name="${option.name}" type="color" value="${/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}"><input class="input option-input" data-name="${option.name}" value="${escapeHtml(value)}"></div>`
  if (option.kind === 'multi') return `<textarea class="textarea option-multi" data-name="${option.name}">${escapeHtml(values.length ? values.join('\n') : (option.defaults ?? []).join('\n'))}</textarea>`
  return `<input class="input option-input" data-name="${option.name}" type="${option.kind === 'int' || option.kind === 'float' ? 'number' : 'text'}" ${option.kind === 'float' ? 'step="any"' : ''} value="${escapeHtml(value)}">`
}

function optionCard(option: KittyOption): string {
  const configured = valuesOf(state.document, option.name).length > 0
  return `<article class="card option" data-search="${escapeHtml(`${option.name} ${option.group} ${option.doc}`.toLowerCase())}">
    <div class="option-top"><div><span class="option-name">${option.name}</span> ${configured ? '<span class="tag active">Configured</span>' : ''} ${option.multi ? '<span class="tag">Repeatable</span>' : ''}<p class="option-group">${escapeHtml(option.group)}</p></div>${configured ? `<button class="btn small reset-option" data-name="${option.name}">↺ Default</button>` : ''}</div>
    <div class="option-control">${optionControl(option)}</div>
    ${option.doc ? `<details><summary class="option-doc" style="cursor:pointer">Official documentation</summary><p class="option-doc">${escapeHtml(option.doc)}</p></details>` : ''}
  </article>`
}

function renderShortcuts(): string {
  const maps = valuesOf(state.document, 'map')
  return `<article class="card option"><h2>Active mappings</h2><p class="card-desc">One mapping per line. Modal and alias syntax are preserved.</p><textarea id="map-editor" class="textarea" style="min-height:220px;margin-top:14px">${escapeHtml(maps.join('\n'))}</textarea></article>
    <h2 style="margin:12px 0 0">Official defaults</h2>
    ${state.registry.maps.map((map) => `<article class="card option" data-search="${escapeHtml(`${map.name} ${map.title} ${map.group}`.toLowerCase())}"><div class="option-top"><div><b class="option-name">${escapeHtml(map.title || map.name)}</b><p class="option-group">${escapeHtml(map.group)} ${map.only ? `· ${map.only}` : ''}</p></div><button class="btn small add-map" data-definition="${escapeHtml(map.definition)}">+ Add</button></div><code class="option-doc">${escapeHtml(map.definition)}</code></article>`).join('')}`
}

function renderConfig(section: string): string {
  const valid = state.registry.sections.some((item) => item.id === section) ? section : 'fonts'
  const sectionInfo = state.registry.sections.find((item) => item.id === valid)!
  const options = state.registry.options.filter((option) => option.section === valid && option.documented)
  return `<div class="config-layout">
    <aside class="section-list"><div class="search-wrap"><input id="option-search" class="input" placeholder="Search ${state.registry.options.length} options…"></div>${state.registry.sections.map((item) => `<a class="section-link ${item.id === valid ? 'active' : ''}" href="#/config/${item.id}">${escapeHtml(item.title)}<span>${item.id === 'shortcuts' ? state.registry.maps.length : state.registry.options.filter((option) => option.section === item.id && option.documented).length}</span></a>`).join('')}</aside>
    <section class="options-pane"><header class="options-head"><div><p class="eyebrow">Complete configuration</p><h1>${escapeHtml(sectionInfo.title)}</h1></div><div><span id="visible-count" class="pill">${valid === 'shortcuts' ? state.registry.maps.length : options.length} items</span> <span class="pill ${isDirty() ? 'warning' : 'success'}">${isDirty() ? 'Modified' : 'Saved'}</span></div></header>
    <div id="options-list" class="options-list">${valid === 'shortcuts' ? renderShortcuts() : options.length ? options.map(optionCard).join('') : '<div class="empty">Run the Tauri desktop app to load the complete option registry from kitty.</div>'}</div></section>
  </div>`
}

function diffHtml(): string {
  return `<pre class="diff">${diffLines(state.original, content()).map((part) => `<span class="${part.added ? 'diff-add' : part.removed ? 'diff-remove' : 'diff-same'}">${escapeHtml(part.value)}</span>`).join('')}</pre>`
}

function renderFiles(): string {
  const templateOptions = Object.keys(fileTemplates).map((path) => `<option value="${path}">${path}</option>`).join('')
  const listedFiles = state.files.some((file) => file.relativePath === 'kitty.conf')
    ? state.files
    : [{ relativePath: 'kitty.conf', size: 0 }, ...state.files]
  return `<div class="files-layout">
    <aside class="file-panel"><div class="panel-title"><div><b>Configuration files</b><div class="option-group">${state.files.length} discovered</div></div></div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:13px"><select id="template-select" class="select">${templateOptions}</select><button id="create-file" class="btn">+</button></div>
      ${listedFiles.map((file) => `<button class="file-button ${file.relativePath === state.activeFile ? 'active' : ''}" data-file="${escapeHtml(file.relativePath)}"><span>▤ ${escapeHtml(file.relativePath)}</span><small>${file.size} B</small></button>`).join('')}
      <div class="backup-list"><p class="eyebrow">Automatic backups</p>${backups.length ? backups.slice(0, 10).map((backup) => `<button class="backup-button" data-backup="${escapeHtml(backup.path)}">↺ ${new Date(backup.timestamp * 1000).toLocaleString()}</button>`).join('') : '<p class="option-group">A backup is created before each overwrite.</p>'}</div>
    </aside>
    <section class="editor-pane"><div class="editor-toolbar"><div><h1>${escapeHtml(state.activeFile)}</h1><p class="option-group">${escapeHtml(state.status?.configDir ?? '')}/${escapeHtml(state.activeFile)}</p></div><div class="toolbar-actions"><span id="dirty-pill" class="pill ${isDirty() ? 'warning' : 'success'}">${isDirty() ? 'Modified' : 'Saved'}</span><button id="discard-file" class="btn" ${!isDirty() ? 'disabled' : ''}>Discard</button><button id="toggle-diff" class="btn">${filesMode === 'source' ? 'Show diff' : 'Edit source'}</button><button id="save-file" class="btn primary" ${!isDirty() || !isTauri() ? 'disabled' : ''}>Save & reload</button></div></div>
      ${filesMode === 'source' ? `<textarea id="source-editor" class="textarea source-editor" spellcheck="false">${escapeHtml(content())}</textarea>` : diffHtml()}
      <div class="card card-pad" style="margin-top:14px"><h2>Lossless editor</h2><p class="card-desc">Comments, unknown future directives, includes, ordering and repeated values survive every visual edit. Supported companion files include actions, SSH, diff, sessions, themes, shaders, pipelines, tab bars, notifications and paste hooks.</p></div>
    </section>
  </div>`
}

function availableInstall(integration: (typeof integrations)[number]) {
  const managers = state.status?.packageManagers ?? []
  return integration.install.find((method) => managers.includes(method.manager === 'brew-cask' ? 'brew' : method.manager))
}

function renderIntegrations(): string {
  return `<div class="page">
    ${pageHead('Official ecosystem', 'Integrations', `${integrations.length} tools listed by the kitty project. Deterministic package-manager installs can run after explicit confirmation; all others link to official instructions.`)}
    <div class="filters"><div class="search-wrap"><input id="integration-search" class="input" placeholder="Search integrations…"></div><select id="integration-category" class="select"><option value="">All categories</option>${integrationCategories.map((category) => `<option>${category}</option>`).join('')}</select></div>
    <div id="catalog" class="grid catalog">${integrations.map((integration) => {
      const method = availableInstall(integration)
      const installed = Boolean(integration.binary && detectedCommands[integration.binary])
      const managed = integration.install.find((candidate) => managedPackages.some((item) => item.manager === candidate.manager && item.package === candidate.package))
      const command = method ? `${method.manager === 'brew-cask' ? 'brew install --cask' : method.manager === 'npm' ? 'npm install -g' : `${method.manager} install`} ${method.package}` : ''
      return `<article class="card integration" data-category="${escapeHtml(integration.category)}" data-search="${escapeHtml(`${integration.name} ${integration.description} ${integration.category}`.toLowerCase())}"><div class="integration-head"><h3>${escapeHtml(integration.name)}</h3>${installed ? '<span class="tag active">Installed</span>' : `<span class="tag">${escapeHtml(integration.category)}</span>`}</div><p>${escapeHtml(integration.description)}</p>${command && !installed ? `<div class="command-preview">${escapeHtml(command)}</div>` : ''}<div class="integration-actions">${managed ? `<button class="btn install-integration" data-action="upgrade" data-manager="${managed.manager}" data-package="${escapeHtml(managed.package)}" data-name="${escapeHtml(integration.name)}">Update</button><button class="btn danger install-integration" data-action="uninstall" data-manager="${managed.manager}" data-package="${escapeHtml(managed.package)}" data-name="${escapeHtml(integration.name)}">Remove</button>` : !installed && method ? `<button class="btn primary install-integration" data-action="install" data-manager="${method.manager}" data-package="${escapeHtml(method.package)}" data-name="${escapeHtml(integration.name)}">Install</button>` : !installed ? '<span class="tag">Manual setup</span>' : '<span class="tag">Externally managed</span>'}<a class="btn small" href="${integrationDocs(integration.id)}" target="_blank" rel="noreferrer">Docs ↗</a></div></article>`
    }).join('')}</div>
  </div>`
}

function renderSetup(): string {
  const status = state.status
  const brew = status?.packageManagers.includes('brew')
  const canManage = status?.os === 'macos' && brew
  const linuxInstall = 'curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin'
  return `<div class="page">
    ${pageHead('System', 'Kitty setup', 'Detect, install, update and connect kitty without exposing an unrestricted command shell.')}
    <div class="grid setup-grid"><div class="card card-pad"><h2>Installation status</h2><div class="check-list">
      <div class="check"><span>kitty binary</span><span class="tag ${status?.kittyInstalled ? 'active' : ''}">${status?.kittyInstalled ? 'Installed' : 'Missing'}</span></div>
      <div class="check"><span>Version</span><code>${escapeHtml(status?.kittyVersion ?? '—')}</code></div>
      <div class="check"><span>Binary path</span><code>${escapeHtml(status?.kittyPath ?? '—')}</code></div>
      <div class="check"><span>Config directory</span><code>${escapeHtml(status?.configDir ?? '—')}</code></div>
    </div><div style="display:flex;gap:8px;margin-top:15px">${canManage ? `<button id="manage-kitty" class="btn primary" data-action="${status?.kittyInstalled ? 'upgrade' : 'install'}">${status?.kittyInstalled ? 'Update kitty' : 'Install kitty'}</button>` : ''}<button id="refresh-status" class="btn">Refresh detection</button>${status?.kittyInstalled ? '<button id="reload-kitty" class="btn">Reload config</button>' : ''}</div></div>
    <div class="card card-pad"><h2>${status?.os === 'macos' ? 'macOS' : 'Linux'} installation</h2>${status?.os === 'macos'
      ? `<p class="card-desc">Kitty Builder uses Homebrew Cask when available. You see and approve the exact operation before it runs.</p><pre class="code-block">brew ${status?.kittyInstalled ? 'upgrade --cask' : 'install --cask'} kitty</pre>`
      : `<p class="card-desc">The official Linux installer is shown but never executed automatically because it pipes remote code into a shell.</p><pre class="code-block">${linuxInstall}</pre>`}
      <p class="card-desc" style="margin-top:14px">Detected package managers</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${status?.packageManagers.map((manager) => `<span class="tag active">${manager}</span>`).join('') || '<span class="tag">None</span>'}</div>
    </div></div>
    <div class="card card-pad" style="margin-top:16px"><h2>Security boundaries</h2><div class="grid stats" style="margin-top:12px"><div class="check">Filesystem <span class="tag active">Kitty config only</span></div><div class="check">Commands <span class="tag active">Allowlist only</span></div><div class="check">Writes <span class="tag active">Atomic + backup</span></div><div class="check">Remote scripts <span class="tag active">Never automatic</span></div></div></div>
  </div>`
}

function render(): void {
  const route = currentRoute()
  const body = route.page === 'config' ? renderConfig(route.detail)
    : route.page === 'files' ? renderFiles()
      : route.page === 'integrations' ? renderIntegrations()
        : route.page === 'setup' ? renderSetup()
          : renderOverview()
  app.innerHTML = shell(body)
  bindEvents(route.page)
}

function showMessage(message: string): void {
  state.log = message
  render()
  window.setTimeout(() => { state.log = ''; document.querySelector('.toast')?.remove() }, 3500)
}

function bindConfigEvents(): void {
  document.querySelector<HTMLInputElement>('#option-search')?.addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value.toLowerCase()
    let count = 0
    document.querySelectorAll<HTMLElement>('[data-search]').forEach((element) => {
      const visible = !query || element.dataset.search?.includes(query)
      element.hidden = !visible
      if (visible) count++
    })
    const label = document.querySelector('#visible-count')
    if (label) label.textContent = `${count} items`
  })
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.option-input').forEach((control) => control.addEventListener('change', () => {
    const value = control instanceof HTMLInputElement && control.type === 'checkbox' ? (control.checked ? 'yes' : 'no') : control.value
    setValue(state.document, control.dataset.name!, value)
    render()
  }))
  document.querySelectorAll<HTMLInputElement>('.option-color').forEach((control) => control.addEventListener('change', () => {
    setValue(state.document, control.dataset.name!, control.value); render()
  }))
  document.querySelectorAll<HTMLTextAreaElement>('.option-multi').forEach((control) => control.addEventListener('change', () => {
    setValues(state.document, control.dataset.name!, control.value.split('\n').filter(Boolean)); render()
  }))
  document.querySelectorAll<HTMLButtonElement>('.reset-option').forEach((button) => button.addEventListener('click', () => {
    removeValue(state.document, button.dataset.name!); render()
  }))
  document.querySelector<HTMLTextAreaElement>('#map-editor')?.addEventListener('change', (event) => {
    setValues(state.document, 'map', (event.target as HTMLTextAreaElement).value.split('\n').filter(Boolean)); render()
  })
  document.querySelectorAll<HTMLButtonElement>('.add-map').forEach((button) => button.addEventListener('click', () => {
    setValues(state.document, 'map', [...valuesOf(state.document, 'map'), button.dataset.definition!]); render()
  }))
}

async function loadBackups(): Promise<void> {
  if (!isTauri() || backupsLoadedFor === state.activeFile) return
  backupsLoadedFor = state.activeFile
  backups = await backend.backups(state.activeFile).catch(() => [])
  if (currentRoute().page === 'files') render()
}

function bindFilesEvents(): void {
  void loadBackups()
  document.querySelectorAll<HTMLButtonElement>('.file-button').forEach((button) => button.addEventListener('click', async () => {
    if (isDirty() && !confirm('Discard unsaved changes and open another file?')) return
    await openFile(button.dataset.file!); backupsLoadedFor = ''; render()
  }))
  document.querySelector<HTMLTextAreaElement>('#source-editor')?.addEventListener('input', (event) => {
    state.document = parseDocument((event.target as HTMLTextAreaElement).value)
    const pill = document.querySelector('#dirty-pill')
    if (pill) { pill.textContent = isDirty() ? 'Modified' : 'Saved'; pill.className = `pill ${isDirty() ? 'warning' : 'success'}` }
    const save = document.querySelector<HTMLButtonElement>('#save-file')
    if (save) save.disabled = !isDirty() || !isTauri()
  })
  document.querySelector('#toggle-diff')?.addEventListener('click', () => { filesMode = filesMode === 'source' ? 'diff' : 'source'; render() })
  document.querySelector('#discard-file')?.addEventListener('click', () => { state.document = parseDocument(state.original); render() })
  document.querySelector('#save-file')?.addEventListener('click', async () => {
    if (!confirm(`Write ${state.activeFile}, create a backup and reload kitty?`)) return
    try {
      await saveFile()
      const result = await backend.reload()
      backupsLoadedFor = ''
      showMessage(result.success ? 'Saved and reloaded successfully' : `Saved. Reload failed:\n${result.stderr}`)
    } catch (error) { showMessage(`Save failed:\n${String(error)}`) }
  })
  document.querySelector('#create-file')?.addEventListener('click', async () => {
    const selected = document.querySelector<HTMLSelectElement>('#template-select')!.value
    const path = prompt('Path inside the kitty config directory:', selected)
    if (!path) return
    try {
      await createFile(path, fileTemplates[selected])
      if (path.startsWith('profiles/') && confirm(`Add "include ${path}" to kitty.conf?`)) {
        const main = await backend.read('kitty.conf')
        const mainDocument = parseDocument(main.content)
        const includes = valuesOf(mainDocument, 'include')
        if (!includes.includes(path)) setValues(mainDocument, 'include', [...includes, path])
        await backend.write('kitty.conf', serializeDocument(mainDocument))
      }
      backupsLoadedFor = ''
      showMessage(`Created ${path}`)
    } catch (error) { showMessage(String(error)) }
  })
  document.querySelectorAll<HTMLButtonElement>('.backup-button').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm(`Restore this backup over ${state.activeFile}? The current file will also be backed up.`)) return
    try { await backend.restore(button.dataset.backup!, state.activeFile); await openFile(state.activeFile); backupsLoadedFor = ''; showMessage('Backup restored') } catch (error) { showMessage(String(error)) }
  }))
}

function bindIntegrationEvents(): void {
  if (isTauri() && !integrationStateLoaded) {
    integrationStateLoaded = true
    const commands = [...new Set(integrations.flatMap((item) => item.binary ? [item.binary] : []))]
    void Promise.all([backend.detectCommands(commands), backend.managedPackages()]).then(([detected, managed]) => {
      detectedCommands = detected
      managedPackages = managed
      if (currentRoute().page === 'integrations') render()
    }).catch((error) => { integrationStateLoaded = false; showMessage(String(error)) })
  }
  const filter = () => {
    const query = document.querySelector<HTMLInputElement>('#integration-search')!.value.toLowerCase()
    const category = document.querySelector<HTMLSelectElement>('#integration-category')!.value
    document.querySelectorAll<HTMLElement>('.integration').forEach((element) => {
      element.hidden = Boolean((query && !element.dataset.search?.includes(query)) || (category && element.dataset.category !== category))
    })
  }
  document.querySelector('#integration-search')?.addEventListener('input', filter)
  document.querySelector('#integration-category')?.addEventListener('change', filter)
  document.querySelectorAll<HTMLButtonElement>('.install-integration').forEach((button) => button.addEventListener('click', async () => {
    const manager = button.dataset.manager!
    const packageName = button.dataset.package!
    const action = button.dataset.action ?? 'install'
    const command = manager === 'brew-cask' ? `brew ${action}${action === 'install' || action === 'upgrade' ? ' --cask' : ' --cask'} ${packageName}` : `${manager} ${action} ${packageName}`
    if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} ${button.dataset.name}?\n\nCommand: ${command}\n\nThird-party integrations run with your user permissions.`)) return
    button.disabled = true
    button.textContent = 'Installing…'
    try {
      const result = await backend.packageAction(manager, action, packageName)
      integrationStateLoaded = false
      showMessage(result.success ? `${button.dataset.name}: ${action} completed\n${result.stdout}` : `Operation failed\n${result.stderr}`)
    } catch (error) { showMessage(String(error)) }
  }))
}

function bindSetupEvents(): void {
  document.querySelector('#refresh-status')?.addEventListener('click', async () => { state.status = await backend.status(); render() })
  document.querySelector('#reload-kitty')?.addEventListener('click', async () => {
    const result = await backend.reload(); showMessage(result.success ? 'kitty configuration reloaded' : result.stderr)
  })
  document.querySelector<HTMLButtonElement>('#manage-kitty')?.addEventListener('click', async (event) => {
    const action = (event.currentTarget as HTMLButtonElement).dataset.action!
    const command = action === 'install' ? 'brew install --cask kitty' : 'brew upgrade --cask kitty'
    if (!confirm(`${action === 'install' ? 'Install' : 'Update'} kitty?\n\n${command}`)) return
    try {
      const result = await backend.packageAction('brew-cask', action, 'kitty')
      state.status = await backend.status()
      showMessage(result.success ? result.stdout || 'Operation completed' : result.stderr)
    } catch (error) { showMessage(String(error)) }
  })
}

function bindEvents(page: string): void {
  if (page === 'config') bindConfigEvents()
  if (page === 'files') bindFilesEvents()
  if (page === 'integrations') bindIntegrationEvents()
  if (page === 'setup') bindSetupEvents()
}

window.addEventListener('hashchange', render)
if (!location.hash) location.hash = '#/overview'
render()
void initialize().then(render)
