# Feature 09: Page Operations

## 📋 Overview

Perform various page operations: rotate, delete, extract, reorder, insert pages from other PDFs.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `PageOperationsTab` (lines 8967-9718)
- **Methods**: `rotate_pages()`, `delete_pages()`, `extract_pages()`, `reorder_pages()`, `insert_pages()`

## 🔌 Required Backend API Endpoints

### 1. Rotate Pages

**Endpoint**: `POST /api/page-operations/rotate`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_rotated.pdf",
  "pages": "1-10",
  "rotation": 90
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages rotated successfully"
}
```

### 2. Delete Pages

**Endpoint**: `POST /api/page-operations/delete`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_deleted.pdf",
  "pages": "5,10,15-20"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages deleted successfully",
  "pages_deleted": 8
}
```

### 3. Extract Pages

**Endpoint**: `POST /api/page-operations/extract`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/extracted.pdf",
  "pages": "1-50"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages extracted successfully",
  "pages_extracted": 50
}
```

### 4. Reorder Pages

**Endpoint**: `POST /api/page-operations/reorder`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_reordered.pdf",
  "new_order": [3, 1, 2, 4, 5]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages reordered successfully"
}
```

### 5. Insert Pages

**Endpoint**: `POST /api/page-operations/insert`

**Request**:
```json
{
  "target_pdf": "C:/book.pdf",
  "source_pdf": "C:/insert.pdf",
  "output_path": "C:/book_with_insert.pdf",
  "insert_after_page": 10,
  "source_pages": "1-5"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages inserted successfully",
  "pages_inserted": 5
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Rotate] [Delete] [Extract] [Reorder] [Insert]             │
├─────────────────────────────────────────────────────────────┤
│  Selected Operation: Rotate Pages                            │
│                                                               │
│  [Select PDF]                                                │
│  File: C:/Users/Documents/book.pdf (100 pages)              │
│                                                               │
│  Page Range: [1-10]                                          │
│  Rotation: ○ 90° ○ 180° ● 270°                              │
│                                                               │
│  Output: [C:/book_rotated.pdf] [Browse]                     │
│                                                               │
│  [Execute Operation]                                         │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **OperationSelector**: Tabs for different operations
2. **PageRangeInput**: Input for page selection
3. **RotationSelector**: Radio buttons for rotation angle
4. **PageReorderList**: Drag-and-drop list for reordering
5. **InsertPageSelector**: Select source PDF and pages

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Page Operations" | "عمليات الصفحات" |
| "Rotate" | "تدوير" |
| "Delete" | "حذف" |
| "Extract" | "استخراج" |
| "Reorder" | "إعادة ترتيب" |
| "Insert" | "إدراج" |
| "Page Range" | "نطاق الصفحات" |
| "Rotation Angle" | "زاوية التدوير" |

## ✅ Testing Checklist

- [ ] Rotate pages 90°, 180°, 270°
- [ ] Delete single page
- [ ] Delete multiple pages
- [ ] Delete page range
- [ ] Extract pages
- [ ] Reorder pages by drag-and-drop
- [ ] Insert pages from another PDF
- [ ] Handle invalid page ranges

---

**Next Feature**: [FEATURE_10_Watermark.md](./FEATURE_10_Watermark.md)

