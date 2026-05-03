# Feature 02: Book Library

## 📋 Overview

The Book Library feature manages a collection of recently opened PDF books with thumbnails, metadata, reading progress tracking, starring, priority levels, categories, and notes.

### Current Functionality

- **Book Grid/List View**: Display books with thumbnails and metadata
- **Reading Progress**: Track pages read and percentage complete
- **Starring**: Mark favorite books
- **Priority Levels**: Set priority (High/Medium/Low)
- **Categories**: Organize books by category
- **Notes**: Add personal notes to books
- **Search & Filter**: Find books by title, category, or status
- **Sort Options**: Sort by date, title, progress, priority
- **Thumbnail Generation**: Auto-generate first page thumbnail
- **Quick Actions**: Open, delete, edit metadata

---

## 📂 Current Python Code Location

### Main Files
- **File**: `src/recent_books_manager.py` (complete file)
- **File**: `src/recent_books_tab.py` (UI implementation)
- **Database**: SQLite database for book storage

### Key Classes & Methods

**Class**: `RecentBooksManager` (src/recent_books_manager.py)

| Method | Description |
|--------|-------------|
| `__init__` | Initialize database connection |
| `add_book(file_path)` | Add new book to library |
| `save_book(book_data)` | Save/update book metadata |
| `get_all_books()` | Retrieve all books from database |
| `get_book(file_path)` | Get single book by file path |
| `delete_book(file_path)` | Remove book from library |
| `toggle_star(file_path)` | Toggle favorite status |
| `set_priority(file_path, priority)` | Set book priority |
| `update_progress(file_path, pages_read)` | Update reading progress |
| `generate_thumbnail(file_path)` | Create thumbnail from first page |
| `search_books(query)` | Search books by title |
| `filter_by_category(category)` | Filter books by category |

### Database Schema

**Table**: `recent_books`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment ID |
| `file_path` | TEXT UNIQUE | Full path to PDF file |
| `title` | TEXT | Book title |
| `total_pages` | INTEGER | Total number of pages |
| `pages_read` | INTEGER | Pages read so far |
| `reading_percentage` | REAL | Percentage complete (0-100) |
| `thumbnail_path` | TEXT | Path to thumbnail image |
| `is_starred` | INTEGER | Favorite status (0/1) |
| `priority` | TEXT | Priority level (High/Medium/Low) |
| `category` | TEXT | Book category |
| `notes` | TEXT | User notes |
| `file_size` | INTEGER | File size in bytes |
| `date_added` | TEXT | Date added to library |
| `last_opened` | TEXT | Last opened timestamp |

---

## 🔌 Required Backend API Endpoints

### 1. Get All Books

**Endpoint**: `GET /api/books`

**Query Parameters**:
- `sort_by`: string (optional: "date_added", "title", "progress", "priority")
- `order`: string (optional: "asc", "desc")
- `category`: string (optional: filter by category)
- `starred_only`: boolean (optional: show only starred books)

**Response**:
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": 1,
        "file_path": "C:/Users/Documents/book1.pdf",
        "title": "Introduction to Python",
        "total_pages": 350,
        "pages_read": 120,
        "reading_percentage": 34.3,
        "thumbnail_base64": "data:image/png;base64,...",
        "is_starred": true,
        "priority": "High",
        "category": "Programming",
        "notes": "Great book for beginners",
        "file_size": 15728640,
        "date_added": "2025-10-15T10:30:00Z",
        "last_opened": "2025-10-30T14:20:00Z"
      }
    ],
    "total_count": 25
  }
}
```

### 2. Add Book

**Endpoint**: `POST /api/books`

**Request**:
```json
{
  "file_path": "C:/Users/Documents/new_book.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 26,
    "file_path": "C:/Users/Documents/new_book.pdf",
    "title": "New Book Title",
    "total_pages": 200,
    "pages_read": 0,
    "reading_percentage": 0,
    "thumbnail_base64": "data:image/png;base64,...",
    "is_starred": false,
    "priority": "Medium",
    "category": "Uncategorized",
    "notes": "",
    "file_size": 8388608,
    "date_added": "2025-10-31T09:00:00Z",
    "last_opened": null
  }
}
```

### 3. Update Book

**Endpoint**: `PUT /api/books/:id`

**Request**:
```json
{
  "title": "Updated Title",
  "pages_read": 150,
  "is_starred": true,
  "priority": "High",
  "category": "Science",
  "notes": "Updated notes"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Book updated successfully"
}
```

### 4. Delete Book

**Endpoint**: `DELETE /api/books/:id`

**Response**:
```json
{
  "success": true,
  "message": "Book deleted successfully"
}
```

### 5. Toggle Star

**Endpoint**: `POST /api/books/:id/toggle-star`

**Response**:
```json
{
  "success": true,
  "data": {
    "is_starred": true
  }
}
```

### 6. Update Progress

**Endpoint**: `POST /api/books/:id/progress`

**Request**:
```json
{
  "pages_read": 175
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "pages_read": 175,
    "reading_percentage": 50.0
  }
}
```

### 7. Search Books

**Endpoint**: `GET /api/books/search`

**Query Parameters**:
- `query`: string (required)

**Response**:
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": 5,
        "title": "Python Programming",
        "file_path": "C:/Users/Documents/python.pdf"
      }
    ]
  }
}
```

### 8. Get Categories

**Endpoint**: `GET /api/books/categories`

**Response**:
```json
{
  "success": true,
  "data": {
    "categories": [
      "Programming",
      "Science",
      "History",
      "Uncategorized"
    ]
  }
}
```

---

## 🎨 UI/UX Requirements for Electron Frontend

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Search: ___________] [Filter: All ▼] [Sort: Date ▼] [Grid]│
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ [Thumb]  │  │ [Thumb]  │  │ [Thumb]  │  │ [Thumb]  │   │
│  │  ⭐       │  │          │  │  ⭐       │  │          │   │
│  │ Book 1   │  │ Book 2   │  │ Book 3   │  │ Book 4   │   │
│  │ 120/350  │  │ 50/200   │  │ 200/200  │  │ 0/150    │   │
│  │ [34%]    │  │ [25%]    │  │ [100%]   │  │ [0%]     │   │
│  │ High     │  │ Medium   │  │ Low      │  │ Medium   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  [+ Add Book]                                               │
└─────────────────────────────────────────────────────────────┘
```

### Components to Implement

1. **BookLibrary Component** (Main Container)
   - Search bar
   - Filter dropdown (All, Starred, By Category)
   - Sort dropdown (Date Added, Title, Progress, Priority)
   - View toggle (Grid/List)
   - Add book button

2. **BookCard Component**
   - Thumbnail image
   - Star icon (clickable)
   - Book title (editable on click)
   - Progress bar with percentage
   - Pages read / Total pages
   - Priority badge (color-coded)
   - Category tag
   - Quick actions menu (Open, Edit, Delete)
   - Last opened date

3. **BookEditDialog Component**
   - Title input
   - Category dropdown/input
   - Priority selector
   - Notes textarea
   - Save/Cancel buttons

4. **BookDetailsPanel Component** (Optional)
   - Full metadata display
   - Larger thumbnail
   - Reading statistics
   - Notes section
   - Open button

### Visual Design

**Book Card (Grid View)**:
```
┌────────────────────┐
│   [Thumbnail]      │
│        ⭐          │
├────────────────────┤
│ Book Title         │
│ ▓▓▓▓▓▓░░░░ 60%    │
│ 210/350 pages      │
│ [High] Programming │
│ Last: 2 days ago   │
└────────────────────┘
```

**Priority Colors**:
- High: Red (`#F44336`)
- Medium: Orange (`#FF9800`)
- Low: Green (`#4CAF50`)

**Progress Bar Colors**:
- 0-33%: Red
- 34-66%: Orange
- 67-99%: Blue
- 100%: Green

---

## 📊 Data Flow

### Adding a Book

```
User clicks "Add Book"
  ↓
Electron file dialog
  ↓
POST /api/books with file_path
  ↓
Backend:
  - Opens PDF with PyMuPDF
  - Extracts metadata (title, pages)
  - Generates thumbnail from first page
  - Saves to database
  ↓
Return book data with thumbnail
  ↓
Display new book card in grid
```

### Updating Progress

```
User opens book from library
  ↓
PDF Viewer tracks current page
  ↓
On close or page change:
  POST /api/books/:id/progress
  ↓
Backend updates database
  ↓
Return updated progress
  ↓
Update book card UI
```

---

## 🌍 Bilingual Support Requirements

### Text Elements to Localize

| English | Arabic |
|---------|--------|
| "Book Library" | "مكتبة الكتب" |
| "Add Book" | "إضافة كتاب" |
| "Search books..." | "البحث عن كتب..." |
| "Filter" | "تصفية" |
| "Sort by" | "ترتيب حسب" |
| "All Books" | "جميع الكتب" |
| "Starred" | "المفضلة" |
| "Date Added" | "تاريخ الإضافة" |
| "Title" | "العنوان" |
| "Progress" | "التقدم" |
| "Priority" | "الأولوية" |
| "High" | "عالية" |
| "Medium" | "متوسطة" |
| "Low" | "منخفضة" |
| "Category" | "الفئة" |
| "Notes" | "ملاحظات" |
| "pages" | "صفحة" |
| "Last opened" | "آخر فتح" |
| "Delete" | "حذف" |
| "Edit" | "تعديل" |

---

## 🎨 Theme Support Requirements

### Light Mode
- Card Background: `#FFFFFF`
- Card Border: `#E0E0E0`
- Text: `#000000`
- Progress Bar Background: `#F5F5F5`

### Dark Mode
- Card Background: `#2D2D2D`
- Card Border: `#404040`
- Text: `#FFFFFF`
- Progress Bar Background: `#1E1E1E`

---

## ⚠️ Error Handling

| Error | Cause | User Message |
|-------|-------|--------------|
| `FILE_NOT_FOUND` | PDF file moved/deleted | "File not found. The book may have been moved or deleted." |
| `DUPLICATE_BOOK` | Book already in library | "This book is already in your library." |
| `THUMBNAIL_GENERATION_FAILED` | Cannot create thumbnail | "Could not generate thumbnail. Using default icon." |
| `DATABASE_ERROR` | SQLite error | "Database error. Please try again." |

---

## ✅ Testing Checklist

### Functional Tests
- [ ] Add book to library
- [ ] Display all books in grid view
- [ ] Display all books in list view
- [ ] Toggle star on book
- [ ] Update book progress
- [ ] Edit book metadata
- [ ] Delete book from library
- [ ] Search books by title
- [ ] Filter by category
- [ ] Filter starred books only
- [ ] Sort by date added
- [ ] Sort by title
- [ ] Sort by progress
- [ ] Sort by priority
- [ ] Open book in PDF viewer
- [ ] Thumbnail displays correctly

### Performance Tests
- [ ] Load library with 100+ books in < 2 seconds
- [ ] Search is responsive
- [ ] Thumbnail generation doesn't block UI

### UI/UX Tests
- [ ] Grid view displays correctly
- [ ] List view displays correctly
- [ ] Progress bars animate smoothly
- [ ] Priority badges show correct colors
- [ ] Star toggle is responsive
- [ ] Edit dialog works correctly
- [ ] Delete confirmation shows

### Edge Cases
- [ ] Handle book with no title (use filename)
- [ ] Handle book with very long title
- [ ] Handle missing thumbnail
- [ ] Handle deleted PDF file
- [ ] Handle empty library
- [ ] Handle duplicate file paths

---

## 📝 Implementation Notes

### Backend Implementation

```python
# backend/routes/books.py
from flask import Blueprint, request, jsonify
from src.recent_books_manager import RecentBooksManager
import base64

bp = Blueprint('books', __name__)
books_manager = RecentBooksManager()

@bp.route('/', methods=['GET'])
def get_all_books():
    sort_by = request.args.get('sort_by', 'date_added')
    order = request.args.get('order', 'desc')
    category = request.args.get('category')
    starred_only = request.args.get('starred_only', 'false') == 'true'
    
    books = books_manager.get_all_books()
    
    # Apply filters
    if starred_only:
        books = [b for b in books if b['is_starred']]
    if category:
        books = [b for b in books if b['category'] == category]
    
    # Sort
    books.sort(key=lambda x: x[sort_by], reverse=(order == 'desc'))
    
    # Load thumbnails as base64
    for book in books:
        if book['thumbnail_path']:
            with open(book['thumbnail_path'], 'rb') as f:
                book['thumbnail_base64'] = base64.b64encode(f.read()).decode()
    
    return jsonify({'success': True, 'data': {'books': books, 'total_count': len(books)}})
```

### Frontend Implementation

```jsx
// electron-app/src/components/BookLibrary.jsx
import React, { useState, useEffect } from 'react';
import { getAllBooks, addBook, toggleStar } from '../services/booksService';
import BookCard from './BookCard';

const BookLibrary = () => {
  const [books, setBooks] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date_added');

  useEffect(() => {
    loadBooks();
  }, [sortBy]);

  const loadBooks = async () => {
    const result = await getAllBooks({ sort_by: sortBy });
    setBooks(result.books);
  };

  const handleAddBook = async (filePath) => {
    const newBook = await addBook(filePath);
    setBooks([newBook, ...books]);
  };

  return (
    <div className="book-library">
      <div className="toolbar">
        <input type="text" placeholder="Search books..." />
        <select onChange={(e) => setSortBy(e.target.value)}>
          <option value="date_added">Date Added</option>
          <option value="title">Title</option>
          <option value="progress">Progress</option>
        </select>
      </div>
      <div className={`books-${viewMode}`}>
        {books.map(book => (
          <BookCard key={book.id} book={book} onUpdate={loadBooks} />
        ))}
      </div>
    </div>
  );
};
```

---

**Next Feature**: [FEATURE_03_Reading_Speed.md](./FEATURE_03_Reading_Speed.md)

