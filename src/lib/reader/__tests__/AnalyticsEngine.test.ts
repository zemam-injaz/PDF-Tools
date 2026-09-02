import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsEngine } from '../AnalyticsEngine';
import type { SessionReport } from '../types';

function makeSession(overrides: Partial<SessionReport> & { date: string }): SessionReport {
  return {
    fileName: 'test.pdf',
    mode: 'rsvp',
    totalWords: 1000,
    wordsRead: 500,
    durationSeconds: 600,
    averageWPM: 250,
    peakWPM: 300,
    targetWpm: 300,
    chunkSize: 2,
    comprehensionScore: null,
    consistency: 80,
    regressions: 3,
    averageFixationMs: 200,
    autoPauses: 1,
    ...overrides,
  };
}

describe('AnalyticsEngine', () => {
  let engine: AnalyticsEngine;

  beforeEach(() => {
    engine = new AnalyticsEngine();
  });

  describe('with no sessions', () => {
    it('returns 0 for overall WPM', () => {
      expect(engine.getOverallWpm()).toBe(0);
    });

    it('returns empty insights', () => {
      expect(engine.generateInsights()).toEqual([]);
    });

    it('returns 0 streak', () => {
      expect(engine.getDailyStreak()).toBe(0);
    });
  });

  describe('with single session', () => {
    beforeEach(() => {
      engine.loadSessions([makeSession({ date: '2024-01-15T10:00:00Z', averageWPM: 200 })]);
    });

    it('returns that session WPM', () => {
      expect(engine.getOverallWpm()).toBe(200);
    });

    it('returns 0 improvement', () => {
      expect(engine.getSpeedImprovement()).toBe(0);
    });
  });

  describe('with multiple sessions', () => {
    beforeEach(() => {
      engine.loadSessions([
        makeSession({ date: '2024-01-01T10:00:00Z', averageWPM: 200 }),
        makeSession({ date: '2024-01-08T10:00:00Z', averageWPM: 250 }),
        makeSession({ date: '2024-01-15T10:00:00Z', averageWPM: 300 }),
      ]);
    });

    it('computes average WPM', () => {
      expect(engine.getOverallWpm()).toBe(250);
    });

    it('finds best WPM', () => {
      expect(engine.getBestWpm()).toBe(300);
    });

    it('computes speed improvement', () => {
      expect(engine.getSpeedImprovement()).toBe(50);
    });

    it('returns total reading hours', () => {
      // 3 sessions × 600 seconds = 1800 sec = 0.5 hours
      expect(engine.getTotalReadingHours()).toBe(0.5);
    });

    it('returns total words read', () => {
      expect(engine.getTotalWordsRead()).toBe(1500);
    });
  });

  describe('streaks', () => {
    it('counts consecutive days ending at today', () => {
      // Use UTC dates to avoid local timezone shifting the day
      const now = Date.now();
      const sessions: SessionReport[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(now - i * 86400000);
        sessions.push(makeSession({ date: d.toISOString(), averageWPM: 250 }));
      }
      engine.loadSessions(sessions);
      expect(engine.getDailyStreak()).toBeGreaterThanOrEqual(2);
    });

    it('breaks streak on gap', () => {
      const today = new Date();
      const sessions: SessionReport[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i * 3); // every 3 days → gap
        sessions.push(makeSession({ date: d.toISOString(), averageWPM: 250 }));
      }
      engine.loadSessions(sessions);
      expect(engine.getDailyStreak()).toBeLessThan(3);
    });
  });

  describe('books', () => {
    it('counts finished books (>90% progress)', () => {
      engine.loadSessions([
        makeSession({ fileName: 'book1.pdf', totalWords: 1000, wordsRead: 950, date: '2024-01-01T10:00:00Z' }),
        makeSession({ fileName: 'book2.pdf', totalWords: 500, wordsRead: 250, date: '2024-01-02T10:00:00Z' }),
      ]);
      expect(engine.getBooksFinished()).toBe(1);
    });

    it('returns book stats sorted by total minutes', () => {
      engine.loadSessions([
        makeSession({ fileName: 'short.pdf', totalWords: 100, wordsRead: 50, durationSeconds: 120, averageWPM: 200, date: '2024-01-01T10:00:00Z' }),
        makeSession({ fileName: 'long.pdf', totalWords: 1000, wordsRead: 800, durationSeconds: 2400, averageWPM: 250, date: '2024-01-02T10:00:00Z' }),
      ]);

      const stats = engine.getBookStats();
      expect(stats).toHaveLength(2);
      expect(stats[0].totalMinutes).toBeGreaterThanOrEqual(stats[1].totalMinutes);
    });
  });

  describe('daily stats', () => {
    it('returns stats for the last N days', () => {
      engine.loadSessions([
        makeSession({ date: new Date().toISOString(), averageWPM: 300, durationSeconds: 600, wordsRead: 200 }),
      ]);

      const stats = engine.getDailyStats(7);
      expect(stats).toHaveLength(8); // 7 days + today
      const today = stats[stats.length - 1];
      expect(today.minutes).toBe(10);
      expect(today.avgWpm).toBe(300);
    });
  });

  describe('insights generation', () => {
    it('generates insights from session data', () => {
      engine.loadSessions([
        makeSession({ date: '2024-01-01T10:00:00Z', averageWPM: 200 }),
        makeSession({ date: '2024-01-02T10:00:00Z', averageWPM: 250 }),
        makeSession({ date: '2024-01-03T10:00:00.000Z', averageWPM: 280 }),
      ]);

      const insights = engine.generateInsights();
      expect(insights.length).toBeGreaterThan(0);

      const speedInsight = insights.find(i => i.type === 'pattern');
      expect(speedInsight).toBeDefined();
      expect(speedInsight!.value).toBe(243); // average of 200, 250, 280
    });

    it('includes time-of-day insight with enough sessions', () => {
      const sessions: SessionReport[] = [];
      for (let i = 0; i < 10; i++) {
        const d = new Date('2024-01-01T10:00:00Z');
        d.setDate(d.getDate() + i);
        sessions.push(makeSession({ date: d.toISOString(), averageWPM: 250 + i * 5 }));
      }
      engine.loadSessions(sessions);
      const insights = engine.generateInsights();
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('consistency', () => {
    it('averages consistency across sessions', () => {
      engine.loadSessions([
        makeSession({ date: '2024-01-01T10:00:00Z', consistency: 70 }),
        makeSession({ date: '2024-01-02T10:00:00Z', consistency: 90 }),
      ]);
      expect(engine.getAverageConsistency()).toBe(80);
    });
  });

  describe('comprehension', () => {
    it('returns null when no comprehension data', () => {
      engine.loadSessions([
        makeSession({ date: '2024-01-01T10:00:00Z', comprehensionScore: null }),
      ]);
      expect(engine.getAverageComprehension()).toBeNull();
    });

    it('averages comprehension scores', () => {
      engine.loadSessions([
        makeSession({ date: '2024-01-01T10:00:00Z', comprehensionScore: 80 }),
        makeSession({ date: '2024-01-02T10:00:00Z', comprehensionScore: 90 }),
      ]);
      expect(engine.getAverageComprehension()).toBe(85);
    });
  });
});
