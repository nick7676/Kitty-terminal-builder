use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::util::explain;

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
        for shift in [18, 12, 6, 0] {
            output.push(TABLE[((value >> shift) & 63) as usize] as char);
        }
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

#[tauri::command]
pub fn preview_image(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let mime = image_mime(&path)?;
    let metadata = fs::metadata(&path).map_err(explain)?;
    if !metadata.is_file() || metadata.len() > 32 * 1024 * 1024 {
        return Err("Choose an image smaller than 32 MB".into());
    }
    let bytes = fs::read(&path).map_err(explain)?;
    Ok(format!("data:{mime};base64,{}", encode_base64(&bytes)))
}

#[cfg(test)]
mod tests {
    use super::{encode_base64, image_mime};
    use std::path::Path;

    #[test]
    fn encodes_image_bytes_and_rejects_non_images() {
        assert_eq!(encode_base64(b"Man"), "TWFu");
        assert!(image_mime(Path::new("/tmp/wall.png")).is_ok());
        assert!(image_mime(Path::new("relative.png")).is_err());
        assert!(image_mime(Path::new("/tmp/notes.txt")).is_err());
    }
}
