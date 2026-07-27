# Markdown → PDF Pipeline — Professional Edition

## Problem Diagnosis (Original)

The original pipeline was:

```
.md files → fpdf2 (FPDF) + arabic_reshaper + python-bidi → PDF
```

This caused overlapping lines, broken Arabic shaping, raw Markdown artifacts, missing bold, and collapsed lists.

---

## Solution Architecture

```
Markdown files
    │
    ▼
markdown-it-py  (commonmark + table + container + footnote)
    │
    ▼
HTML + CSS variables + @page margin boxes
    │
    ▼
Playwright (Chromium)  → PDF
    │
    ▼
PyMuPDF post-processing  → PDF metadata
```

---

## Implementation Status: DONE — Professional Edition

> [!IMPORTANT]
> **Playwright installs a full Chromium browser (~170 MB).** This is a one-time download that happens during `pip install playwright && playwright install chromium`. If your app is packaged as an `.exe` (Warraq.exe via PyInstaller), we need to bundle Playwright's Chromium separately.

> [!WARNING]
> The old `fpdf2`-based implementation has been **replaced entirely**. The API endpoint `/api/markdown/to-pdf` now accepts advanced options for professional document generation.

---

## Files Changed

| File | What changed |
|------|-------------|
| `python-server/services/markdown_service.py` | Full rewrite — Chromium + CSS variables + @page margin boxes + cover page + metadata |
| `python-server/server.py` | Extended `MarkdownToPDFRequest` with metadata, header/footer, colors, layout |
| `python-server/requirements.txt` | Added `markdown-it-py`, `mdit-py-plugins`, `playwright` |
| `python-server/assets/fonts/NotoNaskhArabic-Bold.ttf` | Downloaded from Google Fonts |
| `src/components/tools/MarkdownToPDFTool.tsx` | New tabbed UI with Basic / Content / Header-Footer / Colors |

---

## Professional Features

### 1. Arabic-Safe Typography

| Element | Default | Reason |
|---------|---------|--------|
| Body font-size | 12pt | Readable for print |
| Body line-height | 2.8 | Noto Naskh Arabic glyphs are ~2.22× em height; 2.8 gives visual clearance |
| h1 line-height | 2.0 | Prevents overlap in multi-line headings/cover titles |
| h2 line-height | 2.1 | Same |
| h3 line-height | 2.2 | Same |
| h4 line-height | 2.3 | Same |
| Text align | justify | Book-like appearance |
| Paragraph margin | 0 0 0.9em | Clear paragraph separation |

Measured with PyMuPDF: **no block-level overlap** at default settings.

### 2. Font System

- `NotoNaskhArabic-Regular.ttf` for normal text
- `NotoNaskhArabic-Bold.ttf` for `font-weight: 700`
- Loaded via `@font-face url(file://...)` — not base64

### 3. Color System

All colors are CSS variables and customizable from the UI:

```css
:root {
    --primary-color: #111827;        /* headings */
    --text-color: #1a1a1a;           /* body text */
    --link-color: #2563eb;           /* links */
    --accent-color: #2563eb;         /* accent */
    --code-bg: #1e1e2e;              /* code background */
    --code-text: #cdd6f4;            /* code text */
    --blockquote-border: #cbd5e1;    /* blockquote border */
    --blockquote-bg: #f8fafc;        /* blockquote background */
    --highlight: #fef08a;            /* ==highlight== */
    --header-color: #4b5563;         /* header text */
    --footer-color: #6b7280;         /* footer text */
    --page-number-color: #6b7280;    /* page numbers */
    --toc-color: #374151;            /* TOC entries */
}
```

### 4. Page Layout

- Page size: A4 / Letter / A3 / A5 / Legal
- Per-side margins: top, bottom, left, right
- Margins use `@page` CSS so headers/footers live in margin boxes

### 5. Headers & Footers

- Header text with alignment (left/center/right)
- Footer text with alignment
- Page numbers: standalone or combined with footer text
- Hidden on cover page via `@page :first`

Example generated CSS:

```css
@page {
    @top-center { content: 'Book Title'; }
    @bottom-center { content: 'Warraq — ' counter(page); }
}
```

### 6. Cover Page

Optional front page with:
- Title
- Subtitle
- Author
- Publisher
- Date

No header/footer on the cover page.

### 7. Table of Contents

Auto-generated from `#` to `####` headings with 4 indentation levels.

### 8. Content Structure

- Chapter breaks: each file starts on a new page
- `==highlight==` converted to `<mark>`
- Tables, lists, blockquotes, code blocks, inline code, links

### 9. PDF Metadata

PyMuPDF injects:
- Title, Author, Subject, Keywords
- Creator, Producer
- Creation/Modification dates

---

## API Request Model

```python
class MarkdownToPDFRequest(BaseModel):
    markdown_files: List[str]
    output_path: str

    # Page & layout
    page_size: str = 'A4'
    margin_top: float = 20.0
    margin_bottom: float = 25.0
    margin_left: float = 20.0
    margin_right: float = 20.0
    direction: str = 'rtl'

    # Typography
    font_family: str = 'NotoNaskhArabic'
    body_size: int = 12
    line_height: float = 2.8

    # Content structure
    include_toc: bool = False
    cover_page: bool = False
    chapter_breaks: bool = True

    # Metadata
    title: Optional[str] = None
    subtitle: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None
    publisher: Optional[str] = None
    lang: str = 'ar'

    # Header
    header_enabled: bool = True
    header_text: Optional[str] = None
    header_align: str = 'center'

    # Footer
    footer_enabled: bool = True
    footer_text: Optional[str] = 'Generated by Warraq'
    footer_page_numbers: bool = True
    footer_align: str = 'center'
    page_number_format: str = '{n}'

    # Color system
    primary_color: str = '#111827'
    text_color: str = '#1a1a1a'
    link_color: str = '#2563eb'
    accent_color: str = '#2563eb'
    code_background: str = '#1e1e2e'
    code_text: str = '#cdd6f4'
    blockquote_border: str = '#cbd5e1'
    blockquote_background: str = '#f8fafc'
    highlight_color: str = '#fef08a'
    header_color: str = '#4b5563'
    footer_color: str = '#6b7280'
    page_number_color: str = '#6b7280'
    toc_color: str = '#374151'
```

---

## Verification

- ✅ Module imports cleanly
- ✅ PDF generation end-to-end via `/api/markdown/to-pdf`
- ✅ Cover page + TOC + body, no block overlap
- ✅ PDF metadata injected correctly
- ✅ HTML free of raw Markdown artifacts
- ✅ Frontend UI with tabs compiles without errors in MarkdownToPDFTool.tsx

---

## Known Issues & Notes

1. **Dynamic running chapter headers**: CSS `string-set`/`running()` is not reliable in Chromium. Per-page chapter headers in the margin require PyMuPDF post-processing (not yet implemented).

2. **PyInstaller `.exe`**: `dist/pdf_server.exe` must be rebuilt with `pyinstaller pdf_server.spec` after dependency or code changes.

3. **Server restart required**: If you still see raw `**` or overlapping lines, an old server process is still in memory. Clear `__pycache__` and restart `python server.py`.

4. **Visual verification recommended**: PyMuPDF text extraction returns scrambled Arabic for shaped glyphs. Always verify the PDF visually in a PDF reader.
