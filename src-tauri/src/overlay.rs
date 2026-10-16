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
    #[serde(default)]
    stage_width: f64,
    #[serde(default)]
    stage_height: f64,
    #[serde(default)]
    background: String,
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
fg="$4"
bg="$5"
printf '\033[?25l'
paint() {
  if [ -n "$bg" ]; then printf '\033]11;%s\007\033]21;background=%s\007' "$bg" "$bg"; fi
  if [ -n "$fg" ]; then printf '\033]10;%s\007\033]21;foreground=%s\007' "$fg" "$fg"; fi
}
while :; do
  case "$kind" in
    clock) if [ "$clock24" = true ]; then value=$(date '+%H:%M:%S'); else value=$(date '+%I:%M:%S %p'); fi ;;
    cpu) value=$(top -l 1 2>/dev/null | awk '/CPU usage/ {print $3}'); [ -n "$value" ] || value=unavailable ;;
    memory) value=$(vm_stat 2>/dev/null | awk '/Pages active/ {gsub("\\.","",$3); printf "%.0f MB", $3*4096/1048576}'); [ -n "$value" ] || value=$(free -h 2>/dev/null | awk '/Mem:/ {print $3 " / " $2}'); [ -n "$value" ] || value=unavailable ;;
    disk) value=$(df -h / | awk 'NR==2 {print $5}') ;;
    *) value= ;;
  esac
  printf '\033[H\033[2J'
  paint
  rows=$(stty size 2>/dev/null | awk 'NR==1 {print $1}')
  mid=$(( ${rows:-8} / 2 ))
  [ "$mid" -lt 1 ] && mid=1
  printf '\033[%s;1H' "$mid"
  printf '\033[2m%s\033[22m\n' "$(printf '%s' "$label" | tr '[:lower:]' '[:upper:]')"
  printf '\033]66;s=2;%s\033\\\n' "$value"
  sleep 1
done
"#
}

fn image_command(path: &str) -> String {
    let script = format!(
        "printf '\\033[?25l'; kitten_bin=\"${{KITTY_KITTEN:-kitten}}\"; \"$kitten_bin\" icat --stdin=no --fit=both --scale-up --align=center --loop=-1 --no-trailing-newline {} || true; exec sleep 2147483647",
        shell_quote(path)
    );
    format!("/bin/sh -c {}", shell_quote(&script))
}

fn widget_command(root: &Path, widget: &TerminalWidget) -> String {
    format!(
        "{} {} {} {} {} {}",
        shell_quote(&root.join("builder-widget").display().to_string()),
        shell_quote(&widget.kind),
        shell_quote(&widget.label),
        widget.clock24,
        shell_quote(&widget.foreground),
        shell_quote(&widget.background),
    )
}

fn terminal_color(background: &str) -> &str {
    let color = background.trim();
    let hex = color.strip_prefix('#').unwrap_or("");
    if color.starts_with('#') && matches!(hex.len(), 3 | 6 | 8) && hex.chars().all(|item| item.is_ascii_hexdigit()) {
        color
    } else {
        "#102033"
    }
}

fn spacer_command(background: &str) -> String {
    let script = format!(
        "printf '\\033[?25l\\033]11;{}\\007'; exec sleep 2147483647",
        terminal_color(background)
    );
    format!("/bin/sh -c {}", shell_quote(&script))
}

fn image_pixels(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") && bytes.len() >= 24 {
        let width = u32::from_be_bytes(bytes[16..20].try_into().ok()?);
        let height = u32::from_be_bytes(bytes[20..24].try_into().ok()?);
        return (width > 0 && height > 0).then_some((width, height));
    }
    if (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) && bytes.len() >= 10 {
        let width = u16::from_le_bytes(bytes[6..8].try_into().ok()?) as u32;
        let height = u16::from_le_bytes(bytes[8..10].try_into().ok()?) as u32;
        return (width > 0 && height > 0).then_some((width, height));
    }
    if bytes.starts_with(&[0xFF, 0xD8]) {
        let mut index = 2;
        while index + 8 < bytes.len() {
            if bytes[index] != 0xFF {
                index += 1;
                continue;
            }
            let marker = bytes[index + 1];
            if marker == 0xC0 || marker == 0xC1 || marker == 0xC2 {
                let height = u16::from_be_bytes(bytes[index + 5..index + 7].try_into().ok()?) as u32;
                let width = u16::from_be_bytes(bytes[index + 7..index + 9].try_into().ok()?) as u32;
                return (width > 0 && height > 0).then_some((width, height));
            }
            if index + 3 >= bytes.len() {
                break;
            }
            let length = u16::from_be_bytes(bytes[index + 2..index + 4].try_into().ok()?) as usize;
            index += 2 + length.max(2);
        }
    }
    None
}

fn image_aspect(path: &str) -> Option<f64> {
    let bytes = fs::read(path).ok()?;
    let (width, height) = image_pixels(&bytes)?;
    Some(width as f64 / height as f64)
}

fn shell_command(root: &Path) -> String {
    shell_quote(&root.join("builder-shell").display().to_string())
}

#[derive(Clone)]
struct Pane {
    title: String,
    command: String,
    size: f64,
}

struct Placed {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    edge: String,
    title: String,
    command: String,
    aspect: Option<f64>,
}

fn percent(part: f64, whole: f64) -> u32 {
    if whole <= 1.0 {
        return 50;
    }
    (part / whole * 100.0).round().clamp(1.0, 99.0) as u32
}

fn span(size: f64, total: f64) -> f64 {
    if size <= 0.0 {
        return 0.0;
    }
    size.min(total * 0.8).max(1.0)
}

fn launch(location: Option<&str>, bias: Option<u32>, title: &str, cwd: bool, command: &str) -> String {
    let mut line = String::from("launch");
    if let Some(location) = location {
        line.push_str(" --location=");
        line.push_str(location);
    }
    if let Some(bias) = bias {
        line.push_str(" --bias=");
        line.push_str(&bias.to_string());
    }
    if cwd {
        line.push_str(" --cwd=current");
    }
    line.push_str(" --title=");
    line.push_str(title);
    if !command.is_empty() {
        line.push(' ');
        line.push_str(command);
    }
    line
}

fn subdivide(lines: &mut Vec<String>, panes: &[Pane], location: &str) {
    fn rec(lines: &mut Vec<String>, current: &str, current_size: f64, rest: &[Pane], location: &str) {
        if rest.is_empty() {
            return;
        }
        let rest_size: f64 = rest.iter().map(|pane| pane.size).sum();
        let bias = percent(rest_size, current_size + rest_size);
        lines.push(format!("focus_matching_window title:{current}"));
        lines.push(launch(
            Some(location),
            Some(bias),
            &rest[0].title,
            false,
            &rest[0].command,
        ));
        rec(lines, &rest[0].title, rest[0].size, &rest[1..], location);
    }
    if panes.len() >= 2 {
        rec(lines, &panes[0].title, panes[0].size, &panes[1..], location);
    }
}

fn fitted_size(item: &Placed, by_x: bool, cross: f64) -> f64 {
    let limit = if by_x { item.w } else { item.h };
    let Some(aspect) = item.aspect.filter(|aspect| *aspect > 0.0) else {
        return limit.max(1.0);
    };
    let fitted = if by_x { cross * aspect } else { cross / aspect };
    fitted.min(limit).max(1.0)
}

fn band(items: &mut [Placed], origin: f64, span_size: f64, by_x: bool, gaps: &mut u32, background: &str) -> Vec<Pane> {
    if items.is_empty() {
        return Vec::new();
    }
    items.sort_by(|left, right| {
        let (a, b) = if by_x { (left.x, right.x) } else { (left.y, right.y) };
        a.partial_cmp(&b).unwrap_or(std::cmp::Ordering::Equal)
    });
    let cross = items.iter().map(|item| if by_x { item.h } else { item.w }).fold(0.0_f64, f64::max).max(1.0);
    let mut panes = Vec::new();
    let mut cursor = origin;
    for item in items.iter() {
        let start = if by_x { item.x } else { item.y };
        let size = fitted_size(item, by_x, cross);
        if start - cursor > 16.0 {
            *gaps += 1;
            panes.push(Pane {
                title: format!("gap{gaps}"),
                command: spacer_command(background),
                size: start - cursor,
            });
        }
        panes.push(Pane {
            title: item.title.clone(),
            command: item.command.clone(),
            size,
        });
        cursor = (start + size).max(cursor);
    }
    let rest = origin + span_size - cursor;
    if !by_x && rest > 16.0 {
        *gaps += 1;
        panes.push(Pane {
            title: format!("gap{gaps}"),
            command: spacer_command(background),
            size: rest,
        });
    }
    panes
}

fn session(spec: &OverlaySpec, root: &Path) -> String {
    let stage_w = if spec.stage_width >= 80.0 { spec.stage_width } else { 740.0 };
    let stage_h = if spec.stage_height >= 80.0 { spec.stage_height } else { 420.0 };
    let shell = shell_command(root);
    let mut lines = vec!["new_tab overlays".to_string(), "layout splits".to_string()];
    let mut placed = Vec::new();
    for (index, image) in spec.images.iter().filter(|image| image.placement.pinned).enumerate() {
        placed.push(Placed {
            x: image.placement.x,
            y: image.placement.y,
            w: image.placement.w,
            h: image.placement.h,
            edge: image.placement.edge.clone(),
            title: format!("ov{index}"),
            command: image_command(&image.path),
            aspect: image_aspect(&image.path),
        });
    }
    let image_count = placed.len();
    for (index, widget) in spec.widgets.iter().filter(|widget| widget.placement.pinned).enumerate() {
        placed.push(Placed {
            x: widget.placement.x,
            y: widget.placement.y,
            w: widget.placement.w,
            h: widget.placement.h,
            edge: widget.placement.edge.clone(),
            title: format!("ov{}", image_count + index),
            command: widget_command(root, widget),
            aspect: None,
        });
    }
    if placed.is_empty() {
        lines.push(launch(None, None, "main", true, &shell));
        return format!("{}\n", lines.join("\n"));
    }

    let mut top = Vec::new();
    let mut bottom = Vec::new();
    let mut left = Vec::new();
    let mut right = Vec::new();
    for item in placed {
        match item.edge.as_str() {
            "bottom" => bottom.push(item),
            "left" => left.push(item),
            "right" => right.push(item),
            _ => top.push(item),
        }
    }
    let mut top_h = span(top.iter().map(|item| item.h).fold(0.0, f64::max), stage_h);
    let mut bottom_h = span(bottom.iter().map(|item| item.h).fold(0.0, f64::max), stage_h);
    let left_w = span(left.iter().map(|item| item.w).fold(0.0, f64::max), stage_w);
    let right_w = span(right.iter().map(|item| item.w).fold(0.0, f64::max), stage_w);
    let used = top_h + bottom_h;
    if used > stage_h * 0.85 && used > 0.0 {
        let scale = stage_h * 0.85 / used;
        top_h *= scale;
        bottom_h *= scale;
    }
    let mid_h = (stage_h - top_h - bottom_h).max(1.0);
    let main_w = (stage_w - left_w - right_w).max(1.0);
    let mut gaps = 0u32;
    let background = spec.background.as_str();
    let top_panes = band(&mut top, 0.0, stage_w, true, &mut gaps, background);
    let bottom_panes = band(&mut bottom, 0.0, stage_w, true, &mut gaps, background);
    let left_panes = band(&mut left, top_h, mid_h, false, &mut gaps, background);
    let right_panes = band(&mut right, top_h, mid_h, false, &mut gaps, background);
    let middle_is_left = !left_panes.is_empty();
    let middle_title = if middle_is_left { left_panes[0].title.clone() } else { "main".to_string() };
    let middle_command = if middle_is_left { left_panes[0].command.clone() } else { shell.clone() };

    if top_panes.is_empty() {
        lines.push(launch(None, None, &middle_title, middle_title == "main", &middle_command));
    } else {
        lines.push(launch(None, None, &top_panes[0].title, false, &top_panes[0].command));
        lines.push(launch(
            Some("hsplit"),
            Some(percent(stage_h - top_h, stage_h)),
            &middle_title,
            middle_title == "main",
            &middle_command,
        ));
        subdivide(&mut lines, &top_panes, "vsplit");
    }
    if !bottom_panes.is_empty() {
        let below_h = if top_panes.is_empty() { stage_h } else { stage_h - top_h };
        lines.push(format!("focus_matching_window title:{middle_title}"));
        lines.push(launch(
            Some("hsplit"),
            Some(percent(bottom_h, below_h)),
            &bottom_panes[0].title,
            false,
            &bottom_panes[0].command,
        ));
        subdivide(&mut lines, &bottom_panes, "vsplit");
    }
    if middle_is_left {
        lines.push(format!("focus_matching_window title:{}", left_panes[0].title));
        lines.push(launch(
            Some("vsplit"),
            Some(percent(main_w + right_w, left_w + main_w + right_w)),
            "main",
            true,
            &shell,
        ));
        if !right_panes.is_empty() {
            lines.push("focus_matching_window title:main".into());
            lines.push(launch(
                Some("vsplit"),
                Some(percent(right_w, main_w + right_w)),
                &right_panes[0].title,
                false,
                &right_panes[0].command,
            ));
            subdivide(&mut lines, &right_panes, "hsplit");
        }
        subdivide(&mut lines, &left_panes, "hsplit");
    } else if !right_panes.is_empty() {
        lines.push("focus_matching_window title:main".into());
        lines.push(launch(
            Some("vsplit"),
            Some(percent(right_w, main_w + right_w)),
            &right_panes[0].title,
            false,
            &right_panes[0].command,
        ));
        subdivide(&mut lines, &right_panes, "hsplit");
    }
    lines.push("focus_matching_window title:main".into());
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

#[cfg(test)]
mod tests {
    use super::*;

    fn placement(x: f64, y: f64, w: f64, h: f64, edge: &str) -> Placement {
        Placement { x, y, w, h, pinned: true, edge: edge.into() }
    }

    #[test]
    fn pinned_row_sits_above_the_shell_without_stretching_the_image() {
        let spec = OverlaySpec {
            images: vec![OverlayImage {
                id: "gif".into(),
                path: "/Users/appfactory/Downloads/bocchi-the-rock-bocchi.gif".into(),
                placement: placement(5.4, 0.0, 290.9, 72.9, "top"),
            }],
            widgets: vec![
                TerminalWidget {
                    id: "mem".into(),
                    kind: "memory".into(),
                    label: "Memory".into(),
                    foreground: "#f3e9fb".into(),
                    background: "#21182a".into(),
                    clock24: true,
                    placement: placement(299.4, 0.0, 173.6, 75.5, "top"),
                },
                TerminalWidget {
                    id: "cpu".into(),
                    kind: "cpu".into(),
                    label: "CPU".into(),
                    foreground: "#f3e9fb".into(),
                    background: "#21182a".into(),
                    clock24: true,
                    placement: placement(476.9, 0.0, 186.4, 77.5, "top"),
                },
            ],
            stage_width: 740.0,
            stage_height: 420.0,
            background: "#102033".into(),
        };
        let text = session(&spec, Path::new("/Users/appfactory/.config/kitty"));
        let lines: Vec<_> = text.lines().collect();
        assert_eq!(lines[0], "new_tab overlays");
        assert_eq!(lines[1], "layout splits");
        assert!(lines[2].starts_with("launch --title=ov0 "));
        assert!(lines[2].contains("--fit=both"));
        assert!(!lines[2].contains("#141118"));
        assert!(lines[2].contains("bocchi-the-rock-bocchi.gif"));
        assert!(!lines[2].contains("--location="));
        let top_h = 77.5_f64;
        let shell_bias = percent(420.0 - top_h, 420.0);
        assert!(lines[3].starts_with(&format!("launch --location=hsplit --bias={shell_bias} --cwd=current --title=main ")));
        let splits: Vec<_> = lines.iter().filter(|line| line.starts_with("launch --location=")).collect();
        assert_eq!(splits.iter().filter(|line| line.contains("hsplit")).count(), 1);
        let memory = lines.iter().position(|line| line.contains("'memory'")).unwrap();
        let cpu = lines.iter().position(|line| line.contains("'cpu'")).unwrap();
        assert!(memory < cpu);
        assert!(lines[memory].contains("--location=vsplit"));
        assert!(lines[cpu].contains("--location=vsplit"));
        assert_eq!(lines.last().copied(), Some("focus_matching_window title:main"));
    }
}
