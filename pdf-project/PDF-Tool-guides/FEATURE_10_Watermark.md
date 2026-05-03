# Feature 10: Watermark

## 📋 Overview

Add text or image watermarks to PDF files, and remove existing watermarks.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `WatermarkTab` (lines 9865-10173)
- **Methods**: `add_watermark()` (line 4015), `remove_watermark()` (line 4057)

## 🔌 Required Backend API Endpoints

### 1. Add Text Watermark

**Endpoint**: `POST /api/watermark/add-text`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_watermarked.pdf",
  "watermark_text": "CONFIDENTIAL",
  "position": "center",
  "opacity": 0.5,
  "font_size": 50,
  "color": "#FF0000",
  "rotation": 45
}
```

**Response**:
```json
{
  "success": true,
  "message": "Watermark added successfully"
}
```

### 2. Add Image Watermark

**Endpoint**: `POST /api/watermark/add-image`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_watermarked.pdf",
  "image_path": "C:/logo.png",
  "position": "bottom-right",
  "opacity": 0.3,
  "scale": 0.5
}
```

**Response**:
```json
{
  "success": true,
  "message": "Image watermark added successfully"
}
```

### 3. Remove Watermark

**Endpoint**: `POST /api/watermark/remove`

**Request**:
```json
{
  "pdf_path": "C:/book_watermarked.pdf",
  "output_path": "C:/book_clean.pdf",
  "aggressive_mode": false,
  "target_updf": true,
  "target_urls": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Watermark removed successfully",
  "items_removed": 15
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Add Watermark] [Remove Watermark]                         │
├─────────────────────────────────────────────────────────────┤
│  Add Watermark:                                              │
│                                                               │
│  [Select PDF]                                                │
│  Type: ○ Text ● Image                                        │
│                                                               │
│  Watermark Text: [CONFIDENTIAL]                             │
│  Position: [Center ▼]                                        │
│  Opacity: [━━━━━●━━━━] 50%                                  │
│  Font Size: [50]                                             │
│  Color: [🎨 #FF0000]                                         │
│  Rotation: [45°]                                             │
│                                                               │
│  [Add Watermark]                                             │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **WatermarkTypeSelector**: Radio buttons for text/image
2. **TextWatermarkForm**: Text, position, opacity, font, color, rotation
3. **ImageWatermarkForm**: Image file, position, opacity, scale
4. **RemoveWatermarkForm**: Aggressive mode, target options
5. **PositionSelector**: Dropdown (center, top-left, top-right, etc.)

### Position Options
- Center
- Top Left
- Top Center
- Top Right
- Middle Left
- Middle Right
- Bottom Left
- Bottom Center
- Bottom Right

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Watermark" | "علامة مائية" |
| "Add Watermark" | "إضافة علامة مائية" |
| "Remove Watermark" | "إزالة علامة مائية" |
| "Text" | "نص" |
| "Image" | "صورة" |
| "Position" | "الموضع" |
| "Opacity" | "الشفافية" |
| "Font Size" | "حجم الخط" |
| "Color" | "اللون" |
| "Rotation" | "التدوير" |
| "Aggressive Mode" | "الوضع القوي" |

## ✅ Testing Checklist

- [ ] Add text watermark
- [ ] Add image watermark
- [ ] Set watermark position
- [ ] Adjust opacity
- [ ] Change font size
- [ ] Change color
- [ ] Rotate watermark
- [ ] Remove watermark
- [ ] Aggressive removal mode
- [ ] Handle PDFs with existing watermarks

---

**Next Feature**: [FEATURE_11_Image_Extraction.md](./FEATURE_11_Image_Extraction.md)

