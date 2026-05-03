# Feature 03: Reading Speed Analysis & Training

## 📋 Overview

Reading Speed feature provides multiple reading modes (Standard, RSVP, Scrolling, Chunking, Elimination) with WPM (Words Per Minute) tracking, reading sessions, and performance analytics.

### Current Functionality

- **5 Reading Modes**: Standard, RSVP (Rapid Serial Visual Presentation), Auto-Scrolling, Chunking, Word Elimination
- **WPM Tracking**: Real-time words per minute calculation
- **Reading Sessions**: Track reading time and progress
- **Performance Analytics**: Charts and statistics
- **Book Analysis**: Analyze PDF content for reading
- **Session History**: Save and review past sessions
- **Customizable Settings**: Speed, font size, colors

---

## 📂 Current Python Code Location

### Main File
- **File**: `src/reading_speed_tab.py` (complete file)
- **Dependencies**: PyMuPDF, pandas, matplotlib

### Key Methods

| Method | Description |
|--------|-------------|
| `load_pdf(file_path)` | Load PDF for reading session |
| `start_reading_session(mode)` | Start reading with selected mode |
| `prepare_book_analysis()` | Analyze PDF content and extract text |
| `analyze_pdf_content()` | Extract text from all pages |
| `calculate_wpm()` | Calculate words per minute |
| `save_session()` | Save reading session to database |
| `get_session_history()` | Retrieve past sessions |
| `update_reading_position()` | Track current reading position |

### Database Schema

**Table**: `reading_sessions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Session ID |
| `file_path` | TEXT | PDF file path |
| `mode` | TEXT | Reading mode used |
| `start_time` | TEXT | Session start timestamp |
| `end_time` | TEXT | Session end timestamp |
| `duration_seconds` | INTEGER | Total reading time |
| `words_read` | INTEGER | Total words read |
| `wpm` | REAL | Words per minute |
| `pages_covered` | INTEGER | Pages read in session |
| `start_page` | INTEGER | Starting page |
| `end_page` | INTEGER | Ending page |

---

## 🔌 Required Backend API Endpoints

### 1. Analyze PDF for Reading

**Endpoint**: `POST /api/reading-speed/analyze`

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf",
  "start_page": 0,
  "end_page": 50
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total_words": 15000,
    "total_pages": 50,
    "avg_words_per_page": 300,
    "estimated_reading_time_minutes": 60,
    "text_content": ["Page 1 text...", "Page 2 text..."]
  }
}
```

### 2. Start Reading Session

**Endpoint**: `POST /api/reading-speed/session/start`

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf",
  "mode": "RSVP",
  "start_page": 0,
  "settings": {
    "wpm_target": 300,
    "font_size": 24,
    "background_color": "#000000",
    "text_color": "#FFFFFF"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-v4-string",
    "start_time": "2025-10-31T10:00:00Z",
    "total_words": 15000,
    "words_array": ["word1", "word2", "word3", ...]
  }
}
```

### 3. End Reading Session

**Endpoint**: `POST /api/reading-speed/session/end`

**Request**:
```json
{
  "session_id": "uuid-v4-string",
  "words_read": 1500,
  "duration_seconds": 300,
  "end_page": 10
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "wpm": 300,
    "duration_minutes": 5,
    "pages_covered": 10,
    "session_saved": true
  }
}
```

### 4. Get Session History

**Endpoint**: `GET /api/reading-speed/sessions`

**Query Parameters**:
- `file_path`: string (optional, filter by book)
- `limit`: integer (optional, default: 50)

**Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": 1,
        "file_path": "C:/Users/Documents/book.pdf",
        "mode": "RSVP",
        "start_time": "2025-10-30T14:00:00Z",
        "duration_seconds": 600,
        "words_read": 3000,
        "wpm": 300,
        "pages_covered": 20
      }
    ]
  }
}
```

### 5. Get Reading Statistics

**Endpoint**: `GET /api/reading-speed/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "total_sessions": 45,
    "total_reading_time_hours": 25.5,
    "total_words_read": 450000,
    "average_wpm": 285,
    "best_wpm": 350,
    "favorite_mode": "RSVP",
    "wpm_trend": [250, 260, 275, 285, 290]
  }
}
```

---

## 🎨 UI/UX Requirements for Electron Frontend

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Reading Speed Analysis                                      │
├─────────────────────────────────────────────────────────────┤
│  [Select PDF] [Mode: RSVP ▼] [Speed: 300 WPM] [Start]      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    ┌─────────────────┐                       │
│                    │                 │                       │
│                    │   WORD DISPLAY  │  (RSVP Mode)         │
│                    │                 │                       │
│                    └─────────────────┘                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Progress: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░ 35%       │    │
│  │ WPM: 285 | Words: 1500/4500 | Time: 5:15           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  [Pause] [Resume] [Stop]                                     │
└─────────────────────────────────────────────────────────────┘
```

### Reading Modes

1. **Standard Mode**: Traditional page-by-page reading with timer
2. **RSVP Mode**: One word at a time in center of screen
3. **Auto-Scrolling Mode**: Continuous scrolling at set speed
4. **Chunking Mode**: Display 3-5 words at a time
5. **Elimination Mode**: Gradually remove words to increase speed

### Components to Implement

1. **ReadingSpeedSetup Component**
   - PDF file selector
   - Mode dropdown
   - Speed slider (100-1000 WPM)
   - Page range selector
   - Font size selector
   - Color pickers (background, text)
   - Start button

2. **ReadingDisplay Component** (Mode-specific)
   - RSVP: Single word display with focus point
   - Scrolling: Auto-scrolling text area
   - Chunking: Multi-word display
   - Elimination: Fading text display

3. **ReadingControls Component**
   - Progress bar
   - WPM counter (real-time)
   - Words read counter
   - Timer
   - Pause/Resume/Stop buttons
   - Speed adjustment (±50 WPM)

4. **SessionHistory Component**
   - Table of past sessions
   - Filter by book/mode
   - Sort by date/WPM
   - Charts (WPM over time, reading time by book)

5. **ReadingStats Component**
   - Total sessions
   - Total reading time
   - Average WPM
   - Best WPM
   - WPM trend chart
   - Mode distribution pie chart

---

## 📊 Data Flow

### Starting a Reading Session

```
User selects PDF and mode
  ↓
POST /api/reading-speed/analyze (get word count)
  ↓
User clicks "Start"
  ↓
POST /api/reading-speed/session/start
  ↓
Backend extracts text, splits into words
  ↓
Return words array and session_id
  ↓
Frontend displays words based on mode
  ↓
Track time and words read
  ↓
User clicks "Stop"
  ↓
POST /api/reading-speed/session/end
  ↓
Save session to database
  ↓
Display session summary
```

---

## 🌍 Bilingual Support Requirements

| English | Arabic |
|---------|--------|
| "Reading Speed" | "سرعة القراءة" |
| "Mode" | "الوضع" |
| "Standard" | "عادي" |
| "RSVP" | "عرض سريع" |
| "Scrolling" | "تمرير تلقائي" |
| "Chunking" | "مجموعات" |
| "Elimination" | "إزالة تدريجية" |
| "Words Per Minute" | "كلمة في الدقيقة" |
| "Start Reading" | "بدء القراءة" |
| "Pause" | "إيقاف مؤقت" |
| "Resume" | "استئناف" |
| "Stop" | "إيقاف" |
| "Session History" | "سجل الجلسات" |
| "Statistics" | "الإحصائيات" |

---

## ⚠️ Error Handling

| Error | Cause | User Message |
|-------|-------|--------------|
| `NO_TEXT_FOUND` | PDF has no extractable text | "This PDF contains no readable text. It may be scanned images." |
| `INVALID_PAGE_RANGE` | Invalid start/end pages | "Invalid page range. Please check the page numbers." |
| `SESSION_NOT_FOUND` | Session ID doesn't exist | "Session not found. Please start a new session." |

---

## ✅ Testing Checklist

### Functional Tests
- [ ] Analyze PDF successfully
- [ ] Start reading session in each mode
- [ ] Pause and resume session
- [ ] Stop session and save
- [ ] Calculate WPM correctly
- [ ] Display session history
- [ ] Show reading statistics
- [ ] Adjust speed during session
- [ ] Handle page range selection

### Performance Tests
- [ ] Handle large PDFs (500+ pages)
- [ ] RSVP mode displays words smoothly at 500+ WPM
- [ ] No lag during auto-scrolling

### UI/UX Tests
- [ ] Word display is clear and readable
- [ ] Progress bar updates smoothly
- [ ] WPM counter updates in real-time
- [ ] Controls are responsive
- [ ] Charts display correctly

---

## 📝 Implementation Notes

### Backend Implementation

```python
# backend/routes/reading_speed.py
from flask import Blueprint, request, jsonify
import fitz
import re

bp = Blueprint('reading_speed', __name__)

@bp.route('/analyze', methods=['POST'])
def analyze_pdf():
    data = request.json
    file_path = data['file_path']
    start_page = data.get('start_page', 0)
    end_page = data.get('end_page', -1)
    
    doc = fitz.open(file_path)
    if end_page == -1:
        end_page = doc.page_count - 1
    
    text_content = []
    total_words = 0
    
    for page_num in range(start_page, end_page + 1):
        page = doc[page_num]
        text = page.get_text()
        words = len(re.findall(r'\w+', text))
        total_words += words
        text_content.append(text)
    
    doc.close()
    
    return jsonify({
        'success': True,
        'data': {
            'total_words': total_words,
            'total_pages': end_page - start_page + 1,
            'avg_words_per_page': total_words / (end_page - start_page + 1),
            'text_content': text_content
        }
    })
```

### Frontend Implementation (RSVP Mode)

```jsx
// electron-app/src/components/RSVPReader.jsx
import React, { useState, useEffect } from 'react';

const RSVPReader = ({ words, wpm, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const msPerWord = 60000 / wpm;
  
  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= words.length - 1) {
          onComplete();
          return prev;
        }
        return prev + 1;
      });
    }, msPerWord);
    
    return () => clearInterval(timer);
  }, [isPlaying, wpm]);
  
  return (
    <div className="rsvp-reader">
      <div className="word-display">
        {words[currentIndex]}
      </div>
      <div className="controls">
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  );
};
```

---

**Next Feature**: [FEATURE_04_Text_Extraction.md](./FEATURE_04_Text_Extraction.md)

