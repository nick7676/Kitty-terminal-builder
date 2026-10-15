use std::env;

use serde::Serialize;

use crate::{
    kitty::{kitty_binary, kitty_running, kitty_version},
    paths::{config_root, find_in_path, resolve},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStatus {
    os: String,
    arch: String,
    config_dir: String,
    config_exists: bool,
    kitty_conf_exists: bool,
    kitty_installed: bool,
    kitty_path: Option<String>,
    kitty_version: Option<String>,
    kitty_running: bool,
    package_managers: Vec<String>,
}

const PACKAGE_MANAGERS: [&str; 8] = [
    "brew", "apt", "apt-get", "dnf", "pacman", "pipx", "cargo", "npm",
];

#[tauri::command]
pub fn get_system_status() -> Result<SystemStatus, String> {
    let kitty_path = kitty_binary();
    let version = kitty_path.as_ref().and_then(kitty_version);
    let managers = PACKAGE_MANAGERS
        .into_iter()
        .filter(|name| find_in_path(name).is_some())
        .map(str::to_string)
        .collect();
    let root = config_root()?;

    Ok(SystemStatus {
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        config_dir: root.display().to_string(),
        config_exists: root.is_dir(),
        kitty_conf_exists: root.join("kitty.conf").is_file(),
        kitty_installed: kitty_path.is_some(),
        kitty_path: kitty_path.map(resolve),
        kitty_version: version,
        kitty_running: kitty_running(),
        package_managers: managers,
    })
}
