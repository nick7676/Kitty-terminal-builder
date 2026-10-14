export interface SystemStatus {
  os: string
  arch: string
  configDir: string
  kittyInstalled: boolean
  kittyPath?: string
  kittyVersion?: string
  packageManagers: string[]
}

export interface ConfigFile {
  relativePath: string
  size: number
}

export interface FileSnapshot {
  path: string
  content: string
  exists: boolean
}

export interface BackupInfo {
  path: string
  timestamp: number
  size: number
}

export interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
}

export interface KittyOption {
  name: string
  section: string
  group: string
  kind: 'bool' | 'int' | 'float' | 'choice' | 'color' | 'string' | 'multi'
  default?: string
  defaults?: string[]
  macosDefault?: string
  choices?: string[]
  multi: boolean
  documented: boolean
  doc: string
}

export interface KittyRegistry {
  kittyVersion: string
  sections: { id: string; title: string }[]
  options: KittyOption[]
  maps: { name: string; type: 'map' | 'mouse_map'; title: string; group: string; definition: string; only: string }[]
}

export interface InstallMethod {
  manager: string
  package: string
}

export interface Integration {
  id: string
  name: string
  category: string
  description: string
  binary?: string
  install: InstallMethod[]
}

export interface ManagedPackage {
  manager: string
  package: string
  installedAt: number
}
