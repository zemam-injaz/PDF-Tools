# Warraq UI Enhancement Plan

## Purpose

Make Warraq feel like a production desktop workspace for Arabic-first PDF work. The redesign should reduce the time from opening the app to starting a task, make long-running operations easy to understand, and give reading and library workflows a clear home without hiding the PDF tools.

This plan is for the existing Tauri + React application. It preserves the current tool implementations and focuses on information architecture, visual hierarchy, states, and interaction patterns.

## Current UI Diagnosis

The current app has strong functional coverage, but the experience is difficult to scan:

- The home screen presents a large hero followed by two grids containing more than twenty tools.
- The sidebar repeats most of the same tools, so users must choose between two navigation models.
- Tool cards use hover movement, gradients, shadows, and decorative effects that compete with the task itself.
- The dark sidebar combines navigation, plan status, legal links, and version information in one vertical surface.
- The task monitor is useful but appears as a floating utility rather than part of a coherent activity model.
- Arabic-first content is present, but some labels and navigation metadata remain English or mixed-language.
- The app has no obvious recent-files or “continue where you left off” surface.

## Product Direction

Position Warraq as a local document workspace, not a collection of isolated utilities.

Primary user promise:

> اختر ملفك، ثم نفّذ العمل الذي تريده بسرعة ووضوح، مع بقاء ملفاتك على جهازك.

The first screen should answer three questions immediately:

1. What can I do now?
2. Which files or tasks did I use recently?
3. What is currently processing or waiting for attention?

## Information Architecture

Use four primary destinations:

1. **الرئيسية** — quick actions, recent files, active tasks, and a compact privacy note.
2. **أدوات PDF** — grouped tools with search and category filters.
3. **المكتبة** — books, reading progress, notes, bookmarks, and reading tools.
4. **المهام** — active, completed, and failed background operations.

Keep privacy policy, terms, settings, and plan management in a secondary account/settings area. Do not place them alongside daily tools.

Suggested PDF tool groups:

| Group | Tools |
|---|---|
| Organize | Merge, split, extract pages, reorder, rotate, delete pages |
| Convert | Text extraction, PDF to images, images to PDF, Markdown to PDF, OCR |
| Improve | Compress, clean, crop, invert colors, metadata, page numbers |
| Protect | Watermark, remove security, redact |
| Inspect | Extract images, extract tables, bookmarks, annotations |

## Screen Plan

### 1. Home workspace

- Compact top bar with Warraq identity, search, task status, and plan status.
- A primary “ابدأ بملف” drop zone with file picker and recent-file shortcuts.
- Four to six quick actions only: دمج, تقسيم, ضغط, استخراج النص, OCR, فتح المكتبة.
- Recent files list with file name, last action, modified time, and an explicit open action.
- Active task strip showing progress, pause/cancel where supported, and an “عرض كل المهام” action.
- Small trust statement: “تتم معالجة أدوات PDF محلياً على جهازك.” Avoid promotional hero copy.

### 2. PDF tools directory

- Search field with keyboard shortcut.
- Category tabs or segmented control.
- Dense rows or compact cards with icon, Arabic label, one-line description, and recent-use marker.
- Premium tools show a small lock/status indicator only when access is unavailable.
- Keep the directory useful at 1100px desktop width and usable when the sidebar is collapsed.

### 3. Tool workspace

Every tool should share one shell:

- Breadcrumb/back action and clear tool title.
- Input area on the right for RTL: file drop zone, selected files, ordering controls.
- Options area with progressive disclosure; show only the settings that matter for the common case.
- Sticky action footer with primary action, reset, and output location.
- Result state with file name, open, reveal, copy path, and run again actions.
- Error state with a human explanation, recovery action, and technical detail behind disclosure.

### 4. Library

- Library header with search, filters, and “إضافة كتاب”.
- Reading status tabs: الكل, للقراءة, قيد القراءة, مكتمل.
- Book rows/cards with cover, title, progress, last opened, star, and context menu.
- Empty state that explains the next action and supports adding a folder or file.

### 5. Tasks

- Full-page task history with status filters.
- Progress, start time, elapsed time, output, retry, cancel, and remove-history actions.
- Preserve the compact floating indicator for background awareness, but make it a doorway to this screen.

## Visual System

Use a restrained, document-tool palette:

- Canvas: warm-neutral light gray, not a saturated gradient.
- Surface: white with a subtle border.
- Text: charcoal for primary, neutral gray for secondary.
- Accent: one muted indigo or blue for focus and primary actions.
- Status colors: green success, amber attention, red error, all with text/icon support.
- Dark charcoal sidebar is acceptable, but it should be quieter and less visually dominant.

Remove from primary surfaces:

- Large gradient hero blocks.
- Blurred decorative circles and glassmorphism effects.
- Hover scale animations on tool cards.
- Multiple competing purple/indigo accents.

Use 4–8px radius, 8px spacing increments, visible focus rings, and stable control dimensions. Icons should be Lucide icons with tooltips when the label is hidden.

## Typography and RTL

- Keep IBM Plex Sans Arabic as the UI default.
- Use Arabic labels first; retain English only for product names such as Warraq, Tahweel, PDF, OCR, DOCX, and Markdown.
- Align primary content right-to-left while keeping file paths, license keys, numbers, and technical values left-to-right.
- Avoid all-caps English section headings in the main navigation.
- Test Arabic line wrapping at 320px, 768px, and 1280px widths.

## Interaction Requirements

- File drop areas must also support a visible file-picker button.
- Every async operation needs idle, validating, running, success, cancelled, and failed states.
- Never make progress the only success signal; show the output file and next action.
- Confirm destructive actions such as delete pages, redact, remove security, and watermark removal.
- Preserve selected files and options when a recoverable error occurs.
- Support keyboard navigation, Escape to close overlays, and Enter/Space activation for controls.
- Keep the sidebar collapsed state persistent.

## Freemium Presentation

Use a free-first presentation:

- Free tools should be fully usable without a blocking upgrade screen.
- Premium access should be explained at the point of need with the feature name and value.
- The plan status component belongs in the account/settings area and as a compact top-bar badge.
- Do not place a large upgrade banner above every workflow.
- Keep pricing copy consistent with the actual Gumroad product and currency shown at checkout.

## Delivery Phases

### Phase 1: Foundation

- Define design tokens and shared components: AppShell, PageHeader, FileDropZone, ToolCard, TaskStatus, EmptyState, and ResultPanel.
- Replace the home hero with the workspace layout.
- Add responsive sidebar behavior and a single navigation model.

### Phase 2: Core workflows

- Migrate merge, split, compress, extract text, and OCR to the shared tool shell.
- Add recent files and task summaries.
- Standardize loading, error, success, and output actions.

### Phase 3: Library and task history

- Rework Book Library and reading tools into the library destination.
- Promote TaskMonitor into the task history screen.
- Add empty states, filters, and recovery actions.

### Phase 4: Monetization and polish

- Add contextual premium states.
- Finalize legal/settings placement.
- Verify RTL, keyboard access, contrast, reduced motion, and small-window behavior.

## Acceptance Criteria

- A new user can start Merge, Split, or Compress within two interactions from the home screen.
- The first viewport shows a useful action area and recent work without a marketing hero.
- Users can find any tool through search or a named category.
- Every core workflow has consistent idle, running, success, and failure states.
- No primary text or controls overlap at 320px, 768px, or 1280px widths.
- The interface remains understandable with the sidebar collapsed.
- Arabic labels, file paths, numbers, and mixed-language product names render correctly.
- Premium prompts appear only when a gated feature is selected or needed.

## Handoff Output

The redesign agent should return:

- A desktop-first responsive design system.
- Screens for Home, PDF Tools, Tool Workspace, Library, Tasks, Pricing/Plan, and Settings.
- Component states for loading, empty, error, success, disabled, premium-locked, and offline.
- RTL and LTR examples for file paths and technical values.
- Token definitions for color, type, spacing, radius, elevation, and motion.
- A component-to-code mapping that can be implemented in the existing React/Tailwind codebase.
