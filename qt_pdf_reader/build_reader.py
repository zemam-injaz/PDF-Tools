"""Build the Qt reader with stdio enabled for the Tauri JSON line bridge."""
from pathlib import Path
import subprocess
import sys


here = Path(__file__).resolve().parent
fonts = here.parent / "python-server" / "assets" / "fonts"
subprocess.check_call([
    sys.executable, "-m", "PyInstaller", "--onefile", "--console",
    "--noconfirm", "--name", "qt_pdf_reader",
    "--distpath", str(here / "dist"),
    "--workpath", str(here / "build"),
    "--add-data", f"{fonts}{';' if sys.platform == 'win32' else ':'}assets/fonts",
    str(here / "pdf_reader.py"),
], cwd=here)
