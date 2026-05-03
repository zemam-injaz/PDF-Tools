# Feature 14: Edit Pages

## 📋 Overview

Advanced page editing operations: crop pages, add margins, adjust page size.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `PageEditingTab` (lines 11135-11373)
- **Methods**: `crop_pages()`, `add_margins()`, `resize_pages()`

## 🔌 Required Backend API Endpoints

### 1. Crop Pages

**Endpoint**: `POST /api/page-editing/crop`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_cropped.pdf",
  "pages": "all",
  "crop_box": {
    "left": 50,
    "top": 50,
    "right": 50,
    "bottom": 50
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages cropped successfully"
}
```

### 2. Add Margins

**Endpoint**: `POST /api/page-editing/add-margins`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_margins.pdf",
  "pages": "all",
  "margins": {
    "left": 20,
    "top": 20,
    "right": 20,
    "bottom": 20
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Margins added successfully"
}
```

### 3. Resize Pages

**Endpoint**: `POST /api/page-editing/resize`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_resized.pdf",
  "pages": "all",
  "target_size": "A4",
  "maintain_aspect_ratio": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Pages resized successfully"
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Crop] [Add Margins] [Resize]                              │
├─────────────────────────────────────────────────────────────┤
│  Selected Operation: Crop Pages                              │
│                                                               │
│  [Select PDF]                                                │
│  File: C:/Users/Documents/book.pdf                          │
│                                                               │
│  Page Range: [all]                                           │
│                                                               │
│  Crop Margins (pixels):                                      │
│  Left: [50]  Top: [50]  Right: [50]  Bottom: [50]          │
│                                                               │
│  Preview:                                                    │
│  ┌─────────────────┐                                         │
│  │  ┌───────────┐  │                                         │
│  │  │           │  │  (Cropped area shown)                  │
│  │  │           │  │                                         │
│  │  └───────────┘  │                                         │
│  └─────────────────┘                                         │
│                                                               │
│  Output: [C:/book_cropped.pdf] [Browse]                     │
│  [Apply Crop]                                                │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **OperationSelector**: Tabs for Crop/Margins/Resize
2. **CropForm**: Input fields for crop margins
3. **MarginsForm**: Input fields for margins
4. **ResizeForm**: Page size selector, aspect ratio checkbox
5. **PagePreview**: Visual preview of operation
6. **ApplyButton**: Execute operation

### Standard Page Sizes
- A4 (210 × 297 mm)
- Letter (8.5 × 11 in)
- Legal (8.5 × 14 in)
- A3 (297 × 420 mm)
- Custom

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Edit Pages" | "تحرير الصفحات" |
| "Crop" | "قص" |
| "Add Margins" | "إضافة هوامش" |
| "Resize" | "تغيير الحجم" |
| "Left" | "يسار" |
| "Top" | "أعلى" |
| "Right" | "يمين" |
| "Bottom" | "أسفل" |
| "Page Size" | "حجم الصفحة" |
| "Maintain Aspect Ratio" | "الحفاظ على نسبة العرض" |

## ✅ Testing Checklist

- [ ] Crop pages with custom margins
- [ ] Add margins to pages
- [ ] Resize to A4
- [ ] Resize to Letter
- [ ] Resize to custom size
- [ ] Maintain aspect ratio
- [ ] Preview crop operation
- [ ] Apply to all pages
- [ ] Apply to specific page range

---

**Next Feature**: [FEATURE_15_Remove_Security.md](./FEATURE_15_Remove_Security.md)

