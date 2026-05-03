# Feature 11: Image Extraction

## 📋 Overview

Extract all images from PDF files and save them as individual image files (PNG, JPEG).

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `ImageExtractionTab` (lines 10175-10343)
- **Methods**: `extract_images()` (line 4239)

## 🔌 Required Backend API Endpoints

### 1. Extract Images

**Endpoint**: `POST /api/image-extraction/extract`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_dir": "C:/images",
  "page_range": "all",
  "min_width": 100,
  "min_height": 100,
  "format": "png"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "images_extracted": 45,
    "output_files": [
      "C:/images/page_1_img_1.png",
      "C:/images/page_1_img_2.png",
      "C:/images/page_2_img_1.png"
    ]
  }
}
```

### 2. Preview Images

**Endpoint**: `GET /api/image-extraction/preview`

**Query Parameters**: `pdf_path`, `page_number`

**Response**:
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "index": 0,
        "width": 800,
        "height": 600,
        "thumbnail_base64": "data:image/png;base64,..."
      }
    ]
  }
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Select PDF] [Output Directory]                            │
│                                                               │
│  Page Range: [all] or [1-50]                                │
│  Min Width: [100] px  Min Height: [100] px                  │
│  Format: ○ PNG ● JPEG                                        │
│                                                               │
│  [Extract Images]                                            │
├─────────────────────────────────────────────────────────────┤
│  Preview:                                                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                       │
│  │ Img1 │ │ Img2 │ │ Img3 │ │ Img4 │                       │
│  │800x600│ │640x480│ │1024x768│ │512x512│                   │
│  └──────┘ └──────┘ └──────┘ └──────┘                       │
│                                                               │
│  Extracted: 45 images                                        │
│  [Open Output Folder]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **ImageExtractionForm**: PDF selector, output dir, page range, filters
2. **ImagePreview**: Grid of image thumbnails
3. **ExtractionProgress**: Progress bar during extraction
4. **ResultsSummary**: Count of extracted images

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Image Extraction" | "استخراج الصور" |
| "Extract Images" | "استخراج الصور" |
| "Output Directory" | "مجلد الإخراج" |
| "Page Range" | "نطاق الصفحات" |
| "Min Width" | "الحد الأدنى للعرض" |
| "Min Height" | "الحد الأدنى للارتفاع" |
| "Format" | "التنسيق" |
| "Extracted" | "تم استخراج" |
| "images" | "صورة" |

## ✅ Testing Checklist

- [ ] Extract all images from PDF
- [ ] Extract images from specific page range
- [ ] Filter by minimum width/height
- [ ] Save as PNG format
- [ ] Save as JPEG format
- [ ] Preview images before extraction
- [ ] Handle PDFs with no images
- [ ] Open output folder after extraction

---

**Next Feature**: [FEATURE_12_PDF_Merger.md](./FEATURE_12_PDF_Merger.md)

