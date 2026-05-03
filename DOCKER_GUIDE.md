# PDF Tools Docker Guide

This guide explains how to use the Docker setup for PDF Tools.

## 1. Prerequisites
- **Docker Desktop** installed and running.
- **Node.js** installed (for Desktop/Hybrid mode).

## 2. Use Cases

### Case 1: Run Web App (Full Docker)
Run the entire application (Frontend + Backend) inside Docker. Access it via your browser.
**Script:** `run_web_docker.bat`
1.  Run the script.
2.  Open browser to `http://localhost:1422`.
3.  Backend runs on `http://localhost:8002`.

### Case 2: Build Executable (Reproducible Build)
Build the standalone `pdf_server.exe` backend using a consistent environment (Wine on Linux).
**Script:** `build_exe_docker.bat`
1.  Run the script.
2.  It builds the Docker image and compiles the exe.
3.  The output is placed in `python-server/dist/pdf_server.exe`.

### Case 3: Hybrid Desktop Mode (Recommended)
Run the **FastAPI Backend** in Docker (stable environment) but run the **Tauri Frontend** on your Windows host (for the native desktop window experience).
**Script:** `run_desktop_docker.bat`
1.  Run the script.
2.  It starts the backend in Docker (port 8002).
3.  It sets `VITE_USE_DOCKER_BACKEND=true`.
4.  It launches the Tauri app (`npm run tauri dev`).
5.  The app connects to the Docker backend instead of spawning a local one.

> **Note:** The Tauri app might still try to spawn a local backend on a different port (e.g. 8003), but the frontend will ignore it and talk to Docker.

## Troubleshooting
- **Port Conflicts:** Ensure ports 8002 and 1422 are free.
- **Docker Error:** Make sure Docker Desktop is effectively running.
