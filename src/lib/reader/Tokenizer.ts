import type { Token } from './types';

export type Language = 'ar' | 'en';

const ARABIC_CONJUNCTIONS = new Set(['و', 'ف', 'ثم', 'لكن', 'بل', 'حتى', 'أو', 'إما', 'لـ']);
const ARABIC_PREPOSITIONS = new Set(['في', 'على', 'إلى', 'من', 'عن', 'بـ', 'لـ', 'كـ', 'حتى', 'مع', 'بين', 'خلف', 'أمام', 'تحت', 'فوق', 'دون']);
const ARABIC_PREFIXES = ['و', 'ف', 'بـ', 'لـ', 'كـ', 'أ', 'سـ', 'ال'];

const SENTENCE_END = /[.!?؟\n]+/;
const PUNCTUATION = /^[,\u060C\u061B\u061F!?؟.۔،\u2026\u00B7\u2022\-–—()\[\]{}:;"'…·•]+$/;
const NUMBER_PATTERN = /^[\d]+([.,][\d]+)?$/;

function detectArabicRole(word: string): Token['arabicRole'] {
  for (const conj of ARABIC_CONJUNCTIONS) {
    if (word === conj) return 'conjunction';
  }
  for (const prep of ARABIC_PREPOSITIONS) {
    if (word === prep) return 'preposition';
  }
  for (const prefix of ARABIC_PREFIXES) {
    if (word.startsWith(prefix) && word.length > prefix.length) return 'prefix';
  }
  return undefined;
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function tokenize(text: string, languageHint?: 'ar' | 'en'): Token[] {
  if (!text) return [];

  const lines = text.split('\n');
  const tokens: Token[] = [];
  let globalIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmedLine = line.trim();
    const isHeadingLine = trimmedLine.startsWith('#') && !trimmedLine.startsWith('#[');
    const isNextLineEmpty = lineIdx + 1 < lines.length && lines[lineIdx + 1].trim() === '';
    const isThisLineEmpty = trimmedLine === '';

    if (isThisLineEmpty) continue;

    const lineContent = isHeadingLine ? trimmedLine.replace(/^#+\s*/, '') : trimmedLine;

    const words = lineContent.split(/\s+/).filter(Boolean);

    for (let w = 0; w < words.length; w++) {
      const raw = words[w];

      const isPunct = PUNCTUATION.test(raw);
      const isNumber = NUMBER_PATTERN.test(raw);
      const isSentenceEnd = SENTENCE_END.test(raw);

      let displayText = raw;
      let tokenType: Token['type'] = isNumber ? 'number' : isPunct ? 'punctuation' : 'word';

      displayText = raw.replace(/[!?؟.]+$/, '').replace(/^[\[({"']+/, '').replace(/[\]})"']+$/, '');
      if (!displayText) {
        displayText = raw;
        tokenType = 'punctuation';
      }

      if (tokenType === 'word' && isPunct) {
        tokenType = 'punctuation';
      }

      const token: Token = {
        text: displayText,
        index: globalIndex++,
        length: displayText.length,
        type: tokenType,
        isHeading: isHeadingLine,
        isParagraphEnd: false,
        isSentenceEnd: false,
      };

      if (token.type === 'word' && (languageHint === 'ar' || isArabic(displayText))) {
        token.arabicRole = detectArabicRole(displayText);
      }

      tokens.push(token);

      if (isSentenceEnd) {
        tokens[tokens.length - 1].isSentenceEnd = true;
      }
    }

      if (isNextLineEmpty && tokens.length > 0) {
        tokens[tokens.length - 1].isParagraphEnd = true;
      } else if (words.length > 0 && tokens.length > 0) {
      tokens[tokens.length - 1].isSentenceEnd = true;
    }
  }

  return tokens;
}

export function chunkPhrases(tokens: Token[], targetSize: number): Token[][] {
  if (tokens.length === 0) return [];
  if (targetSize < 1) targetSize = 1;

  const chunks: Token[][] = [];
  let i = 0;

  while (i < tokens.length) {
    const chunk: Token[] = [];

    if (targetSize === 1) {
      chunk.push(tokens[i]);
      i++;
    } else {
      let taken = 0;
      while (i < tokens.length && taken < targetSize) {
        const t = tokens[i];
        chunk.push(t);
        i++;
        taken++;

        if (t.arabicRole === 'conjunction' && taken < targetSize && i < tokens.length) {
          chunk.push(tokens[i]);
          i++;
          taken++;
        }
      }
    }

    chunks.push(chunk);
  }

  return chunks;
}

export function getOrpIndex(word: string, language: Language): number {
  if (!word) return 0;
  if (language === 'ar') {
    const mid = Math.floor(word.length * 0.35);
    return Math.min(mid, word.length - 1);
  }
  const mid = Math.floor(word.length * 0.25);
  return Math.min(mid, word.length - 1);
}

export function buildChunks(tokens: Token[], chunkSize: number, language: Language): Token[][] {
  if (tokens.length === 0 || chunkSize < 1) return [];
  const chunks: Token[][] = [];
  let i = 0;
  while (i < tokens.length) {
    const chunk: Token[] = [];
    let taken = 0;
    while (i < tokens.length && taken < chunkSize) {
      const t = tokens[i];
      chunk.push(t);
      i++;
      taken++;
      if (language === 'ar' && t.arabicRole === 'conjunction' && taken < chunkSize && i < tokens.length) {
        chunk.push(tokens[i]);
        i++;
        taken++;
      }
    }
    chunks.push(chunk);
  }
  return chunks;
}
