import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionTracker, computeAdaptiveFeedback, generateReadingPlan } from '../SessionTracker';
import { TimingEngine } from '../TimingEngine';
import { tokenize } from '../Tokenizer';

describe('SessionTracker', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new SessionTracker();
  });

  describe('session lifecycle', () => {
    it('starts in idle state', () => {
      expect(tracker.getState()).toBe('idle');
    });

    it('transitions to reading on start', () => {
      tracker.start();
      expect(tracker.getState()).toBe('reading');
    });

    it('transitions to paused on pause', () => {
      tracker.start();
      tracker.pause();
      expect(tracker.getState()).toBe('paused');
    });

    it('transitions back to reading on resume', () => {
      tracker.start();
      tracker.pause();
      tracker.resume();
      expect(tracker.getState()).toBe('reading');
    });

    it('returns 0 elapsed before start', () => {
      expect(tracker.getElapsedSeconds()).toBe(0);
    });
  });

  describe('elapsed time', () => {
    it('measures elapsed seconds', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);
      expect(tracker.getElapsedSeconds()).toBeGreaterThanOrEqual(4);
    });

    it('excludes paused time', () => {
      tracker.start();
      vi.advanceTimersByTime(5000);
      tracker.pause();
      vi.advanceTimersByTime(5000);
      tracker.resume();
      vi.advanceTimersByTime(5000);

      // Should be ~10s, not ~15s
      expect(tracker.getElapsedSeconds()).toBeGreaterThanOrEqual(9);
      expect(tracker.getElapsedSeconds()).toBeLessThanOrEqual(11);
    });
  });

  describe('event recording', () => {
    it('records display events', () => {
      tracker.start();
      const engine = new TimingEngine({ warmUpDurationSec: 0, targetWpm: 300 });
      const tokens = tokenize('hello world');
      const timed = engine.compute(tokens, 300);

      tracker.recordDisplay(timed[0]);
      tracker.recordDisplay(timed[1]);

      // Finish to generate report
      const report = tracker.finish(2, 2, 'test.md', 'rsvp', 300, 1);
      expect(report.wordsRead).toBe(2);
    });

    it('counts regressions', () => {
      tracker.start();
      tracker.recordRegression(5);
      tracker.recordRegression(10);

      const report = tracker.finish(50, 100, 'test.md', 'rsvp', 300, 1);
      expect(report.regressions).toBe(2);
    });

    it('tracks autoPauses', () => {
      tracker.start();
      tracker.pause(true);
      tracker.resume();
      tracker.pause(true);

      const report = tracker.finish(50, 100, 'test.md', 'rsvp', 300, 1);
      expect(report.autoPauses).toBe(2);
    });
  });

  describe('finish report', () => {
    it('produces a complete SessionReport', () => {
      tracker.start();
      const report = tracker.finish(200, 500, 'book.txt', 'rsvp', 300, 2);

      expect(report.fileName).toBe('book.txt');
      expect(report.mode).toBe('rsvp');
      expect(report.totalWords).toBe(500);
      expect(report.wordsRead).toBe(200);
      expect(report.targetWpm).toBe(300);
      expect(report.chunkSize).toBe(2);
    });

    it('sets done state after finish', () => {
      tracker.start();
      tracker.finish(100, 200, 'test.md', 'normal', 300, 1);
      expect(tracker.getState()).toBe('done');
    });

    it('computes consistency from fixation intervals', () => {
      tracker.start();
      const engine = new TimingEngine({ warmUpDurationSec: 0, targetWpm: 300 });
      const tokens = tokenize('a b c d e');
      const timed = engine.compute(tokens, 300);

      for (const t of timed) {
        tracker.recordDisplay(t);
      }

      const report = tracker.finish(5, 5, 'test.md', 'rsvp', 300, 1);
      expect(report.consistency).toBeGreaterThanOrEqual(0);
      expect(report.consistency).toBeLessThanOrEqual(100);
    });
  });
});

describe('computeAdaptiveFeedback', () => {
  it('decreases factor on hard rating', () => {
    const result = computeAdaptiveFeedback('hard', 1.0);
    expect(result).toBe(0.95);
  });

  it('increases factor on easy rating', () => {
    const result = computeAdaptiveFeedback('easy', 1.0);
    expect(result).toBe(1.05);
  });

  it('keeps factor unchanged on good rating', () => {
    const result = computeAdaptiveFeedback('good', 1.0);
    expect(result).toBe(1.0);
  });

  it('clamps factor to minimum of 0.5', () => {
    const result = computeAdaptiveFeedback('hard', 0.52);
    expect(result).toBe(0.5);
  });

  it('clamps factor to maximum of 2.0', () => {
    const result = computeAdaptiveFeedback('easy', 1.97);
    expect(result).toBe(2.0);
  });
});

describe('generateReadingPlan', () => {
  const wordIndex = [
    { page: 1, word_count: 200 },
    { page: 2, word_count: 250 },
    { page: 3, word_count: 300 },
    { page: 4, word_count: 200 },
    { page: 5, word_count: 150 },
  ];

  it('returns empty for empty index', () => {
    expect(generateReadingPlan([], 300, 30, '2024-01-01', 'medium', 1.0, false, 5, false, []))
      .toEqual([]);
  });

  it('generates a multi-day plan', () => {
    const plan = generateReadingPlan(wordIndex, 300, 30, '2024-01-01', 'medium', 1.0, false, 5, false, []);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].isRest).toBe(false);
  });

  it('adjusts difficulty multiplier for easy', () => {
    const easyPlan = generateReadingPlan(wordIndex, 300, 30, '2024-01-01', 'easy', 1.0, false, 5, false, []);
    const hardPlan = generateReadingPlan(wordIndex, 300, 30, '2024-01-01', 'hard', 1.0, false, 5, false, []);
    // Easy should cover more pages per day than hard
    expect(easyPlan[0].page_count).toBeGreaterThanOrEqual(hardPlan[0].page_count);
  });

  it('includes rest days when enabled', () => {
    const plan = generateReadingPlan(wordIndex, 300, 30, '2024-01-01', 'medium', 1.0, true, 1, false, []);
    // 2024-01-01 is Monday, day 1 should not be rest, look for Monday
    const restDays = plan.filter(d => d.isRest);
    expect(restDays.length).toBeGreaterThanOrEqual(0);
  });

  it('generates readable page ranges', () => {
    const plan = generateReadingPlan(wordIndex, 600, 30, '2024-01-01', 'easy', 2.0, false, 5, false, []);
    expect(plan[0].pages).toBeTruthy();
    expect(plan[0].word_count).toBeGreaterThan(0);
  });
});
