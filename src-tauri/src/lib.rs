use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    env,
    ffi::OsStr,
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use walkdir::WalkDir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemStatus {
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFile {
    relative_path: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSnapshot {
    path: String,
    content: String,
    exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteResult {
    path: String,
    backup_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    path: String,
    timestamp: u64,
    size: u64,
}

#[derive(Serialize)]
struct CommandResult {
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedPackage {
    manager: String,
    package: String,
    installed_at: u64,
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Cannot determine the home directory".to_string())
}

fn config_root() -> Result<PathBuf, String> {
    if let Ok(custom) = env::var("KITTY_CONFIG_DIRECTORY") {
        return Ok(PathBuf::from(custom));
    }
    if let Ok(xdg) = env::var("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(xdg).join("kitty"));
    }
    Ok(home_dir()?.join(".config").join("kitty"))
}

fn safe_relative(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if path.as_os_str().is_empty()
        || path.is_absolute()
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(
            "Only relative paths inside the kitty configuration directory are allowed".into(),
        );
    }
    Ok(path.to_path_buf())
}

fn search_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(path) = env::var_os("PATH") {
        dirs.extend(env::split_paths(&path));
    }
    let mut extras = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin"),
    ];
    if let Some(home) = dirs::home_dir() {
        extras.push(home.join(".local/bin"));
        extras.push(home.join("bin"));
        extras.push(home.join(".local/kitty.app/bin"));
    }
    for extra in extras {
        if !dirs.iter().any(|dir| dir == &extra) {
            dirs.push(extra);
        }
    }
    dirs
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    search_directories()
        .into_iter()
        .map(|dir| dir.join(name))
        .find(|path| path.is_file())
}

fn kitty_binary() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(found) = find_in_path("kitty") {
        candidates.push(found);
    }
    candidates.push(PathBuf::from("/Applications/kitty.app/Contents/MacOS/kitty"));
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("Applications/kitty.app/Contents/MacOS/kitty"));
        candidates.push(home.join(".local/kitty.app/bin/kitty"));
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn version_label(stdout: &str) -> String {
    let line = stdout.lines().next().unwrap_or("").trim();
    let Some(rest) = line.strip_prefix("kitty ") else {
        return line.to_string();
    };
    let version = rest.split_whitespace().next().unwrap_or(rest);
    format!("kitty {version}")
}

fn image_mime(path: &Path) -> Result<&'static str, String> {
    if !path.is_absolute() {
        return Err("Choose an image with an absolute path".into());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match extension.as_str() {
        "png" => Ok("image/png"),
        "gif" => Ok("image/gif"),
        "webp" => Ok("image/webp"),
        "jpg" | "jpeg" => Ok("image/jpeg"),
        _ => Err("Choose a png, jpg, webp or gif image".into()),
    }
}

fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::new();
    let mut index = 0;
    while index + 3 <= bytes.len() {
        let value = ((bytes[index] as u32) << 16)
            | ((bytes[index + 1] as u32) << 8)
            | (bytes[index + 2] as u32);
        output.push(TABLE[((value >> 18) & 63) as usize] as char);
        output.push(TABLE[((value >> 12) & 63) as usize] as char);
        output.push(TABLE[((value >> 6) & 63) as usize] as char);
        output.push(TABLE[(value & 63) as usize] as char);
        index += 3;
    }
    let rest = bytes.len() - index;
    if rest == 1 {
        let value = (bytes[index] as u32) << 16;
        output.push(TABLE[((value >> 18) & 63) as usize] as char);
        output.push(TABLE[((value >> 12) & 63) as usize] as char);
        output.push('=');
        output.push('=');
    } else if rest == 2 {
        let value = ((bytes[index] as u32) << 16) | ((bytes[index + 1] as u32) << 8);
        output.push(TABLE[((value >> 18) & 63) as usize] as char);
        output.push(TABLE[((value >> 12) & 63) as usize] as char);
        output.push(TABLE[((value >> 6) & 63) as usize] as char);
        output.push('=');
    }
    output
}

fn kitty_running() -> bool {
    Command::new("pgrep")
        .args(["-x", "kitty"])
        .output()
        .is_ok_and(|output| output.status.success())
}

fn command_output(mut command: Command) -> Result<CommandResult, String> {
    let output = command.output().map_err(|error| error.to_string())?;
    Ok(CommandResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
    })
}

fn managed_packages_path() -> Result<PathBuf, String> {
    Ok(config_root()?.join(".kitty-builder").join("installed.json"))
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
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_vec_pretty(packages).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_system_status() -> Result<SystemStatus, String> {
    let kitty_path = kitty_binary();
    let kitty_version = kitty_path.as_ref().and_then(|path| {
        let output = Command::new(path).arg("--version").output().ok()?;
        if !output.status.success() {
            return None;
        }
        let label = version_label(&String::from_utf8_lossy(&output.stdout));
        (!label.is_empty()).then_some(label)
    });
    let managers = [
        "brew", "apt", "apt-get", "dnf", "pacman", "pipx", "cargo", "npm",
    ]
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
        kitty_path: kitty_path.map(|path| {
            path.canonicalize()
                .unwrap_or(path)
                .display()
                .to_string()
        }),
        kitty_version,
        kitty_running: kitty_running(),
        package_managers: managers,
    })
}

#[tauri::command]
fn list_config_files() -> Result<Vec<ConfigFile>, String> {
    let root = config_root()?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .max_depth(4)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() || entry.path().starts_with(root.join(".kitty-builder")) {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(&root)
            .map_err(|error| error.to_string())?;
        files.push(ConfigFile {
            relative_path: relative.to_string_lossy().to_string(),
            size: entry.metadata().map(|metadata| metadata.len()).unwrap_or(0),
        });
    }
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

#[tauri::command]
fn read_config_file(relative_path: String) -> Result<FileSnapshot, String> {
    let relative = safe_relative(&relative_path)?;
    let path = config_root()?.join(&relative);
    let exists = path.is_file();
    let content = if exists {
        fs::read_to_string(&path).map_err(|error| error.to_string())?
    } else {
        String::new()
    };
    Ok(FileSnapshot {
        path: path.display().to_string(),
        content,
        exists,
    })
}

#[tauri::command]
fn write_config_file(relative_path: String, content: String) -> Result<WriteResult, String> {
    if content.len() > 8 * 1024 * 1024 {
        return Err("Configuration file exceeds the 8 MB safety limit".into());
    }
    let relative = safe_relative(&relative_path)?;
    let root = config_root()?;
    let path = root.join(&relative);
    if path
        .symlink_metadata()
        .is_ok_and(|metadata| metadata.file_type().is_symlink())
    {
        return Err("Refusing to overwrite a symbolic link".into());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let backup_path = if path.is_file() {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_secs();
        let backup = root
            .join(".kitty-builder")
            .join("backups")
            .join(timestamp.to_string())
            .join(&relative);
        if let Some(parent) = backup.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(&path, &backup).map_err(|error| error.to_string())?;
        Some(backup.display().to_string())
    } else {
        None
    };

    let temporary = path.with_extension("kitty-builder.tmp");
    fs::write(&temporary, content.as_bytes()).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())?;
    Ok(WriteResult {
        path: path.display().to_string(),
        backup_path,
    })
}

#[tauri::command]
fn list_backups(relative_path: String) -> Result<Vec<BackupInfo>, String> {
    let relative = safe_relative(&relative_path)?;
    let root = config_root()?.join(".kitty-builder").join("backups");
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut backups = Vec::new();
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let timestamp = entry
            .file_name()
            .to_string_lossy()
            .parse::<u64>()
            .unwrap_or(0);
        let path = entry.path().join(&relative);
        if path.is_file() {
            backups.push(BackupInfo {
                size: path.metadata().map(|metadata| metadata.len()).unwrap_or(0),
                path: path.display().to_string(),
                timestamp,
            });
        }
    }
    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(backups)
}

#[tauri::command]
fn restore_backup(backup_path: String, relative_path: String) -> Result<WriteResult, String> {
    let relative = safe_relative(&relative_path)?;
    let root = config_root()?;
    let backup_root = root.join(".kitty-builder").join("backups");
    let source = PathBuf::from(backup_path);
    let canonical_source = source.canonicalize().map_err(|error| error.to_string())?;
    let canonical_root = backup_root
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !canonical_source.starts_with(&canonical_root) || !canonical_source.is_file() {
        return Err("The selected backup is outside the managed backup directory".into());
    }
    let content = fs::read_to_string(canonical_source).map_err(|error| error.to_string())?;
    write_config_file(relative.to_string_lossy().to_string(), content)
}

#[tauri::command]
fn get_option_registry() -> Result<String, String> {
    let kitty = kitty_binary().ok_or_else(|| "kitty is not installed".to_string())?;
    let script = include_str!("../../scripts/dump-kitty-definition.py");
    let output = Command::new(kitty)
        .args(["+runpy", script])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    String::from_utf8(output.stdout).map_err(|error| error.to_string())
}

#[tauri::command]
fn reload_kitty() -> Result<CommandResult, String> {
    let listed = Command::new("pgrep")
        .args(["-x", "kitty"])
        .output()
        .map_err(|error| error.to_string())?;
    let pids: Vec<String> = String::from_utf8_lossy(&listed.stdout)
        .lines()
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect();
    if pids.is_empty() {
        return Ok(CommandResult {
            success: true,
            stdout: "No kitty window is open".into(),
            stderr: String::new(),
        });
    }
    let mut command = Command::new("kill");
    command.arg("-USR1");
    command.args(&pids);
    let result = command_output(command)?;
    if !result.success {
        return Ok(result);
    }
    let windows = pids.len();
    Ok(CommandResult {
        success: true,
        stdout: format!("Reloaded {windows} kitty window{}", if windows == 1 { "" } else { "s" }),
        stderr: String::new(),
    })
}

#[tauri::command]
fn preview_image(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let mime = image_mime(&path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > 12 * 1024 * 1024 {
        return Err("Choose an image smaller than 12 MB".into());
    }
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    Ok(format!("data:{mime};base64,{}", encode_base64(&bytes)))
}

#[tauri::command]
fn detect_commands(commands: Vec<String>) -> Result<HashMap<String, bool>, String> {
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
fn list_managed_packages() -> Vec<ManagedPackage> {
    read_managed_packages()
}

fn valid_package_name(package: &str) -> bool {
    !package.is_empty()
        && package.len() < 160
        && package
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_./:@+".contains(&byte))
}

#[tauri::command]
fn run_package_action(
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
    let (program, arguments): (&str, Vec<&OsStr>) = match (manager.as_str(), action.as_str()) {
        ("brew", "install") => ("brew", vec![OsStr::new("install"), OsStr::new(&package)]),
        ("brew-cask", "install") => (
            "brew",
            vec![
                OsStr::new("install"),
                OsStr::new("--cask"),
                OsStr::new(&package),
            ],
        ),
        ("brew", "upgrade") => ("brew", vec![OsStr::new("upgrade"), OsStr::new(&package)]),
        ("brew-cask", "upgrade") => (
            "brew",
            vec![
                OsStr::new("upgrade"),
                OsStr::new("--cask"),
                OsStr::new(&package),
            ],
        ),
        ("brew", "uninstall") => ("brew", vec![OsStr::new("uninstall"), OsStr::new(&package)]),
        ("brew-cask", "uninstall") => (
            "brew",
            vec![
                OsStr::new("uninstall"),
                OsStr::new("--cask"),
                OsStr::new(&package),
            ],
        ),
        ("pipx", "install") => ("pipx", vec![OsStr::new("install"), OsStr::new(&package)]),
        ("pipx", "upgrade") => ("pipx", vec![OsStr::new("upgrade"), OsStr::new(&package)]),
        ("pipx", "uninstall") => ("pipx", vec![OsStr::new("uninstall"), OsStr::new(&package)]),
        ("cargo", "install") => ("cargo", vec![OsStr::new("install"), OsStr::new(&package)]),
        ("cargo", "upgrade") => ("cargo", vec![OsStr::new("install"), OsStr::new(&package)]),
        ("cargo", "uninstall") => ("cargo", vec![OsStr::new("uninstall"), OsStr::new(&package)]),
        ("npm", "install") => (
            "npm",
            vec![
                OsStr::new("install"),
                OsStr::new("-g"),
                OsStr::new(&package),
            ],
        ),
        ("npm", "upgrade") => (
            "npm",
            vec![OsStr::new("update"), OsStr::new("-g"), OsStr::new(&package)],
        ),
        ("npm", "uninstall") => (
            "npm",
            vec![
                OsStr::new("uninstall"),
                OsStr::new("-g"),
                OsStr::new(&package),
            ],
        ),
        ("apt", "install") if cfg!(target_os = "linux") => {
            ("apt", vec![OsStr::new("install"), OsStr::new(&package)])
        }
        ("apt", "upgrade") if cfg!(target_os = "linux") => (
            "apt",
            vec![
                OsStr::new("install"),
                OsStr::new("--only-upgrade"),
                OsStr::new(&package),
            ],
        ),
        ("apt", "uninstall") if cfg!(target_os = "linux") => {
            ("apt", vec![OsStr::new("remove"), OsStr::new(&package)])
        }
        ("dnf", "install") if cfg!(target_os = "linux") => {
            ("dnf", vec![OsStr::new("install"), OsStr::new(&package)])
        }
        ("dnf", "upgrade") if cfg!(target_os = "linux") => {
            ("dnf", vec![OsStr::new("upgrade"), OsStr::new(&package)])
        }
        ("dnf", "uninstall") if cfg!(target_os = "linux") => {
            ("dnf", vec![OsStr::new("remove"), OsStr::new(&package)])
        }
        ("pacman", "install") if cfg!(target_os = "linux") => {
            ("pacman", vec![OsStr::new("-S"), OsStr::new(&package)])
        }
        ("pacman", "upgrade") if cfg!(target_os = "linux") => {
            ("pacman", vec![OsStr::new("-S"), OsStr::new(&package)])
        }
        ("pacman", "uninstall") if cfg!(target_os = "linux") => {
            ("pacman", vec![OsStr::new("-R"), OsStr::new(&package)])
        }
        _ => return Err("This package action is not allowlisted".into()),
    };
    let executable = find_in_path(program).ok_or_else(|| format!("{program} is not installed"))?;
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
            installed_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| error.to_string())?
                .as_secs(),
        });
        write_managed_packages(&managed)?;
    } else if result.success && action == "uninstall" {
        managed.retain(|item| item.manager != manager || item.package != package);
        write_managed_packages(&managed)?;
    }
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_status,
            list_config_files,
            read_config_file,
            write_config_file,
            list_backups,
            restore_backup,
            get_option_registry,
            reload_kitty,
            preview_image,
            detect_commands,
            list_managed_packages,
            run_package_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kitty Builder");
}

#[cfg(test)]
mod tests {
    use super::{encode_base64, image_mime, safe_relative, valid_package_name, version_label};
    use std::path::Path;

    #[test]
    fn accepts_paths_inside_config_directory() {
        assert!(safe_relative("kitty.conf").is_ok());
        assert!(safe_relative("themes/custom.conf").is_ok());
        assert!(safe_relative("sessions/work.session").is_ok());
    }

    #[test]
    fn rejects_path_traversal_and_absolute_paths() {
        assert!(safe_relative("../secrets").is_err());
        assert!(safe_relative("/etc/passwd").is_err());
        assert!(safe_relative("").is_err());
    }

    #[test]
    fn encodes_image_bytes_and_rejects_non_images() {
        assert_eq!(encode_base64(b"Man"), "TWFu");
        assert!(image_mime(Path::new("/tmp/wall.png")).is_ok());
        assert!(image_mime(Path::new("relative.png")).is_err());
        assert!(image_mime(Path::new("/tmp/notes.txt")).is_err());
    }

    #[test]
    fn formats_the_first_line_of_kitty_version_output() {
        assert_eq!(
            version_label("kitty 0.49.2 created by Kovid Goyal\n"),
            "kitty 0.49.2"
        );
        assert_eq!(version_label(""), "");
    }

    #[test]
    fn validates_package_identifiers_without_shell_metacharacters() {
        assert!(valid_package_name("@bitwarden/cli"));
        assert!(valid_package_name("yazi-fm"));
        assert!(!valid_package_name("package; rm -rf /"));
        assert!(!valid_package_name("$(whoami)"));
    }
}
