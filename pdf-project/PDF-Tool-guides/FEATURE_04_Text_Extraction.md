# Feature 04: Text Extraction

## 📋 Overview

Extract text from PDF files to various formats (TXT, DOCX, MD) with support for page ranges and batch processing.

## 📂 Current Python Code Location

- **File**: `src/pdf_tools_comprehensive.py`
- **Class**: `TextExtractionTab` (lines 10345-10846)
- **Methods**: `extract_text()`, `extract_text_single()`, `extract_text_batch()`, `_save_as_docx()`

## 🔌 Required Backend API Endpoints

### 1. Extract Text (Single File)

**Endpoint**: `POST /api/text-extraction/extract`

**Request**:
```json
{
  "file_path": "C:/Users/Documents/book.pdf",
  "page_range": "1-50",
  "format": "txt"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "extracted_text": "Full text content...",
    "total_pages": 50,
    "word_count": 15000
  }
}
```

### 2. Extract Text (Batch)

**Endpoint**: `POST /api/text-extraction/batch`

**Request**:
```json
{
  "file_paths": ["C:/file1.pdf", "C:/file2.pdf"],
  "output_dir": "C:/output",
  "format": "docx",
  "page_range": "all"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "successful": 2,
    "failed": 0,
    "output_files": ["C:/output/file1.docx", "C:/output/file2.docx"]
  }
}
```

## 🎨 UI/UX Requirements

### Components
1. **TextExtractionForm**: File selector, page range input, format dropdown
2. **BatchProcessor**: Multiple file selection, progress bar
3. **PreviewPanel**: Show extracted text preview

### Supported Formats
- **TXT**: Plain text
- **DOCX**: Microsoft Word with formatting
- **MD**: Markdown format

## 🌍 Bilingual Support

| English | Arabic |
|---------|--------|
| "Extract Text" | "استخراج النص" |
| "Page Range" | "نطاق الصفحات" |
| "All Pages" | "جميع الصفحات" |
| "Format" | "التنسيق" |
| "Batch Mode" | "وضع الدفعة" |

## ✅ Testing Checklist

- [ ] Extract text from single PDF
- [ ] Extract specific page range
- [ ] Extract to TXT format
- [ ] Extract to DOCX format
- [ ] Extract to MD format
- [ ] Batch extract multiple files
- [ ] Handle PDFs with no text
- [ ] Handle scanned PDFs (show warning)

---

**Next Feature**: [FEATURE_05_Bookmark_Manager.md](./FEATURE_05_Bookmark_Manager.md)

