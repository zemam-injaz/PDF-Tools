import type { Token } from './types';

export type Language = 'ar' | 'en';

// ── Arabic linguistic sets ───────────────────────────────────────────────────

const ARABIC_CONJUNCTIONS = new Set(['و', 'ف', 'ثم', 'لكن', 'بل', 'حتى', 'أو', 'إما']);
const ARABIC_PREPOSITIONS = new Set(['في', 'على', 'إلى', 'من', 'عن', 'مع', 'بين', 'خلف', 'أمام', 'تحت', 'فوق', 'دون', 'حتى']);
const ARABIC_PREFIXES     = ['بـ', 'لـ', 'كـ', 'أ', 'سـ', 'ال'];

// ── Regex patterns ───────────────────────────────────────────────────────────

const SENTENCE_END_CHARS  = /[.!?؟]/;
const PUNCTUATION_ONLY    = /^[,،\u060C\u061B\u061F!?؟.۔\u2026\u00B7\u2022\-–—()\[\]{}:;"'…·•]+$/;
const NUMBER_PATTERN      = /^[\d]+([.,][\d]+)?$/;

/**
 * Strip Markdown formatting tokens from a line but preserve the content.
 * - Bold/italic: **text**, *text*, __text__, _text_
 * - Inline code: `code`
 * - Links: [label](url) → label
 * - Images: ![alt](url) → alt
 * - HTML tags: <br>, <b>…</b> etc.
 * - Horizontal rules: --- / *** / ===
 */
function stripMarkdown(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')   // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')    // links
    .replace(/`{1,3}[^`]*`{1,3}/g, '')          // inline code / code fences
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')   // bold / italic / bold-italic
    .replace(/_{1,3}([^_]*)_{1,3}/g, '$1')      // underscore variants
    .replace(/<[^>]+>/g, '')                    // HTML tags
    .replace(/^[-*_]{3,}\s*$/, '')              // horizontal rules
    .trim();
}

// ── Role detection ───────────────────────────────────────────────────────────

function detectArabicRole(word: string): Token['arabicRole'] {
  if (ARABIC_CONJUNCTIONS.has(word)) return 'conjunction';
  if (ARABIC_PREPOSITIONS.has(word)) return 'preposition';
  for (const prefix of ARABIC_PREFIXES) {
    if (word.startsWith(prefix) && word.length > prefix.length) return 'prefix';
  }
  return undefined;
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// ── tokenize ─────────────────────────────────────────────────────────────────

export function tokenize(text: string, languageHint?: 'ar' | 'en'): Token[] {
  if (!text) return [];

  const lines = text.split('\n');
  const tokens: Token[] = [];
  let globalIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine     = lines[lineIdx];
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) continue;

    // Detect heading before stripping so we know the flag
    const isHeadingLine = trimmedLine.startsWith('#') && !trimmedLine.startsWith('#[');
    const isNextLineEmpty =
      lineIdx + 1 < lines.length && lines[lineIdx + 1].trim() === '';

    // Strip heading marker then all Markdown syntax
    const lineWithoutHeading = isHeadingLine
      ? trimmedLine.replace(/^#+\s*/, '')
      : trimmedLine;
    const lineContent = stripMarkdown(lineWithoutHeading);

    if (!lineContent) continue;

    const words = lineContent.split(/\s+/).filter(Boolean);

    for (let w = 0; w < words.length; w++) {
      const raw = words[w];

      // Strip residual leading/trailing punctuation wrapping a word, e.g. (word) "word,"
      const stripped = raw.replace(/^[\[({«"']+/, '').replace(/[\])}»"']+$/, '');
      const display  = stripped || raw;

      const isPunct  = PUNCTUATION_ONLY.test(display);
      const isNumber = NUMBER_PATTERN.test(display);
      // A token ends a sentence if it contains a sentence-ending character
      const isSentenceEnd = SENTENCE_END_CHARS.test(display);

      let tokenType: Token['type'] = isNumber ? 'number' : isPunct ? 'punctuation' : 'word';

      const token: Token = {
        text:           display,
        index:          globalIndex++,
        length:         display.length,
        type:           tokenType,
        isHeading:      isHeadingLine,
        isParagraphEnd: false,
        isSentenceEnd:  isSentenceEnd && tokenType !== 'punctuation', // only mark word tokens
      };

      if (token.type === 'word' && (languageHint === 'ar' || isArabic(display))) {
        token.arabicRole = detectArabicRole(display);
      }

      tokens.push(token);
    }

    // Mark the last token of each paragraph (line followed by empty line)
    if (isNextLineEmpty && tokens.length > 0) {
      tokens[tokens.length - 1].isParagraphEnd = true;
    }
  }

  return tokens;
}

// ── buildChunks ──────────────────────────────────────────────────────────────

/**
 * Group tokens into display chunks of approximately `chunkSize` words.
 *
 * Rules (in priority order):
 * 1. Never exceed chunkSize content words.
 * 2. Always stop at a sentence boundary (isSentenceEnd / isParagraphEnd).
 * 3. For Arabic: keep a conjunction/preposition together with the next word.
 * 4. Trailing punctuation-only tokens are merged into the preceding chunk.
 */
export function buildChunks(
  tokens: Token[],
  chunkSize: number,
  language: Language,
): Token[][] {
  if (tokens.length === 0 || chunkSize < 1) return [];

  const chunks: Token[][] = [];
  let i = 0;

  while (i < tokens.length) {
    const chunk: Token[] = [];
    let contentWords = 0;

    while (i < tokens.length && (contentWords < chunkSize || chunk.length === 0)) {
      const t = tokens[i];
      chunk.push(t);
      i++;

      if (t.type !== 'punctuation') contentWords++;

      // Hard boundary: stop after a sentence/paragraph end
      if (t.isSentenceEnd || t.isParagraphEnd) break;

      // Stop if we have hit a standalone punctuation token mid-chunk
      if (t.type === 'punctuation') break;

      // Arabic: keep preposition / conjunction glued to the following word
      const isGlue =
        language === 'ar' &&
        (t.arabicRole === 'conjunction' || t.arabicRole === 'preposition');

      if (isGlue && i < tokens.length) {
        const next = tokens[i];
        if (next.type !== 'punctuation') {
          chunk.push(next);
          i++;
          contentWords++;
          if (next.isSentenceEnd || next.isParagraphEnd) break;
        }
      }
    }

    // Merge trailing punctuation-only tokens into this chunk
    while (i < tokens.length && tokens[i].type === 'punctuation') {
      chunk.push(tokens[i]);
      i++;
    }

    chunks.push(chunk);
  }

  return chunks;
}

// ── ORP (Optimal Recognition Point) ─────────────────────────────────────────

export function getOrpIndex(word: string, language: Language): number {
  if (!word) return 0;
  // Arabic reads right-to-left; fixation point is ≈35% from start
  const ratio = language === 'ar' ? 0.35 : 0.25;
  return Math.min(Math.floor(word.length * ratio), word.length - 1);
}
