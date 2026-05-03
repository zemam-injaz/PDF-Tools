@echo off
REM ============================================
REM PDF Tools - Complete Build Script
REM ============================================
REM This script builds both the Python backend and the Tauri app
REM into a single distributable executable/installer.
REM ============================================

echo.
echo ============================================
echo PDF Tools - Complete Build
echo ============================================
echo.

REM Navigate to project root
cd /d "%~dp0"

REM Step 1: Build Python Backend
echo [Step 1/3] Building Python backend...
echo.
cd python-server
python build_exe.py
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Python build failed!
    pause
    exit /b 1
)

REM Verify the Python exe was created
if not exist "dist\pdf_server.exe" (
    echo.
    echo ERROR: pdf_server.exe was not created!
    pause
    exit /b 1
)

echo.
echo Python backend built successfully!
echo.

REM Step 2: Go back to project root
cd ..

REM Step 2.5: Copy Python exe to Tauri resources
echo [Step 2.5/3] Copying backend to Tauri resources...
if not exist "src-tauri\resources" mkdir "src-tauri\resources"
copy /Y "python-server\dist\pdf_server.exe" "src-tauri\resources\pdf_server.exe"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to copy pdf_server.exe to resources!
    pause
    exit /b 1
)

REM Step 3: Build Tauri App
echo [Step 2/3] Building Tauri application...
echo.
call npm run tauri build
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Tauri build failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo BUILD COMPLETE!
echo ============================================
echo.
echo [Step 3/3] Build outputs:
echo.

REM Check for NSIS installer
if exist "src-tauri\target\release\bundle\nsis\*.exe" (
    echo NSIS Installer:
    for %%f in (src-tauri\target\release\bundle\nsis\*.exe) do echo   %%f
    echo.
)

REM Check for MSI installer
if exist "src-tauri\target\release\bundle\msi\*.msi" (
    echo MSI Installer:
    for %%f in (src-tauri\target\release\bundle\msi\*.msi) do echo   %%f
    echo.
)

REM Check for standalone exe
if exist "src-tauri\target\release\PDF Tools.exe" (
    echo Standalone EXE:
    echo   src-tauri\target\release\PDF Tools.exe
    echo.
)

echo ============================================
echo.
echo Share the installer with your friends!
echo.
pause
