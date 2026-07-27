import type { Token, TimedToken } from './types';

export function chunkSizeFromWPM(wpm: number): number {
  if (wpm >= 600) return 3;
  if (wpm >= 400) return 2;
  return 1;
}

export function effectiveWPM(targetWpm: number, elapsedMs: number): number {
  const elapsedSec = elapsedMs / 1000;
  const warmUpSec = 90;
  if (elapsedSec >= warmUpSec) return targetWpm;
  const t = elapsedSec / warmUpSec;
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const warmUpWpm = Math.max(targetWpm * 0.6, 100);
  return Math.round(warmUpWpm + (targetWpm - warmUpWpm) * eased);
}

export function chunkDwellMs(chunk: Token[], currentWpm: number): number {
  const wordTokens = chunk.filter(t => t.type === 'word');
  const wordCount = Math.max(wordTokens.length, 1);
  let ms = (wordCount / currentWpm) * 60 * 1000;
  if (chunk.some(t => t.isHeading)) ms *= 5;
  else if (chunk.some(t => t.isParagraphEnd)) ms *= 3.5;
  else if (chunk.length === 1 && chunk[0].type === 'punctuation') ms *= 2;
  else if (wordTokens.some(t => (t.text?.length ?? 0) > 8)) ms *= 1.3;
  return Math.round(ms);
}

export interface TimingConfig {
  targetWpm: number;
  chunkSize: number;
  warmUpDurationSec: number;
  warmUpWpm: number;
  longWordThreshold: number;
  shortWordThreshold: number;
  shortWordMultiplier: number;
  longWordMultiplier: number;
  punctuationMultiplier: number;
  paragraphEndMultiplier: number;
  headingMultiplier: number;
}

const DEFAULT_CONFIG: TimingConfig = {
  targetWpm: 300,
  chunkSize: 1,
  warmUpDurationSec: 90,
  warmUpWpm: 200,
  longWordThreshold: 8,
  shortWordThreshold: 3,
  shortWordMultiplier: 0.8,
  longWordMultiplier: 1.3,
  punctuationMultiplier: 2.0,
  paragraphEndMultiplier: 3.5,
  headingMultiplier: 5.0,
};

function getEffectiveWpm(targetWpm: number, elapsedSec: number, config: TimingConfig): number {
  if (elapsedSec >= config.warmUpDurationSec) return targetWpm;

  const t = elapsedSec / config.warmUpDurationSec;
  return config.warmUpWpm + (targetWpm - config.warmUpWpm) * easeInOutCubic(t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function baseDwellMs(wpm: number, chunkSize: number): number {
  return (60 / wpm) * 1000 * chunkSize;
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

    const targetWpm = overrides?.targetWpm ?? this.config.targetWpm;
    const chunkSize = overrides?.chunkSize ?? this.config.chunkSize;
    const effectiveWpm = getEffectiveWpm(targetWpm, elapsedSec, this.config);
    const base = baseDwellMs(effectiveWpm, chunkSize);

    const timed: TimedToken[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let dwellMs = base;

      if (token.isHeading) {
        dwellMs = base * this.config.headingMultiplier;
      } else if (token.isParagraphEnd) {
        dwellMs = base * this.config.paragraphEndMultiplier;
      } else if (token.type === 'punctuation') {
        dwellMs = base * this.config.punctuationMultiplier;
      } else if (token.length <= this.config.shortWordThreshold) {
        dwellMs = base * this.config.shortWordMultiplier;
      } else if (token.length >= this.config.longWordThreshold) {
        dwellMs = base * this.config.longWordMultiplier;
      }

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
      if (t.chunkGroup !== timedTokens[Math.min(timedTokens.indexOf(t) + 1, timedTokens.length - 1)]?.chunkGroup) {
        chunks.push(current);
        current = [];
      }
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    return chunks;
  }

  getEffectiveWpm(elapsedSec: number, overrides?: { targetWpm?: number }): number {
    const targetWpm = overrides?.targetWpm ?? this.config.targetWpm;
    return getEffectiveWpm(targetWpm, elapsedSec, this.config);
  }

  getConfig(): TimingConfig {
    return { ...this.config };
  }
}
