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

fn write_executable(path: &Path, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(explain)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).map_err(explain)?;
    }
    Ok(())
}

fn image_script(images: &[OverlayImage], stage_w: f64, stage_h: f64) -> String {
    let stage_w = if stage_w >= 80.0 { stage_w } else { 740.0 };
    let stage_h = if stage_h >= 80.0 { stage_h } else { 420.0 };
    let mut script = String::from("#!/bin/sh\npane=${1:-0}\ncount=${2:-2}\n");
    script.push_str(&geometry_prelude(stage_w, stage_h));
    script.push_str("slice=$(awk -v sw=\"$stage_w\" -v n=\"$count\" 'BEGIN { print sw / n }')\n");
    script.push_str("origin=$(awk -v s=\"$slice\" -v p=\"$pane\" 'BEGIN { print s * p }')\n");
    script.push_str(&place_function());
    for image in images {
        script.push_str(&format!(
            "center=$(awk -v x='{x}' -v w='{w}' 'BEGIN {{ print x + (w / 2) }}')\n",
            x = image.placement.x.max(0.0),
            w = image.placement.w.max(1.0),
        ));
        script.push_str("ok=$(awk -v c=\"$center\" -v o=\"$origin\" -v s=\"$slice\" 'BEGIN { if (c >= o && c < o + s) print 1; else print 0 }')\n");
        script.push_str(&format!(
            "[ \"$ok\" = 1 ] && place \"$(awk -v x='{x}' -v o=\"$origin\" 'BEGIN {{ d = x - o; if (d < 0) d = 0; print d }}')\" {y} {w} {h} {}\n",
            shell_quote(&image.path),
            x = image.placement.x.max(0.0),
            y = image.placement.y.max(0.0),
            w = image.placement.w.max(1.0),
            h = image.placement.h.max(1.0),
        ));
    }
    script.push_str("printf '\\033[%s;1H' \"$prompt_row\"\nexec \"${KITTY_BUILDER_SHELL:-/bin/zsh}\" -l\n");
    script
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
    if rest > 16.0 {
        *gaps += 1;
        panes.push(Pane {
            title: format!("gap{gaps}"),
            command: spacer_command(background),
            size: rest,
        });
    }
    panes
}

fn geometry_prelude(stage_w: f64, stage_h: f64) -> String {
    format!(
        r#"kitten_bin="${{KITTY_KITTEN:-kitten}}"
stage_w={stage_w}
stage_h={stage_h}
prev=""
stable=0
i=0
cols=80
rows=24
px=800x600
while [ "$i" -lt 40 ]; do
  size=$(stty size 2>/dev/null || echo "24 80")
  rows=${{size%% *}}
  cols=${{size##* }}
  px=$("$kitten_bin" icat --print-window-size 2>/dev/null || echo 800x600)
  now="$cols $rows $px"
  sane=$(awk -v c="$cols" -v r="$rows" -v px="$px" 'BEGIN {{ split(px,p,"x"); if (c<1 || r<1) {{ print 0; exit }} cw=p[1]/c; ch=p[2]/r; if (cw>=4 && cw<=40 && ch>=8 && ch<=48) print 1; else print 0 }}')
  if [ "$sane" = 1 ] && [ "$now" = "$prev" ]; then
    stable=$((stable+1))
    [ "$stable" -ge 3 ] && break
  else
    stable=0
  fi
  prev=$now
  i=$((i+1))
  sleep 0.05
done
prompt_row=1
image_id=1
"#
    )
}

fn place_function() -> String {
    r#"place() {
  iw=$(sips -g pixelWidth "$5" 2>/dev/null | awk '/pixelWidth/ { print $2 }')
  ih=$(sips -g pixelHeight "$5" 2>/dev/null | awk '/pixelHeight/ { print $2 }')
  [ -n "$iw" ] || iw=1
  [ -n "$ih" ] || ih=1
  rect=$(awk -v x="$1" -v y="$2" -v w="$3" -v h="$4" -v sw="$slice" -v sh="$stage_h" -v c="$cols" -v r="$rows" -v px="$px" -v iw="$iw" -v ih="$ih" 'BEGIN {
    split(px, p, "x"); pw=p[1]; ph=p[2]
    if (c < 1) c = 80; if (r < 1) r = 24
    if (pw < 1) pw = c * 9; if (ph < 1) ph = r * 18
    cw_px = pw / c; ch_px = ph / r
    box_x = (x / sw) * pw; box_y = (y / sh) * ph
    box_w = (w / sw) * pw; box_h = (h / sh) * ph
    if (box_w < 1) box_w = 1; if (box_h < 1) box_h = 1
    aspect = iw / ih; if (aspect < 0.05) aspect = box_w / box_h
    if (box_w / box_h > aspect) { draw_h = box_h; draw_w = box_h * aspect } else { draw_w = box_w; draw_h = box_w / aspect }
    ox = box_x + (box_w - draw_w) / 2; oy = box_y + (box_h - draw_h) / 2
    cw = draw_w / cw_px; ch = draw_h / ch_px; cx = ox / cw_px; cy = oy / ch_px
    if (cw < 1) cw = 1; if (ch < 1) ch = 1
    if (cw > c) cw = c; if (ch > r) ch = r
    if (cx + cw > c) cx = c - cw; if (cy + ch > r) cy = r - ch
    if (cx < 0) cx = 0; if (cy < 0) cy = 0
    printf "%dx%d@%dx%d", cw, ch, cx, cy
  }')
  "$kitten_bin" icat --stdin=no --align=left --loop=-1 --scale-up --image-id "$image_id" --place "$rect" "$5" || true
  image_id=$((image_id + 1))
  top=$(printf '%s' "$rect" | awk -F '[x@]' '{ print $4 + 0 }')
  used=$(printf '%s' "$rect" | awk -F '[x@]' '{ print $2 + $4 }')
  if [ "$top" -le 2 ]; then
    next=$((used + 2))
    [ "$next" -gt "$prompt_row" ] && prompt_row=$next
  fi
}
"#
    .to_string()
}

fn pane_script(images: &[OverlayImage], pane: usize, stage_w: f64, stage_h: f64) -> String {
    let mut script = String::from("#!/bin/sh\n");
    script.push_str(&pane_body(images, pane, stage_w, stage_h));
    script
}

fn pane_body(images: &[OverlayImage], pane: usize, stage_w: f64, stage_h: f64) -> String {
    let slice = stage_w / 2.0;
    let origin = slice * pane as f64;
    let mut script = geometry_prelude(stage_w, stage_h);
    script.push_str(&format!("slice={slice}\n"));
    script.push_str(&place_function());
    script.push_str(&format!("image_id={}\n", pane * 10 + 1));
    for image in images {
        let center = image.placement.x + image.placement.w / 2.0;
        if center < origin || center >= origin + slice {
            continue;
        }
        let local_x = (image.placement.x - origin).max(0.0);
        script.push_str(&format!(
            "place {local_x} {y} {w} {h} {}\n",
            shell_quote(&image.path),
            y = image.placement.y.max(0.0),
            w = image.placement.w.max(1.0),
            h = image.placement.h.max(1.0),
        ));
    }
    script.push_str("printf '\\033[%s;1H' \"$prompt_row\"\nexec /bin/zsh -l\n");
    script
}

fn pane_path(root: &Path, pane: usize) -> String {
    root.join(format!("builder-pane-{pane}")).display().to_string()
}

fn two_panes(_spec: &OverlaySpec, root: &Path) -> String {
    format!(
        "new_tab custom\nlayout splits\nlaunch --cwd=current --title=custom {}\nlaunch --location=vsplit --bias=50 --cwd=current --title=custom {}\n",
        pane_path(root, 0),
        pane_path(root, 1),
    )
}

fn session(spec: &OverlaySpec, root: &Path) -> String {
    let stage_w = if spec.stage_width >= 80.0 { spec.stage_width } else { 740.0 };
    let stage_h = if spec.stage_height >= 80.0 { spec.stage_height } else { 420.0 };
    if spec.widgets.is_empty() && !spec.images.is_empty() {
        return two_panes(spec, root);
    }
    let shell = shell_command(root);
    let mut lines = vec!["new_tab overlays".to_string(), "layout splits".to_string()];
    let mut placed = Vec::new();
    for (index, widget) in spec.widgets.iter().filter(|widget| widget.placement.pinned).enumerate() {
        placed.push(Placed {
            x: widget.placement.x,
            y: widget.placement.y,
            w: widget.placement.w,
            h: widget.placement.h,
            edge: widget.placement.edge.clone(),
            title: format!("ov{index}"),
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
    write_executable(
        &root.join("builder-shell"),
        &image_script(&spec.images, spec.stage_width, spec.stage_height),
    )?;
    write_executable(&root.join("builder-widget"), widget_script())?;
    let stage_w = if spec.stage_width >= 80.0 { spec.stage_width } else { 740.0 };
    let stage_h = if spec.stage_height >= 80.0 { spec.stage_height } else { 420.0 };
    write_executable(&root.join("builder-pane-0"), &pane_script(&spec.images, 0, stage_w, stage_h))?;
    write_executable(&root.join("builder-pane-1"), &pane_script(&spec.images, 1, stage_w, stage_h))?;
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
        assert!(!text.contains("bocchi-the-rock-bocchi.gif"));
        let script = image_script(&spec.images, spec.stage_width, spec.stage_height);
        assert!(script.contains("stty size"));
        assert!(!script.contains("unicode-placeholder"));
        assert!(script.contains("bocchi-the-rock-bocchi.gif"));
        let top_h = 77.5_f64;
        let shell_bias = percent(420.0 - top_h, 420.0);
        assert!(text.contains(&format!("--location=hsplit --bias={shell_bias}")));
        let splits: Vec<_> = lines.iter().filter(|line| line.starts_with("launch --location=")).collect();
        assert_eq!(splits.iter().filter(|line| line.contains("hsplit")).count(), 1);
        let memory = lines.iter().position(|line| line.contains("'memory'")).unwrap();
        let cpu = lines.iter().position(|line| line.contains("'cpu'")).unwrap();
        assert!(memory < cpu);
        assert!(lines[memory].contains("--location=vsplit"));
        assert!(lines[cpu].contains("--location=vsplit"));
        assert_eq!(lines.last().copied(), Some("focus_matching_window title:main"));
    }

    #[test]
    fn each_pane_places_only_its_own_image_after_the_real_size() {
        let spec = OverlaySpec {
            images: vec![
                OverlayImage {
                    id: "left".into(),
                    path: "/tmp/left.gif".into(),
                    placement: Placement { x: 0.0, y: 0.0, w: 120.0, h: 56.0, pinned: false, edge: "left".into() },
                },
                OverlayImage {
                    id: "right".into(),
                    path: "/tmp/cat.gif".into(),
                    placement: Placement { x: 500.0, y: 300.0, w: 90.0, h: 56.0, pinned: false, edge: "right".into() },
                },
            ],
            widgets: vec![],
            stage_width: 666.0,
            stage_height: 409.0,
            background: String::new(),
        };
        let text = session(&spec, Path::new("/Users/appfactory/.config/kitty"));
        assert_eq!(text.lines().count(), 4);
        assert!(!text.contains('\''));
        assert!(text.contains("builder-pane-0"));
        assert!(text.contains("builder-pane-1"));
        let left = pane_script(&spec.images, 0, spec.stage_width, spec.stage_height);
        let right = pane_script(&spec.images, 1, spec.stage_width, spec.stage_height);
        assert!(left.contains("/tmp/left.gif"));
        assert!(!left.contains("/tmp/cat.gif"));
        assert!(right.contains("/tmp/cat.gif"));
        assert!(!right.contains("/tmp/left.gif"));
        assert!(left.contains("stty size"));
        assert!(!text.contains("unicode-placeholder"));
    }
}
