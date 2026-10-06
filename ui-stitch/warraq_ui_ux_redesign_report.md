# Google Stitch UI/UX Redesign Brief

## Project

Warraq (وراق) is an Arabic-first desktop PDF workspace built with Tauri, React, TypeScript, and a local Python PDF service. It supports PDF manipulation, OCR through Tahweel, document reading, book library management, annotations, reading speed practice, and background tasks.

The goal is a production-level redesign of the existing app UI. Preserve the product’s capabilities and local-first trust model while making the experience easier to scan, faster to use, and more coherent across tools.

## Current Product Evidence

The current implementation exposes:

- More than twenty PDF actions, including merge, split, compress, text extraction, OCR, page operations, watermarking, redaction, metadata, tables, and conversions.
- Reading and library workflows: books, comments, chapter weight, and reading speed.
- A dark 240px sidebar with navigation, subscription status, legal links, and version information.
- A home screen with a large indigo/purple gradient hero followed by large tool-card grids.
- A floating task monitor for active and completed background work.
- Arabic-first labels mixed with English metadata and product names.
- Light canvas, white cards, indigo/purple accents, rounded surfaces, shadows, and motion effects.

The redesign must work with the current React component model and should not assume a new backend or a new product capability.

## Design Problem

The app currently feels like a catalogue of tools instead of a document workspace. The same tools appear in both the sidebar and the home grid. The hero consumes the first viewport without helping a user choose a file or resume work. Subscription messaging is visually prominent inside navigation, while recent files, active jobs, and output recovery are not first-class surfaces.

## Design Objective

Design a calm, professional document workspace that lets an Arabic-speaking user:

1. Start a task from a file quickly.
2. Find any PDF tool through clear grouping or search.
3. Understand what is happening during long operations.
4. Recover outputs and errors without losing context.
5. Continue reading and library work from where they stopped.

## Required Direction

Use a restrained desktop productivity visual language:

- Warm-neutral canvas, white surfaces, charcoal text, one muted blue/indigo accent.
- Dense but breathable layouts optimized for scanning.
- 4–8px corner radius and subtle borders instead of large floating cards.
- Minimal motion: use transitions for state changes, not hover spectacle.
- No large gradient hero, decorative blobs, glassmorphism, or marketing-style landing composition.
- The first viewport should show the actual workspace and a hint of recent activity.

## Required Screens

### Home workspace

Include:

- “ابدأ بملف” primary drop zone with file picker.
- Six or fewer quick actions for common PDF work.
- Recent files with last action and open/reveal actions.
- Active task summary with progress and a route to task history.
- Compact local-processing/privacy note.

Suggested Arabic labels:

- ابدأ بملف
- الملفات الأخيرة
- المهام الجارية
- أدوات سريعة
- تتم معالجة أدوات PDF محلياً على جهازك

### PDF tools directory

Provide search and category navigation. Use these groups:

- تنظيم: دمج، تقسيم، استخراج صفحات، ترتيب، تدوير، حذف
- تحويل: استخراج النص، PDF إلى صور، صور إلى PDF، Markdown إلى PDF، OCR
- تحسين: ضغط، تنظيف، قص، عكس الألوان، الوصف، أرقام الصفحات
- حماية: علامة مائية، إزالة الحماية، تعتيم
- فحص: الصور، الجداول، الفهرس، التعليقات

Each tool item needs an icon, Arabic name, short description, recent-use state, and premium lock state when relevant.

### Shared tool workspace

Design one repeatable shell for every tool:

- Header with back/breadcrumb, tool name, and short purpose.
- File input and selected-file list.
- Progressive options, with advanced controls collapsed by default.
- Sticky bottom action area.
- Result panel with open, reveal, copy path, save again, and run again.
- Recoverable error state with a clear fix and expandable technical details.

### Library

Design a reading-focused library with search, status filters, cover thumbnails, progress, last-opened time, star, notes, and a context menu. Include a useful empty state for first-time users.

### Tasks

Design a full task history screen with active, completed, failed, and cancelled filters. Show progress, timestamps, output files, retry, cancel, and clear history. Keep a compact task indicator available globally.

### Plan and settings

Move subscription, legal pages, privacy, local storage, and app preferences into a secondary settings area. Use contextual premium prompts inside gated tools. The free tier should feel complete for core offline PDF work.

## Component Requirements

Return components or frames for:

- App shell with expanded and collapsed sidebar.
- Top bar with search, task status, and compact plan badge.
- FileDropZone: idle, drag-over, selected, invalid, and uploading/processing states.
- ToolCard: default, hover/focus, recent, disabled, and premium-locked.
- FileRow: default, selected, processing, success, failed, and missing-file.
- TaskRow: queued, running, paused, completed, failed, cancelled.
- ResultPanel: success, partial success, and error.
- EmptyState and first-run guidance.
- Confirm dialog for destructive actions.
- Toast/notification states.

## RTL and Mixed Text Rules

- Primary UI direction is RTL.
- Keep Arabic labels and descriptions right-aligned.
- Keep file paths, URLs, license keys, numbers, and code-like values LTR.
- Make icon placement intentional for RTL; do not mirror product logos.
- Test line wrapping with long Arabic labels and mixed Arabic/English strings.
- Provide visible focus states and keyboard order.

## Responsive Targets

Design and verify:

- 1280px desktop: full sidebar and two-column workspace where useful.
- 1024px desktop: reduced sidebar and compact tool directory.
- 768px tablet-sized window: collapsed sidebar and single-column workspace.
- 390px narrow window: stacked file input, options, and actions with no clipped text.

The app is desktop-first, but every screen must survive a small resizable window.

## Accessibility and Trust

- WCAG AA contrast for body text and controls.
- Keyboard navigation for all tools and dialogs.
- Visible focus ring independent of hover state.
- Reduced-motion mode for transitions.
- Clear destructive-action confirmation.
- Privacy copy should state that local PDF operations stay on the device, with a separate explanation for Tahweel/OCR when files leave the device.

## Monetization UX

Recommend a free-first structure:

- Core merge, split, compress, basic conversion, and reading workflows remain easy to access.
- Premium prompts appear only at the point of a gated action.
- Explain the benefit in one sentence; do not block the home screen with a sales banner.
- Pricing must use the same product names, currency, renewal, and refund language as Gumroad.

## Avoid

- A second navigation model that duplicates the sidebar.
- A giant welcome hero before the user can choose a file.
- Card-within-card layouts.
- Excessive purple/blue gradients.
- Hover scaling that shifts neighboring content.
- Tiny text for plan status, errors, or progress.
- English-only section names in an Arabic-first workflow.

## Stitch Deliverables

Please return:

1. A complete desktop UI concept for Home, Tools, Tool Workspace, Library, Tasks, Plan, and Settings.
2. A reusable design system with color, typography, spacing, radius, elevation, and motion tokens.
3. RTL-first component states and mixed-direction examples.
4. A compact responsive variant for 768px and 390px widths.
5. A redline or implementation note mapping frames to existing React components.
6. A prioritized list of visual changes that can be implemented without changing backend APIs.

## Success Measure

The redesign succeeds when a new user can start Merge, Split, or Compress within two interactions, find any tool through search or category, understand an in-progress job at a glance, and recover the output without leaving the workspace.
