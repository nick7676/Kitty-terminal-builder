# Kitty Builder

Native desktop studio for [kitty](https://sw.kovidgoyal.net/kitty/), built with Tauri 2.

## Capabilities

- Loads all options and default shortcuts directly from the installed kitty version
- Lossless editing of `kitty.conf`, preserving comments, unknown directives and ordering
- Companion files: actions, SSH, diff, sessions, themes, shaders, pipelines and Python hooks
- Modular profiles through `include`
- Atomic writes, timestamped backups, diff preview and rollback
- Apply and reload running kitty instances
- Detect, install and update kitty on macOS and guide official Linux installation
- Complete official integrations catalog with allowlisted package-manager installs
- Managed integration updates and safe removal
- macOS and Linux support
- In-app updates from GitHub releases. The header shows Update when a newer version is published.

## Stack

- Tauri 2 desktop runtime
- Rust backend for filesystem and process boundaries
- React 19 with TanStack Router, Query and Virtual
- Zustand for workspace state and react-hotkeys-hook for keyboard shortcuts

There is no server and no generic shell command. Package versions are stable releases.

## Development

Requirements: Node.js, Rust and the native Tauri prerequisites for your platform.

```bash
npm install
npm run desktop
```

`npm run desktop` opens the native window. React is the interface inside that window, loaded by Tauri during development and packaged into the app for distribution.

## Verification

```bash
npm run build
npm test
cd src-tauri && cargo test
```

Create a distributable:

```bash
npm run bundle
```

## Security

- File commands accept only relative paths inside the detected kitty configuration directory.
- Symbolic-link overwrite is rejected.
- Every existing file is backed up before an atomic replacement.
- Package actions use direct process arguments and an explicit manager/action allowlist.
- Removal is allowed only for packages recorded as installed by Kitty Builder.
- Remote `curl | sh` installers are displayed for manual review and never run automatically.
