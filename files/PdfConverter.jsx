// src/components/PdfConverter.jsx
// Drop this component anywhere in your Tauri React app.
// It talks to Tauri commands (converter.rs) which forward to server.py.

import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/tauri";

// ── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Icons (inline SVG so no extra deps) ───────────────────────────────────

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FolderIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const FileIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
    </path>
  </svg>
);

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');

  .pdf-converter * { box-sizing: border-box; font-family: 'Cairo', sans-serif; }

  .pdf-converter {
    direction: rtl;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    background: #f0f4f8;
    border-radius: 20px;
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 100vh;
  }

  /* ── Logo ── */
  .pc-logo {
    display: flex;
    justify-content: center;
  }
  .pc-logo-box {
    width: 72px; height: 72px;
    background: white;
    border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    font-size: 32px;
  }

  /* ── Title ── */
  .pc-title { text-align: center; }
  .pc-title h1 { margin: 0; font-size: 20px; font-weight: 700; color: #1a202c; }
  .pc-title p { margin: 6px 0 0; font-size: 13px; color: #718096; line-height: 1.6; }

  /* ── Auth card ── */
  .pc-auth-card {
    background: white;
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .pc-auth-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #2d3748;
  }
  .pc-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pc-dot-green { background: #38a169; }
  .pc-dot-gray  { background: #a0aec0; }
  .pc-sign-btn {
    border: none; cursor: pointer;
    font-family: 'Cairo', sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 8px;
    display: flex; align-items: center; gap: 7px;
    transition: all 0.2s;
  }
  .pc-sign-in-btn {
    background: #fff;
    color: #2d3748;
    border: 1.5px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .pc-sign-in-btn:hover { background: #f7fafc; border-color: #cbd5e0; }
  .pc-sign-out-btn { background: none; color: #e53e3e; padding: 0; }
  .pc-sign-out-btn:hover { text-decoration: underline; }

  /* ── Action buttons ── */
  .pc-actions { display: flex; gap: 12px; }
  .pc-action-btn {
    flex: 1;
    border: none; cursor: pointer;
    border-radius: 14px;
    padding: 20px 12px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px;
    font-family: 'Cairo', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: white;
    transition: transform 0.15s, filter 0.15s;
    min-height: 100px;
  }
  .pc-action-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
  .pc-action-btn:active:not(:disabled) { transform: translateY(0); }
  .pc-action-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .pc-folder-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
  .pc-file-btn   { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }

  /* ── File path display ── */
  .pc-filepath {
    background: white;
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 13px;
    color: #4a5568;
    border: 1.5px solid #e2e8f0;
    word-break: break-all;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .pc-filepath span { flex: 1; }
  .pc-clear-btn {
    background: none; border: none; cursor: pointer;
    color: #a0aec0; font-size: 18px; line-height: 1;
    padding: 0 2px;
    transition: color 0.15s;
  }
  .pc-clear-btn:hover { color: #e53e3e; }

  /* ── Settings ── */
  .pc-settings {
    background: white;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .pc-settings-header {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
  }
  .pc-settings-header span { font-size: 15px; font-weight: 600; color: #2d3748; }
  .pc-settings-chevron {
    color: #718096; font-size: 18px;
    transition: transform 0.2s;
    display: inline-block;
  }
  .pc-settings-chevron.open { transform: rotate(180deg); }
  .pc-settings-body {
    padding: 0 16px 16px;
    border-top: 1px solid #edf2f7;
  }
  .pc-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 14px;
  }
  .pc-toggle-label { font-size: 13px; color: #4a5568; }
  .pc-toggle {
    width: 44px; height: 24px;
    border-radius: 12px;
    background: #e2e8f0;
    position: relative;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .pc-toggle.on { background: #38a169; }
  .pc-toggle-knob {
    position: absolute;
    top: 2px; right: 2px;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    transition: right 0.2s;
  }
  .pc-toggle.on .pc-toggle-knob { right: calc(100% - 22px); }

  /* ── Progress ── */
  .pc-progress-card {
    background: white;
    border-radius: 14px;
    padding: 18px 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .pc-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .pc-progress-label { font-size: 14px; font-weight: 600; color: #2d3748; display: flex; align-items: center; gap: 8px; }
  .pc-progress-pct { font-size: 14px; font-weight: 700; color: #38a169; }
  .pc-bar-track {
    width: 100%; height: 8px;
    background: #edf2f7;
    border-radius: 99px;
    overflow: hidden;
  }
  .pc-bar-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #38a169, #68d391);
    transition: width 0.4s ease;
  }

  /* ── Done card ── */
  .pc-done-card {
    background: #f0fff4;
    border: 1.5px solid #9ae6b4;
    border-radius: 14px;
    padding: 18px 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .pc-done-header {
    display: flex; align-items: center; gap: 8px;
    font-size: 15px; font-weight: 700; color: #276749;
  }
  .pc-done-icon {
    width: 28px; height: 28px;
    background: #38a169;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .pc-file-link {
    font-size: 13px; color: #2b6cb0; cursor: default;
    display: flex; align-items: center; gap: 6px;
    background: white;
    border-radius: 8px; padding: 8px 12px;
    border: 1px solid #bee3f8;
  }
  .pc-file-link-label { font-weight: 700; color: #2c5282; margin-left: 4px; }
  .pc-reset-btn {
    margin-top: 4px; padding: 10px;
    border: none; border-radius: 10px;
    background: #38a169; color: white;
    font-family: 'Cairo', sans-serif;
    font-size: 14px; font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s;
  }
  .pc-reset-btn:hover { filter: brightness(1.1); }

  /* ── Error ── */
  .pc-error {
    background: #fff5f5;
    border: 1.5px solid #feb2b2;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 13px;
    color: #c53030;
    font-weight: 500;
  }
`;

// ── Component ──────────────────────────────────────────────────────────────

export default function PdfConverter() {
  const [auth, setAuth] = useState({ authenticated: false, email: null });
  const [pdfPath, setPdfPath] = useState(null);
  const [removeNewlines, setRemoveNewlines] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | signing | converting | done | error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const s = await invoke("auth_status");
      setAuth(s);
    } catch (e) {
      console.error("auth_status failed:", e);
    }
  }

  async function handleSignIn() {
    setStatus("signing");
    setError(null);
    try {
      const s = await invoke("auth_signin");
      setAuth(s);
    } catch (e) {
      setError("فشل تسجيل الدخول: " + e);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSignOut() {
    await invoke("auth_signout");
    setAuth({ authenticated: false, email: null });
    resetConversion();
  }

  async function pickFile() {
    const path = await invoke("pick_pdf_file");
    if (path) setPdfPath(path);
  }

  async function pickFolder() {
    const path = await invoke("pick_output_dir");
    if (path) {
      // For folder conversion, we pass the folder as both source and output
      setPdfPath(path + "/*"); // visual cue only; server handles directory
    }
  }

  function resetConversion() {
    setPdfPath(null);
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  async function startConversion() {
    if (!pdfPath || !auth.authenticated) return;
    setStatus("converting");
    setError(null);
    setProgress(0);

    try {
      await invoke("convert_pdf", {
        pdfPath,
        outputDir: null,
        removeNewlines,
      });

      // Poll progress
      pollRef.current = setInterval(async () => {
        try {
          const p = await invoke("conversion_progress");
          setProgress(p.percent ?? 0);
          if (p.status === "done") {
            clearInterval(pollRef.current);
            setStatus("done");
            setResult(p.result);
          } else if (p.status === "error") {
            clearInterval(pollRef.current);
            setStatus("error");
            setError(p.error ?? "حدث خطأ غير متوقع");
          }
        } catch (e) {
          clearInterval(pollRef.current);
          setStatus("error");
          setError(String(e));
        }
      }, 600);
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  const fileName = pdfPath ? pdfPath.split(/[/\\]/).pop() : null;
  const canConvert = auth.authenticated && pdfPath && status === "idle";

  return (
    <>
      <style>{styles}</style>
      <div className="pdf-converter">
        {/* Logo */}
        <div className="pc-logo">
          <div className="pc-logo-box">📄</div>
        </div>

        {/* Title */}
        <div className="pc-title">
          <h1>حوّل الملفات من صيغة PDF إلى TXT و DOCX</h1>
          <p>
            ملاحظة: يدعم تحويل الملفات بصيغة PDF أو صورة (JPG و JPEG و PNG)
            فقط.
          </p>
        </div>

        {/* Auth card */}
        <div className="pc-auth-card">
          {auth.authenticated ? (
            <>
              <div className="pc-auth-status">
                <div className="pc-dot pc-dot-green" />
                تم تسجيل الدخول إلى Google Drive
                {auth.email && (
                  <span style={{ color: "#718096", fontWeight: 400, fontSize: 12 }}>
                    ({auth.email})
                  </span>
                )}
              </div>
              <button className="pc-sign-btn pc-sign-out-btn" onClick={handleSignOut}>
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <div className="pc-auth-status">
                <div className="pc-dot pc-dot-gray" />
                غير متصل بـ Google Drive
              </div>
              <button
                className="pc-sign-btn pc-sign-in-btn"
                onClick={handleSignIn}
                disabled={status === "signing"}
              >
                {status === "signing" ? <SpinnerIcon /> : <GoogleIcon />}
                تسجيل الدخول
              </button>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="pc-actions">
          <button
            className="pc-action-btn pc-folder-btn"
            disabled={!auth.authenticated || status !== "idle"}
            onClick={pickFolder}
          >
            <FolderIcon />
            تحويل مجلد كامل
          </button>
          <button
            className="pc-action-btn pc-file-btn"
            disabled={!auth.authenticated || status !== "idle"}
            onClick={pickFile}
          >
            <FileIcon />
            تحويل ملف واحد
          </button>
        </div>

        {/* Selected file path */}
        {pdfPath && status === "idle" && (
          <div className="pc-filepath">
            <span>{fileName}</span>
            <button className="pc-clear-btn" onClick={() => setPdfPath(null)}>
              ✕
            </button>
          </div>
        )}

        {/* Convert button */}
        {pdfPath && status === "idle" && (
          <button
            className="pc-action-btn pc-file-btn"
            style={{ minHeight: 54, fontSize: 16 }}
            onClick={startConversion}
            disabled={!canConvert}
          >
            ابدأ التحويل
          </button>
        )}

        {/* Progress */}
        {status === "converting" && (
          <div className="pc-progress-card">
            <div className="pc-progress-header">
              <div className="pc-progress-label">
                <SpinnerIcon />
                جارٍ تحويل الملف...
              </div>
              <div className="pc-progress-pct">{progress}%</div>
            </div>
            <div className="pc-bar-track">
              <div className="pc-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Done */}
        {status === "done" && result && (
          <div className="pc-done-card">
            <div className="pc-done-header">
              <div className="pc-done-icon">
                <CheckIcon />
              </div>
              تم التحويل بنجاح ({result.pages} صفحة)
            </div>
            <div className="pc-file-link">
              <span className="pc-file-link-label">DOCX:</span>
              <span>{result.docx_path.split(/[/\\]/).pop()}</span>
            </div>
            <div className="pc-file-link">
              <span className="pc-file-link-label">TXT:</span>
              <span>{result.txt_path.split(/[/\\]/).pop()}</span>
            </div>
            <button className="pc-reset-btn" onClick={resetConversion}>
              تحويل ملف آخر
            </button>
          </div>
        )}

        {/* Error */}
        {status === "error" && error && (
          <>
            <div className="pc-error">⚠️ {error}</div>
            <button className="pc-reset-btn" onClick={resetConversion}
              style={{ background: "#e53e3e", border: "none", color: "white",
                borderRadius: 10, padding: "10px", fontFamily: "Cairo, sans-serif",
                fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              حاول مرة أخرى
            </button>
          </>
        )}

        {/* Settings */}
        <div className="pc-settings">
          <div
            className="pc-settings-header"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span>الإعدادات</span>
            <span className={`pc-settings-chevron ${settingsOpen ? "open" : ""}`}>
              ⌃
            </span>
          </div>
          {settingsOpen && (
            <div className="pc-settings-body">
              <div className="pc-toggle-row">
                <div className="pc-toggle-label">
                  إزالة الأسطر من ملفات DOCX
                  <div style={{ fontSize: 11, color: "#a0aec0", marginTop: 2 }}>
                    يجعل عدد صفحات DOCX مساوياً لعدد صفحات PDF
                  </div>
                </div>
                <button
                  className={`pc-toggle ${removeNewlines ? "on" : ""}`}
                  onClick={() => setRemoveNewlines((v) => !v)}
                >
                  <div className="pc-toggle-knob" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
