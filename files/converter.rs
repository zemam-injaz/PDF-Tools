// src-tauri/src/converter.rs
//
// Tauri commands for the PDF→DOCX/TXT conversion feature.
// These are thin wrappers that forward requests to the Python sidecar server.
//
// Add to Cargo.toml:
//   [dependencies]
//   reqwest = { version = "0.12", features = ["json", "blocking"] }
//   serde = { version = "1", features = ["derive"] }
//   serde_json = "1"
//   tokio = { version = "1", features = ["full"] }

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, State};

const SERVER: &str = "http://127.0.0.1:5199";

// ── Shared HTTP client (held in Tauri state) ──────────────────────────────────

pub struct HttpClient(pub Client);

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Serialize)]
pub struct AuthStatus {
    pub authenticated: bool,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ConversionProgress {
    pub status: String,  // idle | starting | converting | done | error
    pub percent: u32,
    pub error: Option<String>,
    pub result: Option<ConversionResult>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ConversionResult {
    pub docx_path: String,
    pub txt_path: String,
    pub pages: u32,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub message: String,
}

type Result<T> = std::result::Result<T, String>;

fn map_err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ── Commands ───────────────────────────────────────────────────────────────────

/// Check whether the user is signed in to Google.
#[command]
pub async fn auth_status(state: State<'_, HttpClient>) -> Result<AuthStatus> {
    state
        .0
        .get(format!("{SERVER}/auth/status"))
        .send()
        .await
        .map_err(map_err)?
        .json::<AuthStatus>()
        .await
        .map_err(map_err)
}

/// Open the Google OAuth2 browser flow.
#[command]
pub async fn auth_signin(state: State<'_, HttpClient>) -> Result<AuthStatus> {
    state
        .0
        .post(format!("{SERVER}/auth/signin"))
        .send()
        .await
        .map_err(map_err)?
        .json::<AuthStatus>()
        .await
        .map_err(map_err)
}

/// Sign the user out (deletes the local token).
#[command]
pub async fn auth_signout(state: State<'_, HttpClient>) -> Result<serde_json::Value> {
    state
        .0
        .post(format!("{SERVER}/auth/signout"))
        .send()
        .await
        .map_err(map_err)?
        .json::<serde_json::Value>()
        .await
        .map_err(map_err)
}

/// Start converting a PDF file.
/// `pdf_path`     – absolute path chosen via the file dialog.
/// `output_dir`   – where to write DOCX / TXT (optional; defaults to PDF's folder).
/// `remove_newlines` – strip trailing newlines in Word output.
#[command]
pub async fn convert_pdf(
    state: State<'_, HttpClient>,
    pdf_path: String,
    output_dir: Option<String>,
    remove_newlines: Option<bool>,
) -> Result<serde_json::Value> {
    let body = serde_json::json!({
        "pdf_path": pdf_path,
        "output_dir": output_dir,
        "remove_newlines": remove_newlines.unwrap_or(true),
    });
    state
        .0
        .post(format!("{SERVER}/convert"))
        .json(&body)
        .send()
        .await
        .map_err(map_err)?
        .json::<serde_json::Value>()
        .await
        .map_err(map_err)
}

/// Poll the conversion progress (call every ~500 ms from the frontend).
#[command]
pub async fn conversion_progress(
    state: State<'_, HttpClient>,
) -> Result<ConversionProgress> {
    state
        .0
        .get(format!("{SERVER}/convert/progress"))
        .send()
        .await
        .map_err(map_err)?
        .json::<ConversionProgress>()
        .await
        .map_err(map_err)
}

/// Open the system file-picker and return the chosen PDF path.
#[command]
pub async fn pick_pdf_file(window: tauri::Window) -> Result<Option<String>> {
    use tauri::api::dialog::FileDialogBuilder;
    let (tx, rx) = tokio::sync::oneshot::channel();
    FileDialogBuilder::new()
        .add_filter("PDF Files", &["pdf"])
        .set_title("اختر ملف PDF")
        .pick_file(move |path| {
            let _ = tx.send(path.map(|p| p.to_string_lossy().to_string()));
        });
    rx.await.map_err(map_err)
}

/// Open the system folder-picker and return the chosen output directory.
#[command]
pub async fn pick_output_dir(window: tauri::Window) -> Result<Option<String>> {
    use tauri::api::dialog::FileDialogBuilder;
    let (tx, rx) = tokio::sync::oneshot::channel();
    FileDialogBuilder::new()
        .set_title("اختر مجلد الإخراج")
        .pick_folder(move |path| {
            let _ = tx.send(path.map(|p| p.to_string_lossy().to_string()));
        });
    rx.await.map_err(map_err)
}
