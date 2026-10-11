# Matn PDF Project

## Purpose

Matn is an Arabic-first desktop PDF workspace for reading, organizing, annotating, and converting PDF documents. The current repository also contains older Warraq-branded documentation and UI references; use **Matn PDF** as the working product name because that is the name used by the user and the current README. Do not perform a broad branding change as part of unrelated work.

## Product goals

- Make reading long Arabic and bilingual PDFs comfortable and reliable.
- Keep document processing local where possible and preserve user documents.
- Provide practical PDF tools around reading, bookmarks, annotations, library management, OCR, and export.
- Maintain an Arabic-first RTL interface while supporting English documents and UI content.

## Current architecture

- Desktop shell: Tauri 2 / Rust.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion.
- PDF rendering: `react-pdf` / PDF.js.
- Backend: Python FastAPI with PyMuPDF (`fitz`), communicating with the frontend over localhost HTTP.
- Persistent data: SQLite, including book library, reading progress, subscriptions, and app-stored annotations.
- Frontend entry points: `src/App.tsx`, `src/components/`, `src/api/`, `src/lib/`.
- Backend entry points: `python-server/server.py`, `python-server/services/`, `python-server/models/`.

## Reader and annotation context

- The interactive reader is in `src/components/viewer/InteractivePDFViewer.tsx` with page composition in `PDFPageRenderer.tsx`.
- Reader overlays and annotation UI are in `src/components/viewer/`.
- Frontend annotation calls are in `src/api/annotationApi.ts`.
- Annotation data model and SQLite persistence are in `python-server/models/annotation.py` and `python-server/services/annotation_service.py`.
- The directory-scanning and native-PDF annotation workflow is surfaced in `src/components/tools/CommentsTool.tsx`.
- Existing reader notes are app-stored records; the comments scanner also reads annotations embedded in PDFs. Keep these concepts distinct unless a deliberate migration unifies their UI.

## Engineering constraints

- Prefer improving the existing React/PDF.js and PyMuPDF architecture over replacing the PDF engine.
- Treat `storytold/pdfcraft` as a product/architecture reference, not a runtime dependency or code source.
- Preserve existing API behavior and saved user data. Make schema evolution backward compatible.
- Do not overwrite or revert unrelated working-tree changes.
- Keep changes scoped to the requested feature; avoid unrelated refactors and branding changes.

## Source-of-truth order

1. The user's current request and constraints.
2. Repository instructions such as `AGENTS.md` if present.
3. This file and the project workflow in [WORKFLOW.md](WORKFLOW.md).
4. Current implementation and API behavior.
5. Historical planning/status documents, which may be stale and should be updated when relevant.

See [STATUS.md](STATUS.md), [BACKLOG.md](BACKLOG.md), [DECISIONS.md](DECISIONS.md), and [REVIEW_ENHANCEMENTS_PLAN.md](REVIEW_ENHANCEMENTS_PLAN.md).
