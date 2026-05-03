# Feature 07: Divide PDF by Bookmarks

## 📋 Overview

Split a PDF file into multiple smaller PDFs based on its bookmark structure (table of contents).

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `SplitByBookmarksTab` (lines 15137-15541)
- **Methods**: `load_bookmarks()`, `split_pdf_by_bookmarks()`, `calculate_end_page()`, `create_section_toc()`

## 🔌 Required Backend API Endpoints

### 1. Load Bookmarks for Splitting

**Endpoint**: `GET /api/split-by-bookmarks/load`

**Query Parameters**: `pdf_path`

**Response**:
```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {"level": 1, "title": "Chapter 1", "page": 1},
      {"level": 2, "title": "Section 1.1", "page": 5},
      {"level": 1, "title": "Chapter 2", "page": 20}
    ],
    "total_pages": 100
  }
}
```

### 2. Split PDF by Bookmarks

**Endpoint**: `POST /api/split-by-bookmarks/split`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_dir": "C:/output",
  "split_level_1_only": true,
  "preserve_bookmarks": true,
  "selected_bookmarks": [0, 2]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "files_created": [
      "C:/output/Chapter_1.pdf",
      "C:/output/Chapter_2.pdf"
    ],
    "total_files": 2
  }
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Select PDF] [Output Directory]                            │
│  ☑ Split by Level 1 only  ☑ Preserve sub-bookmarks         │
├─────────────────────────────────────────────────────────────┤
│  Select Bookmarks to Split:                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ☑ Chapter 1 (Pages 1-19)                           │    │
│  │ ☐ Chapter 2 (Pages 20-45)                          │    │
│  │ ☑ Chapter 3 (Pages 46-100)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  [Select All] [Deselect All] [Split PDF]                    │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **SplitOptions**: Checkboxes for split level and bookmark preservation
2. **BookmarkSelector**: Checklist of bookmarks with page ranges
3. **OutputSelector**: Directory picker
4. **SplitButton**: Execute split operation
5. **ProgressDialog**: Show splitting progress

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Divide by Bookmarks" | "تقسيم حسب الفهرس" |
| "Split by Level 1 only" | "تقسيم حسب المستوى الأول فقط" |
| "Preserve sub-bookmarks" | "الحفاظ على الفهارس الفرعية" |
| "Select All" | "تحديد الكل" |
| "Deselect All" | "إلغاء تحديد الكل" |
| "Output Directory" | "مجلد الإخراج" |

## ✅ Testing Checklist

- [ ] Load bookmarks from PDF
- [ ] Split by Level 1 bookmarks only
- [ ] Split by all bookmark levels
- [ ] Preserve sub-bookmarks in split files
- [ ] Select specific bookmarks to split
- [ ] Handle PDFs with no bookmarks
- [ ] Create output files with correct names
- [ ] Verify page ranges are correct

---

**Next Feature**: [FEATURE_08_Chapter_Weight.md](./FEATURE_08_Chapter_Weight.md)

