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
    
    work_dir = os.environ.get("PYINSTALLER_WORK_DIR", "build")
    dist_dir = os.environ.get("PYINSTALLER_DIST_DIR", "dist")

    # Clean previous builds
    import time
    for folder in [work_dir, dist_dir]:
        if os.path.exists(folder):
            print(f"Cleaning {folder}...")
            # Try multiple times to handle Windows file locks
            max_retries = 3
            for i in range(max_retries):
                try:
                    shutil.rmtree(folder)
                    break
                except PermissionError as e:
                    if i < max_retries - 1:
                        print(f"  Access denied for {folder}, retrying in 1s... ({i+1}/{max_retries})")
                        time.sleep(1)
                    else:
                        print(f"  WARNING: Could not fully clean {folder}: {e}")
                        print("  Continuing anyway, PyInstaller may still succeed.")
                except Exception as e:
                    print(f"  WARNING: Error cleaning {folder}: {e}")
                    break
    
    # These packages may exist in a developer's global Python environment, but
    # Warraq's backend does not import them. Excluding them keeps the bundled
    # service deterministic and avoids hundreds of megabytes of accidental ML
    # and scientific-runtime dependencies.
    excluded_modules = [
        "torch", "torchvision", "torchaudio", "onnxruntime", "tensorflow",
        "scipy", "pandas", "numpy", "matplotlib", "numba", "llvmlite",
        "pyarrow", "pygame", "sqlalchemy", "sklearn", "cv2",
    ]

    # PyInstaller command
    pyinstaller_args = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",           # Single executable file
        "--noconsole",         # No console window
        "--noconfirm",         # Overwrite without asking
        "--clean",             # Clean cache before building
        "--name", "pdf_server", # Output name
        "--workpath", work_dir,
        "--distpath", dist_dir,
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
        *[arg for module in excluded_modules for arg in ("--exclude-module", module)],
        "server.py"            # Entry point
    ]
    
    print("Building executable...")
    print(f"Command: {' '.join(pyinstaller_args)}")
    
    try:
        subprocess.check_call(pyinstaller_args)
        print("\nBuild successful!")
        print(f"Executable created: {os.path.join(script_dir, dist_dir, 'pdf_server.exe')}")
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("PDF Tools Backend - Executable Builder")
    print("=" * 60)
    
    install_pyinstaller()
    build_exe()
