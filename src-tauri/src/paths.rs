use std::{
    env,
    path::{Component, Path, PathBuf},
};

pub fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Cannot determine the home directory".to_string())
}

pub fn config_root() -> Result<PathBuf, String> {
    if let Ok(custom) = env::var("KITTY_CONFIG_DIRECTORY") {
        return Ok(PathBuf::from(custom));
    }
    if let Ok(xdg) = env::var("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(xdg).join("kitty"));
    }
    Ok(home_dir()?.join(".config").join("kitty"))
}

pub fn state_dir() -> Result<PathBuf, String> {
    Ok(config_root()?.join(".kitty-builder"))
}

pub fn safe_relative(value: &str) -> Result<PathBuf, String> {
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

pub fn find_in_path(name: &str) -> Option<PathBuf> {
    search_directories()
        .into_iter()
        .map(|dir| dir.join(name))
        .find(|path| path.is_file())
}

pub fn resolve(path: PathBuf) -> String {
    path.canonicalize().unwrap_or(path).display().to_string()
}

#[cfg(test)]
mod tests {
    use super::safe_relative;

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
}
