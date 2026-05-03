// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// Force restart to apply backend annotation route changes
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::path::PathBuf;
use std::net::TcpListener;
use std::io::Write;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);
struct BackendPort(u16);

/// Find an available port starting from the preferred port
fn find_available_port(preferred: u16) -> u16 {
    // Try the preferred port first
    if TcpListener::bind(format!("127.0.0.1:{}", preferred)).is_ok() {
        return preferred;
    }
    
    // Try a range of ports
    for port in (preferred + 1)..=(preferred + 100) {
        if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return port;
        }
    }
    
    // Let OS assign a port
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(preferred)
}

#[tauri::command]
fn get_backend_port(state: tauri::State<BackendPort>) -> u16 {
    state.0
}

#[tauri::command]
fn open_in_explorer(path: String) {
    #[cfg(target_os = "windows")]
    {
        // On Windows, just running "explorer path" opens the folder.
        // If we wanted to select the file, we'd use /select,path
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .ok();
    }
    #[cfg(not(target_os = "windows"))]
    {
         // Fallback for other OS (macOS/Linux - specifically 'open' or 'xdg-open')
         // Not strictly needed for this user (Windows), but good practice.
    }
}

fn find_server_executable(resource_dir: &PathBuf) -> Option<PathBuf> {
    let candidates = vec![
        // Production structure - likely flattens or keeps resources folder
        resource_dir.join("resources").join("pdf_server.exe"),
        resource_dir.join("pdf_server.exe"),
        // Relative to executable
        std::env::current_exe().ok()?.parent()?.join("resources").join("pdf_server.exe"),
        std::env::current_exe().ok()?.parent()?.join("pdf_server.exe"),
    ];

    for path in candidates {
        if path.exists() {
            return Some(path);
        }
    }
    None
}

fn find_python_script() -> Option<PathBuf> {
    // Development mode: look for Python script
    let mut server_path = std::env::current_dir().ok()?;
    server_path.push("../python-server/server.py");
    
    if server_path.exists() {
        return Some(server_path);
    }
    
    // Backup check: if running from project root
    let mut server_path = std::env::current_dir().ok()?;
    server_path.push("python-server/server.py");
    
    if server_path.exists() {
        return Some(server_path);
    }
    
    None
}

fn log_error(msg: &str) {
    eprintln!("{}", msg);
    // Try to write to a debug log in temp
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(std::env::temp_dir().join("pdf_tools_debug.log")) {
        let _ = writeln!(file, "{}", msg);
    }
}

fn main() {
    // Find an available port before starting the server
    let port = find_available_port(8002);
    println!("Selected backend port: {}", port);
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_in_explorer, get_backend_port])
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendPort(port))
        .setup(move |app| {
            let resource_dir = app.path().resource_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap());
            
            // Priority 1: Fall back to Python script (development mode / debug)
            // We check this FIRST so that local changes to server.py take effect
            let script_found = if let Some(script_path) = find_python_script() {
                println!("Starting Python backend: {:?}", script_path);
                
                let mut cmd = Command::new("python");
                cmd.arg(&script_path)
                   .env("PORT", port.to_string());
                   
                #[cfg(target_os = "windows")]
                {
                    // Only hide window in release mode
                    if !cfg!(debug_assertions) {
                        const CREATE_NO_WINDOW: u32 = 0x08000000;
                        cmd.creation_flags(CREATE_NO_WINDOW);
                    }
                }

                // In debug mode, we don't pipe so it goes to the same console
                // In release or if we want to capture, we would pipe.
                match cmd.spawn() {
                    Ok(child) => {
                        println!("Backend server started (PID: {}) on port {}", child.id(), port);
                        app.manage(ServerProcess(Mutex::new(Some(child))));
                        true
                    }
                    Err(e) => {
                        eprintln!("Failed to start Python backend: {}", e);
                        false
                    }
                }
            } else {
                false
            };

            if script_found {
                return Ok(());
            }

            // Priority 2: Try to find bundled executable (production mode)
            let exe_path = find_server_executable(&resource_dir);
            
            if let Some(exe_path) = exe_path {
                println!("Starting bundled backend: {:?}", exe_path);
                log_error(&format!("Attempting to start backend at: {:?}", exe_path));
                
                let mut cmd = Command::new(&exe_path);
                cmd.env("PORT", port.to_string())
                    .current_dir(exe_path.parent().unwrap())
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());
                
                #[cfg(target_os = "windows")]
                {
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    cmd.creation_flags(CREATE_NO_WINDOW);
                }
                
                match cmd.spawn() {
                    Ok(child) => {
                        println!("Backend server started (PID: {}) on port {}", child.id(), port);
                        log_error(&format!("Backend started successfully. PID: {}", child.id()));
                        app.manage(ServerProcess(Mutex::new(Some(child))));
                        return Ok(());
                    }
                    Err(e) => {
                        log_error(&format!("Failed to start bundled backend: {}", e));
                    }
                }
            }
            
            if !script_found {
                let msg = "Could not find backend server (neither bundled exe nor Python script)";
                eprintln!("{}", msg);
                log_error(msg);
            }
            
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<ServerProcess>();
                let mut child_guard = state.0.lock().unwrap();
                if let Some(mut child) = child_guard.take() {
                    println!("Killing backend server...");
                    let _ = child.kill();
                }
            }
        });
}
