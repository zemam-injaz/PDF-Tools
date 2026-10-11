# Project Status

Last reviewed: 2026-10-11

## Current state

Matn is an actively developed Tauri + React desktop PDF workspace with a Python FastAPI/PyMuPDF backend. The repository includes PDF manipulation tools, a book library, reading-related tools, bookmark operations, annotation storage, directory scanning, and annotation export/burn workflows.

## Reader baseline

- `react-pdf` / PDF.js renders the document and exposes text and native annotation layers.
- `InteractivePDFViewer` currently provides zoom, fullscreen, page rendering, and app-stored point annotations (text, dot, timestamp).
- `PDFPageRenderer` currently composes each page with an app overlay.
- Existing reader concerns to address: all pages are mounted together, page/layout navigation is limited, and the overlay may intercept reading interactions when no annotation tool is active.

## Comments baseline

- `CommentsTool` scans PDFs and reads native PDF annotations for listing/export workflows.
- Interactive reader annotations are stored separately in the local SQLite database by `book_id`.
- Current app-stored annotation records contain page, normalized x/y, type, JSON data, and creation time. Passage quotes, text context, replies, and resolved state are not currently part of the base model.
- Treat native PDF annotations and app-stored notes as separate sources in the UI and migration strategy.

## Current focus

Improve the reader and comment experience in phases: reader performance and interactions, navigation, passage-based comments, stable persistence, and portable export. See [REVIEW_ENHANCEMENTS_PLAN.md](REVIEW_ENHANCEMENTS_PLAN.md).

## Repository state note

The working tree may contain substantial user changes unrelated to reader work. Inspect `git status` before edits and preserve those changes. Update this status file when a meaningful milestone is completed; do not treat this snapshot as a guarantee that every listed feature is currently bug-free.
