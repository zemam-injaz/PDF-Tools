@echo off
echo ===================================================
echo PDF Tools: Hybrid Mode (Docker Backend + Desktop UI)
echo ===================================================
echo.
echo [1/2] Starting Docker Backend...
docker-compose up -d backend
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start Docker backend. Is Docker running?
    pause
    exit /b
)

echo.
echo [2/2] Starting Tauri Desktop App...
echo.
echo IMPORTANT: The app is configured to use the Docker backend on port 8002.
echo.

set VITE_USE_DOCKER_BACKEND=true
call npm run tauri dev

echo.
echo Cleanup: Stopping Docker backend...
docker-compose stop backend
