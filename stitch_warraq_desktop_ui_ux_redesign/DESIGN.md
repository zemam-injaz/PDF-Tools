---
name: Warraq Desktop Workspace
colors:
  surface: '#f9f9ff'
  surface-dim: '#d0daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff3ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fd'
  surface-container-highest: '#d9e3f7'
  on-surface: '#121c2a'
  on-surface-variant: '#444653'
  inverse-surface: '#273140'
  inverse-on-surface: '#ebf1ff'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3755c3'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#1e40af'
  on-primary-container: '#a8b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#003c36'
  on-tertiary: '#ffffff'
  tertiary-container: '#00554e'
  on-tertiary-container: '#5fcdbf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#173bab'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#f9f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f7'
typography:
  headline-xl:
    fontFamily: IBM Plex Sans
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.005em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.6rem
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.375rem
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
  label-sm:
    fontFamily: IBM Plex Sans
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is tailored for an Arabic-first desktop productivity environment, balancing technical precision with classical document reverence. The aesthetic combines the disciplined ergonomics of high-end desktop utilities (Raycast, Linear, Craft) with native right-to-left typographic hierarchy.

### Personality & Tone
- **Subdued & Scholarly:** The interface recedes entirely, allowing user documents, annotations, and processing pipelines to command focus.
- **Utilitarian & Tactile:** Fast keyboard-first workflows, micro-interactions with immediate feedback, and dense informational layouts without clutter.
- **Crafted Border-First Geometry:** Visual hierarchy relies on structured panels, hairline dividers, and muted tonal shifts rather than dramatic blurs or decorative gradients.

### Design Movement
**Structured Desktop Modernism (Border-First & Tonal):** Grounded in crisp 1px structural outlines, warm off-white neutral canvases, high-legibility slate typography, and measured Indigo-Slate accents for focal selection and active execution states.

## Colors

The palette is engineered specifically for extended document reading and processing sessions under desktop ambient lighting. It enforces strict contrast ratios for fine Arabic stroke details and technical tabular data.

### Palette Architecture
- **Primary (`#1E40AF`):** Deep cobalt-indigo. Used for dominant interactions, active tab indicators, and primary action buttons.
- **Secondary (`#3B82F6`):** Vibrant precision blue. Used for keyboard focus rings, active selection states, and running background threads.
- **Tertiary (`#0D9488`):** Deep pine teal. Used for verified document signatures, completed OCR processes, and success tags.
- **Neutral (`#374151`):** Dense charcoal-slate. Provides rich text contrast without the eye strain of pure `#000000`.

### Surface & Border Scale
- **App Canvas Base:** `#F8F9FA` (subtle warm-tinted paper gray).
- **Surface Elevation 1 (Panels, Sidebars):** `#F3F4F6`.
- **Surface Elevation 2 (Cards, Viewport Viewers):** `#FFFFFF`.
- **Structural Borders:** `#E5E7EB` (neutral hairline).
- **Interactive/Hover Borders:** `#CBD5E1`.
- **Tinted Selection Surfaces:** `#EFF6FF` (subtle 4% blue wash for selected rows and multi-item boundaries).

### Status Tones
- **Success:** Surface `#F0FDF4`, Border `#BBF7D0`, Text `#15803D`.
- **Warning:** Surface `#FFFBEB`, Border `#FDE68A`, Text `#B45309`.
- **Error:** Surface `#FEF2F2`, Border `#FECACA`, Text `#B91C1C`.
- **Running / Queued:** Surface `#EFF6FF`, Border `#BFDBFE`, Text `#1D4ED8`.

## Typography

The typographic engine bridges native Naskh-influenced Arabic typography (`IBM Plex Sans Arabic` fallback to `IBM Plex Sans`) with strict monospaced Latin data (`JetBrains Mono`).

### Typography Rules
1. **Vertical Rhythm in RTL:** Arabic glyphs possess larger ascenders and descenders compared to standard Latin typography. Body line heights are set to a minimum of `1.5` to `1.6` times the font size to prevent character overlap (particularly in Tashkeel and complex ligatures).
2. **Bidirectional Coexistence:** Latin text snippets, file sizes (`14.2 MB`), keyboard shortcuts (`⌘ + P`), document paths (`/var/data/doc.pdf`), and hash digests must force `direction: ltr; unicode-bidi: isolate;` and leverage `JetBrains Mono` for rapid scanning.
3. **Tabular Numerals:** All body and label instances displaying page numbers, timestamps, coordinates, or byte sizes must enforce `font-variant-numeric: tabular-nums;`.

## Layout & Spacing

Layout geometry follows standard multi-pane desktop productivity patterns (Sidebar / List / Canvas / Inspector) within a Tauri window frame.

### Layout Philosophy
- **Three-Pane Desktop Shell:** Fixed collapsible navigation sidebar (240px default), resizable secondary list/queue pane (280px–360px), and fluid document canvas viewer.
- **Native Titlebar Integration:** A custom drag region at the top (38px height) hosting window controls (flipped to match RTL desktop conventions when localized), document title badge, and local Python worker status.
- **RTL Fluidity:** Grid gutters and component margins start from the right edge. Flex and CSS Grid layouts use logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline`) to ensure deterministic alignment across mixed locales.
- **Density:** Spacing tokens prioritize compact information throughput. Dense table listings use `space-xs` and `space-sm` vertical cell padding.

## Elevation & Depth

This system intentionally rejects deep multi-layered shadows and blurred glassmorphism. Depth is expressed structurally through flat surface layering, border contrast, and minimal tactile micro-drop shadows.

### Elevation Levels
- **Base Canvas (Level 0):** `#F8F9FA` background with zero shadow.
- **Flat Panels & Sidebars (Level 1):** `#F3F4F6` separated by an invariant `1px solid #E5E7EB` border.
- **Elevated Cards & Viewers (Level 2):** `#FFFFFF` surfaces with `1px solid #E5E7EB` and an ultra-subtle grounding shadow: `0 1px 2px 0 rgba(0, 0, 0, 0.04)`.
- **Overlays, Popovers, & Dropdowns (Level 3):** `#FFFFFF` surface, `1px solid #CBD5E1`, with directional desktop utility shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)`.
- **Modals & Command Palette (Level 4):** Anchored modal layer with a semi-opaque `#0F172A` backdrop at 20% opacity. Box shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.

## Shapes

The design system uses deliberate, modest corner radii (`0.25rem` to `0.375rem` / 4px to 6px) to emulate native desktop applications.

### Geometric Rules
- **Standard Controls (Inputs, Buttons, Badges):** `4px` to `6px` radius (`roundedness: 1`).
- **Cards, Document Panels, & Canvas Viewports:** `6px` to `8px` max radius.
- **Modals & Command Menus:** `8px` to `10px` max radius.
- **Strict Prohibition:** Full pill shapes (`9999px`) are forbidden for buttons and standard inputs to preserve the structured architectural aesthetic. Only inline status pills may employ semi-rounded pill caps.

## Components

### Buttons
- **Primary:** Background `#1E40AF`, text `#FFFFFF`, border `1px solid transparent`. Hover: `#1D4ED8`. Active: `#1E3A8A`. Internal padding: `0.375rem 0.75rem`.
- **Secondary / Ghost:** Background `#FFFFFF`, text `#374151`, border `1px solid #E5E7EB`. Hover: `#F9FAFB` and border `#D1D5DB`.
- **Destructive:** Background `#FEF2F2`, text `#B91C1C`, border `1px solid #FECACA`. Hover: `#FEE2E2`.
- **Keycap Badges in Buttons:** Monospaced keyboard shortcut badges embedded inside buttons appear on the opposite physical edge (start-aligned in RTL), using subtle gray text and a light border (`#E5E7EB`).

### Inputs & Search Bars
- Background `#FFFFFF`, border `1px solid #D1D5DB`, border-radius `6px`, text `#111827`.
- Height: Compact 32px for filters and toolbars; 36px for primary form controls.
- Focus state: `1px solid #3B82F6` accompanied by an outer box-shadow ring `0 0 0 2px rgba(59, 130, 246, 0.15)`.
- Directional adornments: Search and clear icons respect `inline-start` and `inline-end` layout slots.

### Data Tables & Document Lists
- Row borders: Hairline `1px solid #F3F4F6`.
- Active/Selected Row: Background `#EFF6FF` with an accent bar along the start edge (`3px solid #1E40AF`).
- Hover Row: Background `#F9FAFB`.
- Column Headers: Text color `#6B7280`, uppercase equivalent for typography, tracking relaxed, height 28px.

### Status Indicators & Chips
- Compact tag component (height 20px) featuring a 6px status dot alongside Arabic status text (`مكتمل`, `قيد المعالجة`, `فشل`).
- Running jobs (OCR, vector embedding, PDF compilation) display a non-distracting pulse indicator using `#3B82F6`.

### PDF Viewport & Canvas Controls
- Floating dock toolbar at bottom-center: Background `#FFFFFF`, border `1px solid #E5E7EB`, elevation Level 3.
- Page thumbnail strip: Thumbnails flanked by a `1px solid #E5E7EB` frame, highlighting the selected page with an active `#1E40AF` border outline.