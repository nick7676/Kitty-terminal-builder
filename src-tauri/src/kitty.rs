use std::{path::PathBuf, process::Command};

use crate::{
    command::{CommandResult, command_output},
    paths::{find_in_path, home_dir},
    util::explain,
};

pub fn kitty_binary() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(found) = find_in_path("kitty") {
        candidates.push(found);
    }
    candidates.push(PathBuf::from(
        "/Applications/kitty.app/Contents/MacOS/kitty",
    ));
    if let Ok(home) = home_dir() {
        candidates.push(home.join("Applications/kitty.app/Contents/MacOS/kitty"));
        candidates.push(home.join(".local/kitty.app/bin/kitty"));
    }
    candidates.into_iter().find(|path| path.is_file())
}

pub fn version_label(stdout: &str) -> String {
    let line = stdout.lines().next().unwrap_or("").trim();
    let Some(rest) = line.strip_prefix("kitty ") else {
        return line.to_string();
    };
    let version = rest.split_whitespace().next().unwrap_or(rest);
    format!("kitty {version}")
}

pub fn kitty_version(path: &PathBuf) -> Option<String> {
    let output = Command::new(path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let label = version_label(&String::from_utf8_lossy(&output.stdout));
    (!label.is_empty()).then_some(label)
}

fn kitty_pids() -> Result<Vec<String>, String> {
    let listed = Command::new("pgrep")
        .args(["-x", "kitty"])
        .output()
        .map_err(explain)?;
    Ok(String::from_utf8_lossy(&listed.stdout)
        .lines()
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

pub fn kitty_running() -> bool {
    Command::new("pgrep")
        .args(["-x", "kitty"])
        .output()
        .is_ok_and(|output| output.status.success())
}

#[tauri::command]
pub fn get_option_registry() -> Result<String, String> {
    let kitty = kitty_binary().ok_or_else(|| "kitty is not installed".to_string())?;
    let script = include_str!("../../scripts/dump-kitty-definition.py");
    let output = Command::new(kitty)
        .args(["+runpy", script])
        .output()
        .map_err(explain)?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    String::from_utf8(output.stdout).map_err(explain)
}

#[tauri::command]
pub fn reload_kitty() -> Result<CommandResult, String> {
    let pids = kitty_pids()?;
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
        stdout: format!(
            "Reloaded {windows} kitty window{}",
            if windows == 1 { "" } else { "s" }
        ),
        stderr: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::version_label;

    #[test]
    fn formats_the_first_line_of_kitty_version_output() {
        assert_eq!(
            version_label("kitty 0.49.2 created by Kovid Goyal\n"),
            "kitty 0.49.2"
        );
        assert_eq!(version_label(""), "");
    }
}
