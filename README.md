# PDF Tools - Professional PDF Manipulation Suite

A desktop application for PDF manipulation built with Tauri + React + TypeScript + Python.

## Prerequisites

- **Node.js** (v18 or later)
- **npm** (comes with Node.js)
- **Python** (3.10 or later)
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)

## Project Structure

```
pdf-tools-project/
├── src/              # React frontend (TypeScript)
├── src-tauri/        # Tauri/Rust backend
├── python-server/    # Python FastAPI backend
├── public/           # Static assets
└── dist/             # Build output
```

## Running the Application

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install Python dependencies
cd python-server
pip install -r requirements.txt
cd ..
```

### 2. Start the Python Server

```bash
cd python-server
python server.py
```

> The server runs on `http://localhost:8002` by default.

### 3. Run in Development Mode

**Browser Only (Vite):**
```bash
npm run dev
```

**Desktop App (Tauri):**
```bash
# Ensure Rust is in PATH
$env:Path += ";$env:USERPROFILE\.cargo\bin"
npm run tauri dev
```

## Features

- **Merge PDFs** - Combine multiple PDF files into one
- **Split PDF** - Split a PDF at specific page numbers
- **Compress PDF** - Reduce file size with multiple compression levels
- **Extract Images** - Extract all images from a PDF

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Desktop Shell**: Tauri 2 (Rust)
- **Backend**: Python FastAPI, PyMuPDF

## License

MIT
