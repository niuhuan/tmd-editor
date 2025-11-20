use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{Manager, Emitter};

#[derive(Debug, Serialize, Deserialize)]
struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    is_file: bool,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn read_directory(path: String, show_hidden: Option<bool>) -> Result<Vec<FileEntry>, String> {
    let dir_path = PathBuf::from(&path);
    let show_hidden = show_hidden.unwrap_or(true); // Default to true
    
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut entries = Vec::new();
    
    match fs::read_dir(&dir_path) {
        Ok(dir_entries) => {
            for entry in dir_entries {
                match entry {
                    Ok(entry) => {
                        let path = entry.path();
                        let metadata = match entry.metadata() {
                            Ok(m) => m,
                            Err(_) => continue,
                        };
                        
                        let name = match entry.file_name().into_string() {
                            Ok(n) => n,
                            Err(_) => continue,
                        };
                        
                        // Skip hidden files if show_hidden is false
                        if !show_hidden && name.starts_with('.') {
                            continue;
                        }
                        
                        entries.push(FileEntry {
                            name,
                            path: path.to_string_lossy().to_string(),
                            is_directory: metadata.is_dir(),
                            is_file: metadata.is_file(),
                        });
                    }
                    Err(_) => continue,
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    // Sort: directories first, then files, both alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[tauri::command]
async fn read_image_file(path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    
    match fs::read(&path) {
        Ok(bytes) => {
            let base64_string = general_purpose::STANDARD.encode(&bytes);
            Ok(base64_string)
        }
        Err(e) => Err(format!("Failed to read image file: {}", e)),
    }
}

#[tauri::command]
async fn create_file(path: String) -> Result<(), String> {
    match fs::File::create(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create file: {}", e)),
    }
}

#[tauri::command]
async fn create_directory(path: String) -> Result<(), String> {
    match fs::create_dir(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create directory: {}", e)),
    }
}

#[tauri::command]
async fn delete_path(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err("Path does not exist".to_string());
    }
    
    if path_buf.is_dir() {
        match fs::remove_dir_all(&path) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to delete directory: {}", e)),
        }
    } else {
        match fs::remove_file(&path) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to delete file: {}", e)),
        }
    }
}

#[tauri::command]
async fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    match fs::rename(&old_path, &new_path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to rename: {}", e)),
    }
}

#[tauri::command]
async fn save_file(path: String, content: String) -> Result<(), String> {
    match fs::write(&path, content) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to save file: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_imports)]
    use tauri::menu::{PredefinedMenuItem};
    use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Create menu items
            let open_folder = MenuItemBuilder::with_id("open-folder", "Open Folder...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            
            let open_file = MenuItemBuilder::with_id("open-file", "Open File...")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;
            
            let settings_item = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;
            
            // Build File submenu
            #[allow(unused_mut)]
            let mut file_menu_builder = SubmenuBuilder::new(app, "File")
                .item(&open_folder)
                .item(&open_file);
            
            // On Windows and Linux, add Settings and Exit in File menu
            #[cfg(not(target_os = "macos"))]
            {
                file_menu_builder = file_menu_builder
                    .separator()
                    .item(&settings_item)
                    .separator();
                
                let quit_item = PredefinedMenuItem::quit(app, Some("Exit"))?;
                file_menu_builder = file_menu_builder.item(&quit_item);
            }
            
            let file_menu = file_menu_builder.build()?;
            
            // Create Save menu items
            let save_item = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            
            let save_all_item = MenuItemBuilder::with_id("save-all", "Save All")
                .accelerator("CmdOrCtrl+Alt+S")
                .build(app)?;
            
            // Create Edit menu with standard editing commands
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .separator()
                .item(&save_item)
                .item(&save_all_item)
                .build()?;
            
            // Create main menu
            let menu = Menu::new(app)?;
            
            // On macOS, add app menu with Preferences and Quit
            #[cfg(target_os = "macos")]
            {
                let app_menu = SubmenuBuilder::new(app, "TMD Editor")
                    .separator()
                    .item(&settings_item)
                    .separator()
                    .quit()
                    .build()?;
                menu.append(&app_menu)?;
            }
            
            // Add File menu
            menu.append(&file_menu)?;
            
            // Add Edit menu
            menu.append(&edit_menu)?;
            
            app.set_menu(menu)?;
            
            // Handle menu events
            app.on_menu_event(move |app, event| {
                let event_id = event.id().as_ref();
                if let Some(window) = app.get_webview_window("main") {
                    match event_id {
                        "open-folder" => {
                            let _ = window.emit("menu-open-folder", ());
                        }
                        "open-file" => {
                            let _ = window.emit("menu-open-file", ());
                        }
                        "settings" => {
                            let _ = window.emit("menu-settings", ());
                        }
                        "save" => {
                            let _ = window.emit("menu-save", ());
                        }
                        "save-all" => {
                            let _ = window.emit("menu-save-all", ());
                        }
                        _ => {}
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            read_directory,
            read_file_content,
            read_image_file,
            create_file,
            create_directory,
            delete_path,
            rename_path,
            save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
