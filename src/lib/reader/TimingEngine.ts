import type { Token, TimedToken } from './types';

// ── Public constants ────────────────────────────────────────────────────────

export const WARM_UP_SECONDS = 10;
export const WARM_UP_RATIO  = 0.85; // start at 85% of target WPM

/**
 * Given a target WPM and real wall-clock elapsed milliseconds since the
 * session started, return the *effective* WPM the scheduler should use.
 *
 * We use the actual wall clock (not accumulated dwell) so the warm-up
 * ramps smoothly regardless of pauses or chunk-size changes.
 */
export function effectiveWPM(targetWpm: number, elapsedMs: number): number {
  const elapsedSec = elapsedMs / 1000;
  if (elapsedSec >= WARM_UP_SECONDS) return targetWpm;
  const t = elapsedSec / WARM_UP_SECONDS;
  // ease-in-out cubic
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const startWpm = Math.max(targetWpm * WARM_UP_RATIO, 80);
  return Math.round(startWpm + (targetWpm - startWpm) * eased);
}

/**
 * Derive the suggested words-per-flash from reading speed.
 * Kept intentionally conservative so the user can override.
 */
export function chunkSizeFromWPM(wpm: number): number {
  if (wpm >= 600) return 3;
  if (wpm >= 350) return 2;
  return 1;
}

/**
 * Calculate the dwell time (ms) for a single chunk.
 *
 * Design principles:
 *  - Base time = (wordCount / wpm) × 60 000  → exact WPM maths
 *  - Micro-pauses are gentle and mutually exclusive (highest wins)
 *  - Maximum multiplier is 1.5× (paragraph/heading break)
 *  - No multiplier reduces speed below the base — no "speed-up" for short words
 */
export function chunkDwellMs(chunk: Token[], wpm: number): number {
  const wordCount = Math.max(chunk.filter(t => t.type === 'word').length, 1);
  const base = (wordCount / wpm) * 60_000;

  let multiplier = 1.0;
  if      (chunk.some(t => t.isHeading))       multiplier = 1.3;
  else if (chunk.some(t => t.isParagraphEnd))  multiplier = 1.3;
  else if (chunk.some(t => t.isSentenceEnd))   multiplier = 1.15;
  else if (chunk.some(t => t.type === 'punctuation')) multiplier = 1.05;

  return Math.round(base * multiplier);
}

// ── TimingEngine class (used by TimingConfig consumers) ─────────────────────

export interface TimingConfig {
  targetWpm: number;
  chunkSize: number;
  warmUpDurationSec: number;
  warmUpRatio: number;
  punctuationMultiplier: number;
  paragraphEndMultiplier: number;
  headingMultiplier: number;
  sentenceEndMultiplier: number;
}

const DEFAULT_CONFIG: TimingConfig = {
  targetWpm: 300,
  chunkSize: 1,
  warmUpDurationSec: WARM_UP_SECONDS,
  warmUpRatio: WARM_UP_RATIO,
  punctuationMultiplier: 1.05,
  paragraphEndMultiplier: 1.3,
  headingMultiplier: 1.3,
  sentenceEndMultiplier: 1.15,
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class TimingEngine {
  private config: TimingConfig;

  constructor(config: Partial<TimingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  compute(
    tokens: Token[],
    elapsedSec: number,
    overrides?: { targetWpm?: number; chunkSize?: number },
  ): TimedToken[] {
    if (tokens.length === 0) return [];

    const targetWpm  = overrides?.targetWpm  ?? this.config.targetWpm;
    const chunkSize  = overrides?.chunkSize  ?? this.config.chunkSize;
    const startWpm   = Math.max(targetWpm * this.config.warmUpRatio, 80);
    const t          = Math.min(elapsedSec / this.config.warmUpDurationSec, 1);
    const currentWpm = elapsedSec >= this.config.warmUpDurationSec
      ? targetWpm
      : Math.round(startWpm + (targetWpm - startWpm) * easeInOutCubic(t));

    const base = (60 / currentWpm) * 1000 * chunkSize;
    const timed: TimedToken[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let dwellMs = base;

      if      (token.isHeading)      dwellMs = base * this.config.headingMultiplier;
      else if (token.isParagraphEnd) dwellMs = base * this.config.paragraphEndMultiplier;
      else if (token.isSentenceEnd)  dwellMs = base * this.config.sentenceEndMultiplier;
      else if (token.type === 'punctuation') dwellMs = base * this.config.punctuationMultiplier;

      timed.push({
        ...token,
        dwellMs: Math.round(dwellMs),
        chunkGroup: Math.floor(i / chunkSize),
      });
    }

    return timed;
  }

  getChunks(timedTokens: TimedToken[]): TimedToken[][] {
    if (timedTokens.length === 0) return [];
    const chunks: TimedToken[][] = [];
    let current: TimedToken[] = [];
    for (const t of timedTokens) {
      current.push(t);
      const nextIdx = timedTokens.indexOf(t) + 1;
      if (nextIdx >= timedTokens.length || timedTokens[nextIdx].chunkGroup !== t.chunkGroup) {
        chunks.push(current);
        current = [];
      }
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  getEffectiveWpm(elapsedSec: number, overrides?: { targetWpm?: number }): number {
    const targetWpm = overrides?.targetWpm ?? this.config.targetWpm;
    const startWpm  = Math.max(targetWpm * this.config.warmUpRatio, 80);
    if (elapsedSec >= this.config.warmUpDurationSec) return targetWpm;
    const t = elapsedSec / this.config.warmUpDurationSec;
    return Math.round(startWpm + (targetWpm - startWpm) * easeInOutCubic(t));
  }

  getConfig(): TimingConfig {
    return { ...this.config };
  }
}
