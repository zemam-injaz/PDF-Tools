import type { TimedToken, SessionReport, ReaderMode, SessionState, DayRating } from './types';

export interface SessionEvent {
  type: 'display' | 'pause' | 'resume' | 'regression' | 'skip_forward' | 'skip_backward' | 'speed_change' | 'comprehension_answer';
  timestamp: number;
  data?: Record<string, unknown>;
}

export class SessionTracker {
  private events: SessionEvent[] = [];
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private lastPauseStart: number = 0;
  private state: SessionState = 'idle';
  private autoPauseCount: number = 0;

  start(): void {
    this.events = [];
    this.startTime = Date.now();
    this.pausedDuration = 0;
    this.state = 'reading';
    this.autoPauseCount = 0;
  }

  pause(isAuto: boolean = false): void {
    if (this.state !== 'reading') return;
    this.lastPauseStart = Date.now();
    this.state = 'paused';
    this.events.push({ type: 'pause', timestamp: this.lastPauseStart });

    if (isAuto) {
      this.autoPauseCount++;
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.pausedDuration += Date.now() - this.lastPauseStart;
    this.state = 'reading';
    this.events.push({ type: 'resume', timestamp: Date.now() });
  }

  recordDisplay(token: TimedToken): void {
    this.events.push({ type: 'display', timestamp: Date.now(), data: { token } });
  }

  recordRegression(amount: number): void {
    this.events.push({ type: 'regression', timestamp: Date.now(), data: { amount } });
  }

  recordSkip(direction: 'forward' | 'backward', amount: number): void {
    this.events.push({ type: direction === 'forward' ? 'skip_forward' : 'skip_backward', timestamp: Date.now(), data: { amount } });
  }

  recordSpeedChange(oldWpm: number, newWpm: number): void {
    this.events.push({ type: 'speed_change', timestamp: Date.now(), data: { oldWpm, newWpm } });
  }

  getElapsedSeconds(): number {
    if (this.state === 'idle') return 0;
    const base = Date.now() - this.startTime - this.pausedDuration;
    return Math.max(0, Math.floor(base / 1000));
  }

  getState(): SessionState {
    return this.state;
  }

  finish(wordsRead: number, totalWords: number, fileName: string, mode: ReaderMode, targetWpm: number, chunkSize: number): SessionReport {
    const elapsed = this.getElapsedSeconds();
    const minutes = elapsed / 60;
    const wpm = minutes > 0 ? Math.round(wordsRead / minutes) : 0;

    const displayEvents = this.events.filter(e => e.type === 'display');
    const fixations = displayEvents.map((e, i, arr) => {
      if (i === 0) return 0;
      return e.timestamp - arr[i - 1].timestamp;
    });
    const averageFixation = fixations.length > 0 ? fixations.reduce((a, b) => a + b, 0) / fixations.length : 0;

    const regressionCount = this.events.filter(e => e.type === 'regression').length;
    const consistency = this.computeConsistency(fixations);

    this.state = 'done';

    return {
      fileName,
      mode,
      totalWords,
      wordsRead,
      durationSeconds: elapsed,
      wpm,
      targetWpm,
      chunkSize,
      comprehensionScore: null,
      consistency,
      regressions: regressionCount,
      averageFixationMs: Math.round(averageFixation),
      date: new Date().toISOString(),
      autoPauses: this.autoPauseCount,
    };
  }

  private computeConsistency(fixations: number[]): number {
    if (fixations.length < 3) return 100;
    const mean = fixations.reduce((a, b) => a + b, 0) / fixations.length;
    if (mean === 0) return 100;
    const variance = fixations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / fixations.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(100, Math.round((1 - stdDev / mean) * 100)));
  }
}

export function computeAdaptiveFeedback(
  rating: DayRating,
  currentFactor: number,
): number {
  if (rating === 'hard') return Math.max(0.5, currentFactor - 0.05);
  if (rating === 'easy') return Math.min(2.0, currentFactor + 0.05);
  return currentFactor;
}

export function generateReadingPlan(
  wordIndex: { page: number; word_count: number }[],
  targetWpm: number,
  dailyMinutes: number,
  startDate: string,
  difficulty: 'easy' | 'medium' | 'hard',
  feedbackFactor: number,
  includeRestDays: boolean,
  restDayOfWeek: number,
  syncWithChapters: boolean,
  bookmarks: { page: number }[],
): {
  day: number;
  date: string;
  pages: string;
  page_count: number;
  word_count: number;
  isRest: boolean;
}[] {
  if (!wordIndex || wordIndex.length === 0) return [];

  const difficultyMultiplier = difficulty === 'easy' ? 1.2 : difficulty === 'hard' ? 0.8 : 1.0;
  const effectiveWPM = targetWpm * difficultyMultiplier * feedbackFactor;
  const wordsPerDay = effectiveWPM * dailyMinutes;

  const plan: {
    day: number;
    date: string;
    pages: string;
    page_count: number;
    word_count: number;
    isRest: boolean;
  }[] = [];

  let currentDay = 1;
  let currentWordIndex = 0;
  const startDateTime = new Date(startDate);

  while (currentWordIndex < wordIndex.length) {
    let dayWords = 0;
    const dayPages: number[] = [];
    const startPage = wordIndex[currentWordIndex].page;

    while (currentWordIndex < wordIndex.length && dayWords < wordsPerDay) {
      const page = wordIndex[currentWordIndex];
      if (dayWords > 0 && dayWords + page.word_count > wordsPerDay * 1.2) break;

      dayWords += page.word_count;
      dayPages.push(page.page);
      currentWordIndex++;
    }

    if (dayPages.length > 0) {
      let adjustedEndPage = dayPages[dayPages.length - 1];

      if (syncWithChapters && bookmarks.length > 0) {
        const boundaryB = bookmarks.find(b => Math.abs(b.page - (adjustedEndPage + 1)) <= 2);
        if (boundaryB && boundaryB.page > startPage) {
          adjustedEndPage = boundaryB.page - 1;
        }
      }

      const date = new Date(startDateTime);
      date.setDate(date.getDate() + (currentDay - 1));

      if (includeRestDays && date.getDay() === restDayOfWeek) {
        plan.push({
          day: currentDay,
          date: date.toISOString().split('T')[0],
          pages: '-',
          page_count: 0,
          word_count: 0,
          isRest: true,
        });
        currentDay++;
        continue;
      }

      plan.push({
        day: currentDay,
        date: date.toISOString().split('T')[0],
        pages: startPage === adjustedEndPage ? `${startPage}` : `${startPage} - ${adjustedEndPage}`,
        page_count: adjustedEndPage - startPage + 1,
        word_count: dayWords,
        isRest: false,
      });
      currentDay++;
    }
  }

  return plan;
}
