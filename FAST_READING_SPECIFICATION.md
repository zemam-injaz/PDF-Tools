# Fast Reading Feature — Full Technical Specification

## Project: Warraq (وراق) — PDF Tools Suite

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack Summary](#2-tech-stack-summary)
3. [Architecture & Data Flow (Current)](#3-architecture--data-flow-current)
4. [PDF-to-Text Pipeline](#4-pdf-to-text-pipeline)
5. [Existing Fast Reading Features & Their Limits](#5-existing-fast-reading-features--their-limits)
6. [Reading Controls & UI Components](#6-reading-controls--ui-components)
7. [Subscription & Feature Gating](#7-subscription--feature-gating)
8. [Proposed Enhancements — 15 Priorities](#8-proposed-enhancements--15-priorities)
   - 8.1 Tier 1 — Reading Science (Core Engine Rewrite)
   - 8.2 Tier 2 — User Experience (Immersion & Feedback)
   - 8.3 Tier 3 — Analytics & Intelligence
9. [Target Architecture: The Reading Engine](#9-target-architecture-the-reading-engine)
10. [Recommended Implementation Roadmap](#10-recommended-implementation-roadmap)
11. [Appendices](#11-appendices)

---

## 1. Overview

Warraq is a desktop PDF tools application built on **React + Tauri v2** (frontend) and **Python FastAPI** (backend). The Fast Reading feature is designed to:

1. **Extract text** from PDFs (both text-based and scanned/OCR)
2. **Display the text** to the user in multiple reading modes optimized for speed
3. **Track reading speed** (WPM / PPM) per session
4. **Generate adaptive reading plans** based on word indexing per page
5. **Provide an RSVP (Rapid Serial Visual Presentation)** mode for high-speed reading

The current feature is implemented in a single React component (`ReadingSpeedTool.tsx`, ~1131 lines) with backend services for text extraction and word indexing. The infrastructure is solid — the gaps are in **reading science** and **user experience**.

---

## 2. Tech Stack Summary

| Layer | Technology | Details |
|-------|-----------|---------|
| **Desktop Shell** | Tauri v2 (Rust) | Manages Python backend lifecycle, file dialogs |
| **Frontend** | React 19 + TypeScript | Component-based architecture |
| **Styling** | Tailwind CSS v4 | Utility-first, RTL-first (Arabic UI) |
| **Animation** | Framer Motion | UI transitions |
| **State Management** | React hooks (useState, useRef, useEffect) | No external state library |
| **Backend** | Python 3 + FastAPI (Uvicorn, port 8002) | REST API, service-oriented |
| **PDF Engine** | PyMuPDF (fitz) | Text extraction, page info, bookmarks |
| **OCR Engine** | Tahweel (Google Drive OCR) | Scanned PDF text extraction |
| **Background Tasks** | ThreadPoolExecutor (custom task_service) | Long-running OCR operations |
| **Database** | SQLite | Book library, reading sessions, annotations |
| **Feature Gating** | SubscriptionContext (React context) | Controls paid/paid feature access |
| **Plugin System** | @tauri-apps/plugin-dialog | Native file picker dialogs |

---

## 3. Architecture & Data Flow (Current)

```
[User] → ReadingSpeedTool (React)
            │
            ├── Markdown/TXT mode:
            │     <input type="file"> → FileReader.readAsText()
            │     → Split into wordsArray (client-side only)
            │     → RSVP / Normal reader renders from wordsArray
            │
            └── PDF mode:
                  Tauri file dialog → api.info(pdfPath)
                        │
                        ├── Without OCR:
                        │     api.tahweel.index(pdfPath, useOcr=false)
                        │       → TextService.get_word_index() — PyMuPDF
                        │       → Returns [{page, word_count}]
                        │
                        └── With OCR (scanned docs):
                              api.tahweel.convert(pdfPath, ..., isAsync=true)
                                → TahweelService.convert()
                                → Google Drive OCR (ThreadPool, 4 workers)
                                → Returns txt_content + task_id
                              Poll: api.tasks.getStatus(taskId)
                                → On complete: split txt into wordsArray
```

**Key backend endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/text/extract` | POST | Extract raw text from PDF (TXT) |
| `/api/text/extract-to-file` | POST | Extract + save to TXT/DOCX/MD file |
| `/api/tahweel/convert` | POST | OCR PDF → TXT (sync or async) |
| `/api/tahweel/index` | POST | Word-count per page (PyMuPDF or OCR) |
| `/api/tasks/{id}` | GET | Poll background task status/progress |

---

## 4. PDF-to-Text Pipeline

### 4.1 Text-based PDF (PyMuPDF)

**File:** `python-server/services/text_service.py : TextService`

- `extract_text()` — opens PDF with `fitz.open()`, iterates pages, calls `page.get_text()`, joins with `\n\n`
- `extract_to_file()` — structured extraction that:
  1. Reads page as `"dict"` blocks via `page.get_text("dict", flags=...)`
  2. Collects all lines with font sizes, calculates mode body font size
  3. Classifies blocks as `h1` (>1.6× body), `h2` (>1.25× body), or `body`
  4. Outputs to TXT (flat), DOCX (with heading styles via python-docx), or Markdown (with `#`/`##`)
- `get_word_index()` — per-page word count using `page.get_text().split()`

**Frontend API calls:**
```
api.extractText(pdfPath, pageRange)           → { text, word_count, pages_extracted }
api.extractTextToFile(pdfPath, outputPath, ...) → { output_path, format, duration }
```

### 4.2 Scanned PDF / OCR (Tahweel + Google Drive OCR)

**File:** `python-server/services/tahweel_service.py : TahweelService`

Requirements:
- **Tahweel** Python package (custom Google Drive OCR wrapper)
- **Poppler** (`pdftocairo`) for PDF → image conversion
- **Google OAuth2** credentials (stored at `~/.pdf-tools/tahweel_token.pickle`)

Pipeline:
1. `FileManagersFactory.from_file_path()` initializes file manager
2. `file_manager.to_images()` converts PDF → images via `pdf2image` (8 threads)
3. `GoogleDriveBaseOcrProcessor.process()` sends each image to Google Drive OCR
4. `ThreadPoolExecutor(max_workers=4)` parallelizes OCR requests
5. Text transformations: BOM removal, whitespace stripping
6. Output: DOCX (via `DocxWriter`), TXT (with `PAGE_SEPARATOR`), optionally PDF (via Win32 COM Word)

**Async mode:** Long OCR operations run via background task system:
```
POST /api/tahweel/convert { is_async: true }
  → Returns { task_id: "..." }
  → Frontend polls GET /api/tasks/{task_id}
    → When status === "completed", reads result
```

### 4.3 Word Indexing for Reading Plans

**File:** `python-server/services/text_service.py : get_word_index()`
**File:** `python-server/services/tahweel_service.py : get_word_index()`

Two code paths for per-page word indexing:
- **Non-OCR (PyMuPDF):** Fast, works for text-based PDFs. Counts words via `page.get_text().split()`.
- **OCR (Tahweel):** Slow but necessary for scanned PDFs. Full OCR pipeline per page.

Both return: `[{page: 1, word_count: N}, {page: 2, word_count: M}, ...]`

This index feeds the reading plan generator.

---

## 5. Existing Fast Reading Features & Their Limits

All implemented in `src/components/tools/ReadingSpeedTool.tsx` (1131 lines).

### 5.1 RSVP Reader

**Current timing logic (the core problem):**
```typescript
// Line 426
const interval = (60 / targetWPM) * 1000 * chunkSize;
```
Every chunk receives exactly the same duration regardless of word length, punctuation, or structure.

**What's missing:**
- No variable dwell time per word/chunk
- No word-length-aware pacing
- No punctuation or paragraph-break pauses
- No heading/section boundary detection for timing

### 5.2 Normal (Full-Text) Reader

**Display:**
- Scrollable container with progressive highlighting
- Current chunk: `text-indigo-900 bg-indigo-100`
- Past words: `text-gray-200`, future words: `text-gray-400 opacity-30`
- Auto-scroll to keep current word vertically centered

**What's missing:**
- No focus guide (dim everything except current line)
- No eye-guidance animation (moving indicator)
- All display modes share the same flat `wordsArray` — no linguistic structure

### 5.3 Reading Plan Generator

```
effectiveWPM = targetWPM × difficultyMultiplier × feedbackFactor
wordsPerDay = effectiveWPM × dailyMinutes
```

**What's missing:**
- Linear only — no spaced repetition or forgetting curve
- No integration with session performance for dynamic re-planning
- Plan stored in-memory only, not persisted

### 5.4 Session Tracking & WPM History

```typescript
interface Session {
  fileName, mode, totalWords, totalPages, wordsRead, pagesRead,
  durationSeconds, wpm, ppm, date
}
```

**What's missing:**
- No comprehension score
- No consistency/variance metrics
- No average fixation duration
- No regression count
- No daily streaks, books finished, reading hours
- No speed improvement trend
- No per-book or per-genre breakdown
- Session data held in-memory only, lost on refresh

---

## 6. Reading Controls & UI Components

### Main Component Tree (ReadingSpeedTool.tsx)

```
ReadingSpeedTool (full-page, max-w-4xl)
  ├── Header: title + session/plan tab switcher
  ├── File Mode Toggle: Markdown/TXT | PDF
  ├── File Picker:
  │   ├── MD mode: <input type="file" accept=".md,.txt">
  │   └── PDF mode: Tauri @tauri-apps/plugin-dialog (open)
  │       └── OCR checkbox option (for scanned PDFs)
  ├── Session Tab (activeTab === 'session'):
  │   ├── File info (name, word/page count)
  │   ├── Reader Mode Toggle: Normal | RSVP
  │   ├── Reader Display:
  │   │   ├── Normal: scrollable text (h-[500px]) with progressive highlight
  │   │   └── RSVP: dark full-width container (h-80) with ORP
  │   ├── Speed Gauge Dashboard (when reading/paused):
  │   │   ├── SpeedGauge (WPM/PPM) — circular SVG
  │   │   ├── Timer display
  │   │   └── Words read / current page
  │   ├── Controls:
  │   │   ├── Idle: WPM preset buttons (200/300/400/500/600) + Start button
  │   │   ├── Reading/Paused: Pause/Resume + Finish + Stop
  │   │   └── Done: Result card + WPM history chart + session list
  │   └── WPM History Chart — SVG line graph
  └── Plan Tab (activeTab === 'plan'):
      ├── File picker for PDF (same dialog)
      ├── OCR toggle for indexing
      ├── "بدء فهرسة الكلمات" button → handleIndexBook()
      ├── Progress indicator during indexing
      ├── Plan Configuration:
      │   ├── Target WPM (pre-filled from last session)
      │   ├── Daily minutes
      │   ├── Start date
      │   ├── Rest days toggle + day-of-week selector
      │   ├── Chapter sync toggle
      │   └── Difficulty level (easy/medium/hard)
      └── Generated Plan:
          ├── Table view or Calendar view
          ├── Day ratings (easy/good/hard) with adaptive feedback
          └── Per-day stats: pages, word count
```

### Key Variables & State

| Variable | Type | Purpose |
|----------|------|---------|
| `fileMode` | `'md' \| 'pdf'` | File type selection |
| `readerMode` | `'normal' \| 'rsvp'` | Reading display mode |
| `sessionState` | `'idle' \| 'reading' \| 'paused' \| 'done'` | Session lifecycle |
| `wordsArray` | `useRef<string[]>` | In-memory word array (client-side) |
| `rsvpIndex` | `number` | Current word position |
| `chunkSize` | `1–4` | Words per RSVP tick |
| `targetWPM` | `number` (100–1000) | Target reading speed |
| `elapsed` | `number` (seconds) | Session timer |
| `feedbackFactor` | `number` (0.5–2.0) | Adaptive plan adjustment |
| `useOcr` | `boolean` | Use OCR for scanned PDFs |
| `wordIndex` | `{page, word_count}[]` | Per-page word counts |

---

## 7. Subscription & Feature Gating

**File:** `src/contexts/SubscriptionContext.tsx`

The fast reading feature is behind the `'fast_reading'` feature flag:
```tsx
const { checkAccess } = useSubscription();
const hasAccess = checkAccess('fast_reading');
```

- If `hasAccess === false`: a locked overlay is shown with an "Upgrade" button → `PricingPage`
- During development: `VITE_DEV_MODE` env var unlocks all features
- During subscription loading: optimistic access granted to prevent flash of lock UI
- Feature flags are fetched from backend via `api.subscription.authDevice()`

---

## 8. Proposed Enhancements — 15 Priorities

### 8.1 Tier 1 — Reading Science (Core Engine Rewrite)

These are the fundamentals that make RSVP feel natural. Without them, speed comes at the cost of comprehension.

#### Priority 1 — Intelligent RSVP Timing Engine ⭐⭐⭐⭐⭐

**Current:**
```typescript
interval = (60 / targetWPM) * 1000 * chunkSize;
```
Every chunk gets identical duration.

**Target:**
```
base = 60 / WPM

short word (1-3 chars)   → duration = base × 0.8
normal word              → duration = base
long word (>8 chars)     → duration = base × 1.3
punctuation              → duration = base × 2.0
paragraph end            → duration = base × 3.5
heading                  → duration = base × 5
```

**Implementation:**
- Add a `TimingEngine` module that accepts a token and returns dwell time in ms
- Each word/chunk is classified by type before timing is computed
- Classification is cheap: character count + regex for punctuation/digit detection
- Paragraph and heading detection already available from the structured extraction pipeline (`text_service.py` role detection)

**Impact:** Highest. Single change that makes RSVP feel dramatically more natural.

---

#### Priority 2 — Phrase-Based Chunking ⭐⭐⭐⭐⭐

**Current:**
```
"The" "cat" "jumped" "over" "the" "wall"
```
One word at a time, or fixed N-gram chunks.

**Target:**
```
"The cat jumped" "over the wall"
```
Semantic chunks the brain naturally processes as units.

**Algorithm sketch:**
```
ChunkBuilder
  │
  ├── split text into sentences
  ├── split each sentence into clauses (by conjunctions, commas, relative pronouns)
  ├── split each clause into phrases (determiner + noun, verb + complement)
  └── output chunks sized by current WPM:
        slow  → 1-2 words
        medium → 2-3 words
        fast  → 3-4 words
```

**Why it matters:** Humans don't read word-by-word; they read in saccadic jumps over meaningful units. Phrase display increases comprehension far more than increasing WPM.

---

#### Priority 3 — Arabic-Aware Chunking ⭐⭐⭐⭐⭐

**Current:** Identical whitespace splitting for all languages.

**Target:** Language-detection at file-load time, then route to Arabic-aware chunker.

**Arabic-specific rules:**

Conjunctions that should trigger chunk boundaries:
```
و  (and)
ف  (so/then)
ثم (then)
لكن (but)
بل (rather)
حتى (until/even)
```

Prepositions that should stay attached to their noun phrase:
```
في (in)
على (on)
إلى (to)
من (from)
عن (about)
بـ (with/by)
لـ (for/to)
كـ (like/as)
```

**Example:**
```
"ذهب محمد إلى المدرسة"
```
- Current: `"ذهب" "محمد" "إلى" "المدرسة"`
- Target at slow: `"ذهب محمد" "إلى المدرسة"`
- Target at fast: `"ذهب محمد إلى المدرسة"`

---

#### Priority 4 — Arabic ORP (Optimal Recognition Point) ⭐⭐⭐⭐⭐

**Current:**
```typescript
const mid = Math.floor(word.length / 2);
```
Center character — designed for Latin alphabets.

**Target:** Arabic-specific fixation point estimation accounting for:

1. **Word length** — longer words shift fixation rightward
2. **Ligatures** — connected glyphs change perceptual center
3. **Initial vs medial vs final forms** — the first character of an Arabic word carries disproportionate recognition weight because it determines the joining class

**Heuristic approach:**
```
if len <= 2: fixate at position 0 (first char — carries most shape info)
if len == 3: fixate at position 1
if len >= 4: fixate at floor(len × 0.35) — weighted toward the distinctive initial portion
```

Even this simple heuristic is better than `len/2`.

---

#### Priority 5 — Progressive Speed Increase ⭐⭐⭐⭐⭐

**Current:** Constant WPM for the entire session.

**Target:**
```
0-30 sec     → 250 WPM (warm-up)
30-60 sec    → 300 WPM
60-90 sec    → 350 WPM
90+ sec      → target WPM
```

**Implementation:**
- `effectiveWPM = f(elapsed, targetWPM)` function interpolates from warm-up to target
- Configurable warm-up duration (default 90 seconds)
- Optional cool-down ramp at the end

**Why:** Sudden high WPM from second 0 causes cognitive strain. The brain needs a warm-up period.

---

#### Priority 6 — Comprehension Mode ⭐⭐⭐⭐⭐

**Current:** No comprehension checks. WPM is the only metric.

**Target:**
- Every N minutes (configurable: 3/5/10), auto-pause
- Display a multiple-choice question about the last passage
- Score = f(speed, accuracy)
- Track comprehension across sessions to power reading coach insights

**Question generation:**
- Since we don't have AI inference locally, use a heuristic approach:
  - Pick a sentence with a named entity or a key term
  - Replace/challenge that entity in the question
  - Or: show a statement and ask True/False
- For AI-powered questions: move this to the backend with a lightweight model or API call

**Data model addition:**
```typescript
interface ComprehensionCheck {
  position: number;        // word index where quiz appears
  question: string;
  options: string[];
  correctIndex: number;
  userAnswer?: number;
  responseTimeMs?: number;
}
```

---

### 8.2 Tier 2 — User Experience (Immersion & Feedback)

These enhancements make the reader feel polished and professional.

#### Priority 7 — Focus Guide

**Current:** Normal reader shows all text with fading; RSVP shows only the current word.

**Target (Normal Reader):**
```
████████████████████████████████
Current Line   (bright, opaque)
████████████████████████████████
Everything below   (faded, 20% opacity)
Everything above   (faded, 10% opacity)
```

Like Kindle's Reading Focus. Achievable with a CSS overlay mask or gradient on the scroll container.

**Target (RSVP):** Similar concept — a horizontal band with gradient fade above/below the word.

---

#### Priority 8 — Eye Guidance Animation

**Current:** Words simply appear/disappear in RSVP mode. No visual anchor.

**Target:** Animate a moving focus point:

Option A — moving dot:
```
│
● (descends down a vertical track as words progress)
│
```

Option B — horizontal guide:
```
────► (animated line sweeping left-to-right for each word)
```

Option C — kinetic text: words slide in from the right and settle at center (simulates natural reading motion).

---

#### Priority 9 — Adaptive Chunk Size

**Current:** User sets chunk size manually (1-4).

**Target:**
```
slow  (< 200 WPM)  → 1 word
medium (200-400)   → 2 words
fast  (400-600)    → 3 words
expert (> 600)     → 4 words
```

Auto-adjusted when speed changes. User can still override.

---

#### Priority 10 — Smart Pause Detection

**Current:** Reading continues even when user walks away.

**Target:**
- Detect window blur (`visibilitychange` event) → auto-pause
- Detect no keyboard/mouse interaction for N seconds → auto-pause
- Resume on any interaction or focus return
- Store auto-pause events in session log

---

#### Priority 11 — Immersive Reader UI

**Current:** The reader is embedded in the app layout with toolbars, tabs, and buttons around it.

**Target:** Full-screen immersive mode:

```
──────────────────────────────────────────

                    كلمة

          ──────────●────────────────────

          370 WPM    12:14    68%

──────────────────────────────────────────
```

- No browser chrome, no sidebar, no tabs
- Dark background, centered content, minimal controls
- Controls appear on hover or tap (HUD-style overlay)
- Exit via Escape

---

#### Priority 12 — Modern Session Result UI

**Current:** Session result is a card with numbers and an SVG line chart.

**Target — Reading Coach overlay:**
```
          ┌──────────────────────┐
          │   Excellent! 🎉      │
          │   You maintained     │
          │   91% consistency    │
          │                      │
          │   Next session:      │
          │   375 WPM            │
          └──────────────────────┘
```

- Animated result reveal
- Comparison with previous session
- Auto-suggestion for next target WPM
- "New personal best" detection

---

### 8.3 Tier 3 — Analytics & Intelligence

#### Priority 13 — Rich Statistics Dashboard

**Current:** WPM, duration, words read.

**Target — Full analytics:**

| Metric | Source |
|--------|--------|
| Average fixation duration (ms) | Calculated from individual word dwell times |
| Regression count | Track `rsvpIndex` decreases (manual back-jumps) |
| Consistency score (% variance) | Standard deviation of per-chunk timing |
| Longest session | Max elapsed across sessions |
| Daily streak | Consecutive days with reading activity |
| Books finished | Threshold: >90% progress on word index |
| Reading hours | Total `elapsed` across all sessions |
| Speed improvement | (Current WPM - initial WPM) / initial WPM |
| Predicted finish for current book | `remainingWords / avgWPM` |
| Optimal time of day | Aggregate WPM by hour across sessions |

All metrics should be **persisted** (currently sessions live in-memory only). Add SQLite table for reading sessions:
```sql
CREATE TABLE reading_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_path TEXT,
  mode TEXT NOT NULL,
  total_words INTEGER,
  words_read INTEGER,
  duration_seconds REAL NOT NULL,
  wpm REAL,
  chunk_size INTEGER,
  comprehension_score REAL,
  consistency REAL,
  regressions INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

#### Priority 14 — Reading Heatmap (GitHub-Style)

**Current:** Session list + SVG line chart (last 10 sessions).

**Target:**
```
Mon ████████  45 min  320 WPM
Tue ████       22 min  280 WPM
Wed ██████████ 55 min  340 WPM
Thu ██         10 min  150 WPM
Fri ████████   40 min  310 WPM
Sat ██████     35 min  330 WPM
```

- Daily activity calendar (GitHub contribution graph style)
- Color intensity = reading time × speed
- Weekly aggregation view
- Month/year navigation

---

#### Priority 15 — AI Reading Insights (Personal Reading Coach)

**Target — after N sessions, generate:**
```
- You read 18% faster in the morning
- You slow down after 20 continuous minutes
- Technical PDFs reduce your speed by 18%
- Arabic books are 12% slower for you
- Your optimal chunk size is 3 words
- Recommended next target: 410 WPM
```

**Implementation approaches:**
- **Simple:** Aggregate session data with per-book metadata tags (genre, language, difficulty). Compare averages across dimensions.
- **Advanced:** Move aggregation to the backend. Store per-word timing data. Run simple statistical analysis (OLS regression of WPM on time-of-day, duration, genre, language).

---

## 9. Target Architecture: The Reading Engine

### 9.1 Current vs Target

**Current architecture** (display-centric):
```
Text → split(" ") → wordsArray → display (RSVP or Normal)
```

**Target architecture** (linguistic analysis → timing → display):

```
                    ┌─────────────────────┐
                    │     Reading Engine   │
                    │   (separate module)  │
                    └─────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────────┐     ┌───────────────┐     ┌──────────────────┐
│  Tokenizer  │     │  Timing Engine│     │  Display Engine   │
│             │     │               │     │                  │
│ • Word split│     │ • Word-length │     │ • RSVP mode      │
│ • Sentence  │     │   weighting   │     │ • Normal mode    │
│   detection │     │ • Punctuation │     │ • Focus mode     │
│ • Clause    │     │   pause       │     │ • (Future modes) │
│   detection │     │ • Paragraph   │     │                  │
│ • Arabic    │     │   pause       │     │ • ORP rendering  │
│   rules     │     │ • Heading     │     │ • Eye guide      │
│             │     │   pause       │     │ • HUD overlay    │
│             │     │ • Warm-up     │     │ • Progress bar   │
│             │     │   ramp        │     │                  │
└──────┬──────┘     └───────┬───────┘     └───────┬──────────┘
       │                    │                      │
       └────────────────────┴──────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Session Tracker   │
                │                     │
                │ • WPM / dwell time  │
                │ • Comprehension     │
                │ • Regressions       │
                │ • Consistency       │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Analytics Engine  │
                │                     │
                │ • Per-session stats │
                │ • Across-session    │
                │   trends            │
                │ • Reading Coach     │
                │ • Heatmap           │
                └─────────────────────┘
```

### 9.2 Key Design Principle

**Separation of concerns:**
- `Tokenizer` converts raw text → structured tokens (words with metadata: length, type, position)
- `TimingEngine` converts tokens → dwell times (pure computation, no rendering)
- `DisplayEngine` consumes timed tokens → renders in chosen mode
- `SessionTracker` records all events → feeds `AnalyticsEngine`

Each layer is testable in isolation. New display modes (e.g., eye-tracking guided) slot in without touching the timing logic.

### 9.3 Module Specification

**Tokenizer** — new file `src/lib/reader/Tokenizer.ts`
- Input: raw text string, language hint
- Output: `Token[]` where each token has:
  ```typescript
  interface Token {
    text: string;
    index: number;           // global word index
    length: number;          // char count
    type: 'word' | 'punctuation' | 'number';
    isHeading: boolean;
    isParagraphEnd: boolean;
    isSentenceEnd: boolean;
    arabicRole?: 'noun' | 'verb' | 'preposition' | 'conjunction';
  }
  ```
- Sentence detection: `[.!?]` for English, `[.?!\n]` for Arabic (with exception handling for abbreviations)
- Clause boundaries: commas, conjunctions (`و`, `ف`, `ثم`, `لكن`, `بل`, `حتى`)
- Heading detection: reuse existing line from `text_service.py` role detection, or MD `#` detection

**TimingEngine** — new file `src/lib/reader/TimingEngine.ts`
- Input: `Token[]`, `targetWPM`, `sessionElapsed`
- Output: `TimedToken[]` where each token has:
  ```typescript
  interface TimedToken extends Token {
    dwellMs: number;         // milliseconds to display
    chunkGroup: number;      // which visual chunk this belongs to
  }
  ```
- Warm-up logic: interpolate from `warmUpWPM` to `targetWPM` over configurable period
- Word-length weighting: short/normal/long multipliers
- Punctuation pauses: detected by `Token.type`
- Paragraph/heading pauses: detected by `Token.isParagraphEnd` / `Token.isHeading`

**DisplayEngine** — refactored rendering in `ReadingSpeedTool.tsx`
- Consumes `TimedToken[]`
- RSVP mode: render single or grouped tokens with `setTimeout` chain (instead of `setInterval`)
- Normal mode: progressive highlight driven by current index (no change needed)
- Focus mode: CSS overlay mask with gradient fade
- ORP rendering: language-aware fixation point (Arabic vs Latin)
- Eye-guide animation: moving indicator synchronized with token transitions

**SessionTracker** — new file `src/lib/reader/SessionTracker.ts`
- Records: every token display event with actual dwell time
- Tracks: regressions (user jumps backward), pauses, window blur events
- Computes: live WPM, consistency, estimated comprehension
- Output: `SessionReport` on session end

**AnalyticsEngine** — new file `src/lib/reader/AnalyticsEngine.ts`
- Consumes `SessionReport[]` (stored in SQLite via backend)
- Computes: trends, streaks, optimal time-of-day, per-genre breakdown
- Generates: reading coach messages, heatmap data, improvement metrics
- Runs client-side for responsiveness, syncs to backend for persistence

---

## 10. Recommended Implementation Roadmap

| Phase | Priorities | Effort | Impact |
|-------|-----------|--------|--------|
| **Phase 1** | P1 (Timing Engine) + P5 (Progressive Speed) + P9 (Adaptive Chunk) | 2-3 days | Highest |
| **Phase 2** | P2 (Phrase Chunking) + P3 (Arabic Rules) + P4 (Arabic ORP) | 3-5 days | Very high |
| **Phase 3** | P7 (Focus Guide) + P8 (Eye Guide) + P11 (Immersive UI) | 2-3 days | High |
| **Phase 4** | P10 (Smart Pause) + P13 (Rich Stats) + P14 (Heatmap) | 2-3 days | Medium |
| **Phase 5** | P6 (Comprehension Mode) + P12 (Session Result UI) | 3-4 days | Medium |
| **Phase 6** | P15 (AI Reading Insights) + Reading Engine refactor | 3-5 days | High |

**Total estimated effort:** 15-23 days for the full transformation.

**Phase 1 alone** (2-3 days) would deliver the most noticeable improvement: weighted timing + warm-up ramp + auto chunk-size. This single change makes RSVP feel like a professional tool.

---

## 11. Appendices

### A. Key File Paths

| Component | Path |
|-----------|------|
| **RSVP Speed Reader + Plans** | `src/components/tools/ReadingSpeedTool.tsx` |
| **Text Extraction (UI)** | `src/components/tools/TextExtractTool.tsx` |
| **Book Library** | `src/components/tools/BookLibraryTool.tsx` |
| **Chapter Weight / Reading Plans** | `src/components/tools/ChapterWeightTool.tsx` |
| **Interactive PDF Viewer** | `src/components/viewer/InteractivePDFViewer.tsx` |
| **Central API client** | `src/lib/api.ts` |
| **FastAPI Server** | `python-server/server.py` |
| **Text Service (PyMuPDF)** | `python-server/services/text_service.py` |
| **Tahweel OCR Service** | `python-server/services/tahweel_service.py` |
| **Tahweel API Routes** | `python-server/api/tahweel_routes.py` |
| **Background Task Service** | `python-server/services/task_service.py` |
| **Subscription Context** | `src/contexts/SubscriptionContext.tsx` |
| **App Router** | `src/App.tsx` (route: `'reading-speed'`) |
| **Global Styles** | `src/index.css` |

### B. Data Flow Summary (Current)

```
                         ┌──────────────────────────────────┐
                         │       ReadingSpeedTool.tsx       │
                         │  (React Component, ~1131 lines) │
                         └──────────┬───────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────┐ ┌────────────────┐
            │  MD/TXT File  │ │ PDF File │ │  Tauri Dialog  │
            │ (FileReader)  │ │ (Tauri)  │ │ (plugin-dialog)│
            └──────┬───────┘ └────┬─────┘ └────────────────┘
                   │              │
                   ▼              ▼
            wordsArray      api.tahweel.index()
            (in-memory)        or
                              api.tahweel.convert()
                                   │
                                   ▼
                            wordsArray (from OCR text)
                                   │
                    ┌──────────────┴──────────────┐
                    │                              │
                    ▼                              ▼
            ┌──────────────┐              ┌─────────────────┐
            │ Normal Reader│              │ RSVP Reader     │
            │ (scrollable) │              │ (one-by-one)    │
            │ progressive  │              │ ORP highlight   │
            │ highlight    │              │ chunk control   │
            └──────┬───────┘              └────────┬────────┘
                   │                               │
                   └───────────┬───────────────────┘
                               ▼
                    ┌────────────────────┐
                    │ Session Tracking   │
                    │ WPM, elapsed,      │
                    │ history chart      │
                    └────────────────────┘
```

### C. Data Flow Summary (Target)

```
Raw Text (from PyMuPDF or OCR)
         │
         ▼
┌─────────────────────┐
│    Tokenizer         │
│  src/lib/reader/     │
│  Tokenizer.ts        │
│                      │
│  • sentence split    │
│  • clause detection  │
│  • Arabic rules      │
│  • heading detection │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│    TimingEngine      │
│  src/lib/reader/     │
│  TimingEngine.ts     │
│                      │
│  • weighted dwell    │
│  • warm-up ramp      │
│  • adaptive chunk    │
│  • pause rules       │
└──────────┬──────────┘
           ▼
┌─────────────────────────────────────────────┐
│           Display Engine                     │
│  (Refactored ReadingSpeedTool.tsx)           │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ RSVP     │  │ Normal   │  │ Focus     │  │
│  │ • ORP    │  │ • Prog.  │  │ • Line    │  │
│  │ • eye    │  │   high-  │  │   mask    │  │
│  │   guide  │  │   light  │  │ • scroll  │  │
│  └──────────┘  └──────────┘  └───────────┘  │
└───────────────────┬─────────────────────────┘
                    ▼
┌─────────────────────┐
│   SessionTracker     │
│  src/lib/reader/     │
│  SessionTracker.ts   │
│                      │
│  • events log        │
│  • live metrics      │
│  • comprehension     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│   AnalyticsEngine    │
│  src/lib/reader/     │
│  AnalyticsEngine.ts  │
│                      │
│  • trends            │
│  • heatmap           │
│  • reading coach     │
│  • SQLite persistence│
└─────────────────────┘
```

### D. Enhancement Priority Matrix

| # | Priority | Tier | Effort | Impact | Dependencies |
|---|----------|------|--------|--------|-------------|
| 1 | Intelligent RSVP Timing Engine | Reading Science | 1 day | ⭐⭐⭐⭐⭐ | None |
| 2 | Phrase-Based Chunking | Reading Science | 2-3 days | ⭐⭐⭐⭐⭐ | P1 |
| 3 | Arabic-Aware Chunking | Reading Science | 1-2 days | ⭐⭐⭐⭐⭐ | P2 |
| 4 | Arabic ORP | Reading Science | 0.5 day | ⭐⭐⭐ | None |
| 5 | Progressive Speed Increase | Reading Science | 0.5 day | ⭐⭐⭐⭐ | P1 |
| 6 | Comprehension Mode | Reading Science | 2-3 days | ⭐⭐⭐⭐ | P2 |
| 7 | Focus Guide | UX | 0.5 day | ⭐⭐⭐ | None |
| 8 | Eye Guidance Animation | UX | 1 day | ⭐⭐⭐ | None |
| 9 | Adaptive Chunk Size | UX | 0.5 day | ⭐⭐⭐ | P1 |
| 10 | Smart Pause Detection | UX | 0.5 day | ⭐⭐ | None |
| 11 | Immersive Reader UI | UX | 1-2 days | ⭐⭐⭐⭐ | P7, P8 |
| 12 | Modern Session Result UI | UX | 1 day | ⭐⭐⭐ | None |
| 13 | Rich Statistics Dashboard | Analytics | 2-3 days | ⭐⭐⭐⭐ | Backend + DB |
| 14 | Reading Heatmap | Analytics | 1 day | ⭐⭐⭐ | P13 |
| 15 | AI Reading Insights | Analytics | 2-3 days | ⭐⭐⭐⭐ | P13 |

### E. Reading Engine — Module Dependencies

```
Tokenizer.ts          (zero dependencies — pure text processing)
  ↑
TimingEngine.ts       (depends on Tokenizer types)
  ↑
DisplayEngine         (depends on TimingEngine output)
  ↑
SessionTracker.ts     (depends on DisplayEngine events)
  ↑
AnalyticsEngine.ts    (depends on SessionTracker reports)
```

Each module can be developed, tested, and swapped independently. New display modes (e.g., guided eye-tracking, kinetic text) can be added as new consumers of `TimedToken[]` without modifying `Tokenizer` or `TimingEngine`.
