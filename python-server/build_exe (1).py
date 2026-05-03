"""
Build script to create a standalone executable for the PDF Tools Python backend.
Uses PyInstaller to bundle the FastAPI server with all dependencies.
"""
import subprocess
import sys
import os
import shutil

def install_pyinstaller():
    """Ensure PyInstaller is installed"""
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

def build_exe():
    """Build the standalone executable"""
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Clean previous builds
    for folder in ['build', 'dist']:
        if os.path.exists(folder):
            print(f"Cleaning {folder}...")
            shutil.rmtree(folder)
    
    # PyInstaller command
    pyinstaller_args = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",           # Single executable file
        "--noconsole",         # No console window
        "--noconfirm",         # Overwrite without asking
        "--clean",             # Clean cache before building
        "--name", "pdf_server", # Output name
        "--add-data", f"services{os.pathsep}services",  # Include services folder
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.lifespan.off",
        "--hidden-import", "fitz",
        "--hidden-import", "fitz.fitz",
        "--hidden-import", "docx",
        "--hidden-import", "docx.document",
        "--hidden-import", "pydantic",
        "--hidden-import", "fastapi",
        "--hidden-import", "starlette",
        "--hidden-import", "httptools",
        "--hidden-import", "websockets",
        "--hidden-import", "webbrowser",
        "--collect-submodules", "uvicorn",
        "--collect-submodules", "fastapi",
        "--collect-submodules", "starlette",
        "--collect-submodules", "fitz",
        "--collect-submodules", "docx",
        "--collect-submodules", "services",
        "server.py"            # Entry point
    ]
    
    print("Building executable...")
    print(f"Command: {' '.join(pyinstaller_args)}")
    
    try:
        subprocess.check_call(pyinstaller_args)
        print("\n✅ Build successful!")
        print(f"📦 Executable created: {os.path.join(script_dir, 'dist', 'pdf_server.exe')}")
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("PDF Tools Backend - Executable Builder")
    print("=" * 60)
    
    install_pyinstaller()
    build_exe()
