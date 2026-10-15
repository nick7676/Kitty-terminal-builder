use std::{collections::HashMap, ffi::OsStr, fs, process::Command};

use serde::{Deserialize, Serialize};

use crate::{
    command::{CommandResult, command_output},
    paths::{find_in_path, state_dir},
    util::{ensure_parent, explain, unix_secs},
};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ManagedPackage {
    manager: String,
    package: String,
    installed_at: u64,
}

struct PackageAction {
    manager: &'static str,
    action: &'static str,
    program: &'static str,
    args: &'static [&'static str],
    linux_only: bool,
}

const fn action(
    manager: &'static str,
    action: &'static str,
    program: &'static str,
    args: &'static [&'static str],
    linux_only: bool,
) -> PackageAction {
    PackageAction {
        manager,
        action,
        program,
        args,
        linux_only,
    }
}

const PACKAGE_ACTIONS: &[PackageAction] = &[
    action("brew", "install", "brew", &["install"], false),
    action(
        "brew-cask",
        "install",
        "brew",
        &["install", "--cask"],
        false,
    ),
    action("brew", "upgrade", "brew", &["upgrade"], false),
    action(
        "brew-cask",
        "upgrade",
        "brew",
        &["upgrade", "--cask"],
        false,
    ),
    action("brew", "uninstall", "brew", &["uninstall"], false),
    action(
        "brew-cask",
        "uninstall",
        "brew",
        &["uninstall", "--cask"],
        false,
    ),
    action("pipx", "install", "pipx", &["install"], false),
    action("pipx", "upgrade", "pipx", &["upgrade"], false),
    action("pipx", "uninstall", "pipx", &["uninstall"], false),
    action("cargo", "install", "cargo", &["install"], false),
    action("cargo", "upgrade", "cargo", &["install"], false),
    action("cargo", "uninstall", "cargo", &["uninstall"], false),
    action("npm", "install", "npm", &["install", "-g"], false),
    action("npm", "upgrade", "npm", &["update", "-g"], false),
    action("npm", "uninstall", "npm", &["uninstall", "-g"], false),
    action("apt", "install", "apt", &["install"], true),
    action(
        "apt",
        "upgrade",
        "apt",
        &["install", "--only-upgrade"],
        true,
    ),
    action("apt", "uninstall", "apt", &["remove"], true),
    action("dnf", "install", "dnf", &["install"], true),
    action("dnf", "upgrade", "dnf", &["upgrade"], true),
    action("dnf", "uninstall", "dnf", &["remove"], true),
    action("pacman", "install", "pacman", &["-S"], true),
    action("pacman", "upgrade", "pacman", &["-S"], true),
    action("pacman", "uninstall", "pacman", &["-R"], true),
];

fn valid_package_name(package: &str) -> bool {
    !package.is_empty()
        && package.len() < 160
        && package
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_./:@+".contains(&byte))
}

fn managed_packages_path() -> Result<std::path::PathBuf, String> {
    Ok(state_dir()?.join("installed.json"))
}

fn read_managed_packages() -> Vec<ManagedPackage> {
    managed_packages_path()
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn write_managed_packages(packages: &[ManagedPackage]) -> Result<(), String> {
    let path = managed_packages_path()?;
    ensure_parent(&path)?;
    let content = serde_json::to_vec_pretty(packages).map_err(explain)?;
    fs::write(path, content).map_err(explain)
}

fn package_action(manager: &str, action_name: &str) -> Result<&'static PackageAction, String> {
    PACKAGE_ACTIONS
        .iter()
        .find(|item| {
            item.manager == manager
                && item.action == action_name
                && (!item.linux_only || cfg!(target_os = "linux"))
        })
        .ok_or_else(|| "This package action is not allowlisted".to_string())
}

#[tauri::command]
pub fn detect_commands(commands: Vec<String>) -> Result<HashMap<String, bool>, String> {
    if commands.len() > 256 {
        return Err("Too many command names".into());
    }
    let mut result = HashMap::new();
    for command in commands {
        if !valid_package_name(&command) || command.contains('/') {
            return Err("Invalid command name".into());
        }
        result.insert(command.clone(), find_in_path(&command).is_some());
    }
    Ok(result)
}

#[tauri::command]
pub fn list_managed_packages() -> Vec<ManagedPackage> {
    read_managed_packages()
}

#[tauri::command]
pub fn run_package_action(
    manager: String,
    action: String,
    package: String,
) -> Result<CommandResult, String> {
    if !valid_package_name(&package) {
        return Err("Invalid package identifier".into());
    }
    let mut managed = read_managed_packages();
    let is_managed = managed
        .iter()
        .any(|item| item.manager == manager && item.package == package);
    if action == "uninstall" && !is_managed {
        return Err("Refusing to remove a package not installed by Kitty Builder".into());
    }
    let spec = package_action(&manager, &action)?;
    let mut arguments: Vec<&OsStr> = spec.args.iter().copied().map(OsStr::new).collect();
    arguments.push(OsStr::new(&package));
    let executable =
        find_in_path(spec.program).ok_or_else(|| format!("{} is not installed", spec.program))?;
    let needs_privilege =
        cfg!(target_os = "linux") && matches!(manager.as_str(), "apt" | "dnf" | "pacman");
    let mut command = if needs_privilege {
        if let Some(pkexec) = find_in_path("pkexec") {
            let mut elevated = Command::new(pkexec);
            elevated.arg(&executable);
            elevated
        } else {
            Command::new(&executable)
        }
    } else {
        Command::new(&executable)
    };
    command.args(arguments);
    let result = command_output(command)?;
    if result.success && action == "install" && !is_managed {
        managed.push(ManagedPackage {
            manager,
            package,
            installed_at: unix_secs()?,
        });
        write_managed_packages(&managed)?;
    } else if result.success && action == "uninstall" {
        managed.retain(|item| item.manager != manager || item.package != package);
        write_managed_packages(&managed)?;
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::valid_package_name;

    #[test]
    fn validates_package_identifiers_without_shell_metacharacters() {
        assert!(valid_package_name("@bitwarden/cli"));
        assert!(valid_package_name("yazi-fm"));
        assert!(!valid_package_name("package; rm -rf /"));
        assert!(!valid_package_name("$(whoami)"));
    }
}
