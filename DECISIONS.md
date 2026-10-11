# Decision Log

Record durable project decisions here. Add new entries at the top with date, decision, and rationale. Revisit a decision explicitly if requirements or evidence change.

## 2026-10-11 — Keep the existing PDF rendering stack for reader improvements

**Decision:** Continue with React + `react-pdf` / PDF.js for the interactive reader and PyMuPDF for backend PDF operations. Use PdfCraft as a design reference only.

**Rationale:** Matn already has a working Tauri, React, and FastAPI/PyMuPDF architecture. Replacing it with PdfCraft's Rust application/engine would be a larger integration or rewrite, while the requested reader and comments improvements can be implemented within the current stack.

## 2026-10-11 — Keep app-stored notes distinct from annotations embedded in PDFs

**Decision:** The reader must clearly distinguish Matn's SQLite-backed annotations from native annotations already stored inside a PDF. Any unification must define import, ownership, duplicate handling, and export behavior before changing persistence.

**Rationale:** These are currently separate workflows and data sources. Treating them as interchangeable risks hiding or losing user annotations.

## 2026-10-11 — Evolve annotation storage compatibly

**Decision:** Preserve the ability to load existing point annotations when adding passage anchors, replies, or resolved state. Prefer optional fields or a migration with a safe fallback.

**Rationale:** Existing records are user data; new reader capabilities must not invalidate saved notes.

## Open questions

- Confirm the canonical public brand/name across the app. The user and README use “Matn”; some existing project files use “Warraq”.
- Decide whether app-stored annotations should eventually sync across devices; current architecture is local-first.
- Decide default export behavior for native annotations versus flattened/burned appearance.
