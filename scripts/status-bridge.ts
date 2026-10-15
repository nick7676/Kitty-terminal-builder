import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { arch, homedir, platform } from 'node:os'
import { delimiter, join } from 'node:path'
import type { Plugin } from 'vite'

function searchDirs() {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  const extras = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/home/linuxbrew/.linuxbrew/bin',
    join(homedir(), '.local/bin'),
    join(homedir(), 'bin'),
    join(homedir(), '.local/kitty.app/bin'),
  ]
  for (const extra of extras) if (!dirs.includes(extra)) dirs.push(extra)
  return dirs
}

function findInPath(name: string) {
  return searchDirs().map((dir) => join(dir, name)).find((path) => existsSync(path))
}

function kittyBinary() {
  const candidates = [
    findInPath('kitty'),
    '/Applications/kitty.app/Contents/MacOS/kitty',
    join(homedir(), 'Applications/kitty.app/Contents/MacOS/kitty'),
    join(homedir(), '.local/kitty.app/bin/kitty'),
  ].filter((path): path is string => Boolean(path))
  return candidates.find((path) => existsSync(path))
}

function versionLabel(stdout: string) {
  const line = stdout.split('\n')[0]?.trim() ?? ''
  if (!line.startsWith('kitty ')) return line
  const version = line.slice(6).split(/\s+/)[0] ?? ''
  return version ? `kitty ${version}` : line
}

export function readSystemStatus() {
  const kittyPath = kittyBinary()
  let kittyVersion: string | undefined
  if (kittyPath) {
    try {
      kittyVersion = versionLabel(execFileSync(kittyPath, ['--version'], { encoding: 'utf8' }))
    } catch {
      kittyVersion = undefined
    }
  }
  let kittyRunning = false
  try {
    execFileSync('pgrep', ['-x', 'kitty'], { stdio: 'ignore' })
    kittyRunning = true
  } catch {
    kittyRunning = false
  }
  const configDir = process.env.KITTY_CONFIG_DIRECTORY
    || (process.env.XDG_CONFIG_HOME ? join(process.env.XDG_CONFIG_HOME, 'kitty') : join(homedir(), '.config/kitty'))
  const managers = ['brew', 'apt', 'apt-get', 'dnf', 'pacman', 'pipx', 'cargo', 'npm'].filter((name) => findInPath(name))
  return {
    os: platform() === 'darwin' ? 'macos' : platform(),
    arch: arch(),
    configDir,
    configExists: existsSync(configDir),
    kittyConfExists: existsSync(join(configDir, 'kitty.conf')),
    kittyInstalled: Boolean(kittyPath),
    kittyPath,
    kittyVersion,
    kittyRunning,
    packageManagers: managers,
  }
}

export function kittyStatusPlugin(): Plugin {
  return {
    name: 'kitty-status',
    configureServer(server) {
      server.middlewares.use('/__kitty/status', (_request, response) => {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify(readSystemStatus()))
      })
    },
  }
}
