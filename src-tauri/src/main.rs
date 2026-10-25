// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// Force restart to apply backend annotation route changes
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::path::{Component, Path, PathBuf};
use std::net::TcpListener;
use std::io::{BufRead, BufReader, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::{Emitter, Manager};

struct ServerProcess(Mutex<Option<Child>>);
struct BackendPort(u16);
struct BackendToken(String);
struct ReaderProcess(Mutex<Option<Child>>);

fn reader_executable(app: &tauri::AppHandle) -> Result<(PathBuf, bool), String> {
    if cfg!(debug_assertions) {
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../qt_pdf_reader/pdf_reader.py");
        if script.is_file() { return Ok((script, true)); }
    }
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    for path in [resource_dir.join("resources/qt_pdf_reader.exe"), resource_dir.join("qt_pdf_reader.exe")] {
        if path.is_file() { return Ok((path, false)); }
    }
    Err("Qt reader executable is missing. Build qt_pdf_reader.exe before packaging Matn.".into())
}

fn send_reader(child: &mut Child, value: &serde_json::Value) -> Result<(), String> {
    let input = child.stdin.as_mut().ok_or("Reader command pipe is closed")?;
    writeln!(input, "{}", value).map_err(|e| e.to_string())?;
    input.flush().map_err(|e| e.to_string())
}

#[tauri::command]
fn launch_reader(app: tauri::AppHandle, state: tauri::State<ReaderProcess>,
                 port: tauri::State<BackendPort>, token: tauri::State<BackendToken>,
                 path: String, book_id: String) -> Result<(), String> {
    let pdf = PathBuf::from(&path);
    if !pdf.is_file() || pdf.extension().and_then(|s| s.to_str()).map(|s| !s.eq_ignore_ascii_case("pdf")).unwrap_or(true) {
        return Err("The PDF file does not exist".into());
    }
    if book_id.parse::<u64>().is_err() { return Err("Invalid book ID".into()); }
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            return send_reader(child, &serde_json::json!({"type":"open", "path":path, "book_id":book_id}));
        }
    }
    let (executable, is_script) = reader_executable(&app)?;
    let mut command = if is_script {
        let mut c = Command::new("python"); c.arg(&executable); c
    } else { Command::new(&executable) };
    command.arg(&path).arg("--book-id").arg(&book_id)
        .env("MATN_BACKEND_PORT", port.0.to_string())
        .env("MATN_BACKEND_TOKEN", &token.0)
        .stdin(Stdio::piped()).stdout(Stdio::piped());
    #[cfg(target_os = "windows")]
    if !cfg!(debug_assertions) { command.creation_flags(0x08000000); }
    let mut child = command.spawn().map_err(|e| format!("Could not start Qt reader: {e}"))?;
    let stdout = child.stdout.take().ok_or("Reader event pipe is closed")?;
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                let _ = app.emit("matn-reader", event);
            }
        }
        let _ = app.emit("matn-reader", serde_json::json!({"type":"closed"}));
    });
    *guard = Some(child);
    Ok(())
}

#[tauri::command]
fn reader_action(state: tauri::State<ReaderProcess>, action: String,
                 page: Option<u32>, zoom: Option<f64>, visible: Option<bool>, query: Option<String>) -> Result<(), String> {
    if !matches!(action.as_str(), "focus" | "minimize" | "close" | "goto" | "zoom" | "comments" | "filter_comments") {
        return Err("Unsupported reader action".into());
    }
    if query.as_ref().is_some_and(|value| value.len() > 200) { return Err("Comment filter is too long".into()); }
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let child = guard.as_mut().ok_or("Reader is not running")?;
    if child.try_wait().map_err(|e| e.to_string())?.is_some() { return Err("Reader has exited".into()); }
    send_reader(child, &serde_json::json!({"type":action, "page":page, "zoom":zoom, "visible":visible, "query":query}))
}

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
fn get_backend_token(state: tauri::State<BackendToken>) -> String {
    state.0.clone()
}

fn app_data_file(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    let relative = Path::new(name);
    if relative.is_absolute() || relative.components().any(|part| matches!(part, Component::ParentDir)) {
        return Err("App storage path must stay inside the app data directory".to_string());
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(relative))
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

#[tauri::command]
fn read_app_file(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    let path = app_data_file(&app, &name)?;
    match std::fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn write_app_file(app: tauri::AppHandle, name: String, content: String) -> Result<(), String> {
    let path = app_data_file(&app, &name)?;
    std::fs::write(path, content).map_err(|e| e.to_string())
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
    let backend_token = uuid::Uuid::new_v4().to_string();
    let backend_token_for_setup = backend_token.clone();
    println!("Selected backend port: {}", port);
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_in_explorer, get_backend_port, get_backend_token, read_app_file, write_app_file, launch_reader, reader_action])
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendPort(port))
        .manage(BackendToken(backend_token))
        .manage(ReaderProcess(Mutex::new(None)))
        .setup(move |app| {
            let resource_dir = app.path().resource_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap());
            
            // Priority 1: Fall back to Python script (development mode / debug)
            // We check this FIRST so that local changes to server.py take effect
            let script_found = if let Some(script_path) = find_python_script() {
                println!("Starting Python backend: {:?}", script_path);
                
                let mut cmd = Command::new("python");
                cmd.arg(&script_path)
                   .env("PORT", port.to_string())
                   .env("LOCAL_API_TOKEN", &backend_token_for_setup);
                if !cfg!(debug_assertions) {
                    cmd.env("LAUNCH_ACCESS_ENABLED", "false");
                }
                   
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
                    .env("LOCAL_API_TOKEN", &backend_token_for_setup)
                    .current_dir(exe_path.parent().unwrap())
                    .stdin(Stdio::null())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());
                if !cfg!(debug_assertions) {
                    cmd.env("LAUNCH_ACCESS_ENABLED", "false");
                }
                
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
                let reader_state = app_handle.state::<ReaderProcess>();
                if let Some(mut reader) = reader_state.0.lock().unwrap().take() {
                    // Let Qt ask about unsaved annotations. If the user keeps
                    // that window open, leave it alive so their work is safe.
                    let _ = send_reader(&mut reader, &serde_json::json!({"type":"close"}));
                }
                let state = app_handle.state::<ServerProcess>();
                let mut child_guard = state.0.lock().unwrap();
                if let Some(mut child) = child_guard.take() {
                    println!("Killing backend server...");
                    let _ = child.kill();
                }
            }
        });
}
