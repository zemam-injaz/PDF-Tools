@echo off
echo ===================================================
echo PDF Tools: Build EXE (via Docker)
echo ===================================================
echo.
echo This will build the Python backend executable using a Linux+Wine container.
echo The resulting file will be in python-server/dist/pdf_server.exe
echo.

cd python-server
docker build -f Dockerfile.build -t pdf-tools-builder .
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker build failed.
    pause
    exit /b
)

echo.
echo Running builder container...
echo output mapped to: %CD%\dist
if not exist dist mkdir dist

docker run --rm -v "%CD%/dist:/src/dist" pdf-tools-builder
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build process failed inside Docker.
    pause
    exit /b
)

echo.
echo [SUCCESS] Build complete! Check python-server/dist/pdf_server.exe
pause
