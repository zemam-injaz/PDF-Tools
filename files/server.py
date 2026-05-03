"""
server.py — lightweight Flask server that acts as the bridge between
the Tauri frontend (Rust) and the Python conversion logic.

Start it from your Tauri app's sidecar / Python subprocess.
"""

import json
import threading
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from converter import (
    convert_pdf,
    get_user_email,
    is_authenticated,
    sign_out,
    ConversionProgress,
)

app = Flask(__name__)
CORS(app)  # Allow Tauri webview origin

# ── Global state ──────────────────────────────────────────────────────────────
_progress: dict = {"status": "idle", "percent": 0, "error": None}
_progress_lock = threading.Lock()


def _update_progress(p: ConversionProgress):
    with _progress_lock:
        _progress["status"] = p.status
        _progress["percent"] = p.percent
        if p.error:
            _progress["error"] = p.error


# ── Auth endpoints ─────────────────────────────────────────────────────────────

@app.get("/auth/status")
def auth_status():
    """Returns whether the user is authenticated and their email."""
    authenticated = is_authenticated()
    email = get_user_email() if authenticated else None
    return jsonify({"authenticated": authenticated, "email": email})


@app.post("/auth/signin")
def auth_signin():
    """
    Trigger the Google OAuth flow. This opens the system browser.
    The call blocks until the user completes sign-in (or it times out).
    """
    try:
        from converter import get_credentials
        get_credentials()  # triggers browser flow if needed
        email = get_user_email()
        return jsonify({"success": True, "email": email})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.post("/auth/signout")
def auth_signout():
    sign_out()
    return jsonify({"success": True})


# ── Conversion endpoints ───────────────────────────────────────────────────────

@app.post("/convert")
def start_conversion():
    """
    Body JSON:
    {
        "pdf_path": "/absolute/path/to/file.pdf",
        "output_dir": "/absolute/path/to/output",   // optional
        "remove_newlines": true                       // optional
    }
    """
    if not is_authenticated():
        return jsonify({"error": "not_authenticated"}), 401

    data = request.get_json(force=True)
    pdf_path = data.get("pdf_path")
    if not pdf_path or not Path(pdf_path).exists():
        return jsonify({"error": "invalid_pdf_path"}), 400

    output_dir = data.get("output_dir")
    remove_newlines = data.get("remove_newlines", True)

    # Reset progress
    with _progress_lock:
        _progress.update({"status": "starting", "percent": 0, "error": None})

    def run():
        try:
            result = convert_pdf(
                pdf_path=pdf_path,
                output_dir=output_dir,
                remove_newlines=remove_newlines,
                on_progress=_update_progress,
            )
            with _progress_lock:
                _progress["result"] = result
        except Exception as exc:
            with _progress_lock:
                _progress["status"] = "error"
                _progress["error"] = str(exc)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    return jsonify({"success": True, "message": "Conversion started"})


@app.get("/convert/progress")
def conversion_progress():
    """Poll this endpoint to get live conversion progress."""
    with _progress_lock:
        return jsonify(dict(_progress))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Tauri will start this as a sidecar on a fixed port.
    app.run(host="127.0.0.1", port=5199, debug=False)
