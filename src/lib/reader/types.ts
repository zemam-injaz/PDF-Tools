export interface Token {
  text: string;
  index: number;
  length: number;
  type: 'word' | 'punctuation' | 'number';
  isHeading: boolean;
  isParagraphEnd: boolean;
  isSentenceEnd: boolean;
  arabicRole?: 'noun' | 'verb' | 'preposition' | 'conjunction' | 'prefix';
}

export interface TimedToken extends Token {
  dwellMs: number;
  chunkGroup: number;
}

export type ReaderMode = 'rsvp' | 'normal' | 'focus';

export type SessionState = 'idle' | 'reading' | 'paused' | 'done';

export type DayRating = 'easy' | 'good' | 'hard';

export interface SessionReport {
  fileName: string;
  mode: ReaderMode;
  totalWords: number;
  wordsRead: number;
  durationSeconds: number;
  wpm: number;
  targetWpm: number;
  chunkSize: number;
  comprehensionScore: number | null;
  consistency: number;
  regressions: number;
  averageFixationMs: number;
  date: string;
  autoPauses: number;
}

export interface ReadingInsight {
  type: 'pattern' | 'tip' | 'achievement';
  message: string;
  value?: number;
}

export interface DailyStat {
  date: string;
  minutes: number;
  avgWpm: number;
  wordsRead: number;
  sessions: number;
}

export interface BookStat {
  fileName: string;
  totalSessions: number;
  totalMinutes: number;
  avgWpm: number;
  progressPercent: number;
}
