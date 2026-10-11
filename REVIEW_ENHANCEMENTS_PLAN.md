# Reader and Comments Enhancement Plan

## Objective

Make Matn's PDF reader comfortable for long-form reading and make comments easy to anchor to, find, revisit, and export. Retain the existing React/PDF.js frontend and PyMuPDF/FastAPI backend. PdfCraft is a reference for reader workflows and modular architecture, not a runtime dependency.

## Guiding requirements

- Arabic-first RTL experience with correct selection and reading order for Arabic and mixed-script documents.
- Fast rendering for long PDFs; never require all pages to be mounted simultaneously.
- Text selection and copying work in reading mode.
- Annotation tools capture pointer input only while active.
- Existing Matn notes remain readable and editable.
- Native PDF annotations and Matn database annotations remain distinguishable.
- New persistence is backward compatible and robust to zoom/layout changes.
- Export preserves portable annotations where supported and makes flattening an explicit choice.

## Phase 0 — Baseline and implementation map

**Scope**

- Read repository instructions and inspect the current UI-to-API-to-database flow.
- Confirm current `react-pdf` and PDF.js APIs/dependency versions before selecting rendering or text-selection techniques.
- Identify the existing book identity, progress storage, bookmark extraction, export operations, and any annotation database migration conventions.
- Keep unrelated working-tree changes intact.

**Exit criteria**

- The implementation map and compatibility risks are understood before modifying data or viewer behavior.

## Phase 1 — Reader foundation and interaction correctness

**Primary files**

- `src/components/viewer/InteractivePDFViewer.tsx`
- `src/components/viewer/PDFPageRenderer.tsx`
- `src/components/viewer/AnnotationOverlay.tsx`
- Relevant toolbar and reader state/storage modules.

**Scope**

- Render only visible pages and a small neighborhood around them; select a virtualization approach compatible with `react-pdf`.
- Add page count/current page display and direct page-number navigation.
- Add fit-width and fit-page controls alongside zoom.
- Support continuous, single-page, and two-page layouts.
- Preserve the current reading location through zoom and layout changes, accounting for pages of different sizes.
- Persist last-read page and useful reader preferences per book using existing storage conventions.
- Make annotation SVG overlays ignore pointer events when no annotation tool is active; keep text, link, and native annotation layers usable.
- Keep the canvas, text layer, PDF annotation layer, and Matn overlays aligned at all zoom levels.

**Acceptance criteria**

- A long document does not mount every page at once.
- Page jump, scrolling, zoom, and layout changes do not unexpectedly lose the reader's place.
- Text selection and copy work in reading mode.
- Explicitly activated annotation tools still place annotations accurately.

## Phase 2 — Navigation and reading controls

**Primary files**

- `src/components/viewer/InteractivePDFViewer.tsx`
- Existing bookmark API/service and appropriate viewer sidebar components.

**Scope**

- Add a collapsible navigation sidebar with page thumbnails and the PDF's hierarchical bookmarks.
- Reuse current bookmark extraction where suitable; handle documents without bookmarks gracefully.
- Synchronize current visible page with selected thumbnail/bookmark state.
- Navigate to the destination page when the user selects a thumbnail or bookmark.
- Add keyboard navigation and shortcuts consistent with existing app conventions.
- Ensure RTL direction, Arabic labels, focus order, and compact window layouts work.

**Acceptance criteria**

- A reader can navigate a long PDF by page or bookmark without leaving the viewer.
- Thumbnail/bookmark selection and scroll position remain synchronized.
- PDFs without an outline still have usable thumbnail and page-number navigation.

## Phase 3 — Passage-based annotation workflow

**Primary files**

- `src/components/viewer/InteractivePDFViewer.tsx`
- `src/components/viewer/AnnotationOverlay.tsx`
- `src/components/viewer/toolbar/AnnotationToolbar.tsx`
- `src/components/tools/CommentsTool.tsx` where integration is appropriate.
- `src/api/annotationApi.ts`
- `python-server/models/annotation.py`
- `python-server/services/annotation_service.py`
- Relevant API routes in `python-server/server.py`.

**Scope**

- Let the user select PDF text and create a highlight, underline, or note attached to that selection.
- Capture all line rectangles for multi-line selections rather than approximating a selection with a single point.
- Add a comments panel scoped to the open document with page, quote, comment text, and status.
- Selecting a comment navigates to and emphasizes the corresponding passage.
- Add reply and resolved-state support if it fits the existing schema cleanly.
- Distinguish Matn database notes from annotations extracted from the PDF itself; do not silently merge duplicates.
- Retain existing text, dot, and timestamp annotation behavior.

**Acceptance criteria**

- A comment is visually attached to its passage and is discoverable from the comments panel.
- Selecting a comment returns the reader to the right page and selection area.
- Existing stored annotations and imported native PDF annotations remain visible through their respective workflows.

## Phase 4 — Stable anchoring and data compatibility

**Scope**

- For passage annotations, persist page number, selected quote, nearby text context, and page-space geometry.
- Store coordinates in a PDF-space or otherwise zoom-independent representation; never store only screen pixels.
- Tie annotations to the app's stable document identity; avoid filename-only association where a stronger identity exists.
- Define migration/default behavior for old records that contain only page and normalized x/y.
- Handle changed, moved, or missing source files without crashing or silently discarding annotations.
- Ensure undo/redo and optimistic saves remain consistent with the backend.

**Acceptance criteria**

- Existing records load without destructive migration.
- New passage anchors remain aligned after zoom and layout changes.
- Failed saves, edits, deletes, and reloads leave the UI and database in a consistent state.

## Phase 5 — Export and reader polish

**Scope**

- Export passage highlights/notes as PDF-native annotation objects where PyMuPDF supports the required type and appearance.
- Preserve a deliberate flattened/burned export option; clearly label the difference.
- Ensure generated annotations can be extracted/reopened in common PDF readers.
- Add useful loading, empty, missing-file, and save/export error states.
- Replace blocking alerts with the app's established inline/toast/dialog patterns where practical.
- Review Arabic text selection, mixed RTL/LTR order, keyboard-only navigation, focus, and small-window behavior.
- Remove temporary diagnostic logging added during implementation.

**Acceptance criteria**

- An exported annotated copy can be reopened and its annotations remain selectable/editable where supported.
- Flattened export remains available as a separate intentional output.
- Common failures provide an understandable recovery path.

## Cross-phase risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Virtualization changes scroll behavior | Preserve a page-relative scroll anchor when pages mount/unmount and zoom changes. |
| Text layer and overlays drift | Derive geometry from PDF.js viewport transforms and test at varied zoom and page sizes. |
| Arabic selection order differs from visual order | Preserve the selected quote from PDF.js text content, inspect mixed-script selections, and avoid assuming DOM order equals reading order. |
| Legacy notes are lost during model changes | Keep legacy fields readable and make any migration additive and reversible where practical. |
| Native PDF annotations duplicate app notes | Keep source/type identifiers explicit and require deliberate import/export behavior. |
| Large PDF causes memory spikes | Render visible pages and a bounded neighbor window; release canvases when pages leave the window. |

## Completion report

When implementation is complete, summarize completed phases, key files, compatibility/migration behavior, known limitations, and validation performed. Update [STATUS.md](STATUS.md), [BACKLOG.md](BACKLOG.md), and [DECISIONS.md](DECISIONS.md) if the result changes project state or architecture.
