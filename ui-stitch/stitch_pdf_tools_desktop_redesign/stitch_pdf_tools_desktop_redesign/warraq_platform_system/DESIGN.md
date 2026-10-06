---
name: Warraq Platform System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#5148d7'
  primary: '#2a14b4'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#c1beff'
  inverse-primary: '#c3c0ff'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#00442d'
  on-tertiary: '#ffffff'
  tertiary-container: '#005e3f'
  on-tertiary-container: '#4ddda2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#372abf'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-hero:
    fontFamily: IBM Plex Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.01em
  display-hero-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
  title-card:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-nav:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  label-tag:
    fontFamily: IBM Plex Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes a high-performance, studio-grade document workspace crafted primarily for Arabic-first digital scholarship, publishing, and PDF manipulation. Rooted in the historical role of the "Warraq" (the master scribe, stationer, and manuscript conservator), the platform bridges traditional literary reverence with modern, local-first computing efficiency.

The aesthetic philosophy is **Corporate Modern with Tactile Precision and Subtle Ambient Neomorphism**. It avoids heavy skeuomorphism in favor of ultra-clean canvas backgrounds, crisp elevated cards, and a deep architectural contrast between the light workspace canvas and an authoritative dark utility navigation dock. The interface inspires confidence, precision, and tranquility during intensive reading, batch processing, and archival operations.

Key characteristics:
- **RTL Native Orientation:** Complete spatial flipping, optical alignment, and logical flow tailored specifically for modern Arabic typography and reading habits.
- **Atmospheric Brand Radiance:** Deep indigo-to-ultraviolet gradients reserved for high-impact orientation banners, primary action focal points, and active system states.
- **Architectural Surface Division:** A persistent obsidian/slate control column balanced against an airy, calm porcelain canvas.

## Colors

The system uses a balanced dual-surface structure. While the active canvas operates in a focused light mode for document legibility, the navigation architecture resides within deep midnight tones.

- **Primary (`#4338CA`) & Secondary (`#6366F1`):** Indigo and electric iris. Represents cognitive depth, intelligence, and modern processing power. Deployed across the iconic hero gradient, primary buttons, active state indicators, and subtle icon badge backgrounds.
- **Tertiary (`#10B981`):** Emerald jade. Used purposefully for success states, local execution security badges, and trial/status verification tags.
- **Neutral (`#0F172A`):** Deep slate/obsidian. Forms the dark navigation column (`#111827` to `#0B0F19`), high-contrast body typography (`#1E293B`), and foundational structural borders (`#E2E8F0` on canvas, `#1F2937` on dark rails).

### Functional Color Applications
- **Canvas Base:** `#F8FAFC` — a soft, glare-reducing off-white tuned for sustained reading.
- **Card Surface:** `#FFFFFF` with whisper-soft borders (`rgba(15, 23, 42, 0.06)`).
- **Dark Navigation Rail:** `#111827` with muted slate links (`#9CA3AF`) and bright white active labels (`#FFFFFF`).
- **Accent Badges & Icons:** Dual-layer tinting using 8% opacity indigo fills (`rgba(99, 102, 241, 0.08)`) with concentrated `#4F46E5` stroke and glyph fills.

## Typography

Typography is set exclusively in **IBM Plex Sans** (paired seamlessly with IBM Plex Sans Arabic in implementation). This geometric humanist structure provides exceptional baseline stability and distinct legibility for Arabic technical phrases, Latin loanwords (such as "PDF", "OCR", "DOCX"), and alphanumeric data.

Key typographical guidelines:
- **Baseline Correction:** Arabic letterforms naturally require slightly more vertical breathing room than Latin glyphs. Line heights are calibrated 10–15% higher to prevent accent clipping and diacritical collisions.
- **Hierarchical Balance:** Document headers and hero banners utilize bold weights (`700`), while utility card titles rely on semi-bold (`600`) to remain sharp even when surrounded by descriptive body text.
- **Bilingual Harmony:** When English abbreviations accompany Arabic labels, use identical optical sizing without altering line-height metrics.

## Layout & Spacing

The layout is built upon a **Fluid RTL Workspace Grid** anchored by a fixed right-hand navigation dock on wide viewports.

- **Main Navigation Rail:** A fixed 260px right-hand panel (in RTL) housing brand meta-information, workflow categories, active subscription telemetry, and system controls. Collapsible to 72px for expanded document editing views.
- **Content Canvas:** Fluid area anchored by a maximum width container (`1440px`) to preserve human eye-span across widescreen monitors.
- **Grid Architecture:** 
  - **Desktop (≥1200px):** 4-column tool grid for PDF utilities; 24px gutter and 40px outer canvas margin.
  - **Tablet (768px – 1199px):** 2-column or 3-column tool grid; 20px gutter and 24px canvas margin.
  - **Mobile (<768px):** Single-column stacked or 2-column compact grid; bottom sheet navigation replaces the dark dock.

Spacing follows an 8pt metric scale (`0.25rem` to `2rem`). Visual separators between functional clusters (e.g., Reading Tools vs. File Manipulation Tools) must maintain a minimum distance of `space-xl` (32px) preceded by a vertical brand marker pill.

## Elevation & Depth

This design system avoids loud dropped shadows, utilizing instead **Subtle Ambient Shadows combined with Crisp Low-Contrast Outlines** to mimic high-grade archival cards and precision desktop utility windows.

- **Surface Level 0 (Canvas):** Pure `#F8FAFC`, non-elevated.
- **Surface Level 1 (Tool Cards & Containers):** `#FFFFFF` surface with a delicate outer boundary (`1px solid rgba(15, 23, 42, 0.05)`) and a diffused resting shadow: `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.02)`.
- **Surface Level 2 (Interactive Hover / Modals):** On hover, cards subtly rise with smooth transitions: `transform: translateY(-2px)`, paired with `box-shadow: 0 8px 24px -4px rgba(67, 56, 202, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)` and a primary border tint (`rgba(99, 102, 241, 0.3)`).
- **Surface Level 3 (Hero Banner):** Deep gradient treatment (`linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)`) with an ambient multi-layered glow: `box-shadow: 0 12px 32px -8px rgba(49, 46, 129, 0.3)`.
- **Navigation Surface:** Obsidian plane (`#111827`) with inset left border in RTL (`1px solid rgba(255, 255, 255, 0.06)`).

## Shapes

The shape system is set to **Level 2 (Rounded)**, balancing technological precision with welcoming tactility.

- **Default Elements (`rounded-md`, 0.5rem / 8px):** Contextual chips, input boxes, icon badge backgrounds, and secondary interactive buttons.
- **Cards & Banners (`rounded-lg`, 1rem / 16px):** Utility tool cards, dashboard summary blocks, and contextual modal frames.
- **Hero Containers (`rounded-xl`, 1.5rem / 24px):** Primary welcome banner, upload drag-and-drop zones, and reader canvas wrappers.
- **Pills (`rounded-full`):** Tag indicators, status badges, trial verification chips, and circular icon triggers.

## Components

### Utility Tool Cards
- **Structure:** Vertical stack centered or RTL-aligned. Icon badge top-center or top-right, followed by bold tool name and a two-line muted description.
- **Surface:** `#FFFFFF` background, 16px corner radius, 24px interior padding (`space-lg`).
- **Icon Badges:** 44px × 44px container, `rounded-md` (8px), background `rgba(99, 102, 241, 0.08)`, housing a 20px monochrome outline icon tinted `#4F46E5`.
- **Hover State:** Smooth 200ms cubic-bezier transition: border shifts to `rgba(99, 102, 241, 0.4)`, subtle 2px upward lift, icon badge shifts to solid `#4F46E5` fill with white glyph.

### Navigation Dock (Dark Rail)
- **Position:** Right-hand placement (RTL origin).
- **Header:** Platform monogram, brand wordmark, and edition badge (`Professional Edition`).
- **Section Headers:** Uppercase tracking, muted zinc text (`#6B7280`), 11px font size, RTL padded.
- **Links:** 40px height, flex alignment with right-aligned glyph and left-aligned badge indicator (if applicable). Default color `#9CA3AF`; hover color `#F3F4F6` with subtle `rgba(255, 255, 255, 0.05)` background fill.
- **Active Item:** `#FFFFFF` text, background `rgba(99, 102, 241, 0.15)`, bordered with a 3px right-edge accent line in `#6366F1`.

### Hero Orientation Banner
- **Background:** Rich indigo/violet diagonal mesh gradient.
- **Dimensions:** Minimum height 180px, corner radius 24px (`rounded-xl`).
- **Typography:** Large white bold headline, paired with a high-legibility translucid subtitle (`rgba(255, 255, 255, 0.85)`).
- **Alignment:** RTL-centered content hierarchy designed to welcome the user and establish immediate clarity.

### Buttons & Chips
- **Primary Button:** Background `#4338CA`, text `#FFFFFF`, rounded 8px (`rounded-md`), subtle shadow `0 2px 8px rgba(67, 56, 202, 0.25)`. Active/Hover: `#3730A3`.
- **Secondary Ghost Button:** Translucent slate or white border, text `#1E293B` on light, `#F9FAFB` on dark.
- **Status Chips:** Height 24px, pill-shaped (`rounded-full`), horizontal padding 10px. Green tint for trial/verified (`rgba(16, 185, 129, 0.1)` with `#059669` text).

### Section Markers
- Group titles (e.g., "القراءة والمتابعة", "أدوات الملفات") feature a 4px × 18px rounded vertical bar in `#4F46E5` immediately preceding the text to direct the visual scan.