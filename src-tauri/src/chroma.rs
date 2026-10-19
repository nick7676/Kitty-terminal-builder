use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use crate::{paths::config_root, util::explain};

struct KeyColor {
    hex: String,
    despill: &'static str,
}

#[tauri::command]
pub fn remove_greenscreen(path: String, mode: String) -> Result<String, String> {
    let input = PathBuf::from(&path);
    if !input.is_absolute() || !input.is_file() {
        return Err("Choose a GIF or video with an absolute path".into());
    }
    let ffmpeg = ffmpeg_binary()?;
    let (_, _, pixels) = sample_frame(&ffmpeg, &input)?;
    let (sample_width, sample_height) = (160u32, (pixels.len() / 4) as u32 / 160);
    let key = detect_key(&pixels, sample_width, sample_height)?;
    let overlay = mode != "background";
    let output = output_path(&input, overlay)?;
    fs::create_dir_all(output.parent().unwrap_or(Path::new("."))).map_err(explain)?;
    let geometry = if overlay {
        "scale=640:-2:flags=lanczos"
    } else {
        "scale=720:-2:flags=lanczos,pad=trunc(iw*1.8/2)*2:trunc(ih*1.8/2)*2:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
    };
    let filter = format!(
        "[0:v]format=rgba,chromakey=0x{hex}:0.2:0.1,despill=type={despill}:mix=0.55:expand=0.08,{geometry},split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=diff:max_colors=256[p];[b][p]paletteuse=alpha_threshold=96:dither=floyd_steinberg",
        hex = key.hex,
        despill = key.despill,
    );
    let result = Command::new(&ffmpeg)
        .args([
            "-y",
            "-i",
            &path,
            "-an",
            "-filter_complex",
            &filter,
            "-loop",
            "0",
        ])
        .arg(&output)
        .output()
        .map_err(explain)?;
    if !result.status.success() {
        let detail = String::from_utf8_lossy(&result.stderr);
        let line = detail.lines().rev().find(|line| !line.trim().is_empty()).unwrap_or("ffmpeg failed");
        return Err(line.trim().to_string());
    }
    Ok(output.display().to_string())
}

fn ffmpeg_binary() -> Result<PathBuf, String> {
    for candidate in ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"] {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return Ok(path);
        }
    }
    Err("ffmpeg is required to remove a greenscreen".into())
}

fn sample_frame(ffmpeg: &Path, input: &Path) -> Result<(u32, u32, Vec<u8>), String> {
    let output = Command::new(ffmpeg)
        .args([
            "-v",
            "error",
            "-i",
            &input.display().to_string(),
            "-frames:v",
            "1",
            "-vf",
            "scale=160:-2",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-",
        ])
        .output()
        .map_err(explain)?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let pixels = output.stdout;
    if pixels.len() % 4 != 0 || pixels.is_empty() {
        return Err("Could not read a frame from that file".into());
    }
    if pixels.len() % (160 * 4) != 0 {
        return Err("Could not read a frame from that file".into());
    }
    Ok((160, (pixels.len() / 4 / 160) as u32, pixels))
}

fn detect_key(pixels: &[u8], width: u32, height: u32) -> Result<KeyColor, String> {
    let width = width as usize;
    let height = height as usize;
    let margin_x = (width / 12).max(2);
    let margin_y = (height / 12).max(2);
    let mut buckets: HashMap<(u8, u8, u8), (u32, u64, u64, u64)> = HashMap::new();
    for y in 0..height {
        for x in 0..width {
            let edge = x < margin_x || y < margin_y || x + margin_x >= width || y + margin_y >= height;
            if !edge {
                continue;
            }
            let index = (y * width + x) * 4;
            let (red, green, blue) = (pixels[index], pixels[index + 1], pixels[index + 2]);
            let max = red.max(green).max(blue);
            let min = red.min(green).min(blue);
            if max < 48 || max - min < 28 {
                continue;
            }
            let key = (red / 12, green / 12, blue / 12);
            let entry = buckets.entry(key).or_insert((0, 0, 0, 0));
            entry.0 += 1;
            entry.1 += u64::from(red);
            entry.2 += u64::from(green);
            entry.3 += u64::from(blue);
        }
    }
    let (_, (count, red, green, blue)) = buckets
        .into_iter()
        .max_by_key(|(_, (count, ..))| *count)
        .ok_or("No flat backdrop color was found around the edges")?;
    if count < 12 {
        return Err("The edges are not a flat greenscreen".into());
    }
    let red = (red / u64::from(count)) as u8;
    let green = (green / u64::from(count)) as u8;
    let blue = (blue / u64::from(count)) as u8;
    let despill = if green >= red && green >= blue { "green" } else { "blue" };
    Ok(KeyColor {
        hex: format!("{red:02x}{green:02x}{blue:02x}"),
        despill,
    })
}

fn output_path(input: &Path, overlay: bool) -> Result<PathBuf, String> {
    let stem = input
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("background");
    let safe: String = stem
        .chars()
        .map(|char| if char.is_ascii_alphanumeric() { char } else { '-' })
        .collect();
    let kind = if overlay { "overlay" } else { "background" };
    let name = format!("{}-{kind}.gif", safe.trim_matches('-'));
    Ok(config_root()?.join("backgrounds").join(name))
}
