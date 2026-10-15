import type { BackupInfo, CommandResult, ConfigFile, FileSnapshot, KittyRegistry, ManagedPackage, SystemStatus } from './types'

export const isTauri = () => '__TAURI_INTERNALS__' in window

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error('This action requires the Tauri desktop application')
  const api = await import('@tauri-apps/api/core')
  return api.invoke<T>(command, args)
}

const browserStatus: SystemStatus = {
  os: navigator.platform.toLowerCase().includes('mac') ? 'macos' : 'linux',
  arch: 'web',
  configDir: '~/.config/kitty',
  configExists: false,
  kittyConfExists: false,
  kittyInstalled: false,
  kittyRunning: false,
  packageManagers: [],
}

export const backend = {
  async status(): Promise<SystemStatus> {
    if (!isTauri()) {
      try {
        const response = await fetch('/__kitty/status')
        if (response.ok) return await response.json() as SystemStatus
      } catch {
        // The static preview has no local status bridge.
      }
      return browserStatus
    }
    return invoke('get_system_status')
  },
  files: () => invoke<ConfigFile[]>('list_config_files'),
  read: (relativePath: string) => invoke<FileSnapshot>('read_config_file', { relativePath }),
  write: (relativePath: string, content: string) => invoke<{ path: string; backupPath?: string }>('write_config_file', { relativePath, content }),
  backups: (relativePath: string) => invoke<BackupInfo[]>('list_backups', { relativePath }),
  restore: (backupPath: string, relativePath: string) => invoke('restore_backup', { backupPath, relativePath }),
  reload: () => invoke<CommandResult>('reload_kitty'),
  async pickImage(): Promise<string | null> {
    if (!isTauri()) return null
    const dialog = await import('@tauri-apps/plugin-dialog')
    const selected = await dialog.open({
      title: 'Background image',
      multiple: false,
      filters: [{ name: 'Images', extensions: ['gif', 'png', 'jpg', 'jpeg', 'webp', 'image/gif'] }],
    })
    return typeof selected === 'string' ? selected : null
  },
  imagePreview: (path: string) => invoke<string>('preview_image', { path }),
  applyOverlays: (spec: unknown) => invoke<{ shellPath: string; sessionPath: string }>('apply_overlays', { spec }),
  packageAction: (manager: string, action: string, packageName: string) =>
    invoke<CommandResult>('run_package_action', { manager, action, package: packageName }),
  detectCommands: (commands: string[]) => invoke<Record<string, boolean>>('detect_commands', { commands }),
  managedPackages: () => invoke<ManagedPackage[]>('list_managed_packages'),
  async registry(): Promise<KittyRegistry> {
    const raw = await invoke<string>('get_option_registry')
    return JSON.parse(raw) as KittyRegistry
  },
}
