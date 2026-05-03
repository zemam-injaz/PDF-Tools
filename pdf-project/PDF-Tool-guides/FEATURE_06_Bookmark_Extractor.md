# Feature 06: Bookmark Extractor

## 📋 Overview

Extract existing bookmarks from PDF files and save them to text files for backup or editing.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `BookmarkExtractorTab` (lines 9720-9863)
- **Methods**: `extract_bookmarks()`, `save_bookmarks()`

## 🔌 Required Backend API Endpoints

### 1. Extract Bookmarks

**Endpoint**: `POST /api/bookmark-extractor/extract`

**Request**:
```json
{
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
      {"level": 2, "title": "Section 1.1", "page": 5}
    ],
    "formatted_text": "Chapter 1 - 1\n  Section 1.1 - 5"
  }
}
```

### 2. Save Bookmarks to File

**Endpoint**: `POST /api/bookmark-extractor/save`

**Request**:
```json
{
  "bookmarks_text": "Chapter 1 - 1\nSection 1.1 - 5",
  "output_path": "C:/bookmarks.txt"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Bookmarks saved successfully"
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Select PDF File]                                           │
│  Selected: C:/Users/Documents/book.pdf                       │
│  [Extract Bookmarks]                                         │
├─────────────────────────────────────────────────────────────┤
│  Extracted Bookmarks:                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Chapter 1 - 1                                       │    │
│  │   Section 1.1 - 5                                   │    │
│  │   Section 1.2 - 12                                  │    │
│  │ Chapter 2 - 20                                      │    │
│  │   Section 2.1 - 22                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│  [Save to File] [Copy to Clipboard]                         │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **FileSelector**: PDF file picker
2. **ExtractButton**: Trigger extraction
3. **ResultsDisplay**: Show formatted bookmarks
4. **SaveButton**: Save to text file
5. **CopyButton**: Copy to clipboard

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Bookmark Extractor" | "مستخرج الفهرس" |
| "Extract Bookmarks" | "استخراج الفهرس" |
| "Save to File" | "حفظ في ملف" |
| "Copy to Clipboard" | "نسخ للحافظة" |
| "No bookmarks found" | "لم يتم العثور على فهرس" |

## ✅ Testing Checklist

- [ ] Extract bookmarks from PDF with TOC
- [ ] Handle PDF with no bookmarks
- [ ] Display bookmarks with correct indentation
- [ ] Save bookmarks to text file
- [ ] Copy bookmarks to clipboard
- [ ] Handle multi-level bookmarks (3+ levels)

---

**Next Feature**: [FEATURE_07_Divide_By_Bookmarks.md](./FEATURE_07_Divide_By_Bookmarks.md)

