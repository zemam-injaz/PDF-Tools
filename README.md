# Matn (مَتن) — Smart PDF Workspace

**Matn** is a professional-grade, bilingual (Arabic-first) PDF workspace by **Zemam Apps**. It provides tools for merging, splitting, extracting, indexing, organizing, reading, and converting documents — including Markdown to PDF with Arabic and RTL support.

Built with **Tauri + React + TypeScript** on the frontend and a **Python FastAPI** backend powered by **PyMuPDF**, Warraq runs as a native desktop app with a polished RTL-friendly interface.

---

## Native desktop reader

In the Tauri desktop app, opening a library preview launches the PyQt6 reader in its own window. The library can bring it to the front, minimize or close it, jump to a page, and filter comments. The browser build continues to use the React PDF viewer.

For development, run `python -m pip install -r qt_pdf_reader/requirements.txt`, then `npm run tauri dev`. The Qt script is launched from `qt_pdf_reader/pdf_reader.py`. The API session token is passed to the reader through its environment; no token is placed in the command line.

For a Windows installer, run `build.bat`. It builds `pdf_server.exe` and `qt_pdf_reader.exe`, copies both into `src-tauri/resources/`, and then invokes Tauri. The Qt executable must retain standard input/output for the JSON line bridge, so `qt_pdf_reader/build_reader.py` builds a console subsystem binary and Tauri hides its console window when launching it.

Saved native PDF annotations are mirrored into Matn's SQLite annotation records by the local API. Existing app-only notes are shown in the Qt comments dock and as overlays without being inserted into the PDF automatically. Qt uses an OpenGL viewport when available; set `MATN_DISABLE_OPENGL=1` if the display driver cannot support it. The Qt reader currently uses continuous page layout.

---

## Features

### 📄 Core PDF Manipulation

| Tool | Description |
|------|-------------|
| **Merge PDFs** | Combine multiple PDF files into a single document with ease. |
| **Split PDF** | Split a PDF at specified page boundaries into separate files. |
| **Compress PDF** | Reduce file size with 5 configurable compression levels (0–4), from garbage collection to aggressive clean + linearize. |
| **Extract Images** | Extract all embedded images from PDF pages — auto-converts CMYK to RGB, saves as PNG. |
| **Text Extraction** | Extract text from PDF to **TXT**, **DOCX**, or **Markdown** format. |
| **Images to PDF** | Create a PDF from a list of image files (PNG, JPG, etc.) with correctly sized pages. |
| **PDF to Images** | Convert PDF pages to PNG or JPG images at configurable DPI resolution. |
| **Metadata Editor** | View and edit standard PDF metadata fields (title, author, subject, keywords, etc.). |
| **Page Operations** | Rotate (90°/180°/270°), delete, extract, reorder, and insert pages. Supports complex page range syntax: `1-5,10,15-20,odd,even`. |

### 🔒 Security & Watermarking

| Tool | Description |
|------|-------------|
| **Security** | Check encryption status, password protection, and permission restrictions. Remove passwords and all restrictions from protected PDFs. |
| **Watermark** | Add **text** watermarks (configurable font, color, size, opacity, position, rotation) or **image** watermarks (with scale and opacity). Also includes watermark removal via pattern detection. |

### 🔖 Bookmark & Navigation Management

| Tool | Description |
|------|-------------|
| **Extract Bookmarks** | Extract hierarchical bookmarks (table of contents) from PDFs. |
| **Insert Bookmarks** | Insert bookmarks into PDFs with automatic level normalization. |
| **Split by Bookmarks** | Split PDFs by bookmark structure — hierarchy-aware, supports level-targeted splitting, preserves sub-bookmarks, and includes page range calculation. |
| **Transfer Bookmarks** | Transfer bookmarks between PDF files. |
| **TOC Text Parsing** | Parse plain-text table of contents into structured bookmarks. |

### 💬 Annotations & Comments

| Tool | Description |
|------|-------------|
| **Extract Annotations** | Extract native PDF annotations (highlights, notes, comments). |
| **Annotation Manager** | Save/load annotations to/from a SQLite database with interactive overlays (dot markers, text notes, timestamps). |
| **Burn Annotations** | Permanently "burn" overlay annotations into the PDF as printed content. |

### 📚 Reading & Library Tools

| Tool | Description |
|------|-------------|
| **Book Library** | Full SQLite-backed book management system — add books with thumbnails, star ratings, categories, status tracking (To Read / Reading / Read), notes, priority, and reading progress. Search and sort your collection. |
| **Reading Speed Trainer** | Built-in speed reading training tool for rapid reading practice. |
| **Chapter Weight Analyzer** | Analyze chapter sizes from bookmarks and create a balanced reading plan. |
| **Progress Scanner** | Scan directories for PDF reading statistics, annotation counts, and intensity scoring. |

### 🤖 OCR & AI — Tahweel (OTO)

A specialized Google OCR pipeline for PDF-to-text conversion:
- Authenticates via **Google OAuth**
- Converts PDF pages to images and processes via **Google Cloud Vision** through Google Drive
- Outputs as **DOCX**, **TXT**, or searchable **PDF**
- Includes DOCX-to-PDF via Word COM automation on Windows
- Per-page word-count indexing
- Optimized for Arabic text preservation

### 🧠 Smart Infrastructure

| Feature | Description |
|---------|-------------|
| **Background Task Manager** | All long-running operations (merge, split, compress, OCR) run asynchronously with real-time progress polling — view status in a floating task monitor panel. |
| **PDF Preview** | Server-side rendering of PDF pages to PNG for in-app preview. |
| **File Explorer Integration** | Open PDFs in the system default application or reveal them in File Explorer. |
| **Subscription System** | Freemium model with 30-day trial, monthly/yearly/lifetime plans, and feature gating. |
| **Docker Support** | Full Docker setup for web-mode deployment. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Vite 7, Framer Motion 12, Lucide Icons |
| **Desktop Shell** | Tauri 2 (Rust) — window management, backend lifecycle, native dialogs |
| **Backend** | Python FastAPI, Uvicorn, PyMuPDF (fitz) |
| **OCR** | Google Cloud Vision (via tahweel + Google Drive/Docs APIs) |
| **Database** | SQLite3 (book library, subscriptions, annotations) |
| **Icons & Fonts** | Lucide React, IBM Plex Sans Arabic, Al-Jazeera Arabic |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Tauri Desktop Shell                     │
│  (Rust — manages window, spawns backend, hosts frontend) │
├──────────────────────┬──────────────────────────────────┤
│   React Frontend      │   Python Backend (FastAPI)       │
│   (Vite + TS + React) │   (Uvicorn on localhost:8002+)   │
│                       │                                  │
│    HTTP (fetch)       │   14 service modules             │
│    ────────────────►  │   PDF, text, bookmarks, pages,   │
│    localhost:8002     │   watermark, security, library,   │
│                       │   annotations, tahweel, payment, │
│                       │   subscription, tasks, progress,  │
│                       │   rendering                       │
└──────────────────────┴──────────────────────────────────┘
```

The Tauri shell spawns the Python backend on startup with dynamic port allocation and gracefully terminates it on exit. The React frontend communicates with the backend via REST API calls over `localhost`.

---

## Running the Application

### Prerequisites

- **Node.js** (v18 or later)
- **Python** (3.10 or later)
- **Rust** (latest stable) — [Install via rustup](https://rustup.rs/)

### 1. Install Dependencies

```bash
npm install
cd python-server && pip install -r requirements.txt && cd ..
```

### 2. Start the Python Server

```bash
cd python-server && python server.py
```

> The server runs on `http://localhost:8002` by default.

### 3. Run in Development Mode

**Browser Only (Vite):**
```bash
npm run dev
```

**Desktop App (Tauri):**
```bash
$env:Path += ";$env:USERPROFILE\.cargo\bin"
npm run tauri dev
```

---

## License

MIT
