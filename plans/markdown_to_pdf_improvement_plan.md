# Markdown to PDF: Analysis and Improvement Plan

**Reviewed:** 2026-10-11  
**Scope:** `MarkdownToPDFTool` → `/api/markdown/to-pdf` → `MarkdownService` → Chromium/PyMuPDF output.  
**Goal:** Make a polished Arabic-first PDF from one or more Markdown files with fewer choices, predictable structure, readable output, and trustworthy failure handling.

## Current flow

1. The React tool accepts multiple `.md` paths and asks the user to choose a PDF output path.
2. Four tabs expose typography, metadata and structure, header/footer, and color controls. Some structure and page furniture are subscription-gated.
3. The browser sends every setting in one JSON request. The UI aborts after a fixed timeout.
4. FastAPI verifies that the input paths exist, runs the synchronous conversion in a worker thread, and returns the output path.
5. The service reads UTF-8 Markdown, separates source files with an internal boundary, renders HTML with markdown-it and embedded fonts, prints with Chromium, then adds PDF metadata and bookmarks with PyMuPDF.

## Findings, ranked by user impact

### P0 — Content boundaries and structure

- The service joins files with a Markdown horizontal rule and then splits the resulting text on every horizontal rule. Ordinary author content can therefore become a new chapter, and bookmarks can be assigned to the wrong source filename. The `chapter_breaks` option also fails to suppress breaks for later sections because the class condition marks every later section as a chapter unconditionally.
- The converter now uses a private source-file boundary, so horizontal rules remain visible Markdown content and each selected input file maps to one section. `chapter_breaks` now controls page breaks between those sections.
- Acceptance: a source containing one horizontal rule remains one section; multiple source files preserve their input order; turning chapter breaks off removes forced breaks between files.

### P0 — Failure and overwrite safety

- The frontend timeout was 60 seconds regardless of input size. A timeout can leave the user unsure whether a long conversion completed, while Chromium can still be running server-side.
- The frontend now allows up to ten minutes and reports that limit clearly. The service creates the destination directory when needed and rejects an empty readable input list.
- Future work: convert to a sibling temporary file, validate the finished PDF, then atomically replace the destination. Add cancellation/progress through a task ID so a client timeout does not leave invisible work.
- Acceptance: an absent destination folder is created; missing/unreadable inputs return a useful error; an existing valid PDF is preserved if a conversion fails before finalization.

### P1 — First-run ease

- Users must set an output path before the primary action works, even though a sensible name and folder are available from the first input.
- Many fine-grained choices appear before the user has a quick path to a good default.
- The UI now suggests `<first markdown filename>.pdf`, pre-fills an empty title from that filename, deduplicates repeated selections, and offers Arabic reading, compact, and English presets. The user can still choose a different save path and adjust individual settings.
- Future work: persist user presets and last-used choices; show selected-file order with drag reordering; let users remove all files with one action; distinguish the recommended path from a manually selected path.
- Acceptance: selecting one Markdown file provides a ready-to-run output path; applying a preset updates all fields it claims to control; manually changed fields remain editable.

### P1 — PDF navigation and output quality

- The optional visual TOC is extracted with a simple line regex. It ignores setext headings and inline formatting, displays raw source syntax, has no destinations or page numbers, and may diverge from the actual rendered headings. The PDF outline is built later from hidden markers, so the visual TOC and PDF bookmarks have separate sources of truth.
- Tables and code blocks are styled, but long tables/code blocks are declared `page-break-inside: avoid`, which can create large whitespace or awkward overflow. Relative images from Markdown files have no per-source base path in the current `page.set_content` flow.
- Future work: derive one normalized heading model from Markdown-it tokens and use it for rendered IDs, visual TOC, and PDF outline; add clickable entries and page numbers after pagination; improve code/table splitting; resolve local image paths relative to each source file and embed or safely load them.
- Acceptance: ATX and setext headings, inline emphasis, Arabic titles, and duplicate heading names appear correctly and in the same order in page content, visual TOC, and PDF outline; local images render from each file's directory; long blocks paginate without clipping.

### P1 — HTML and option safety

- Markdown raw HTML is enabled for authored markup and callouts. User-entered cover/header/footer text and TOC labels were interpolated into HTML. Dynamic cover/header/footer/TOC text is now HTML-escaped, and JavaScript is disabled in the print page.
- Color strings and numeric layout values used to be accepted with limited validation. The service now validates page size, direction, alignment, dimensions, font size, line height, cover mode, and hex colors; malformed values return HTTP 400. Remote requests should be blocked unless explicitly needed. Local images should be embedded rather than granting arbitrary file access.
- Acceptance: text fields render literal markup as text; malformed colors and out-of-range dimensions return a clear client error; scripts do not execute and remote requests from source Markdown do not load.

### P2 — Long-job observability and consistency

- Conversion is one synchronous request and gives only a generic spinner. Metadata/bookmark application catches all errors and only prints a message, so the UI may say success even if the PDF outline was not applied.
- Future work: background task/progress/cancel support; actionable stage messages (reading, rendering, finalizing); report partial-quality outcomes; verify the output opens and include page count/size in success details.
- Acceptance: long jobs show current stage and can be cancelled; the result distinguishes full success from PDF success with optional navigation metadata omitted; the final path can be opened directly.

## Delivery plan

### Phase 1 — Reliability and quick path (started)

- [x] Preserve horizontal rules and use source-file boundaries for chapters.
- [x] Make chapter-break behavior match its option.
- [x] Escape dynamic cover, header/footer, and TOC text.
- [x] Disable JavaScript in the Chromium print page.
- [x] Validate layout and color options on the server.
- [x] Suggest an output path and title from the first selected file.
- [x] Add fast layout presets and a longer, clearly reported client timeout.
- [ ] Validate all API options and CSS color values on the server.
- [ ] Write to a temporary PDF, verify it, and atomically replace the target.

### Phase 2 — Document fidelity

- [ ] Build a single heading/anchor model from parser tokens.
- [ ] Add linked visual TOC entries and PDF page numbers from final pagination.
- [ ] Resolve images relative to the Markdown file that contains them.
- [ ] Tune long code/table pagination and test mixed Arabic/English text, lists, footnotes, and links.

### Phase 3 — Guided workflow

- [ ] Add file reorder controls and clear/remove actions.
- [ ] Persist the last-used preset and user-defined presets.
- [ ] Add a page preview and compact summary of the current design before conversion.
- [ ] Add a single recommended “make PDF” path with advanced options collapsed by default.

### Phase 4 — Large jobs and diagnostics

- [ ] Move conversion into the existing background-task pattern with progress and cancellation.
- [ ] Return output metadata (page count, size, warnings) and distinguish optional bookmark failures.
- [ ] Add automated unit/visual coverage for structure, Arabic typography, pagination, malformed input, and failed output writes.

## Risks and compatibility

- The output filename suggestion is a convenience only; a manually selected path always wins. For multiple inputs, the first file determines the suggested name and directory.
- Existing API field names and defaults remain unchanged. The source boundary is internal to the conversion service.
- A full visual TOC page-number implementation depends on final PDF pagination and should not be approximated from the source line count.
- Raw HTML compatibility must be considered before disabling HTML globally; a safer restricted renderer is preferable to silently removing supported author markup.

## Current implementation note

Phase 1 is partially implemented in the service and UI. The remaining validation, atomic output, TOC fidelity, image resolution, and task progress work should be delivered as separate increments and added to `BACKLOG.md` when scheduled.
