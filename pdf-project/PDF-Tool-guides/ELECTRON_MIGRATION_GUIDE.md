# Electron Migration Guide - PDF Tools Application

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Development Environment Setup](#development-environment-setup)
4. [Project Structure](#project-structure)
5. [Communication Layer](#communication-layer)
6. [Build & Deployment](#build--deployment)
7. [Testing Strategy](#testing-strategy)
8. [Migration Roadmap](#migration-roadmap)

---

## 🎯 Overview

This guide provides comprehensive instructions for migrating the **PDF Tools** desktop application from **PySide6 (Python GUI)** to **Electron (Web-based Desktop App)** while preserving all existing Python code as the backend.

### Key Principles

- **DO NOT modify any existing Python code** - it remains as-is and serves as the backend API
- **Incremental migration** - implement features one by one, starting with Feature 1
- **Maintain feature parity** - all existing functionality must be preserved
- **Bilingual support** - Arabic RTL and English LTR
- **Theme support** - Light and dark modes
- **Performance** - Handle large PDF files (500+ pages) efficiently

### Current Tech Stack

- **Language**: Python 3.11+
- **GUI Framework**: PySide6 (Qt6)
- **PDF Library**: PyMuPDF (fitz)
- **Database**: SQLite
- **Build Tool**: PyInstaller

### Target Tech Stack

- **Frontend**: Electron + React/Vue (developer's choice)
- **Backend**: Python + Flask/FastAPI
- **Communication**: REST API + WebSocket (for real-time updates)
- **Build**: Electron Builder
- **Package**: NSIS/DMG/AppImage

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Renderer Process (Frontend)              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  React/Vue UI Components                        │  │  │
│  │  │  - PDF Viewer                                   │  │  │
│  │  │  - Book Library                                 │  │  │
│  │  │  - Feature Tabs (15 features)                   │  │  │
│  │  │  - Settings & Theme                             │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                         ↕                              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  API Client Layer (Axios/Fetch)                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ↕                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Main Process (Electron)                  │  │
│  │  - Window Management                                  │  │
│  │  - IPC Communication                                  │  │
│  │  - Python Backend Process Manager                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│              Python Backend (Flask/FastAPI)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                   │  │
│  │  - /api/pdf/viewer/*                                  │  │
│  │  │  - /api/books/*                                     │  │
│  │  - /api/features/* (15 feature endpoints)             │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ↕                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Existing Python Code (UNCHANGED)                     │  │
│  │  - src/pdf_tools_comprehensive.py                     │  │
│  │  - src/reading_speed_tab.py                           │  │
│  │  - src/recent_books_manager.py                        │  │
│  │  - src/chapter_weight_analyzer.py                     │  │
│  │  - All other Python modules                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ↕                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SQLite Database                                      │  │
│  │  - Book library                                       │  │
│  │  - Reading positions                                  │  │
│  │  - User settings                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **User Interaction** → Electron Renderer (React/Vue UI)
2. **API Request** → Electron Main Process (IPC)
3. **HTTP Request** → Python Backend (Flask/FastAPI)
4. **Python Processing** → Existing Python code (unchanged)
5. **Database Operations** → SQLite
6. **Response** → Back through the chain to UI

---

## 🛠️ Development Environment Setup

### Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **Python**: 3.11+
- **npm/yarn/pnpm**: Latest version
- **Git**: For version control

### Step 1: Install Python Dependencies

```bash
# Navigate to project root
cd "F:/Python Projects/PDF Tools"

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install additional backend dependencies
pip install flask flask-cors
# OR
pip install fastapi uvicorn python-multipart
```

### Step 2: Create Electron Project Structure

```bash
# Create electron directory
mkdir electron-app
cd electron-app

# Initialize Node.js project
npm init -y

# Install Electron and dependencies
npm install --save-dev electron electron-builder

# Install frontend framework (choose one)
# Option 1: React
npm install react react-dom
npm install --save-dev @vitejs/plugin-react vite

# Option 2: Vue
npm install vue
npm install --save-dev @vitejs/plugin-vue vite

# Install API client and utilities
npm install axios
npm install electron-store  # For settings persistence
npm install electron-log    # For logging
```

### Step 3: Project Structure Setup

Create the following directory structure:

```
PDF Tools/
├── src/                          # Existing Python code (UNCHANGED)
│   ├── pdf_tools_comprehensive.py
│   ├── reading_speed_tab.py
│   ├── recent_books_manager.py
│   └── ... (all other Python files)
├── backend/                      # NEW: Python Backend API
│   ├── app.py                    # Flask/FastAPI main file
│   ├── routes/                   # API route handlers
│   │   ├── __init__.py
│   │   ├── pdf_viewer.py
│   │   ├── books.py
│   │   ├── reading_speed.py
│   │   ├── text_extraction.py
│   │   └── ... (one file per feature)
│   ├── services/                 # Business logic wrappers
│   │   ├── __init__.py
│   │   └── pdf_service.py        # Wraps existing Python code
│   └── utils/                    # Helper utilities
│       ├── __init__.py
│       └── response.py           # Standard API responses
├── electron-app/                 # NEW: Electron Application
│   ├── package.json
│   ├── electron.js               # Electron main process
│   ├── preload.js                # Preload script for security
│   ├── src/                      # Frontend source code
│   │   ├── main.js/ts            # Frontend entry point
│   │   ├── App.vue/jsx           # Root component
│   │   ├── components/           # UI components
│   │   │   ├── PDFViewer.vue
│   │   │   ├── BookLibrary.vue
│   │   │   └── ... (one per feature)
│   │   ├── services/             # API client services
│   │   │   ├── api.js
│   │   │   ├── pdfService.js
│   │   │   └── booksService.js
│   │   ├── store/                # State management (Vuex/Redux)
│   │   ├── locales/              # i18n translations
│   │   │   ├── ar.json
│   │   │   └── en.json
│   │   └── styles/               # CSS/SCSS files
│   ├── public/                   # Static assets
│   │   ├── icons/
│   │   └── fonts/
│   └── dist/                     # Build output
├── docs/                         # Migration documentation
│   ├── ELECTRON_MIGRATION_GUIDE.md (this file)
│   ├── FEATURE_01_PDF_Viewer.md
│   ├── FEATURE_02_Book_Library.md
│   └── ... (16 feature docs total)
├── requirements.txt              # Python dependencies
└── README.md
```

---

## 🔌 Communication Layer

### Backend API (Flask Example)

**File**: `backend/app.py`

```python
from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
import os

# Add src directory to path to import existing code
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from routes import pdf_viewer, books, reading_speed
# Import other route modules

app = Flask(__name__)
CORS(app)  # Enable CORS for Electron

# Register blueprints
app.register_blueprint(pdf_viewer.bp, url_prefix='/api/pdf')
app.register_blueprint(books.bp, url_prefix='/api/books')
app.register_blueprint(reading_speed.bp, url_prefix='/api/reading-speed')
# Register other blueprints

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Backend is running"})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
```

### Electron Main Process

**File**: `electron-app/electron.js`

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function startPythonBackend() {
  const pythonPath = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe');
  const backendPath = path.join(__dirname, '..', 'backend', 'app.py');
  
  pythonProcess = spawn(pythonPath, [backendPath]);
  
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python: ${data}`);
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the frontend
  mainWindow.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  startPythonBackend();
  setTimeout(createWindow, 2000); // Wait for backend to start
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  app.quit();
});
```

### API Client (Frontend)

**File**: `electron-app/src/services/api.js`

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default apiClient;
```

---

## 📦 Build & Deployment

### Development Mode

```bash
# Terminal 1: Start Python backend
cd backend
python app.py

# Terminal 2: Start Electron app
cd electron-app
npm run dev
```

### Production Build

**File**: `electron-app/package.json`

```json
{
  "name": "pdf-tools-pro",
  "version": "2.0.0",
  "main": "electron.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "electron .",
    "electron:build": "electron-builder"
  },
  "build": {
    "appId": "com.pdftools.pro",
    "productName": "PDF Tools Pro",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron.js",
      "preload.js",
      "../backend/**/*",
      "../src/**/*",
      "../venv/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "public/icons/icon.ico"
    }
  }
}
```

---

## 🧪 Testing Strategy

### Backend Testing

- **Unit Tests**: Test each API endpoint independently
- **Integration Tests**: Test Python code integration
- **Performance Tests**: Test with large PDF files (500+ pages)

### Frontend Testing

- **Component Tests**: Test UI components in isolation
- **E2E Tests**: Test complete user workflows
- **Accessibility Tests**: Test RTL/LTR and theme switching

### Tools

- **Backend**: pytest, pytest-flask
- **Frontend**: Vitest, Playwright
- **API**: Postman/Insomnia for manual testing

---

## 🗺️ Migration Roadmap

### Phase 1: Foundation (Week 1-2)

1. Set up Electron project structure
2. Create Python backend API skeleton
3. Implement health check and basic routing
4. Set up frontend framework (React/Vue)
5. Implement theme and localization system

### Phase 2: Core Features (Week 3-8)

Implement features **one by one** in this order:

1. **Feature 1**: PDF Viewer (Week 3)
2. **Feature 2**: Book Library (Week 4)
3. **Feature 3**: Reading Speed (Week 5)
4. **Feature 4**: Text Extraction (Week 5)
5. **Feature 5**: Bookmark Manager (Week 6)
6. **Feature 6**: Bookmark Extractor (Week 6)
7. **Feature 7**: Divide by Bookmarks (Week 6)
8. **Feature 8**: Chapter Weight (Week 7)
9. **Feature 9**: Page Operations (Week 7)
10. **Feature 10**: Watermark (Week 7)
11. **Feature 11**: Image Extraction (Week 8)
12. **Feature 12**: PDF Merger (Week 8)
13. **Feature 13**: PDF Compression (Week 8)
14. **Feature 14**: Edit Pages (Week 8)
15. **Feature 15**: Remove Security (Week 8)
16. **Feature 16**: Comments/Annotations (Week 8)

### Phase 3: Polish & Testing (Week 9-10)

1. Comprehensive testing
2. Performance optimization
3. Bug fixes
4. Documentation
5. Build and packaging

---

## 📚 Feature Documentation

Each feature has its own detailed documentation file:

- [FEATURE_01_PDF_Viewer.md](./FEATURE_01_PDF_Viewer.md)
- [FEATURE_02_Book_Library.md](./FEATURE_02_Book_Library.md)
- [FEATURE_03_Reading_Speed.md](./FEATURE_03_Reading_Speed.md)
- ... (see docs/ directory for all 16 feature files)

---

## 🤝 Support

For questions or issues during migration, refer to:
- Individual feature documentation files
- Existing Python code in `src/` directory
- Original PySide6 UI for reference

**Remember**: The Python code is your source of truth. Do not modify it - wrap it with API endpoints instead.

