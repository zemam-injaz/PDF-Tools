import { describe, it, expect } from 'vitest';
import { TimingEngine } from '../TimingEngine';
import { tokenize } from '../Tokenizer';

describe('TimingEngine', () => {
  describe('base timing', () => {
    it('uses default config when no overrides given', () => {
      const engine = new TimingEngine();
      const tokens = tokenize('a simple test');
      const timed = engine.compute(tokens, 120);

      expect(timed).toHaveLength(3);
      for (const t of timed) {
        expect(t.dwellMs).toBeGreaterThan(0);
      }
    });

    it('bases dwell on word count, not word length', () => {
      const engine = new TimingEngine({ targetWpm: 300, warmUpDurationSec: 0 });
      const tokens = tokenize('a tiny lengthyWord');
      const timed = engine.compute(tokens, 300);

      expect(timed[1].dwellMs).toBe(timed[2].dwellMs);
    });

    it('produces longer dwell for punctuation', () => {
      const engine = new TimingEngine({ targetWpm: 300, warmUpDurationSec: 0 });
      const tokens = tokenize('word , word');
      const timed = engine.compute(tokens, 300);

      expect(timed[1].type).toBe('punctuation');
      expect(timed[1].dwellMs).toBeGreaterThan(timed[0].dwellMs);
    });

    it('produces longer dwell for paragraph end', () => {
      const engine = new TimingEngine({ targetWpm: 300, warmUpDurationSec: 0 });
      const tokens = tokenize('First paragraph\n\nSecond');
      const timed = engine.compute(tokens, 300);

      const endToken = timed.find(t => t.isParagraphEnd);
      expect(endToken).toBeDefined();
      expect(endToken!.dwellMs).toBeGreaterThan(timed[0].dwellMs);
    });

    it('produces longer dwell for headings', () => {
      const engine = new TimingEngine({ targetWpm: 300, warmUpDurationSec: 0 });
      const tokens = tokenize('# Heading\nbody');
      const timed = engine.compute(tokens, 300);

      const headingToken = timed.find(t => t.isHeading);
      const bodyToken = timed.find(t => !t.isHeading);
      expect(headingToken).toBeDefined();
      expect(bodyToken).toBeDefined();
      expect(headingToken!.dwellMs).toBeGreaterThan(bodyToken!.dwellMs);
    });
  });

  describe('warm-up ramp', () => {
    it('starts at warm-up WPM', () => {
      const engine = new TimingEngine({ targetWpm: 600, warmUpRatio: 0.5, warmUpDurationSec: 90 });
      const tokens = tokenize('test');

      const early = engine.compute(tokens, 0);
      const late = engine.compute(tokens, 180);

      expect(early[0].dwellMs).toBeGreaterThan(late[0].dwellMs);
    });

    it('reaches target WPM after warm-up period', () => {
      const engine = new TimingEngine({ targetWpm: 300, warmUpRatio: 0.5, warmUpDurationSec: 60 });
      const tokens = tokenize('test');

      const afterWarmUp = engine.compute(tokens, 120);
      const expectedMs = (60 / 300) * 1000;

      expect(afterWarmUp[0].dwellMs).toBeLessThanOrEqual(expectedMs + 20);
      expect(afterWarmUp[0].dwellMs).toBeGreaterThanOrEqual(expectedMs - 20);
    });
  });

  describe('getEffectiveWpm', () => {
    it('returns warm-up WPM at start', () => {
      const engine = new TimingEngine({ targetWpm: 400, warmUpRatio: 0.5, warmUpDurationSec: 60 });
      expect(engine.getEffectiveWpm(0)).toBe(200);
    });

    it('returns targetWpm after warm-up', () => {
      const engine = new TimingEngine({ targetWpm: 400, warmUpRatio: 0.5, warmUpDurationSec: 60 });
      expect(engine.getEffectiveWpm(120)).toBe(400);
    });

    it('interpolates during warm-up', () => {
      const engine = new TimingEngine({ targetWpm: 400, warmUpRatio: 0.5, warmUpDurationSec: 60 });
      const mid = engine.getEffectiveWpm(30);
      expect(mid).toBeGreaterThan(200);
      expect(mid).toBeLessThan(400);
    });
  });

  describe('chunk grouping', () => {
    it('groups tokens into chunks', () => {
      const engine = new TimingEngine();
      const tokens = tokenize('one two three four five');
      const timed = engine.compute(tokens, 300, { chunkSize: 2 });
      const chunks = engine.getChunks(timed);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(2);
    });
  });

  describe('config overrides', () => {
    it('accepts partial config', () => {
      const engine = new TimingEngine({ targetWpm: 500 });
      expect(engine.getConfig().targetWpm).toBe(500);
      expect(engine.getConfig().punctuationMultiplier).toBe(1.05); // default
    });

    it('overrides targetWpm and chunkSize at compute time', () => {
      const engine = new TimingEngine({ targetWpm: 300, warmUpDurationSec: 0 });
      const tokens = tokenize('a b c d');
      const timed = engine.compute(tokens, 300, { targetWpm: 600, chunkSize: 2 });
      const chunks = engine.getChunks(timed);

      const baseMs = (60 / 600) * 1000 * 2;
      expect(timed[0].dwellMs).toBeLessThanOrEqual(baseMs);
      expect(chunks).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('returns empty for no tokens', () => {
      const engine = new TimingEngine();
      expect(engine.compute([], 0)).toEqual([]);
      expect(engine.getChunks([])).toEqual([]);
    });

    it('handles single token', () => {
      const engine = new TimingEngine({ warmUpDurationSec: 0, targetWpm: 300 });
      const tokens = tokenize('hello');
      const timed = engine.compute(tokens, 300);
      expect(timed).toHaveLength(1);
      expect(timed[0].dwellMs).toBeGreaterThan(0);
    });
  });
});
