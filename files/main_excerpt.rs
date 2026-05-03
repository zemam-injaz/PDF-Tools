// src-tauri/src/main.rs  (relevant excerpts — merge with your existing file)
//
// 1. Declare the converter module
// 2. Register the HTTP client state
// 3. Register all commands

mod converter;

fn main() {
    let http_client = converter::HttpClient(
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300)) // 5 min — large PDFs
            .build()
            .expect("Failed to build HTTP client"),
    );

    tauri::Builder::default()
        .manage(http_client)
        // ── Register all converter commands ──────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            converter::auth_status,
            converter::auth_signin,
            converter::auth_signout,
            converter::convert_pdf,
            converter::conversion_progress,
            converter::pick_pdf_file,
            converter::pick_output_dir,
            // … your other existing commands …
        ])
        // ── Start the Python sidecar ─────────────────────────────────────────
        .setup(|app| {
            // If your Python server is bundled as a sidecar binary:
            // tauri::api::process::Command::new_sidecar("server")?
            //     .spawn()
            //     .expect("Failed to start Python server");
            //
            // Or launch via python if not compiled:
            std::process::Command::new("python")
                .args(["server.py"])
                .current_dir(
                    app.path_resolver()
                        .resource_dir()
                        .unwrap()
                        .join("python"),
                )
                .spawn()
                .expect("Failed to start Python server sidecar");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
