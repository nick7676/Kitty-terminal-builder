mod command;
mod config;
mod image;
mod kitty;
mod packages;
mod paths;
mod status;
mod util;

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
            status::get_system_status,
            config::list_config_files,
            config::read_config_file,
            config::write_config_file,
            config::list_backups,
            config::restore_backup,
            kitty::get_option_registry,
            kitty::reload_kitty,
            image::preview_image,
            packages::detect_commands,
            packages::list_managed_packages,
            packages::run_package_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kitty Builder");
}
