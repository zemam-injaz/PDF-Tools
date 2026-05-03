# Feature 12: PDF Merger

## 📋 Overview

Merge multiple PDF files into a single PDF document with customizable order.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `MergeTab` (lines 10848-10967)
- **Methods**: `merge_pdfs()` (line 3984), `add_merge_files()`, `clear_merge_files()`

## 🔌 Required Backend API Endpoints

### 1. Merge PDFs

**Endpoint**: `POST /api/pdf-merger/merge`

**Request**:
```json
{
  "input_files": [
    "C:/file1.pdf",
    "C:/file2.pdf",
    "C:/file3.pdf"
  ],
  "output_path": "C:/merged.pdf",
  "preserve_bookmarks": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "PDFs merged successfully",
  "total_pages": 150,
  "output_file": "C:/merged.pdf"
}
```

### 2. Get PDF Info

**Endpoint**: `GET /api/pdf-merger/info`

**Query Parameters**: `pdf_path`

**Response**:
```json
{
  "success": true,
  "data": {
    "file_name": "file1.pdf",
    "total_pages": 50,
    "file_size": 5242880,
    "has_bookmarks": true
  }
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  PDF Merger                                                  │
│  [Add Files]                                                 │
├─────────────────────────────────────────────────────────────┤
│  Files to Merge (Drag to reorder):                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ≡ 1. file1.pdf (50 pages, 5 MB) [↑] [↓] [×]       │    │
│  │ ≡ 2. file2.pdf (75 pages, 8 MB) [↑] [↓] [×]       │    │
│  │ ≡ 3. file3.pdf (25 pages, 3 MB) [↑] [↓] [×]       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Total: 3 files, 150 pages, 16 MB                           │
│  ☑ Preserve bookmarks                                        │
│                                                               │
│  Output: [C:/merged.pdf] [Browse]                           │
│  [Clear All] [Merge PDFs]                                    │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **FileSelector**: Add multiple PDF files
2. **FileList**: Drag-and-drop reorderable list
3. **FileItem**: Show filename, pages, size, move up/down, remove
4. **MergeOptions**: Preserve bookmarks checkbox
5. **OutputSelector**: Output file path
6. **MergeButton**: Execute merge operation

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "PDF Merger" | "دمج ملفات PDF" |
| "Add Files" | "إضافة ملفات" |
| "Merge PDFs" | "دمج الملفات" |
| "Clear All" | "مسح الكل" |
| "Preserve bookmarks" | "الحفاظ على الفهارس" |
| "Total" | "المجموع" |
| "files" | "ملفات" |
| "pages" | "صفحات" |

## ✅ Testing Checklist

- [ ] Add multiple PDF files
- [ ] Reorder files by drag-and-drop
- [ ] Move files up/down with buttons
- [ ] Remove individual files
- [ ] Clear all files
- [ ] Merge PDFs successfully
- [ ] Preserve bookmarks option
- [ ] Display total pages and size
- [ ] Handle duplicate files
- [ ] Handle invalid PDF files

---

**Next Feature**: [FEATURE_13_PDF_Compression.md](./FEATURE_13_PDF_Compression.md)

