# Feature 01: PDF Viewer

## 📋 Overview

The PDF Viewer is the core feature of the application, providing a full-featured PDF reading experience with navigation, zoom, search, bookmarks panel, auto-scrolling, and reading position memory. This feature is implemented using **React/Electron/JavaScript** for the frontend UI and **Python** for backend PDF processing operations only.

### Architecture Separation

**Frontend (JavaScript/React/Electron):**
- PDF rendering and display using PDF.js
- All UI interactions and controls
- Page navigation and zoom
- Auto-scrolling with configurable speed
- Search and highlighting
- Bookmarks panel and navigation
- Thumbnail previews
- Annotations and highlighting
- Full-screen mode
- Theme switching (light/dark)
- Bilingual support (Arabic RTL / English LTR)

**Backend (Python):**
- PDF metadata extraction (title, author, page count)
- Table of contents (TOC) extraction
- Text extraction for search indexing
- PDF processing operations (merge, split, compress, OCR)
- Reading position persistence (database operations)
- Book library management

### Core Functionality

- **PDF Rendering**: Client-side rendering using PDF.js with high quality
- **Navigation**: Page-by-page, jump to page, first/last page, keyboard shortcuts
- **Zoom Controls**: Zoom in/out, fit to width, fit to page, custom zoom levels (50%-400%)
- **Auto-Scrolling**: Configurable auto-scroll with speed control (slow, medium, fast, custom)
- **Pan & Rotate**: Click-and-drag panning, 90° rotation increments
- **Search**: Client-side text search with highlighting and result navigation
- **Bookmarks Panel**: Collapsible sidebar with PDF table of contents (TOC)
- **Thumbnail Preview**: Page thumbnails for quick navigation
- **Annotations**: Highlighting, notes, and markup tools
- **Reading Position**: Auto-save and restore last read page, zoom, and scroll position
- **Full-Screen Mode**: Distraction-free reading experience
- **Theme Support**: Light and dark mode with smooth transitions
- **Bilingual UI**: Arabic RTL and English LTR with dynamic switching

---

## 🏗️ Technology Stack

### Frontend Technologies

| Technology | Purpose | Version |
|------------|---------|---------|
| **PDF.js** | PDF rendering engine | Latest (Mozilla) |
| **React** | UI component framework | 18.2+ |
| **Electron** | Desktop application wrapper | 28.0+ |
| **Canvas API** | PDF page rendering | Native |
| **Web Workers** | Background PDF processing | Native |

### Backend Technologies (Python)

| Technology | Purpose | Usage |
|------------|---------|-------|
| **PyMuPDF (fitz)** | PDF metadata & TOC extraction | Existing code |
| **Flask** | REST API server | New wrapper |
| **SQLite** | Reading position database | Existing code |

### Key Libraries

```json
{
  "pdfjs-dist": "^3.11.174",  // PDF.js library
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "electron": "^28.0.0"
}
```

---

## 📂 Python Backend Reference

### Existing Python Code (DO NOT MODIFY)

- **File**: `PDF-Tools-main/src/pdf_tools_comprehensive.py`
- **Class**: `PDFViewerTab` (lines 13260-15135)
- **Dependencies**:
  - `PyMuPDF (fitz)` for PDF metadata extraction
  - `src/reading_position_db.py` for position persistence
  - `src/recent_books_manager.py` for book library integration

### Python Backend Role

The Python backend will **ONLY** provide:
1. PDF metadata extraction (title, author, page count, file size)
2. Table of contents (TOC/bookmarks) extraction
3. Text content extraction for search indexing (optional)
4. Reading position save/load from database
5. Book library management (recent books, favorites)

**Note**: PDF rendering, viewing, and all UI interactions are handled entirely by the JavaScript frontend using PDF.js.

---

## 🔌 Backend API Endpoints (Python)

**Note**: These endpoints are **ONLY** for metadata extraction and database operations. PDF rendering is handled entirely by PDF.js on the frontend.

### 1. Get PDF Metadata

**Endpoint**: `POST /api/pdf/metadata`

**Purpose**: Extract PDF metadata (title, author, page count, file size, TOC availability)

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "file_path": "C:/Users/Documents/book.pdf",
    "total_pages": 350,
    "title": "Book Title",
    "author": "Author Name",
    "file_size": 15728640,
    "has_toc": true,
    "created_date": "2024-01-15T10:30:00Z",
    "modified_date": "2024-01-20T14:45:00Z"
  }
}
```

**Python Implementation** (Wrapper around existing code):
```python
@app.route('/api/pdf/metadata', methods=['POST'])
def get_pdf_metadata():
    file_path = request.json.get('file_path')
    try:
        doc = fitz.open(file_path)
        metadata = {
            'file_path': file_path,
            'total_pages': doc.page_count,
            'title': doc.metadata.get('title', ''),
            'author': doc.metadata.get('author', ''),
            'file_size': os.path.getsize(file_path),
            'has_toc': len(doc.get_toc()) > 0,
            'created_date': doc.metadata.get('creationDate', ''),
            'modified_date': doc.metadata.get('modDate', '')
        }
        doc.close()
        return jsonify({'success': True, 'data': metadata})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
```

---

### 2. Get Table of Contents (TOC)

**Endpoint**: `POST /api/pdf/toc`

**Purpose**: Extract PDF table of contents/bookmarks structure

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "toc": [
      {
        "level": 1,
        "title": "Chapter 1: Introduction",
        "page": 1
      },
      {
        "level": 2,
        "title": "1.1 Background",
        "page": 3
      },
      {
        "level": 2,
        "title": "1.2 Objectives",
        "page": 5
      },
      {
        "level": 1,
        "title": "Chapter 2: Methodology",
        "page": 10
      }
    ]
  }
}
```

**Python Implementation**:
```python
@app.route('/api/pdf/toc', methods=['POST'])
def get_pdf_toc():
    file_path = request.json.get('file_path')
    try:
        doc = fitz.open(file_path)
        toc = doc.get_toc()
        formatted_toc = [
            {
                'level': item[0],
                'title': item[1],
                'page': item[2]
            }
            for item in toc
        ]
        doc.close()
        return jsonify({'success': True, 'data': {'toc': formatted_toc}})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
```

---

### 3. Save Reading Position

**Endpoint**: `POST /api/pdf/position/save`

**Purpose**: Save current reading position to database

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf",
  "page_number": 42,
  "zoom_level": 1.5,
  "scroll_x": 0,
  "scroll_y": 150,
  "rotation": 0
}
```

**Response**:
```json
{
  "success": true,
  "message": "Reading position saved successfully"
}
```

**Python Implementation** (Uses existing `reading_position_db.py`):
```python
from reading_position_db import ReadingPositionDB

@app.route('/api/pdf/position/save', methods=['POST'])
def save_reading_position():
    data = request.json
    try:
        db = ReadingPositionDB()
        db.save_position(
            file_path=data['file_path'],
            page_number=data['page_number'],
            zoom_level=data.get('zoom_level', 1.0),
            scroll_x=data.get('scroll_x', 0),
            scroll_y=data.get('scroll_y', 0),
            rotation=data.get('rotation', 0)
        )
        return jsonify({'success': True, 'message': 'Reading position saved successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
```

---

### 4. Get Reading Position

**Endpoint**: `POST /api/pdf/position/get`

**Purpose**: Retrieve saved reading position from database

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "page_number": 42,
    "zoom_level": 1.5,
    "scroll_x": 0,
    "scroll_y": 150,
    "rotation": 0,
    "last_read": "2025-11-02T14:30:00Z"
  }
}
```

**Python Implementation**:
```python
@app.route('/api/pdf/position/get', methods=['POST'])
def get_reading_position():
    file_path = request.json.get('file_path')
    try:
        db = ReadingPositionDB()
        position = db.get_position(file_path)
        if position:
            return jsonify({'success': True, 'data': position})
        else:
            return jsonify({'success': True, 'data': None})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
```

---

### 5. Add to Recent Books

**Endpoint**: `POST /api/books/recent/add`

**Purpose**: Add PDF to recent books library

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf",
  "title": "Book Title",
  "author": "Author Name",
  "total_pages": 350
}
```

**Response**:
```json
{
  "success": true,
  "message": "Book added to recent books"
}
```

---

## 🎨 Frontend UI/UX Implementation (React/Electron)

### Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Toolbar: [Open] [◀] [▶] [Page: 1/350] [−] [100%] [+] [⟲] [🔍] [⚙] [☰] │
├──────────┬───────────────────────────────────────────────────────────────┤
│          │                                                                │
│ Bookmarks│                                                                │
│  Panel   │                  PDF Canvas Area                              │
│ (Toggle) │              (PDF.js Rendered Page)                           │
│          │                                                                │
│  [▼] Ch1 │  ┌──────────────────────────────────────┐                    │
│    [▼]1.1│  │                                       │                    │
│      1.1.1│  │         PDF Page Content             │                    │
│  [▼] Ch2 │  │                                       │                    │
│    2.1   │  │                                       │                    │
│    2.2   │  └──────────────────────────────────────┘                    │
│          │                                                                │
│ Thumbnail│  Auto-Scroll: [▶] Speed: [━━━━━━━━━━] Fast                   │
│  Preview │                                                                │
│  (Toggle)│                                                                │
└──────────┴───────────────────────────────────────────────────────────────┘
```

---

## 📦 React Components Architecture

### 1. **PDFViewer Component** (Main Container)

**File**: `src/components/PDFViewer/PDFViewer.jsx`

**Responsibilities**:
- Load PDF file using PDF.js
- Manage PDF document state
- Coordinate child components
- Handle file selection via Electron dialog
- Restore reading position on load
- Auto-save reading position on page change

**State Management**:
```jsx
const [pdfDocument, setPdfDocument] = useState(null);
const [currentPage, setCurrentPage] = useState(1);
const [totalPages, setTotalPages] = useState(0);
const [zoomLevel, setZoomLevel] = useState(1.0);
const [rotation, setRotation] = useState(0);
const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
const [isLoading, setIsLoading] = useState(false);
const [filePath, setFilePath] = useState(null);
const [metadata, setMetadata] = useState(null);
const [toc, setToc] = useState([]);
```

**Key Methods**:
```jsx
const loadPDF = async (filePath) => {
  // Load PDF using PDF.js
  const loadingTask = pdfjsLib.getDocument(filePath);
  const pdf = await loadingTask.promise;
  setPdfDocument(pdf);
  setTotalPages(pdf.numPages);

  // Fetch metadata from Python backend
  const metadata = await fetchMetadata(filePath);
  setMetadata(metadata);

  // Fetch TOC from Python backend
  const toc = await fetchTOC(filePath);
  setToc(toc);

  // Restore reading position
  const position = await fetchReadingPosition(filePath);
  if (position) {
    setCurrentPage(position.page_number);
    setZoomLevel(position.zoom_level);
    setRotation(position.rotation);
  }
};

const savePosition = async () => {
  await saveReadingPosition({
    file_path: filePath,
    page_number: currentPage,
    zoom_level: zoomLevel,
    scroll_x: scrollPosition.x,
    scroll_y: scrollPosition.y,
    rotation: rotation
  });
};
```

---

### 2. **PDFToolbar Component**

**File**: `src/components/PDFViewer/PDFToolbar.jsx`

**Features**:
- **File Operations**: Open PDF (Electron file dialog)
- **Navigation**: First, Previous, Next, Last page buttons
- **Page Input**: Jump to specific page (input field with validation)
- **Zoom Controls**:
  - Zoom in (+) / Zoom out (−) buttons
  - Zoom dropdown: 50%, 75%, 100%, 125%, 150%, 200%, 400%
  - Fit to width / Fit to page buttons
- **Rotation**: Rotate 90° clockwise button
- **Search**: Search icon to toggle search panel
- **Auto-Scroll**: Play/Pause button with speed slider
- **View Options**: Toggle bookmarks panel, toggle thumbnails
- **Full-Screen**: Enter/exit full-screen mode
- **Theme**: Light/Dark mode toggle
- **Language**: Arabic/English toggle

**Props**:
```jsx
<PDFToolbar
  currentPage={currentPage}
  totalPages={totalPages}
  zoomLevel={zoomLevel}
  rotation={rotation}
  onOpenFile={handleOpenFile}
  onPageChange={handlePageChange}
  onZoomChange={handleZoomChange}
  onRotate={handleRotate}
  onToggleSearch={handleToggleSearch}
  onToggleBookmarks={handleToggleBookmarks}
  onToggleThumbnails={handleToggleThumbnails}
  onToggleFullScreen={handleToggleFullScreen}
  autoScrollActive={autoScrollActive}
  autoScrollSpeed={autoScrollSpeed}
  onAutoScrollToggle={handleAutoScrollToggle}
  onAutoScrollSpeedChange={handleAutoScrollSpeedChange}
/>
```

---

### 3. **PDFCanvas Component**

**File**: `src/components/PDFViewer/PDFCanvas.jsx`

**Responsibilities**:
- Render PDF page using PDF.js Canvas API
- Handle zoom and pan interactions
- Display search highlights
- Show loading spinner during rendering
- Handle mouse wheel zoom
- Handle click-and-drag panning
- Support touch gestures (pinch-to-zoom)

**Implementation**:
```jsx
const PDFCanvas = ({ pdfDocument, pageNumber, zoomLevel, rotation, searchResults }) => {
  const canvasRef = useRef(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!pdfDocument) return;

    const renderPage = async () => {
      setIsRendering(true);
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: zoomLevel, rotation });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      setIsRendering(false);

      // Render search highlights if any
      if (searchResults && searchResults.length > 0) {
        highlightSearchResults(context, searchResults, viewport);
      }
    };

    renderPage();
  }, [pdfDocument, pageNumber, zoomLevel, rotation, searchResults]);

  return (
    <div className="pdf-canvas-container">
      {isRendering && <LoadingSpinner />}
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
};
```

---

### 4. **AutoScrollControl Component**

**File**: `src/components/PDFViewer/AutoScrollControl.jsx`

**Features**:
- Play/Pause auto-scroll button
- Speed slider (1-10 scale)
- Preset speed buttons: Slow, Medium, Fast
- Custom speed input
- Visual indicator of scroll progress
- Pause on user interaction (mouse move, scroll)

**Implementation**:
```jsx
const AutoScrollControl = ({ active, speed, onToggle, onSpeedChange }) => {
  const [customSpeed, setCustomSpeed] = useState(speed);

  const presetSpeeds = {
    slow: 1,
    medium: 3,
    fast: 6
  };

  return (
    <div className="auto-scroll-control">
      <button
        className={`auto-scroll-btn ${active ? 'active' : ''}`}
        onClick={onToggle}
        title={active ? 'Pause Auto-Scroll' : 'Start Auto-Scroll'}
      >
        {active ? '⏸' : '▶'}
      </button>

      <div className="speed-control">
        <label>Speed:</label>
        <input
          type="range"
          min="1"
          max="10"
          value={speed}
          onChange={(e) => onSpeedChange(parseInt(e.target.value))}
          className="speed-slider"
        />
        <span className="speed-value">{speed}</span>
      </div>

      <div className="speed-presets">
        <button onClick={() => onSpeedChange(presetSpeeds.slow)}>Slow</button>
        <button onClick={() => onSpeedChange(presetSpeeds.medium)}>Medium</button>
        <button onClick={() => onSpeedChange(presetSpeeds.fast)}>Fast</button>
      </div>
    </div>
  );
};
```

**Auto-Scroll Logic**:
```jsx
// In PDFViewer component
useEffect(() => {
  if (!autoScrollActive) return;

  const scrollInterval = setInterval(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    // Scroll by speed pixels per interval
    container.scrollTop += autoScrollSpeed;

    // Check if reached bottom of page
    if (container.scrollTop + container.clientHeight >= container.scrollHeight) {
      // Move to next page
      if (currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
        container.scrollTop = 0;
      } else {
        // Reached end of document
        setAutoScrollActive(false);
      }
    }
  }, 100); // Update every 100ms

  return () => clearInterval(scrollInterval);
}, [autoScrollActive, autoScrollSpeed, currentPage, totalPages]);
```

---

### 5. **BookmarksPanel Component**

**File**: `src/components/PDFViewer/BookmarksPanel.jsx`

**Features**:
- Collapsible sidebar
- Tree view with indentation for TOC levels
- Click bookmark to navigate to page
- Expand/collapse sections
- Search within bookmarks
- Bookmark analytics button (chapter weight visualization)

**Implementation**:
```jsx
const BookmarksPanel = ({ toc, currentPage, onNavigate, visible }) => {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (index) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const filteredToc = toc.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`bookmarks-panel ${visible ? 'visible' : 'hidden'}`}>
      <div className="bookmarks-header">
        <h3>📑 Bookmarks</h3>
        <input
          type="text"
          placeholder="Search bookmarks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bookmark-search"
        />
      </div>

      <div className="bookmarks-list">
        {filteredToc.map((item, index) => (
          <div
            key={index}
            className={`bookmark-item level-${item.level} ${
              item.page === currentPage ? 'active' : ''
            }`}
            style={{ paddingLeft: `${item.level * 15}px` }}
          >
            {item.hasChildren && (
              <button
                className="expand-btn"
                onClick={() => toggleExpand(index)}
              >
                {expandedItems.has(index) ? '▼' : '▶'}
              </button>
            )}
            <span
              className="bookmark-title"
              onClick={() => onNavigate(item.page)}
            >
              {item.title}
            </span>
            <span className="bookmark-page">p.{item.page}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### 6. **ThumbnailPanel Component**

**File**: `src/components/PDFViewer/ThumbnailPanel.jsx`

**Features**:
- Display page thumbnails in a scrollable sidebar
- Click thumbnail to navigate to page
- Highlight current page thumbnail
- Lazy loading for performance
- Configurable thumbnail size

**Implementation**:
```jsx
const ThumbnailPanel = ({ pdfDocument, totalPages, currentPage, onNavigate, visible }) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  useEffect(() => {
    if (!pdfDocument) return;

    const generateThumbnails = async () => {
      const thumbs = [];
      for (let i = visibleRange.start; i < Math.min(visibleRange.end, totalPages); i++) {
        const page = await pdfDocument.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.2 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        thumbs[i] = canvas.toDataURL();
      }
      setThumbnails(thumbs);
    };

    generateThumbnails();
  }, [pdfDocument, visibleRange]);

  return (
    <div className={`thumbnail-panel ${visible ? 'visible' : 'hidden'}`}>
      <div className="thumbnails-container">
        {thumbnails.map((thumb, index) => (
          <div
            key={index}
            className={`thumbnail-item ${index + 1 === currentPage ? 'active' : ''}`}
            onClick={() => onNavigate(index + 1)}
          >
            <img src={thumb} alt={`Page ${index + 1}`} />
            <span className="thumbnail-page-number">{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### 7. **SearchPanel Component**

**File**: `src/components/PDFViewer/SearchPanel.jsx`

**Features**:
- Search input field
- Case-sensitive toggle
- Match whole word toggle
- Results list with page numbers and context
- Navigate between results (previous/next)
- Highlight current result
- Show total results count

**Implementation**:
```jsx
const SearchPanel = ({ pdfDocument, visible, onResultSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [results, setResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = async () => {
    if (!searchTerm || !pdfDocument) return;

    setIsSearching(true);
    const foundResults = [];

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');

      let searchText = searchTerm;
      let pageText = text;

      if (!caseSensitive) {
        searchText = searchText.toLowerCase();
        pageText = pageText.toLowerCase();
      }

      if (wholeWord) {
        const regex = new RegExp(`\\b${searchText}\\b`, caseSensitive ? 'g' : 'gi');
        const matches = [...text.matchAll(regex)];
        matches.forEach(match => {
          foundResults.push({
            pageNum,
            text: getContext(text, match.index, 50),
            index: match.index
          });
        });
      } else {
        let index = pageText.indexOf(searchText);
        while (index !== -1) {
          foundResults.push({
            pageNum,
            text: getContext(text, index, 50),
            index
          });
          index = pageText.indexOf(searchText, index + 1);
        }
      }
    }

    setResults(foundResults);
    setIsSearching(false);
  };

  const getContext = (text, index, contextLength) => {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + searchTerm.length + contextLength);
    return '...' + text.substring(start, end) + '...';
  };

  return (
    <div className={`search-panel ${visible ? 'visible' : 'hidden'}`}>
      <div className="search-header">
        <input
          type="text"
          placeholder="Search in PDF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && performSearch()}
          className="search-input"
        />
        <button onClick={performSearch} disabled={isSearching}>
          {isSearching ? '⏳' : '🔍'}
        </button>
      </div>

      <div className="search-options">
        <label>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Case sensitive
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
          />
          Whole word
        </label>
      </div>

      <div className="search-results">
        <div className="results-header">
          <span>{results.length} results</span>
          {results.length > 0 && (
            <div className="result-navigation">
              <button onClick={() => setCurrentResultIndex(Math.max(0, currentResultIndex - 1))}>
                ◀
              </button>
              <span>{currentResultIndex + 1} / {results.length}</span>
              <button onClick={() => setCurrentResultIndex(Math.min(results.length - 1, currentResultIndex + 1))}>
                ▶
              </button>
            </div>
          )}
        </div>

        <div className="results-list">
          {results.map((result, index) => (
            <div
              key={index}
              className={`result-item ${index === currentResultIndex ? 'active' : ''}`}
              onClick={() => {
                setCurrentResultIndex(index);
                onResultSelect(result);
              }}
            >
              <span className="result-page">Page {result.pageNum}</span>
              <p className="result-context">{result.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

### 8. **AnnotationTools Component**

**File**: `src/components/PDFViewer/AnnotationTools.jsx`

**Features**:
- Highlight tool (yellow, green, blue, pink)
- Text note tool
- Drawing tool (pen, shapes)
- Eraser tool
- Save annotations to local storage
- Export annotations to JSON
- Import annotations from JSON

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Arabic Label | English Label |
|----------|--------|--------------|---------------|
| `Ctrl/Cmd + O` | Open PDF file | فتح ملف | Open File |
| `→` or `Page Down` | Next page | الصفحة التالية | Next Page |
| `←` or `Page Up` | Previous page | الصفحة السابقة | Previous Page |
| `Home` | First page | الصفحة الأولى | First Page |
| `End` | Last page | الصفحة الأخيرة | Last Page |
| `Ctrl/Cmd + F` | Focus search | بحث | Search |
| `Ctrl/Cmd + +` | Zoom in | تكبير | Zoom In |
| `Ctrl/Cmd + -` | Zoom out | تصغير | Zoom Out |
| `Ctrl/Cmd + 0` | Reset zoom (100%) | إعادة التكبير | Reset Zoom |
| `Ctrl/Cmd + R` | Rotate 90° | تدوير | Rotate |
| `F11` | Toggle fullscreen | ملء الشاشة | Fullscreen |
| `Ctrl/Cmd + B` | Toggle bookmarks | إظهار/إخفاء الفهرس | Toggle Bookmarks |
| `Ctrl/Cmd + T` | Toggle thumbnails | إظهار/إخفاء المصغرات | Toggle Thumbnails |
| `Space` | Start/Stop auto-scroll | تشغيل/إيقاف التمرير التلقائي | Start/Stop Auto-Scroll |
| `Esc` | Exit fullscreen / Close panels | خروج | Exit |

---

## 📊 Data Flow & Architecture

### Opening a PDF (Complete Flow)

```
User clicks "Open PDF" button
  ↓
Electron file dialog (main process)
  ↓
User selects PDF file → Get file_path
  ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (JavaScript/React)                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Load PDF using PDF.js                                    │
│    const loadingTask = pdfjsLib.getDocument(file_path);     │
│    const pdfDoc = await loadingTask.promise;                │
│                                                              │
│ 2. Extract basic info from PDF.js                           │
│    - Total pages: pdfDoc.numPages                           │
│    - Page dimensions                                        │
│                                                              │
│ 3. Render first page to canvas                              │
│    const page = await pdfDoc.getPage(1);                    │
│    const viewport = page.getViewport({ scale: 1.0 });       │
│    await page.render({ canvasContext, viewport }).promise;  │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND API CALLS (Python)                                  │
├─────────────────────────────────────────────────────────────┤
│ 4. Fetch metadata from Python backend                       │
│    POST /api/pdf/metadata                                   │
│    { file_path: "..." }                                     │
│    → Returns: { title, author, file_size, has_toc, ... }    │
│                                                              │
│ 5. Fetch Table of Contents (TOC)                            │
│    POST /api/pdf/toc                                        │
│    { file_path: "..." }                                     │
│    → Returns: { toc: [{level, title, page}, ...] }          │
│                                                              │
│ 6. Check for saved reading position                         │
│    POST /api/pdf/position/get                               │
│    { file_path: "..." }                                     │
│    → Returns: { page_number, zoom_level, scroll_x, ... }    │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Restore State)                                    │
├─────────────────────────────────────────────────────────────┤
│ 7. If saved position exists:                                │
│    - Navigate to saved page                                 │
│    - Apply saved zoom level                                 │
│    - Restore scroll position                                │
│    - Apply saved rotation                                   │
│                                                              │
│ 8. Populate UI components:                                  │
│    - Bookmarks panel with TOC                               │
│    - Metadata display (title, author)                       │
│    - Page counter (1 / 350)                                 │
│                                                              │
│ 9. Generate thumbnails (lazy loading)                       │
│    - Render thumbnails for visible range only               │
└─────────────────────────────────────────────────────────────┘
```

---

### Page Navigation Flow

```
User clicks "Next Page" or presses → key
  ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (JavaScript)                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Validate page number                                     │
│    if (currentPage < totalPages) {                          │
│      setCurrentPage(currentPage + 1);                       │
│    }                                                         │
│                                                              │
│ 2. Render new page using PDF.js                             │
│    const page = await pdfDoc.getPage(currentPage);          │
│    const viewport = page.getViewport({                      │
│      scale: zoomLevel,                                      │
│      rotation: rotation                                     │
│    });                                                       │
│    await page.render({ canvasContext, viewport }).promise;  │
│                                                              │
│ 3. Reset scroll position to top                             │
│    canvasContainer.scrollTop = 0;                           │
└─────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND API CALL (Debounced - save after 2 seconds)        │
├─────────────────────────────────────────────────────────────┤
│ 4. Auto-save reading position                               │
│    POST /api/pdf/position/save                              │
│    {                                                         │
│      file_path: "...",                                      │
│      page_number: currentPage,                              │
│      zoom_level: zoomLevel,                                 │
│      scroll_x: 0,                                           │
│      scroll_y: 0,                                           │
│      rotation: rotation                                     │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

### Auto-Scroll Flow

```
User clicks "Start Auto-Scroll" button
  ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (JavaScript)                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Start scroll interval                                    │
│    setInterval(() => {                                      │
│      container.scrollTop += autoScrollSpeed;                │
│    }, 100);                                                 │
│                                                              │
│ 2. Monitor scroll position                                  │
│    if (scrollTop + clientHeight >= scrollHeight) {          │
│      // Reached bottom of page                              │
│      if (currentPage < totalPages) {                        │
│        setCurrentPage(currentPage + 1);                     │
│        container.scrollTop = 0;                             │
│      } else {                                               │
│        // End of document - stop auto-scroll                │
│        setAutoScrollActive(false);                          │
│      }                                                       │
│    }                                                         │
│                                                              │
│ 3. Pause on user interaction                                │
│    - Mouse move → pause                                     │
│    - Manual scroll → pause                                  │
│    - Key press → pause                                      │
└─────────────────────────────────────────────────────────────┘
```

---

### Search Flow

```
User enters search term and clicks "Search"
  ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (JavaScript - Client-side search)                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Extract text from all pages using PDF.js                 │
│    for (let i = 1; i <= totalPages; i++) {                  │
│      const page = await pdfDoc.getPage(i);                  │
│      const textContent = await page.getTextContent();       │
│      const text = textContent.items                         │
│        .map(item => item.str).join(' ');                    │
│                                                              │
│      // Search for term in text                             │
│      if (text.includes(searchTerm)) {                       │
│        results.push({ pageNum: i, text, ... });             │
│      }                                                       │
│    }                                                         │
│                                                              │
│ 2. Display results in search panel                          │
│    - Show total count                                       │
│    - List results with page numbers                         │
│    - Show context around match                              │
│                                                              │
│ 3. Highlight matches on current page                        │
│    - Get text positions from textContent                    │
│    - Draw highlight rectangles on canvas overlay            │
└─────────────────────────────────────────────────────────────┘
```

**Note**: Search is performed entirely on the frontend using PDF.js text extraction. No backend API call needed.

---

### Zoom & Pan Flow

```
User scrolls mouse wheel or clicks zoom buttons
  ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (JavaScript)                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Update zoom level                                        │
│    const newZoom = Math.max(0.5, Math.min(4.0, zoom));      │
│    setZoomLevel(newZoom);                                   │
│                                                              │
│ 2. Re-render current page with new zoom                     │
│    const viewport = page.getViewport({                      │
│      scale: newZoom,                                        │
│      rotation: rotation                                     │
│    });                                                       │
│    await page.render({ canvasContext, viewport }).promise;  │
│                                                              │
│ 3. Adjust scroll position to maintain focus point           │
│    // Keep the center point in view                         │
│    const centerX = scrollX + (clientWidth / 2);             │
│    const centerY = scrollY + (clientHeight / 2);            │
│    const newScrollX = (centerX * newZoom / oldZoom)         │
│                       - (clientWidth / 2);                  │
│    const newScrollY = (centerY * newZoom / oldZoom)         │
│                       - (clientHeight / 2);                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌍 Bilingual Support (Arabic RTL / English LTR)

### Localization Implementation

**File**: `src/locales/ar.json` (Arabic)
```json
{
  "pdf_viewer": {
    "title": "عارض PDF",
    "open_file": "فتح ملف PDF",
    "close_file": "إغلاق الملف",
    "previous_page": "الصفحة السابقة",
    "next_page": "الصفحة التالية",
    "first_page": "الصفحة الأولى",
    "last_page": "الصفحة الأخيرة",
    "page": "صفحة",
    "of": "من",
    "zoom_in": "تكبير",
    "zoom_out": "تصغير",
    "zoom_fit_width": "ملء العرض",
    "zoom_fit_page": "ملء الصفحة",
    "rotate": "تدوير",
    "search": "بحث",
    "search_placeholder": "ابحث في المستند...",
    "search_case_sensitive": "حساس لحالة الأحرف",
    "search_whole_word": "كلمة كاملة",
    "search_results": "نتائج البحث",
    "no_results": "لا توجد نتائج",
    "bookmarks": "الفهرس",
    "no_bookmarks": "لا يحتوي هذا المستند على فهرس",
    "thumbnails": "المصغرات",
    "fullscreen": "ملء الشاشة",
    "exit_fullscreen": "خروج من ملء الشاشة",
    "auto_scroll": "التمرير التلقائي",
    "auto_scroll_speed": "سرعة التمرير",
    "speed_slow": "بطيء",
    "speed_medium": "متوسط",
    "speed_fast": "سريع",
    "annotations": "التعليقات",
    "highlight": "تظليل",
    "add_note": "إضافة ملاحظة",
    "loading": "جاري التحميل...",
    "error_loading": "خطأ في تحميل الملف",
    "error_invalid_pdf": "ملف PDF غير صالح",
    "error_password_protected": "هذا الملف محمي بكلمة مرور",
    "position_saved": "تم حفظ موضع القراءة",
    "position_restored": "تم استعادة موضع القراءة"
  }
}
```

**File**: `src/locales/en.json` (English)
```json
{
  "pdf_viewer": {
    "title": "PDF Viewer",
    "open_file": "Open PDF",
    "close_file": "Close File",
    "previous_page": "Previous Page",
    "next_page": "Next Page",
    "first_page": "First Page",
    "last_page": "Last Page",
    "page": "Page",
    "of": "of",
    "zoom_in": "Zoom In",
    "zoom_out": "Zoom Out",
    "zoom_fit_width": "Fit to Width",
    "zoom_fit_page": "Fit to Page",
    "rotate": "Rotate",
    "search": "Search",
    "search_placeholder": "Search in document...",
    "search_case_sensitive": "Case sensitive",
    "search_whole_word": "Whole word",
    "search_results": "Search Results",
    "no_results": "No results found",
    "bookmarks": "Bookmarks",
    "no_bookmarks": "This document has no bookmarks",
    "thumbnails": "Thumbnails",
    "fullscreen": "Fullscreen",
    "exit_fullscreen": "Exit Fullscreen",
    "auto_scroll": "Auto-Scroll",
    "auto_scroll_speed": "Scroll Speed",
    "speed_slow": "Slow",
    "speed_medium": "Medium",
    "speed_fast": "Fast",
    "annotations": "Annotations",
    "highlight": "Highlight",
    "add_note": "Add Note",
    "loading": "Loading...",
    "error_loading": "Error loading file",
    "error_invalid_pdf": "Invalid PDF file",
    "error_password_protected": "This file is password protected",
    "position_saved": "Reading position saved",
    "position_restored": "Reading position restored"
  }
}
```

---

### RTL Layout Implementation

**CSS for RTL Support**:
```css
/* Default LTR layout */
.pdf-viewer-container {
  display: flex;
  flex-direction: row;
}

.bookmarks-panel {
  order: 1;
  border-right: 1px solid var(--border-color);
}

.pdf-canvas-area {
  order: 2;
  flex: 1;
}

/* RTL layout for Arabic */
[dir="rtl"] .pdf-viewer-container {
  flex-direction: row-reverse;
}

[dir="rtl"] .bookmarks-panel {
  order: 2;
  border-right: none;
  border-left: 1px solid var(--border-color);
}

[dir="rtl"] .pdf-canvas-area {
  order: 1;
}

/* Flip navigation icons in RTL */
[dir="rtl"] .nav-icon-previous::before {
  content: "→";
}

[dir="rtl"] .nav-icon-next::before {
  content: "←";
}
```

**React Component with RTL Support**:
```jsx
const PDFViewer = () => {
  const { language, t } = useLocalization();
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="pdf-viewer-container" dir={direction}>
      <BookmarksPanel
        title={t('pdf_viewer.bookmarks')}
        noBookmarksText={t('pdf_viewer.no_bookmarks')}
      />
      <div className="pdf-canvas-area">
        <PDFToolbar
          openFileText={t('pdf_viewer.open_file')}
          previousPageText={t('pdf_viewer.previous_page')}
          nextPageText={t('pdf_viewer.next_page')}
          // ... other localized props
        />
        <PDFCanvas />
      </div>
    </div>
  );
};
```

---

## 🎨 Theme Support (Light / Dark Mode)

### Theme Implementation

**CSS Variables** (`src/styles/themes.css`):
```css
:root {
  /* Light Theme (Default) */
  --pdf-bg-primary: #FFFFFF;
  --pdf-bg-secondary: #F5F5F5;
  --pdf-bg-tertiary: #FAFAFA;
  --pdf-text-primary: #000000;
  --pdf-text-secondary: #666666;
  --pdf-text-muted: #999999;
  --pdf-border: #E0E0E0;
  --pdf-accent: #2196F3;
  --pdf-accent-hover: #1976D2;
  --pdf-highlight-yellow: rgba(255, 235, 59, 0.4);
  --pdf-highlight-green: rgba(76, 175, 80, 0.4);
  --pdf-highlight-blue: rgba(33, 150, 243, 0.4);
  --pdf-highlight-pink: rgba(233, 30, 99, 0.4);
  --pdf-shadow: rgba(0, 0, 0, 0.1);
  --pdf-canvas-bg: #E0E0E0;
}

[data-theme="dark"] {
  /* Dark Theme */
  --pdf-bg-primary: #1E1E1E;
  --pdf-bg-secondary: #2D2D2D;
  --pdf-bg-tertiary: #252525;
  --pdf-text-primary: #FFFFFF;
  --pdf-text-secondary: #B0B0B0;
  --pdf-text-muted: #808080;
  --pdf-border: #404040;
  --pdf-accent: #64B5F6;
  --pdf-accent-hover: #42A5F5;
  --pdf-highlight-yellow: rgba(255, 235, 59, 0.3);
  --pdf-highlight-green: rgba(76, 175, 80, 0.3);
  --pdf-highlight-blue: rgba(33, 150, 243, 0.3);
  --pdf-highlight-pink: rgba(233, 30, 99, 0.3);
  --pdf-shadow: rgba(0, 0, 0, 0.3);
  --pdf-canvas-bg: #2A2A2A;
}
```

**Component Styling**:
```css
.pdf-viewer-container {
  background: var(--pdf-bg-primary);
  color: var(--pdf-text-primary);
}

.pdf-toolbar {
  background: var(--pdf-bg-secondary);
  border-bottom: 1px solid var(--pdf-border);
  box-shadow: 0 2px 4px var(--pdf-shadow);
}

.pdf-canvas-container {
  background: var(--pdf-canvas-bg);
}

.bookmarks-panel {
  background: var(--pdf-bg-secondary);
  border-right: 1px solid var(--pdf-border);
}

.bookmark-item:hover {
  background: var(--pdf-bg-tertiary);
}

.bookmark-item.active {
  background: var(--pdf-accent);
  color: white;
}

.search-result-highlight {
  background: var(--pdf-highlight-yellow);
}

.btn-primary {
  background: var(--pdf-accent);
  color: white;
}

.btn-primary:hover {
  background: var(--pdf-accent-hover);
}
```

**Theme Toggle Hook**:
```jsx
// src/hooks/useTheme.js
import { useState, useEffect } from 'react';

export const useTheme = () => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Load saved theme from settings
    const loadTheme = async () => {
      if (window.electronAPI?.getAllSettings) {
        const settings = await window.electronAPI.getAllSettings();
        const themeSetting = settings.find(s => s.key === 'theme');
        if (themeSetting) {
          applyTheme(themeSetting.value);
        }
      }
    };
    loadTheme();
  }, []);

  const applyTheme = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);

    // Save to settings
    if (window.electronAPI?.updateSetting) {
      await window.electronAPI.updateSetting('theme', newTheme);
    }
  };

  return { theme, toggleTheme };
};
```

---

## ⚠️ Error Handling

### Error Types and Handling

**Frontend Error Handling**:
```jsx
const PDFViewer = () => {
  const [error, setError] = useState(null);

  const loadPDF = async (filePath) => {
    try {
      setError(null);
      setIsLoading(true);

      // Load PDF with PDF.js
      const loadingTask = pdfjsLib.getDocument(filePath);
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);

    } catch (err) {
      // Handle PDF.js errors
      if (err.name === 'PasswordException') {
        setError({
          type: 'PASSWORD_PROTECTED',
          message: t('pdf_viewer.error_password_protected'),
          details: 'This PDF requires a password to open.'
        });
      } else if (err.name === 'InvalidPDFException') {
        setError({
          type: 'INVALID_PDF',
          message: t('pdf_viewer.error_invalid_pdf'),
          details: 'The file is corrupted or not a valid PDF.'
        });
      } else if (err.name === 'MissingPDFException') {
        setError({
          type: 'FILE_NOT_FOUND',
          message: t('pdf_viewer.error_loading'),
          details: 'The PDF file could not be found.'
        });
      } else {
        setError({
          type: 'UNKNOWN_ERROR',
          message: t('pdf_viewer.error_loading'),
          details: err.message
        });
      }

      // Show error toast
      if (window.ReactBridge?.showErrorToast) {
        window.ReactBridge.showErrorToast(
          'Error',
          error.message
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pdf-viewer">
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <div className="error-content">
            <h4>{error.message}</h4>
            <p>{error.details}</p>
          </div>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {/* ... rest of component */}
    </div>
  );
};
```

### Error Reference Table

| Error Code | Cause | User Message (EN) | User Message (AR) | Recovery Action |
|------------|-------|-------------------|-------------------|-----------------|
| `FILE_NOT_FOUND` | PDF file doesn't exist | "File not found. Please select a valid PDF file." | "الملف غير موجود. يرجى اختيار ملف PDF صالح." | Prompt user to select another file |
| `INVALID_PDF` | File is corrupted or not a PDF | "Invalid PDF file. The file may be corrupted." | "ملف PDF غير صالح. قد يكون الملف تالفاً." | Suggest file repair or different file |
| `PASSWORD_PROTECTED` | PDF requires password | "This PDF is password protected." | "هذا الملف محمي بكلمة مرور." | Show password input dialog |
| `PAGE_OUT_OF_RANGE` | Invalid page number | "Page number out of range." | "رقم الصفحة خارج النطاق." | Reset to valid page |
| `RENDER_ERROR` | Page rendering failed | "Failed to render page." | "فشل عرض الصفحة." | Retry rendering |
| `METADATA_ERROR` | Backend metadata fetch failed | "Could not load document information." | "تعذر تحميل معلومات المستند." | Continue without metadata |
| `POSITION_SAVE_ERROR` | Failed to save reading position | "Could not save reading position." | "تعذر حفظ موضع القراءة." | Show warning, continue |
| `TOC_ERROR` | Failed to load table of contents | "Could not load bookmarks." | "تعذر تحميل الفهرس." | Hide bookmarks panel |
| `SEARCH_ERROR` | Search operation failed | "Search failed." | "فشل البحث." | Clear search, allow retry |
| `MEMORY_ERROR` | Out of memory (large PDF) | "File too large. Try closing other documents." | "الملف كبير جداً. حاول إغلاق مستندات أخرى." | Suggest closing other PDFs |

---

## ✅ Testing Checklist

### Functional Tests - Core Features

- [ ] **File Operations**
  - [ ] Open PDF file via file dialog
  - [ ] Open PDF via drag-and-drop
  - [ ] Display first page correctly
  - [ ] Close PDF and clear state
  - [ ] Open multiple PDFs in sequence

- [ ] **Page Navigation**
  - [ ] Navigate to next page (button & keyboard)
  - [ ] Navigate to previous page (button & keyboard)
  - [ ] Jump to first page (Home key)
  - [ ] Jump to last page (End key)
  - [ ] Jump to specific page number (input field)
  - [ ] Validate page number input (reject invalid)

- [ ] **Zoom Controls**
  - [ ] Zoom in (+) button works
  - [ ] Zoom out (−) button works
  - [ ] Mouse wheel zoom works
  - [ ] Fit to width works
  - [ ] Fit to page works
  - [ ] Custom zoom levels (50%, 75%, 100%, 125%, 150%, 200%, 400%)
  - [ ] Zoom maintains focus point

- [ ] **Rotation**
  - [ ] Rotate 90° clockwise
  - [ ] Rotate 180°
  - [ ] Rotate 270°
  - [ ] Rotate back to 0°
  - [ ] Rotation persists across pages

- [ ] **Auto-Scroll**
  - [ ] Start auto-scroll
  - [ ] Pause auto-scroll
  - [ ] Resume auto-scroll
  - [ ] Adjust speed with slider
  - [ ] Preset speeds (slow, medium, fast)
  - [ ] Auto-scroll advances to next page at bottom
  - [ ] Auto-scroll stops at end of document
  - [ ] Pause on user interaction (mouse move, scroll)

- [ ] **Search**
  - [ ] Search finds text correctly
  - [ ] Search highlights all matches
  - [ ] Navigate between search results (prev/next)
  - [ ] Case-sensitive search works
  - [ ] Whole word search works
  - [ ] Search results show page numbers
  - [ ] Search results show context
  - [ ] Clear search removes highlights

- [ ] **Bookmarks/TOC**
  - [ ] Bookmarks panel loads correctly
  - [ ] Bookmarks display with proper indentation
  - [ ] Clicking bookmark navigates to page
  - [ ] Expand/collapse bookmark sections
  - [ ] Search within bookmarks
  - [ ] Handle PDFs with no bookmarks gracefully

- [ ] **Thumbnails**
  - [ ] Thumbnail panel displays correctly
  - [ ] Thumbnails load lazily
  - [ ] Clicking thumbnail navigates to page
  - [ ] Current page thumbnail is highlighted
  - [ ] Thumbnails update on page change

- [ ] **Reading Position**
  - [ ] Reading position is saved on page change
  - [ ] Reading position is saved on zoom change
  - [ ] Reading position is saved on scroll
  - [ ] Reading position is saved on rotation
  - [ ] Reading position is restored on reopen
  - [ ] Position save is debounced (not every keystroke)

- [ ] **Full-Screen Mode**
  - [ ] Enter full-screen (F11)
  - [ ] Exit full-screen (Esc or F11)
  - [ ] Full-screen hides toolbars
  - [ ] Full-screen shows minimal controls

### Performance Tests

- [ ] **Load Times**
  - [ ] Open small PDF (< 10 pages) in < 1 second
  - [ ] Open medium PDF (50-100 pages) in < 2 seconds
  - [ ] Open large PDF (500+ pages) in < 5 seconds
  - [ ] First page renders in < 500ms

- [ ] **Navigation Performance**
  - [ ] Page navigation is smooth (< 300ms)
  - [ ] Zoom is responsive (< 200ms)
  - [ ] Scroll is smooth (60 FPS)
  - [ ] Auto-scroll is smooth

- [ ] **Search Performance**
  - [ ] Search in small PDF (< 10 pages) completes in < 1 second
  - [ ] Search in medium PDF (50-100 pages) completes in < 5 seconds
  - [ ] Search in large PDF (500+ pages) completes in < 15 seconds
  - [ ] Search shows progress indicator for long searches

- [ ] **Memory Usage**
  - [ ] Memory usage is acceptable for small PDFs (< 100 MB)
  - [ ] Memory usage is acceptable for large PDFs (< 500 MB)
  - [ ] Memory is released when closing PDF
  - [ ] No memory leaks on repeated open/close

### UI/UX Tests

- [ ] **Theme Support**
  - [ ] Light theme displays correctly
  - [ ] Dark theme displays correctly
  - [ ] Theme toggle works smoothly
  - [ ] Theme persists across sessions
  - [ ] All components respect theme

- [ ] **Bilingual Support**
  - [ ] Arabic RTL layout works
  - [ ] English LTR layout works
  - [ ] Language toggle works
  - [ ] All text is localized
  - [ ] Icons flip correctly in RTL

- [ ] **Keyboard Shortcuts**
  - [ ] All keyboard shortcuts work
  - [ ] Shortcuts are documented
  - [ ] Shortcuts don't conflict with system shortcuts

- [ ] **Responsive Design**
  - [ ] Responsive to window resize
  - [ ] Panels collapse on small screens
  - [ ] Touch gestures work (if applicable)

- [ ] **Loading States**
  - [ ] Loading spinner shows during PDF load
  - [ ] Loading spinner shows during page render
  - [ ] Loading spinner shows during search
  - [ ] Progress bar for long operations

- [ ] **Error Messages**
  - [ ] Error messages are clear and helpful
  - [ ] Error messages are localized
  - [ ] Error recovery options are provided

### Edge Cases

- [ ] **PDF Variations**
  - [ ] Handle PDF with no bookmarks
  - [ ] Handle PDF with 1 page
  - [ ] Handle PDF with 1000+ pages
  - [ ] Handle PDF with special characters in filename
  - [ ] Handle PDF with non-Latin text (Arabic, Chinese, etc.)
  - [ ] Handle PDF with images only (no text)
  - [ ] Handle PDF with complex layouts
  - [ ] Handle PDF with embedded fonts

- [ ] **Error Scenarios**
  - [ ] Handle corrupted PDF gracefully
  - [ ] Handle password-protected PDF
  - [ ] Handle file not found error
  - [ ] Handle network errors (if backend unavailable)
  - [ ] Handle out of memory error
  - [ ] Handle invalid page number input

- [ ] **User Interactions**
  - [ ] Handle rapid page navigation
  - [ ] Handle rapid zoom changes
  - [ ] Handle simultaneous search and navigation
  - [ ] Handle closing PDF during load
  - [ ] Handle switching PDFs quickly

---

## 📝 Implementation Guide

### Step 1: Install PDF.js

```bash
npm install pdfjs-dist
```

**Configure PDF.js Worker** (`src/config/pdfjs-config.js`):
```javascript
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default pdfjsLib;
```

---

### Step 2: Create Backend API Wrapper (Python)

**File**: `backend/routes/pdf_viewer.py`

**Important**: This is a NEW file that wraps existing Python code. DO NOT modify existing Python files.

```python
from flask import Blueprint, request, jsonify
import fitz  # PyMuPDF
import os

# Import existing modules (DO NOT MODIFY THEM)
from reading_position_db import ReadingPositionDB
from recent_books_manager import RecentBooksManager

bp = Blueprint('pdf_viewer', __name__)

@bp.route('/api/pdf/metadata', methods=['POST'])
def get_pdf_metadata():
    """Extract PDF metadata - wraps existing PyMuPDF code"""
    file_path = request.json.get('file_path')

    try:
        doc = fitz.open(file_path)
        metadata = {
            'file_path': file_path,
            'total_pages': doc.page_count,
            'title': doc.metadata.get('title', os.path.basename(file_path)),
            'author': doc.metadata.get('author', ''),
            'file_size': os.path.getsize(file_path),
            'has_toc': len(doc.get_toc()) > 0
        }
        doc.close()
        return jsonify({'success': True, 'data': metadata})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@bp.route('/api/pdf/toc', methods=['POST'])
def get_pdf_toc():
    """Extract table of contents"""
    file_path = request.json.get('file_path')

    try:
        doc = fitz.open(file_path)
        toc = doc.get_toc()
        formatted_toc = [{'level': item[0], 'title': item[1], 'page': item[2]} for item in toc]
        doc.close()
        return jsonify({'success': True, 'data': {'toc': formatted_toc}})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@bp.route('/api/pdf/position/save', methods=['POST'])
def save_reading_position():
    """Save reading position - uses existing database code"""
    data = request.json
    try:
        db = ReadingPositionDB()
        db.save_position(
            file_path=data['file_path'],
            page_number=data['page_number'],
            zoom_level=data.get('zoom_level', 1.0),
            scroll_x=data.get('scroll_x', 0),
            scroll_y=data.get('scroll_y', 0),
            rotation=data.get('rotation', 0)
        )
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@bp.route('/api/pdf/position/get', methods=['POST'])
def get_reading_position():
    """Get saved reading position"""
    file_path = request.json.get('file_path')
    try:
        db = ReadingPositionDB()
        position = db.get_position(file_path)
        return jsonify({'success': True, 'data': position})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
```

---

### Step 3: Create Frontend Service Layer

**File**: `src/services/pdfService.js`

```javascript
const API_BASE_URL = 'http://127.0.0.1:5000';

export const fetchMetadata = async (filePath) => {
  const response = await fetch(`${API_BASE_URL}/api/pdf/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: filePath })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
};

export const fetchTOC = async (filePath) => {
  const response = await fetch(`${API_BASE_URL}/api/pdf/toc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: filePath })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.toc;
};

export const saveReadingPosition = async (positionData) => {
  const response = await fetch(`${API_BASE_URL}/api/pdf/position/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(positionData)
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
};

export const fetchReadingPosition = async (filePath) => {
  const response = await fetch(`${API_BASE_URL}/api/pdf/position/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: filePath })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
};
```

---

### Step 4: Electron Integration

**File**: `main.js` (Add IPC handler)

```javascript
const { ipcMain, dialog } = require('electron');

ipcMain.handle('select-pdf-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});
```

**File**: `preload.js` (Expose API)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file')
});
```

---

### Step 5: Core Component Examples

**PDFCanvas Component** (Core rendering logic):

```jsx
// src/components/PDFViewer/PDFCanvas.jsx
import React, { useRef, useEffect } from 'react';

const PDFCanvas = ({ pdfDocument, pageNumber, zoomLevel, rotation }) => {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        // Cancel previous render task if still running
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        // Get page
        const page = await pdfDocument.getPage(pageNumber);

        // Calculate viewport
        const viewport = page.getViewport({
          scale: zoomLevel,
          rotation: rotation
        });

        // Prepare canvas
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render page
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;

      } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error);
        }
      }
    };

    renderPage();

    // Cleanup
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDocument, pageNumber, zoomLevel, rotation]);

  return (
    <div className="pdf-canvas-container">
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
};

export default PDFCanvas;
```

**AutoScrollControl Component**:

```jsx
// src/components/PDFViewer/AutoScrollControl.jsx
import React, { useEffect, useRef } from 'react';

const AutoScrollControl = ({ active, speed, onToggle, onSpeedChange, containerRef, onPageEnd }) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start auto-scroll
    intervalRef.current = setInterval(() => {
      const container = containerRef.current;
      if (!container) return;

      // Scroll down
      container.scrollTop += speed;

      // Check if reached bottom
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
        onPageEnd(); // Trigger next page
      }
    }, 100); // Update every 100ms

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [active, speed, containerRef, onPageEnd]);

  const presetSpeeds = [
    { label: 'Slow', value: 1 },
    { label: 'Medium', value: 3 },
    { label: 'Fast', value: 5 }
  ];

  return (
    <div className="auto-scroll-control">
      <button onClick={onToggle} className={active ? 'active' : ''}>
        {active ? '⏸ Pause' : '▶ Auto-Scroll'}
      </button>

      <div className="speed-controls">
        <label>Speed:</label>
        <input
          type="range"
          min="1"
          max="10"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
        <span>{speed}</span>

        <div className="preset-speeds">
          {presetSpeeds.map(preset => (
            <button
              key={preset.value}
              onClick={() => onSpeedChange(preset.value)}
              className={speed === preset.value ? 'active' : ''}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AutoScrollControl;
```

**SearchPanel Component**:

```jsx
// src/components/PDFViewer/SearchPanel.jsx
import React, { useState } from 'react';

const SearchPanel = ({ pdfDocument, onResultSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const performSearch = async () => {
    if (!searchTerm || !pdfDocument) return;

    setIsSearching(true);
    setResults([]);

    try {
      const searchResults = [];
      const totalPages = pdfDocument.numPages;

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');

        let searchText = text;
        let term = searchTerm;

        if (!caseSensitive) {
          searchText = text.toLowerCase();
          term = searchTerm.toLowerCase();
        }

        if (wholeWord) {
          const regex = new RegExp(`\\b${term}\\b`, caseSensitive ? 'g' : 'gi');
          const matches = searchText.match(regex);
          if (matches) {
            matches.forEach(match => {
              const index = searchText.indexOf(match);
              const context = text.substring(Math.max(0, index - 50), Math.min(text.length, index + 50));
              searchResults.push({ pageNum: i, context, match });
            });
          }
        } else {
          let index = searchText.indexOf(term);
          while (index !== -1) {
            const context = text.substring(Math.max(0, index - 50), Math.min(text.length, index + 50));
            searchResults.push({ pageNum: i, context, match: term });
            index = searchText.indexOf(term, index + 1);
          }
        }
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-input-group">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && performSearch()}
          placeholder="Search in document..."
        />
        <button onClick={performSearch} disabled={isSearching}>
          {isSearching ? '⏳' : '🔍'}
        </button>
      </div>

      <div className="search-options">
        <label>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Case sensitive
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
          />
          Whole word
        </label>
      </div>

      <div className="search-results">
        <h4>Results: {results.length}</h4>
        {results.map((result, index) => (
          <div
            key={index}
            className="search-result-item"
            onClick={() => onResultSelect(result)}
          >
            <span className="page-num">Page {result.pageNum}</span>
            <p className="context">...{result.context}...</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPanel;
```

---

## � File Structure Summary

```
electron-app/
├── src/
│   ├── components/
│   │   └── PDFViewer/
│   │       ├── PDFViewer.jsx           # Main container component
│   │       ├── PDFToolbar.jsx          # Toolbar with controls
│   │       ├── PDFCanvas.jsx           # PDF rendering canvas
│   │       ├── BookmarksPanel.jsx      # TOC sidebar
│   │       ├── ThumbnailPanel.jsx      # Page thumbnails
│   │       ├── SearchPanel.jsx         # Search interface
│   │       ├── AutoScrollControl.jsx   # Auto-scroll controls
│   │       └── AnnotationTools.jsx     # Annotation tools
│   ├── services/
│   │   └── pdfService.js               # Backend API client
│   ├── hooks/
│   │   ├── useTheme.js                 # Theme management
│   │   └── useLocalization.js          # i18n support
│   ├── config/
│   │   └── pdfjs-config.js             # PDF.js configuration
│   ├── locales/
│   │   ├── ar.json                     # Arabic translations
│   │   └── en.json                     # English translations
│   └── styles/
│       ├── themes.css                  # Theme variables
│       └── pdf-viewer.css              # Component styles

backend/
├── routes/
│   └── pdf_viewer.py                   # NEW: API wrapper (DO NOT modify existing files)
├── src/                                # EXISTING: Do not modify
│   ├── pdf_tools_comprehensive.py      # Original PDFViewerTab class
│   ├── reading_position_db.py          # Database operations
│   └── recent_books_manager.py         # Book library
```

---

## 🎯 Key Takeaways

### ✅ What to Do

1. **Use PDF.js for ALL PDF rendering** - No backend rendering needed
2. **Client-side search** - Extract text with PDF.js, search in JavaScript
3. **Client-side zoom/pan/rotate** - All handled by PDF.js viewport
4. **Auto-scroll** - Pure JavaScript interval-based scrolling
5. **Thumbnails** - Generate with PDF.js at low scale
6. **Annotations** - Store in local storage or separate database
7. **Backend for metadata only** - Title, author, TOC, reading position

### ❌ What NOT to Do

1. **Don't render PDFs on backend** - No base64 image transfer needed
2. **Don't modify existing Python code** - Only create new wrapper files
3. **Don't use sessions** - PDF.js loads file directly, no session management
4. **Don't send page images** - PDF.js renders directly from file
5. **Don't implement search on backend** - PDF.js provides text extraction

---

## 🚀 Performance Optimization Tips

1. **Lazy Loading**: Only render visible pages and thumbnails
2. **Web Workers**: Use PDF.js workers for background processing
3. **Debouncing**: Debounce position saving (2-3 seconds)
4. **Caching**: Cache rendered pages in memory (LRU cache)
5. **Virtual Scrolling**: For thumbnail panel with many pages
6. **Progressive Loading**: Show low-res preview while high-res loads
7. **Memory Management**: Clear canvas when switching pages

---

## �🔗 Related Features

- **Feature 2**: Book Library (integrates with PDF Viewer for recent books)
- **Feature 3**: Reading Speed (uses PDF Viewer as base)
- **Feature 5**: Bookmark Manager (extends bookmark functionality)

---

## 📖 Additional Resources

- **PDF.js Documentation**: https://mozilla.github.io/pdf.js/
- **PDF.js Examples**: https://mozilla.github.io/pdf.js/examples/
- **Electron File Dialogs**: https://www.electronjs.org/docs/latest/api/dialog
- **React Hooks Guide**: https://react.dev/reference/react
- **PyMuPDF Documentation**: https://pymupdf.readthedocs.io/

---

**Next Feature**: [FEATURE_02_Book_Library.md](./FEATURE_02_Book_Library.md)

