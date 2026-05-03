# Feature 05: Bookmark Manager

## 📋 Overview

Manage PDF bookmarks (table of contents) - load from text files, edit, preview, fix page offsets, and insert into PDFs.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `BookmarkTab` (lines 4872-8844)
- **Methods**: 
  - `load_bookmarks_from_text()` (line 3702)
  - `extract_bookmarks_from_pdf()` (line 3744)
  - `insert_bookmarks_into_pdf()` (line 3763)
  - `parse_toc_text()` (line 3821)
  - `fix_bookmark_pages()` (line 6430)
  - `preview_bookmark()` (line 6326)

## 🔌 Required Backend API Endpoints

### 1. Load Bookmarks from Text

**Endpoint**: `POST /api/bookmarks/load-from-text`

**Request**:
```json
{
  "text_content": "Chapter 1 - 1\nSection 1.1 - 5\nChapter 2 - 20",
  "pdf_path": "C:/book.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {"level": 1, "title": "Chapter 1", "page": 1},
      {"level": 2, "title": "Section 1.1", "page": 5},
      {"level": 1, "title": "Chapter 2", "page": 20}
    ]
  }
}
```

### 2. Extract Bookmarks from PDF

**Endpoint**: `GET /api/bookmarks/extract`

**Query Parameters**: `pdf_path`

**Response**:
```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {"level": 1, "title": "Introduction", "page": 1}
    ]
  }
}
```

### 3. Insert Bookmarks into PDF

**Endpoint**: `POST /api/bookmarks/insert`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_with_bookmarks.pdf",
  "bookmarks": [
    {"level": 1, "title": "Chapter 1", "page": 1}
  ],
  "page_offset": 0
}
```

**Response**:
```json
{
  "success": true,
  "message": "Bookmarks inserted successfully"
}
```

### 4. Preview Bookmark Page

**Endpoint**: `GET /api/bookmarks/preview`

**Query Parameters**: `pdf_path`, `page_number`

**Response**:
```json
{
  "success": true,
  "data": {
    "page_image_base64": "data:image/png;base64,...",
    "page_number": 5
  }
}
```

### 5. Fix Bookmark Page Offsets

**Endpoint**: `POST /api/bookmarks/fix-offset`

**Request**:
```json
{
  "bookmarks": [...],
  "offset": -2
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bookmarks": [...]
  }
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Select PDF] [Load Bookmarks from Text]                    │
├─────────────────────────────────────────────────────────────┤
│  Paste TOC Text:                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Chapter 1 - 1                                       │    │
│  │ Section 1.1 - 5                                     │    │
│  │ Chapter 2 - 20                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│  [Parse Bookmarks]                                           │
├─────────────────────────────────────────────────────────────┤
│  Bookmarks Table:                                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Level │ Title       │ Page │ [Preview] [Edit] [Del] │    │
│  │   1   │ Chapter 1   │  1   │    👁️      ✏️     🗑️   │    │
│  │   2   │ Section 1.1 │  5   │    👁️      ✏️     🗑️   │    │
│  └─────────────────────────────────────────────────────┘    │
│  Page Offset: [  0  ] [Fix All Pages]                       │
│  [Insert Bookmarks into PDF]                                 │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **BookmarkTextInput**: Textarea for pasting TOC text
2. **BookmarkTable**: Editable table with preview, edit, delete
3. **BookmarkPreview**: Show PDF page preview
4. **OffsetAdjuster**: Spinbox for page offset correction

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Bookmark Manager" | "إدارة الفهرس" |
| "Load from Text" | "تحميل من نص" |
| "Extract from PDF" | "استخراج من PDF" |
| "Insert Bookmarks" | "إدراج الفهرس" |
| "Page Offset" | "إزاحة الصفحات" |
| "Preview" | "معاينة" |
| "Level" | "المستوى" |
| "Title" | "العنوان" |
| "Page" | "الصفحة" |

## ✅ Testing Checklist

- [ ] Load bookmarks from text
- [ ] Parse TOC with different formats
- [ ] Extract bookmarks from PDF
- [ ] Edit bookmark title
- [ ] Edit bookmark page
- [ ] Delete bookmark
- [ ] Preview bookmark page
- [ ] Fix page offset
- [ ] Insert bookmarks into PDF
- [ ] Handle invalid page numbers
- [ ] Handle empty bookmarks

---

**Next Feature**: [FEATURE_06_Bookmark_Extractor.md](./FEATURE_06_Bookmark_Extractor.md)

