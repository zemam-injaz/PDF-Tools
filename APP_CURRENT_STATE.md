# Warraq (وراق) — Current App State

**Built**: Tauri v2 + React 19 + Python FastAPI + PyMuPDF  
**Target**: Arabic-speaking users (RTL UI, Tahweel OCR integration)  
**Payment**: PayMob — 30-day trial, feature gating per plan

---

## 19 Frontend Tools (all working)

### PDF Tools (15)

| Tool | Description |
|------|-------------|
| **Merge PDF** | Merge multiple PDFs into one |
| **Split PDF** | Split at page boundaries with visual thumbnail + chapter-aware split |
| **Compress PDF** | Compress at configurable levels (1-4) |
| **Extract Images** | Extract all embedded images from PDF |
| **Text Extract** | Extract text → TXT / DOCX / Markdown with page range, line merging |
| **Bookmark Manager** | Extract, insert, split-by-chapter, transfer between PDFs, parse TOC, hierarchy display |
| **Rotate Pages** | Rotate pages 90°/180°/270° with visual selector |
| **Delete Pages** | Delete selected pages with visual selector |
| **Extract Pages** | Extract selected pages into new PDF |
| **Watermark** | Add text/image watermark (position, opacity, font, rotation) + remove |
| **Remove Security** | Remove PDF password/restrictions |
| **Images → PDF** | Combine images into PDF (reorderable) |
| **PDF → Images** | Convert pages to PNG/JPG at configurable DPI |
| **Metadata Editor** | Read/edit title, author, subject, keywords |
| **Visual Page Selector** | Thumbnail grid for selecting pages across tools |

### Reading & Library Tools (4)

| Tool | Description |
|------|-------------|
| **Book Library** | Full CRUD library: add/remove/search books, track pages read & completion %, star/favorite, categories, statuses (To Read / Reading / Read), notes |
| **Comments & Annotations** | Scan directories for PDFs, extract/display/export all annotations & highlights to Markdown, burn annotations into PDF, reading statistics |
| **Chapter Weight Analysis** | Scan folders with hierarchical tree & page counts; analyze chapter weights within a PDF; generate reading plans with **spaced repetition scheduling**; interactive calendar with completion checkboxes; Persian/Arabic locale toggle; ICS calendar export including reviews; history saved to localStorage |
| **Reading Speed Trainer** | RSVP speed reader: adjustable WPM (100–1000+), supports PDF text & Markdown, session history with charts, reading statistics |

### Premium / Gated Features

Tahweel (Google OCR), Watermark editing, Remove Security, Text extraction to file, Speed Reading Trainer, Pro statistics. Unlocked during 30-day free trial, restricted on free plan.

---

## Subscription & Payment (built)

| Feature | Details |
|---------|---------|
| **Plan levels** | free / trial (30-day) / monthly (49 EGP) / yearly (299 EGP) / lifetime (899 EGP) |
| **Feature gating** | Granular flags per feature, checked via React context |
| **Payment** | PayMob integration — checkout session, HMAC webhook, auto-fulfill |
| **Trial** | Auto-created on first launch, countdown banner |
| **Storage** | SQLite — users, subscriptions, books, annotations, progress, reading sessions |

---

## Interactive PDF Viewer (built)

Embedded viewer (`react-pdf`) with zoom, fullscreen, page navigation, and annotation tools: text labels (Arabic/English), colored dots, timestamps. Annotations can be burned into a PDF copy.

---

## Backend Services (14 Python services)

PDF ops, Text extraction, Bookmarks, Pages, Watermark, Security, Annotations, Annotation burn, Book library, Progress scanning, Tahweel OCR, Subscriptions, Payments, Background task system.

---

## What's NOT built yet (from PLAN.md)

- Crop PDF            — `set_mediabox` not exposed
- Page Numbers / Header & Footer
- Reverse Pages / Add Blank Page
- Invert Colors / Dark Mode
- OCR PDF (native, non-Google) — Tesseract integration
- PDF → Word / Excel / CSV
- Redact (hide sensitive data)
- Batch Processing
- PDF Form Filler + Create Form
- Digital Signature
- Table of Contents Generation
- AI features (summarize, translate, smart extract)
- PDF Comparison
- PDF → Markdown / AI-Ready Export
