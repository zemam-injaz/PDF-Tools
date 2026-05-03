# Feature 13: PDF Compression

## 📋 Overview

Compress PDF files to reduce file size while maintaining acceptable quality.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `CompressTab` (lines 10969-11133)
- **Methods**: `compress_pdf()` (line 4564)

## 🔌 Required Backend API Endpoints

### 1. Compress PDF

**Endpoint**: `POST /api/pdf-compression/compress`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "output_path": "C:/book_compressed.pdf",
  "compression_level": "medium"
}
```

**Response**:
```json
{
  "success": true,
  "message": "PDF compressed successfully",
  "original_size": 15728640,
  "compressed_size": 8388608,
  "compression_ratio": 46.7,
  "size_saved": 7340032
}
```

### 2. Estimate Compression

**Endpoint**: `POST /api/pdf-compression/estimate`

**Request**:
```json
{
  "pdf_path": "C:/book.pdf",
  "compression_level": "high"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "original_size": 15728640,
    "estimated_size": 6291456,
    "estimated_ratio": 60.0
  }
}
```

## 🎨 UI/UX Requirements

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  PDF Compression                                             │
│  [Select PDF]                                                │
│  File: C:/Users/Documents/book.pdf                          │
│  Original Size: 15 MB                                        │
├─────────────────────────────────────────────────────────────┤
│  Compression Level:                                          │
│  ○ Low (faster, larger file)                                │
│  ● Medium (balanced)                                         │
│  ○ High (slower, smaller file)                              │
│                                                               │
│  Estimated Size: ~8 MB (47% reduction)                      │
│                                                               │
│  Output: [C:/book_compressed.pdf] [Browse]                  │
│  [Compress PDF]                                              │
├─────────────────────────────────────────────────────────────┤
│  Results:                                                    │
│  Original: 15 MB                                             │
│  Compressed: 8 MB                                            │
│  Saved: 7 MB (46.7% reduction)                              │
│  [Open File] [Open Folder]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **FileSelector**: PDF file picker
2. **CompressionLevelSelector**: Radio buttons (Low/Medium/High)
3. **EstimateDisplay**: Show estimated compression
4. **OutputSelector**: Output file path
5. **CompressButton**: Execute compression
6. **ResultsDisplay**: Show compression statistics

### Compression Levels
- **Low**: Minimal compression, faster processing
- **Medium**: Balanced compression and quality
- **High**: Maximum compression, slower processing

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "PDF Compression" | "ضغط PDF" |
| "Compress PDF" | "ضغط الملف" |
| "Compression Level" | "مستوى الضغط" |
| "Low" | "منخفض" |
| "Medium" | "متوسط" |
| "High" | "عالي" |
| "Original Size" | "الحجم الأصلي" |
| "Compressed Size" | "الحجم المضغوط" |
| "Saved" | "تم توفير" |
| "reduction" | "تقليل" |

## ✅ Testing Checklist

- [ ] Compress PDF with low level
- [ ] Compress PDF with medium level
- [ ] Compress PDF with high level
- [ ] Display original file size
- [ ] Show estimated compression
- [ ] Display compression results
- [ ] Calculate compression ratio
- [ ] Open compressed file
- [ ] Open output folder
- [ ] Handle already compressed PDFs

---

**Next Feature**: [FEATURE_14_Edit_Pages.md](./FEATURE_14_Edit_Pages.md)

