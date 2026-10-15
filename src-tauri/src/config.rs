use std::{fs, path::PathBuf};

use serde::Serialize;
use walkdir::WalkDir;

use crate::{
    paths::{config_root, safe_relative, state_dir},
    util::{byte_len, ensure_parent, explain, unix_secs},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConfigFile {
    relative_path: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileSnapshot {
    path: String,
    content: String,
    exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WriteResult {
    path: String,
    backup_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupInfo {
    path: String,
    timestamp: u64,
    size: u64,
}

fn located(relative_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let relative = safe_relative(relative_path)?;
    let root = config_root()?;
    let path = root.join(&relative);
    Ok((root, path))
}

#[tauri::command]
pub fn list_config_files() -> Result<Vec<ConfigFile>, String> {
    let root = config_root()?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let hidden = root.join(".kitty-builder");
    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .max_depth(4)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() || entry.path().starts_with(&hidden) {
            continue;
        }
        let relative = entry.path().strip_prefix(&root).map_err(explain)?;
        files.push(ConfigFile {
            relative_path: relative.to_string_lossy().to_string(),
            size: entry.metadata().map(|metadata| metadata.len()).unwrap_or(0),
        });
    }
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(files)
}

#[tauri::command]
pub fn read_config_file(relative_path: String) -> Result<FileSnapshot, String> {
    let (_, path) = located(&relative_path)?;
    let exists = path.is_file();
    let content = if exists {
        fs::read_to_string(&path).map_err(explain)?
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
pub fn write_config_file(relative_path: String, content: String) -> Result<WriteResult, String> {
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
    ensure_parent(&path)?;

    let backup_path = if path.is_file() {
        let backup = state_dir()?
            .join("backups")
            .join(unix_secs()?.to_string())
            .join(&relative);
        ensure_parent(&backup)?;
        fs::copy(&path, &backup).map_err(explain)?;
        Some(backup.display().to_string())
    } else {
        None
    };

    let temporary = path.with_extension("kitty-builder.tmp");
    fs::write(&temporary, content.as_bytes()).map_err(explain)?;
    fs::rename(&temporary, &path).map_err(explain)?;
    Ok(WriteResult {
        path: path.display().to_string(),
        backup_path,
    })
}

#[tauri::command]
pub fn list_backups(relative_path: String) -> Result<Vec<BackupInfo>, String> {
    let relative = safe_relative(&relative_path)?;
    let root = state_dir()?.join("backups");
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut backups = Vec::new();
    for entry in fs::read_dir(&root).map_err(explain)? {
        let entry = entry.map_err(explain)?;
        let timestamp = entry
            .file_name()
            .to_string_lossy()
            .parse::<u64>()
            .unwrap_or(0);
        let path = entry.path().join(&relative);
        if path.is_file() {
            backups.push(BackupInfo {
                size: byte_len(&path),
                path: path.display().to_string(),
                timestamp,
            });
        }
    }
    backups.sort_by(|left, right| right.timestamp.cmp(&left.timestamp));
    Ok(backups)
}

#[tauri::command]
pub fn restore_backup(backup_path: String, relative_path: String) -> Result<WriteResult, String> {
    let relative = safe_relative(&relative_path)?;
    let backup_root = state_dir()?.join("backups");
    let canonical_source = PathBuf::from(backup_path).canonicalize().map_err(explain)?;
    let canonical_root = backup_root.canonicalize().map_err(explain)?;
    if !canonical_source.starts_with(&canonical_root) || !canonical_source.is_file() {
        return Err("The selected backup is outside the managed backup directory".into());
    }
    let content = fs::read_to_string(canonical_source).map_err(explain)?;
    write_config_file(relative.to_string_lossy().to_string(), content)
}
