import type { TimedToken, SessionReport, ReaderMode, SessionState, DayRating, SessionPhase, ReadingProfile, BaselineResult, ComprehensionRating } from './types';

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

  getTotalElapsedSeconds(): number {
    if (this.state === 'idle') return 0;
    const base = Date.now() - this.startTime;
    return Math.max(0, Math.floor(base / 1000));
  }

  getPauseCount(): number {
    return this.events.filter(e => e.type === 'pause').length;
  }

  getState(): SessionState {
    return this.state;
  }

  finish(wordsRead: number, totalWords: number, fileName: string, mode: ReaderMode, targetWpm: number, chunkSize: number): SessionReport {
    const elapsed = this.getElapsedSeconds();
    const minutes = elapsed / 60;
    const averageWPM = minutes > 0 ? Math.round(wordsRead / minutes) : 0;

    const displayEvents = this.events.filter(e => e.type === 'display');
    const fixations = displayEvents.map((e, i, arr) => {
      if (i === 0) return 0;
      return e.timestamp - arr[i - 1].timestamp;
    });
    const averageFixation = fixations.length > 0 ? fixations.reduce((a, b) => a + b, 0) / fixations.length : 0;
    
    // Estimate peakWPM from speed change events or targetWpm
    const speedChanges = this.events.filter(e => e.type === 'speed_change').map(e => e.data?.newWpm as number || 0);
    const maxSetWpm = Math.max(targetWpm, ...speedChanges);
    const peakWPM = Math.max(averageWPM, maxSetWpm);

    const regressionCount = this.events.filter(e => e.type === 'regression').length;
    // We normalize consistency over the display events (which correspond to chunks)
    // but the actual report asked to do it per word. Since we only have chunk display events,
    // we compute consistency over chunks but consider the dwell times.
    const consistency = this.computeConsistency(fixations);

    this.state = 'done';

    return {
      fileName,
      mode,
      totalWords,
      wordsRead,
      durationSeconds: elapsed,
      averageWPM,
      peakWPM,
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
    const validFixations = fixations.filter(f => f > 0);
    if (validFixations.length < 3) return 100;
    const mean = validFixations.reduce((a, b) => a + b, 0) / validFixations.length;
    if (mean === 0) return 100;
    const variance = validFixations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validFixations.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(100, Math.round((1 - stdDev / mean) * 100)));
  }

  // ── Phase 2: Baseline & Coaching ──

  finishBaseline(wordsRead: number): BaselineResult {
    const activeSec = this.getElapsedSeconds();
    const totalSec = this.getTotalElapsedSeconds();
    const minutes = activeSec / 60;
    const naturalWpm = minutes > 0 ? Math.round(wordsRead / minutes) : 0;
    
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (activeSec >= 180 && this.getPauseCount() <= 3) {
      confidence = 'high';
    } else if (activeSec >= 60) {
      confidence = 'medium';
    }

    this.state = 'done';

    return {
      naturalWpm,
      durationSeconds: totalSec,
      activeSeconds: activeSec,
      wordsRead,
      confidence
    };
  }
}

export class SessionCoach {
  private profile: ReadingProfile;
  
  constructor(profile: ReadingProfile) {
    this.profile = profile;
  }

  getPhaseAndSpeed(activeElapsedSec: number): { phase: SessionPhase, targetWpm: number } {
    // 0:00 - 1:00 Warm-up (Comfortable WPM)
    if (activeElapsedSec < 60) {
      return { phase: 'warmup', targetWpm: this.profile.comfortableWpm };
    }
    // 1:00 - 8:00 Training (Training WPM)
    if (activeElapsedSec < 480) {
      return { phase: 'training', targetWpm: this.profile.trainingWpm };
    }
    // 8:00 - 11:00 Challenge (Challenge WPM)
    if (activeElapsedSec < 660) {
      return { phase: 'challenge', targetWpm: this.profile.challengeWpm };
    }
    // 11:00+ Recovery (Comfortable WPM)
    return { phase: 'recovery', targetWpm: this.profile.comfortableWpm };
  }

  static generateInitialProfile(baseline: BaselineResult): ReadingProfile {
    const natural = baseline.naturalWpm;
    return {
      naturalWpm: natural,
      comfortableWpm: Math.round(natural * 0.95),
      trainingWpm: natural,
      challengeWpm: Math.round(natural * 1.10),
      peakWpm: natural,
      bestStableWpm: natural,
    };
  }

  static applyComprehensionFeedback(profile: ReadingProfile, rating: ComprehensionRating): ReadingProfile {
    const newProfile = { ...profile };
    // 4-5: +5%, 3: maintain, 1-2: -5%
    if (rating >= 4) {
      newProfile.trainingWpm = Math.round(newProfile.trainingWpm * 1.05);
    } else if (rating <= 2) {
      newProfile.trainingWpm = Math.round(newProfile.trainingWpm * 0.95);
    }
    
    // Ensure boundaries
    newProfile.trainingWpm = Math.max(newProfile.comfortableWpm, newProfile.trainingWpm);
    newProfile.challengeWpm = Math.round(newProfile.trainingWpm * 1.10);
    newProfile.peakWpm = Math.max(newProfile.peakWpm, newProfile.challengeWpm);
    
    if (rating >= 4) {
      newProfile.bestStableWpm = Math.max(newProfile.bestStableWpm, profile.trainingWpm);
    }

    return newProfile;
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
