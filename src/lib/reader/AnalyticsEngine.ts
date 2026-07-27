import type { SessionReport, ReadingInsight, DailyStat, BookStat } from './types';

export class AnalyticsEngine {
  private sessions: SessionReport[] = [];

  loadSessions(sessions: SessionReport[]): void {
    this.sessions = [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  getOverallWpm(): number {
    if (this.sessions.length === 0) return 0;
    const total = this.sessions.reduce((s, r) => s + r.wpm, 0);
    return Math.round(total / this.sessions.length);
  }

  getBestWpm(): number {
    if (this.sessions.length === 0) return 0;
    return Math.max(...this.sessions.map(s => s.wpm));
  }

  getSpeedImprovement(): number {
    if (this.sessions.length < 2) return 0;
    const first = this.sessions[0].wpm;
    const last = this.sessions[this.sessions.length - 1].wpm;
    if (first === 0) return 0;
    return Math.round(((last - first) / first) * 100);
  }

  getTotalReadingHours(): number {
    return Math.round(
      (this.sessions.reduce((s, r) => s + r.durationSeconds, 0) / 3600) * 10,
    ) / 10;
  }

  getTotalWordsRead(): number {
    return this.sessions.reduce((s, r) => s + r.wordsRead, 0);
  }

  getDailyStreak(): number {
    if (this.sessions.length === 0) return 0;

    const days = new Set(
      this.sessions.map(s => s.date.split('T')[0]),
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (days.has(key)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  getBooksFinished(): number {
    const bookMap = new Map<string, SessionReport[]>();
    for (const s of this.sessions) {
      if (!bookMap.has(s.fileName)) bookMap.set(s.fileName, []);
      bookMap.get(s.fileName)!.push(s);
    }

    let finished = 0;
    for (const [, reports] of bookMap) {
      const sorted = reports.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const last = sorted[sorted.length - 1];
      if (last.wordsRead >= last.totalWords * 0.9) {
        finished++;
      }
    }

    return finished;
  }

  getAverageConsistency(): number {
    if (this.sessions.length === 0) return 0;
    const total = this.sessions.reduce((s, r) => s + r.consistency, 0);
    return Math.round(total / this.sessions.length);
  }

  getAverageComprehension(): number | null {
    const scored = this.sessions.filter(s => s.comprehensionScore !== null);
    if (scored.length === 0) return null;
    const total = scored.reduce((s, r) => s + r.comprehensionScore!, 0);
    return Math.round(total / scored.length);
  }

  getDailyStats(days: number = 30): DailyStat[] {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    const dayMap = new Map<string, { minutes: number; wpm: number; words: number; sessions: number }>();

    for (const s of this.sessions) {
      const key = s.date.split('T')[0];
      if (new Date(key) < cutoff) continue;

      const existing = dayMap.get(key) ?? { minutes: 0, wpm: 0, words: 0, sessions: 0 };
      existing.minutes += s.durationSeconds / 60;
      existing.wpm += s.wpm;
      existing.words += s.wordsRead;
      existing.sessions += 1;
      dayMap.set(key, existing);
    }

    const stats: DailyStat[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const data = dayMap.get(key);

      stats.push({
        date: key,
        minutes: data ? Math.round(data.minutes * 10) / 10 : 0,
        avgWpm: data ? Math.round(data.wpm / data.sessions) : 0,
        wordsRead: data?.words ?? 0,
        sessions: data?.sessions ?? 0,
      });
    }

    return stats;
  }

  getBookStats(): BookStat[] {
    const bookMap = new Map<string, SessionReport[]>();
    for (const s of this.sessions) {
      if (!bookMap.has(s.fileName)) bookMap.set(s.fileName, []);
      bookMap.get(s.fileName)!.push(s);
    }

    const stats: BookStat[] = [];
    for (const [fileName, reports] of bookMap) {
      const totalSeconds = reports.reduce((s, r) => s + r.durationSeconds, 0);
      const avgWpm = Math.round(reports.reduce((s, r) => s + r.wpm, 0) / reports.length);
      const sorted = reports.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const last = sorted[sorted.length - 1];
      const progress = Math.min(100, Math.round((last.wordsRead / Math.max(last.totalWords, 1)) * 100));

      stats.push({
        fileName,
        totalSessions: reports.length,
        totalMinutes: Math.round(totalSeconds / 60),
        avgWpm,
        progressPercent: progress,
      });
    }

    return stats.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  generateInsights(): ReadingInsight[] {
    const insights: ReadingInsight[] = [];

    const avgWpm = this.getOverallWpm();
    if (avgWpm > 0) {
      insights.push({
        type: 'pattern',
        message: `متوسط سرعة القراءة: ${avgWpm} كلمة في الدقيقة`,
        value: avgWpm,
      });
    }

    const improvement = this.getSpeedImprovement();
    if (improvement > 5) {
      insights.push({
        type: 'achievement',
        message: `تحسّن السرعة بنسبة ${improvement}%!`,
        value: improvement,
      });
    }

    const consistency = this.getAverageConsistency();
    if (consistency > 0) {
      insights.push({
        type: 'tip',
        message: consistency >= 80
          ? `ثبات ممتاز في الإيقاع (${consistency}%)`
          : `حاول تحسين ثبات الإيقاع (${consistency}%) بالقراءة اليومية`,
        value: consistency,
      });
    }

    const streaks = this.getDailyStreak();
    if (streaks > 1) {
      insights.push({
        type: 'achievement',
        message: `سلسلة قراءة متواصلة: ${streaks} يوم`,
        value: streaks,
      });
    }

    const hours = this.getTotalReadingHours();
    if (hours > 0) {
      insights.push({
        type: 'pattern',
        message: `إجمالي ساعات القراءة: ${hours} ساعة`,
        value: hours,
      });
    }

    const books = this.getBooksFinished();
    if (books > 0) {
      insights.push({
        type: 'achievement',
        message: `تم إنهاء ${books} كتاب`,
        value: books,
      });
    }

    const wpmByTimeOfDay = this.analyzeTimeOfDay();
    if (wpmByTimeOfDay.length > 0) {
      const best = wpmByTimeOfDay[0];
      insights.push({
        type: 'tip',
        message: `أفضل وقت للقراءة: ${best.period} (${best.avgWpm} كلمة/د)`,
        value: best.avgWpm,
      });
    }

    return insights;
  }

  private analyzeTimeOfDay(): { period: string; avgWpm: number }[] {
    if (this.sessions.length < 5) return [];

    const buckets: { period: string; hourStart: number; hourEnd: number; wpm: number[] }[] = [
      { period: 'الصباح الباكر', hourStart: 5, hourEnd: 8, wpm: [] },
      { period: 'الصباح', hourStart: 8, hourEnd: 12, wpm: [] },
      { period: 'الظهر', hourStart: 12, hourEnd: 15, wpm: [] },
      { period: 'العصر', hourStart: 15, hourEnd: 18, wpm: [] },
      { period: 'المساء', hourStart: 18, hourEnd: 21, wpm: [] },
      { period: 'الليل', hourStart: 21, hourEnd: 24, wpm: [] },
      { period: 'متأخر', hourStart: 0, hourEnd: 5, wpm: [] },
    ];

    for (const s of this.sessions) {
      const hour = new Date(s.date).getHours();
      const bucket = buckets.find(b => hour >= b.hourStart && hour < b.hourEnd);
      if (bucket) bucket.wpm.push(s.wpm);
    }

    return buckets
      .map(b => ({
        period: b.period,
        avgWpm: b.wpm.length > 0 ? Math.round(b.wpm.reduce((a, x) => a + x, 0) / b.wpm.length) : 0,
      }))
      .filter(b => b.avgWpm > 0)
      .sort((a, b) => b.avgWpm - a.avgWpm);
  }
}
