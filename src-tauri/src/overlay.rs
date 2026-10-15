use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

use crate::{paths::config_root, util::explain};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    pinned: bool,
    edge: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayImage {
    id: String,
    path: String,
    placement: Placement,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWidget {
    id: String,
    kind: String,
    label: String,
    foreground: String,
    background: String,
    clock24: bool,
    placement: Placement,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySpec {
    images: Vec<OverlayImage>,
    widgets: Vec<TerminalWidget>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayApplyResult {
    shell_path: String,
    session_path: String,
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn cells(value: f64, divisor: f64, minimum: u32) -> u32 {
    (value / divisor).round().max(f64::from(minimum)) as u32
}

fn write_executable(path: &Path, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(explain)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).map_err(explain)?;
    }
    Ok(())
}

fn image_script(images: &[OverlayImage]) -> String {
    let mut lines = vec![
        "#!/bin/sh".to_string(),
        "kitten_bin=\"${KITTY_KITTEN:-kitten}\"".to_string(),
    ];
    for image in images.iter().filter(|image| !image.placement.pinned) {
        let place = format!(
            "{}x{}@{}x{}",
            cells(image.placement.w, 9.0, 6),
            cells(image.placement.h, 20.0, 4),
            cells(image.placement.x, 9.0, 0),
            cells(image.placement.y, 20.0, 0),
        );
        lines.push(format!(
            "\"$kitten_bin\" icat --stdin=no --scale-up --place {} {} || true",
            shell_quote(&place),
            shell_quote(&image.path),
        ));
    }
    lines.push("exec \"${KITTY_BUILDER_SHELL:-/bin/zsh}\" -l".to_string());
    format!("{}\n", lines.join("\n"))
}

fn widget_script() -> &'static str {
    r#"#!/bin/sh
kind="$1"
label="$2"
clock24="$3"
while :; do
  clear
  printf '\033[2m%s\033[0m\n' "$label"
  case "$kind" in
    clock) if [ "$clock24" = true ]; then date '+%H:%M:%S'; else date '+%I:%M:%S %p'; fi ;;
    cpu) top -l 1 2>/dev/null | awk '/CPU usage/ {print $3}' || printf 'unavailable\n' ;;
    memory) vm_stat 2>/dev/null | awk '/Pages active/ {gsub("\\.","",$3); printf "%.0f MB\n", $3*4096/1048576}' || free -h 2>/dev/null | awk '/Mem:/ {print $3 " / " $2}' ;;
    disk) df -h / | awk 'NR==2 {print $5}' ;;
  esac
  sleep 1
done
"#
}

fn pinned_command(
    root: &Path,
    image: Option<&OverlayImage>,
    widget: Option<&TerminalWidget>,
) -> String {
    if let Some(image) = image {
        return format!(
            "/bin/sh -c {}",
            shell_quote(&format!(
                "kitten icat --stdin=no --scale-up {}; exec sleep 2147483647",
                shell_quote(&image.path)
            ))
        );
    }
    let widget = widget.expect("a pinned overlay has content");
    format!(
        "{} {} {} {}",
        shell_quote(&root.join("builder-widget").display().to_string()),
        shell_quote(&widget.kind),
        shell_quote(&widget.label),
        widget.clock24,
    )
}

fn session(spec: &OverlaySpec, root: &Path) -> String {
    let mut lines = vec![
        "new_tab overlays".to_string(),
        "layout splits".to_string(),
        format!(
            "launch --cwd=current {}",
            shell_quote(&root.join("builder-shell").display().to_string())
        ),
    ];
    for image in spec.images.iter().filter(|item| item.placement.pinned) {
        let location = if matches!(image.placement.edge.as_str(), "top" | "bottom") {
            "hsplit"
        } else {
            "vsplit"
        };
        lines.push(format!(
            "launch --location={location} --bias=25 {}",
            pinned_command(root, Some(image), None)
        ));
    }
    for widget in spec.widgets.iter().filter(|item| item.placement.pinned) {
        let location = if matches!(widget.placement.edge.as_str(), "top" | "bottom") {
            "hsplit"
        } else {
            "vsplit"
        };
        lines.push(format!(
            "launch --location={location} --bias=25 {}",
            pinned_command(root, None, Some(widget))
        ));
    }
    format!("{}\n", lines.join("\n"))
}

#[tauri::command]
pub fn apply_overlays(spec: OverlaySpec) -> Result<OverlayApplyResult, String> {
    if spec.images.len() + spec.widgets.len() > 32 {
        return Err("A maximum of 32 images and widgets is supported".into());
    }
    if spec
        .images
        .iter()
        .any(|image| !Path::new(&image.path).is_absolute())
    {
        return Err("Overlay images must use absolute paths".into());
    }
    let root = config_root()?;
    fs::create_dir_all(root.join("sessions")).map_err(explain)?;
    let json = serde_json::to_string_pretty(&spec).map_err(explain)?;
    fs::write(root.join("builder-overlays.json"), json).map_err(explain)?;
    write_executable(&root.join("builder-shell"), &image_script(&spec.images))?;
    write_executable(&root.join("builder-widget"), widget_script())?;
    fs::write(
        root.join("sessions/overlays.session"),
        session(&spec, &root),
    )
    .map_err(explain)?;
    Ok(OverlayApplyResult {
        shell_path: root.join("builder-shell").display().to_string(),
        session_path: "sessions/overlays.session".into(),
    })
}
