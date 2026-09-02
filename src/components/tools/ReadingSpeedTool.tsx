import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Play, Pause, Square, Upload, CheckCircle, BookOpen, Zap,
  Loader2, Clock, Calendar as CalendarIcon, BarChart3, Lock,
  Maximize2, Eye, TrendingUp, Award, Target, X
} from 'lucide-react';
import { api, type TaskInfo } from '../../lib/api';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PricingPage } from '../pricing/PricingPage';
import { UpgradeButton } from '../pricing/UpgradeButton';
import { tokenize, buildChunks, getOrpIndex, type Language } from '../../lib/reader/Tokenizer';
import { chunkDwellMs, effectiveWPM, chunkSizeFromWPM, WARM_UP_SECONDS } from '../../lib/reader/TimingEngine';
import { SessionTracker, generateReadingPlan } from '../../lib/reader/SessionTracker';
import type { Token, SessionReport, TimedToken } from '../../lib/reader/types';

// ─── Types ──────────────────────────────────────────────────────────────────

type FileMode = 'md' | 'pdf';
type SessionState = 'idle' | 'reading' | 'paused' | 'done';
type ReaderMode = 'normal' | 'rsvp' | 'focus';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function countWordsInChunks(chunks: Token[][], upToExclusive: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(upToExclusive, chunks.length); i++) {
    n += chunks[i].filter(t => t.type === 'word').length;
  }
  return n;
}

function chunkIndexForWord(chunks: Token[][], wordIndex: number): number {
  let acc = 0;
  for (let i = 0; i < chunks.length; i++) {
    acc += chunks[i].filter(t => t.type === 'word').length;
    if (acc > wordIndex) return i;
  }
  return Math.max(0, chunks.length - 1);
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SpeedRing({ wpm, targetWPM }: { wpm: number; targetWPM: number }) {
  const pct = Math.min(100, (wpm / (targetWPM * 1.2)) * 100);
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke="url(#wpmGrad)" strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <defs>
          <linearGradient id="wpmGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white tabular-nums leading-none">{wpm}</span>
        <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5">WPM</span>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color = 'indigo' }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  };
  return (
    <div className={`flex flex-col items-center px-5 py-3 rounded-2xl border ${colors[color]}`}>
      <span className="text-xl font-black tabular-nums">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

// ─── ORP Word Renderer ────────────────────────────────────────────────────────

function OrpWord({ word, language }: { word: string; language: Language }) {
  if (!word) return null;
  // Get ORP index (fixation point)
  const cleanWord = word.replace(/[^\u0600-\u06FFa-zA-Z]/g, '');
  const orp = getOrpIndex(cleanWord, language);
  const before = word.substring(0, orp);
  const pivot = word[orp] || '';
  const after = word.substring(orp + 1);

  return (
    <span className="inline-block text-center w-full">
      <span className="text-slate-300/80">{before}</span>
      <span className="text-red-400 font-black drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]">{pivot}</span>
      <span className="text-slate-300/80">{after}</span>
    </span>
  );
}

// ─── RSVP Display ────────────────────────────────────────────────────────────
//
// Expert fast-reading display with:
//  - Flash animation on every word change
//  - Horizontal ORP alignment guide (left-third focus line)
//  - Colour-coded ORP pivot letter
//  - Ghost preview of next chunk
//  - Bottom HUD only in card mode (no overlap in fullscreen)

interface RSVPDisplayProps {
  currentChunk: Token[];
  nextChunk: Token[];
  language: Language;
  progress: number;
  wpm: number;
  elapsed: number;
  targetWPM: number;
  onSpeedChange: (delta: number) => void;
  isImmersive?: boolean;
}

function RSVPDisplay({
  currentChunk,
  nextChunk,
  language,
  progress,
  wpm,
  elapsed,
  targetWPM,
  onSpeedChange,
  isImmersive = false,
}: RSVPDisplayProps) {
  const [flash, setFlash] = useState(false);
  const wordTokens = currentChunk.filter(t => t.type === 'word');
  const nextWords  = nextChunk.filter(t => t.type === 'word').map(t => t.text).join(' ');
  const isSingle   = wordTokens.length === 1;
  const chunkKey   = wordTokens.map(t => t.text).join('\u00b7');
  const fontFamily = language === 'ar' ? "'IBM Plex Sans Arabic', sans-serif" : "'Inter', sans-serif";

  // 80ms flash effect on every word change
  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 80);
    return () => clearTimeout(t);
  }, [chunkKey]);

  return (
    <div
      onWheel={(e) => {
        // Prevent default scrolling and change speed smoothly
        if (Math.abs(e.deltaY) > 0) {
          onSpeedChange(e.deltaY > 0 ? -10 : 10);
        }
      }}
      className={`relative flex flex-col bg-[#070b12] overflow-hidden
        ${isImmersive
          ? 'flex-1 w-full'
          : 'h-[400px] rounded-2xl border border-slate-800/50 shadow-[0_0_60px_rgba(99,102,241,0.07)]'}`}
    >
      {/* Pulsing ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-75"
        style={{ opacity: flash ? 0.20 : 0.06 }}
      >
        <div className="w-[520px] h-[220px] bg-indigo-500 blur-[90px] rounded-full" />
      </div>

      {/* Horizontal guide rails framing the word zone */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent -translate-y-[52px]" />
        <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent  translate-y-[52px]" />
      </div>

      {/* Vertical ORP focal marker */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 flex items-center"
        style={{ [language === 'ar' ? 'right' : 'left']: '40%' }}
      >
        <div
          className="w-[2px] h-16 rounded-full transition-all duration-75"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.7) 25%, rgba(139,92,246,0.7) 75%, transparent)',
            opacity: flash ? 1 : 0.35,
            transform: flash ? 'scaleY(1.15)' : 'scaleY(1)',
          }}
        />
      </div>

      {/* Ghost next-word preview above */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center pt-4 pointer-events-none"
        style={{ fontFamily }}
      >
        <span
          className="text-slate-700 text-sm font-medium tracking-wide transition-opacity duration-200"
          style={{ opacity: nextWords ? 0.55 : 0 }}
        >
          {nextWords}
        </span>
      </div>

      {/* ── Main word zone ── */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div
          key={chunkKey}
          className="w-full text-center select-none"
          style={{
            fontFamily,
            animation: 'rsvpFlash 0.09s ease-out',
          }}
        >
          {isSingle ? (
            <div
              className="leading-none tracking-tight"
              style={{
                fontSize: isImmersive ? 'clamp(4.5rem,11vw,10rem)' : 'clamp(3.2rem,7vw,6rem)',
                fontWeight: 900,
              }}
            >
              <OrpWord word={wordTokens[0].text} language={language} />
            </div>
          ) : (
            <div
              className="flex flex-wrap justify-center leading-tight"
              style={{
                fontSize: isImmersive ? 'clamp(2.5rem,6vw,5rem)' : 'clamp(1.8rem,4vw,3rem)',
                fontWeight: 800,
                gap: '0.5rem 1rem',
              }}
            >
              {wordTokens.map((token, i) => (
                <span
                  key={i}
                  style={{
                    color: i === 0 ? '#a5b4fc' : '#e2e8f0',
                    textShadow: i === 0 ? '0 0 28px rgba(165,180,252,0.4)' : 'none',
                  }}
                >
                  {token.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.04]">
        <div
          className="h-full bg-gradient-to-r from-indigo-600 via-violet-500 to-purple-500"
          style={{ width: `${progress}%`, transition: 'width 0.4s linear' }}
        />
      </div>

      {/* HUD — card mode only, no overlap in fullscreen */}
      {!isImmersive && (
        <div className="absolute bottom-1 left-0 right-0 px-5 pb-4 flex items-end justify-between z-20">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">سرعة</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => onSpeedChange(-25)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-indigo-500/20 text-slate-500 hover:text-white text-xs font-bold transition-all">−</button>
              <span className="text-indigo-400 font-black text-sm tabular-nums w-11 text-center">{targetWPM}</span>
              <button onClick={() => onSpeedChange(25)}  className="w-6 h-6 rounded-md bg-white/5 hover:bg-indigo-500/20 text-slate-500 hover:text-white text-xs font-bold transition-all">+</button>
            </div>
          </div>
          <div className="flex gap-5 text-center">
            <div>
              <div className="text-base font-black text-white tabular-nums">{formatTime(elapsed)}</div>
              <div className="text-[7px] text-slate-600 uppercase tracking-widest">وقت</div>
            </div>
            <div>
              <div className="text-base font-black text-indigo-400 tabular-nums">{Math.round(progress)}%</div>
              <div className="text-[7px] text-slate-600 uppercase tracking-widest">تقدم</div>
            </div>
          </div>
          <div className="scale-[0.65] origin-bottom-right">
            <SpeedRing wpm={wpm} targetWPM={targetWPM} />
          </div>
        </div>
      )}

      {/* Keyframe animation — made softer for ultra-smooth high-speed reading */}
      <style>{`
        @keyframes rsvpFlash {
          0%   { opacity: 0.6; transform: scale(0.98); }
          100% { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReadingSpeedTool() {
  const { checkAccess } = useSubscription();
  const [showPricing, setShowPricing] = useState(false);
  const hasAccess = checkAccess('fast_reading');
  const [activeTab, setActiveTab] = useState<'session' | 'plan'>('session');

  // ── File State ──────────────────────────────────────────────────────────────
  const [fileMode, setFileMode] = useState<FileMode>('md');
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [mdText, setMdText] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useOcr, setUseOcr] = useState(false);
  const [language, setLanguage] = useState<Language>('ar');

  // ── Session State ───────────────────────────────────────────────────────────
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<SessionReport[]>([]);
  const [lastSession, setLastSession] = useState<SessionReport | null>(null);

  // ── RSVP / Reader State ─────────────────────────────────────────────────────
  const [readerMode, setReaderMode] = useState<ReaderMode>('rsvp');
  const [chunkIndex, setChunkIndex] = useState(0);   // current chunk index
  const [targetWPM, setTargetWPM] = useState(300);
  const [isImmersive, setIsImmersive] = useState(false);
  const [autoChunkSize, setAutoChunkSize] = useState(true); // auto derive from WPM
  const [manualChunkSize, setManualChunkSize] = useState(2);

  // Computed chunk size
  const chunkSize = autoChunkSize ? chunkSizeFromWPM(targetWPM) : manualChunkSize;

  // Token and chunk data
  const tokensRef = useRef<Token[]>([]);
  const chunksRef = useRef<Token[][]>([]);
  const sessionStartMs = useRef(0);
  const pausedElapsedMs = useRef(0);
  const timerRef = useRef<number | null>(null);
  const rsvpTimerRef = useRef<number | null>(null);
  const trackerRef = useRef(new SessionTracker());
  const [liveWPM, setLiveWPM] = useState(0);

  // ── Planning State ──────────────────────────────────────────────────────────
  const [wordIndex, setWordIndex] = useState<{ page: number; word_count: number }[] | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<number | null>(null);
  const [indexingMessage, setIndexingMessage] = useState<string | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState<any[]>([]);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [planViewMode, setPlanViewMode] = useState<'table' | 'calendar'>('table');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [feedbackFactor, setFeedbackFactor] = useState(1.0);
  const [dayRatings, setDayRatings] = useState<{ [key: number]: 'easy' | 'good' | 'hard' }>({});
  const [includeRestDays, setIncludeRestDays] = useState(true);
  const [restDayOfWeek, setRestDayOfWeek] = useState(5);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [syncWithChapters, setSyncWithChapters] = useState(true);

  // ── Session Timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionState === 'reading') {
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - sessionStartMs.current + pausedElapsedMs.current) / 1000));
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  // ── File Picker ─────────────────────────────────────────────────────────────
  const mdInputRef = useRef<HTMLInputElement>(null);

  const processText = useCallback((text: string, name: string) => {
    const tokens = tokenize(text);
    const detectedLang: Language = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
    tokensRef.current = tokens;
    setLanguage(detectedLang);

    // Build initial chunks using the current chunk-size setting (auto or manual)
    chunksRef.current = buildChunks(tokens, chunkSize, detectedLang);

    const wordCount = tokens.filter(t => t.type === 'word').length;
    setTotalWords(wordCount);
    setMdText(text);
    setFileName(name);
    setChunkIndex(0);
    setLoading(false);
    setSessionState('idle');
    setElapsed(0);
    setLastSession(null);
  }, [chunkSize]);

  const handleMdFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      processText(text, file.name);
    };
    reader.onerror = () => { setError('فشل قراءة الملف'); setLoading(false); };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }, [processText]);

  const handlePdfFilePick = useCallback(async () => {
    setError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!selected || typeof selected !== 'string') return;

      setFilePath(selected);
      const name = selected.split(/[/\\]/).pop() || selected;
      setLoading(true);
      setSessionState('idle');
      setElapsed(0);
      setCurrentPage(1);
      setMdText(null);
      setLastSession(null);

      if (useOcr) {
        const dir = selected.substring(0, Math.max(selected.lastIndexOf('/'), selected.lastIndexOf('\\')));
        const res = await api.tahweel.convert(selected, dir || '.', true);
        if (res.success && res.data?.txt_content) {
          processText(res.data.txt_content, name);
          setFileMode('md');
        } else {
          setError('تعذّر إجراء OCR: ' + (res.error || ''));
          setLoading(false);
        }
      } else {
        const res = await api.info(selected);
        if (res.success && res.data) {
          setTotalPages(res.data.page_count);
          setFileName(name);
          try {
            const { bookmarkApi } = await import('../../api/bookmarkApi');
            const bData = await bookmarkApi.extractBookmarks(selected);
            if (bData.has_bookmarks) setBookmarks(bData.bookmarks);
          } catch { /* ignore */ }
          setLoading(false);
        } else {
          setError('تعذّر قراءة الملف: ' + (res.error || ''));
          setLoading(false);
        }
      }
    } catch (e: any) {
      setError('خطأ أثناء فتح الملف: ' + (e?.message || e));
      setLoading(false);
    }
  }, [useOcr, processText]);

  const handlePickFile = fileMode === 'md' ? () => mdInputRef.current?.click() : handlePdfFilePick;

  // ── Rebuild chunks when autoChunkSize / manualChunkSize / language changes ──
  useEffect(() => {
    if (tokensRef.current.length === 0) return;
    const wordOffset = countWordsInChunks(chunksRef.current, chunkIndex);
    chunksRef.current = buildChunks(tokensRef.current, chunkSize, language);
    const newIdx = Math.min(
      chunkIndexForWord(chunksRef.current, wordOffset),
      Math.max(0, chunksRef.current.length - 1),
    );
    setChunkIndex(newIdx);
    if (sessionState === 'reading') {
      if (rsvpTimerRef.current) { clearTimeout(rsvpTimerRef.current); rsvpTimerRef.current = null; }
      // Use wall-clock elapsed so effective WPM is computed correctly
      const wallElapsedMs = Date.now() - sessionStartMs.current + pausedElapsedMs.current;
      scheduleNextChunk(newIdx, wallElapsedMs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoChunkSize, manualChunkSize, language]);

  // ── State Ref for closures ──────────────────────────────────────────────────
  const stateRef = useRef({ targetWPM, chunkSize, readerMode, chunkIndex });
  useEffect(() => {
    stateRef.current = { targetWPM, chunkSize, readerMode, chunkIndex };
  }, [targetWPM, chunkSize, readerMode, chunkIndex]);

  // ── Smart Pause Detection ───────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionState === 'reading') {
        handlePause(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionState]);

  // ── Controls ─────────────────────────────────────────────────────────────────
  const handleStart = () => {
    // effectiveStartMs = a virtual timestamp such that (Date.now() - effectiveStartMs) = 0
    // We store it so the scheduler can compute wall-clock elapsed directly.
    sessionStartMs.current = Date.now();
    pausedElapsedMs.current = 0;
    setElapsed(0);
    setCurrentPage(1);
    setChunkIndex(0);
    setSessionState('reading');
    setLiveWPM(0);
    trackerRef.current.start();
    if (fileMode === 'md') {
      scheduleNextChunk(0, sessionStartMs.current);
    }
  };

  const handlePause = (isAuto: boolean = false) => {
    // Accumulate elapsed BEFORE clearing sessionStartMs
    pausedElapsedMs.current += Date.now() - sessionStartMs.current;
    sessionStartMs.current = 0;
    setSessionState('paused');
    if (rsvpTimerRef.current) { clearTimeout(rsvpTimerRef.current); rsvpTimerRef.current = null; }
    trackerRef.current.pause(isAuto);
  };

  const handleResume = () => {
    // Shift sessionStartMs so that (Date.now() - sessionStartMs) = pausedElapsedMs
    // This makes the warm-up correctly count cumulative active reading time
    sessionStartMs.current = Date.now() - pausedElapsedMs.current;
    setSessionState('reading');
    trackerRef.current.resume();
    scheduleNextChunk(chunkIndex, sessionStartMs.current);
  };

  const handleStop = () => {
    setSessionState('idle');
    setElapsed(0);
    setChunkIndex(0);
    if (rsvpTimerRef.current) { clearTimeout(rsvpTimerRef.current); rsvpTimerRef.current = null; }
  };

  const handleFinish = useCallback((finalIdx?: number) => {
    if (rsvpTimerRef.current) { clearTimeout(rsvpTimerRef.current); rsvpTimerRef.current = null; }
    
    const s = stateRef.current;
    const actualIdx = typeof finalIdx === 'number' ? finalIdx : s.chunkIndex;
    
    const wordsRead = countWordsInChunks(chunksRef.current, actualIdx);
    const report = trackerRef.current.finish(wordsRead, totalWords, fileName || 'Document', s.readerMode, s.targetWPM, s.chunkSize);
    
    setLastSession(report);
    setSessions(prev => [report, ...prev.slice(0, 9)]);
    setSessionState('done');
    if (report.averageWPM > 0) setTargetWPM(report.averageWPM);
    localStorage.setItem('fast_reading_last_wpm', String(report.averageWPM));
  }, [fileName, totalWords]);

  // ── RSVP Scheduler ────────────────────────────────────────────────────────
  // We pass the *session-start timestamp* (ms) so each call computes
  // effective WPM from real wall-clock elapsed time, not accumulated dwell.
  const scheduleNextChunk = useCallback((idx: number, sessionStartTimestamp: number, overrideWpm?: number) => {
    if (idx >= chunksRef.current.length) {
      handleFinish(idx);
      return;
    }
    const chunk    = chunksRef.current[idx];
    const wpmToUse = overrideWpm ?? stateRef.current.targetWPM;
    // Real wall-clock elapsed since session start (excludes paused time via offset)
    const wallElapsedMs = Date.now() - sessionStartTimestamp;
    const currentWPM    = effectiveWPM(wpmToUse, wallElapsedMs);
    const dwell         = chunkDwellMs(chunk, currentWPM);

    trackerRef.current.recordDisplay({ ...chunk[0], dwellMs: dwell, chunkGroup: idx });
    setChunkIndex(idx);
    setLiveWPM(Math.round(currentWPM));

    rsvpTimerRef.current = window.setTimeout(() => {
      scheduleNextChunk(idx + 1, sessionStartTimestamp, overrideWpm);
    }, dwell);
  }, [handleFinish]);

  const handleSpeedChange = useCallback((delta: number) => {
    setTargetWPM(v => {
      const newWpm = Math.max(50, Math.min(1000, v + delta));
      if (sessionState === 'reading' && rsvpTimerRef.current) {
        clearTimeout(rsvpTimerRef.current);
        // Resume from current chunk with new WPM; pass the same virtual start timestamp
        scheduleNextChunk(stateRef.current.chunkIndex, sessionStartMs.current, newWpm);
      }
      return newWpm;
    });
  }, [sessionState, scheduleNextChunk]);

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (readerMode !== 'rsvp' || !mdText) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (sessionState === 'reading') handlePause();
        else if (sessionState === 'paused') handleResume();
      } else if (e.code === 'ArrowUp') handleSpeedChange(25);
      else if (e.code === 'ArrowDown') handleSpeedChange(-25);
      else if (e.code === 'Escape') setIsImmersive(false);
      else if (e.code === 'KeyF') setIsImmersive(v => !v);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [readerMode, mdText, sessionState, handlePause, handleResume, handleSpeedChange]);

  // Auto-scroll normal reader
  useEffect(() => {
    if (readerMode === 'normal' && sessionState === 'reading') {
      const el = document.getElementById('current-chunk');
      const container = document.getElementById('normal-reader');
      if (el && container) {
        const top = el.offsetTop - container.offsetHeight / 2;
        container.scrollTo({ top, behavior: 'smooth' });
      }
    }
  }, [chunkIndex, readerMode, sessionState]);

  // ── Load feedback factor from localStorage ──────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('fast_reading_feedback_factor');
    if (saved) setFeedbackFactor(JSON.parse(saved));
    const savedWPM = localStorage.getItem('fast_reading_last_wpm');
    if (savedWPM) setTargetWPM(parseInt(savedWPM) || 300);
  }, []);

  // ── Planning ─────────────────────────────────────────────────────────────────
  const handleIndexBook = async () => {
    if (!filePath) return;
    setIsIndexing(true);
    setIndexingProgress(0);
    setIndexingMessage('جاري بدء الفهرسة...');
    setError(null);
    try {
      if (useOcr) {
        setIndexingMessage('جاري التعرف الضوئي (OCR) لحساب الكلمات...');
        const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
        const res = await api.tahweel.convert(filePath, dir || '.', true, true);
        if (res.success && res.data?.task_id) {
          const taskId = res.data.task_id;
          const poll = setInterval(async () => {
            const s = await api.tasks.getStatus(taskId);
            if (s.success && s.data) {
              const info = (s.data as unknown) as TaskInfo;
              setIndexingProgress(info.progress);
              setIndexingMessage(info.message || 'جاري...');
              if (info.status === 'completed') {
                clearInterval(poll);
                if (info.result?.word_index) { setWordIndex(info.result.word_index); }
                else setError('فشل استخراج الفهرس');
                setIsIndexing(false);
              } else if (info.status === 'failed') {
                clearInterval(poll);
                setError(info.message || 'فشلت الفهرسة');
                setIsIndexing(false);
              }
            }
          }, 2000);
        } else { setError(res.error || 'فشل بدء OCR'); setIsIndexing(false); }
      } else {
        setIndexingMessage('جاري استخراج النصوص...');
        const res = await api.tahweel.index(filePath, false, false);
        if (res.success && res.data) { setWordIndex((res.data as unknown) as { page: number; word_count: number }[]); }
        else setError(res.error || 'فشل الفهرسة');
        setIsIndexing(false);
      }
    } catch (err: any) { setError(err.message || 'خطأ'); setIsIndexing(false); }
  };

  const handleGeneratePlan = () => {
    if (!wordIndex?.length) { setError('يجب فهرسة الكتاب أولاً'); return; }
    const newPlan = generateReadingPlan(
      wordIndex,
      targetWPM,
      dailyMinutes,
      startDate,
      difficulty,
      feedbackFactor,
      includeRestDays,
      restDayOfWeek,
      syncWithChapters,
      bookmarks
    );
    setPlan(newPlan);
    setIsPlanGenerated(true);
  };

  const handleDayRating = (day: number, rating: 'easy' | 'good' | 'hard') => {
    setDayRatings(p => ({ ...p, [day]: rating }));
    let newFactor = feedbackFactor;
    if (rating === 'hard') newFactor = Math.max(0.5, feedbackFactor - 0.05);
    else if (rating === 'easy') newFactor = Math.min(2.0, feedbackFactor + 0.05);
    setFeedbackFactor(newFactor);
    localStorage.setItem('fast_reading_feedback_factor', JSON.stringify(newFactor));
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const currentChunks = chunksRef.current;
  const currentChunk = currentChunks[chunkIndex] || [];
  const nextChunk = currentChunks[chunkIndex + 1] || [];
  const progressPct = currentChunks.length > 0 ? (chunkIndex / currentChunks.length) * 100 : 0;

  // ── Access Gate ───────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-gray-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">خاصية مدفوعة</h2>
          <p className="text-gray-500 mb-8">القراءة السريعة الذكية متاحة في النسخة الكاملة.</p>
          <UpgradeButton onClick={() => setShowPricing(true)} className="w-full justify-center" />
        </div>
      </div>
    );
  }

  // ── Immersive Overlay ─────────────────────────────────────────────────────────
  //
  // Layout: fixed full-screen column
  //   ┌──────────────────────────────┐  ← top HUD (auto-hides, 56px)
  //   │  word display area (flex-1)  │  ← all available height
  //   ├──────────────────────────────┤  ← stats bar (72px)
  //   │  controls row (auto-hides)   │  ← bottom controls (72px)
  //   └──────────────────────────────┘
  //
  // RSVPDisplay in immersive mode renders ONLY the word + ambient glow.
  // All HUD elements (speed, stats, ring, progress bar) live here so there
  // is zero overlap between the display and the controls.

  const immersiveOverlay = isImmersive && sessionState !== 'idle' && sessionState !== 'done' && (
    <div 
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col" 
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > 0) handleSpeedChange(e.deltaY > 0 ? -10 : 10);
      }}
    >

      {/* ── Top HUD (file name + close) — fades in on hover ── */}
      <div className="flex items-center justify-between px-6 py-3 opacity-0 hover:opacity-100 transition-opacity duration-300 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-slate-400 text-sm font-medium">{fileName}</span>
        </div>
        <button
          onClick={() => setIsImmersive(false)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Word display — takes all remaining space ── */}
      <div className="flex-1 flex items-center justify-center min-h-0 relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-48 bg-indigo-600/8 blur-3xl rounded-full" />
        </div>
        {/* Eye guide */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-[2px] h-24 bg-gradient-to-b from-transparent via-indigo-500/25 to-transparent" />
        </div>
        {/* Next word preview */}
        <div className="absolute top-[calc(50%-6rem)] left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-slate-600 text-sm">
            {nextChunk.map(t => t.text).join(' ')}
          </span>
        </div>
        {/* Main word */}
        <div
          className="text-center w-full px-12 z-10"
          style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', sans-serif" : 'inherit' }}
        >
          {currentChunk.length === 1 ? (
            <div className="text-7xl md:text-9xl font-extrabold tracking-tight select-none">
              <OrpWord word={currentChunk[0].text} language={language} />
            </div>
          ) : (
            <div className="text-4xl md:text-6xl font-bold text-slate-100 flex flex-wrap justify-center gap-4 select-none">
              {currentChunk.map((token, i) => (
                <span key={i} className={i === 0 ? 'text-indigo-300' : 'text-slate-200'}>{token.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats bar — always visible ── */}
      <div className="shrink-0 flex items-center justify-between px-8 py-4 border-t border-white/5">
        {/* Speed control */}
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Speed</span>
          <div className="flex items-center gap-3">
            <button onClick={() => handleSpeedChange(-25)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold transition-all">−</button>
            <span className="text-indigo-400 font-black text-base tabular-nums w-14 text-center">{targetWPM} WPM</span>
            <button onClick={() => handleSpeedChange(25)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold transition-all">+</button>
          </div>
        </div>

        {/* Center: elapsed + progress */}
        <div className="flex items-center gap-8 text-center">
          <div>
            <div className="text-xl font-black text-white tabular-nums">{formatTime(elapsed)}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Elapsed</div>
          </div>
          <div>
            <div className="text-xl font-black text-indigo-400 tabular-nums">{Math.round(progressPct)}%</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">Progress</div>
          </div>
        </div>

        {/* Right: WPM ring */}
        <div className="scale-75 origin-center">
          <SpeedRing wpm={liveWPM} targetWPM={targetWPM} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 shrink-0">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>

      {/* ── Control row — fades in on hover ── */}
      <div className="shrink-0 flex items-center justify-center gap-4 py-5 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={() => sessionState === 'reading' ? handlePause() : handleResume()}
          className="flex items-center gap-3 px-8 py-3 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xl"
        >
          {sessionState === 'reading'
            ? <><Pause size={18} fill="currentColor" /> إيقاف مؤقت</>
            : <><Play  size={18} fill="currentColor" /> استئناف</>}
        </button>
        <button onClick={handleFinish} className="px-6 py-3 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all flex items-center gap-2">
          <CheckCircle size={18} /> انتهيت
        </button>
        <button onClick={handleStop} className="p-3 rounded-2xl text-slate-400 bg-white/5 hover:bg-white/10 transition-all">
          <Square size={18} />
        </button>
      </div>
    </div>
  );

  // ── Normal reader (focus-mode with line highlighting) ─────────────────────────
  const renderNormalReader = () => {
    if (!mdText) return null;
    const lines = mdText.split('\n');
    let globalChunkIdx = 0;

    return (
      <div
        id="normal-reader"
        className="h-[520px] overflow-y-auto custom-scrollbar relative"
        style={{ background: 'linear-gradient(to bottom, #0f0f1a, #0a0a14)' }}
      >
        {/* Focus guide gradient overlay */}
        {readerMode === 'focus' && (
          <>
            <div className="sticky top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0f0f1a] to-transparent pointer-events-none z-10" />
            <div className="sticky bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0f0f1a] to-transparent pointer-events-none z-10" />
          </>
        )}
        <div className="max-w-2xl mx-auto px-8 py-40 space-y-4">
          {lines.map((line, lineIdx) => {
            const isHeading = line.startsWith('#');
            const cleanLine = isHeading ? line.replace(/^#+\s*/, '') : line;
            if (!cleanLine.trim()) return <div key={lineIdx} className="h-4" />;
            const words = cleanLine.split(/\s+/).filter(Boolean);

            return (
              <div
                key={lineIdx}
                className={`flex flex-wrap gap-1.5 ${isHeading ? 'text-4xl font-black text-white mb-4 mt-8' : 'text-2xl leading-relaxed'}`}
                style={{ fontFamily: language === 'ar' ? "'IBM Plex Sans Arabic', sans-serif" : "inherit", direction: language === 'ar' ? 'rtl' : 'ltr' }}
              >
                {words.map((word, wi) => {
                  const thisChunkIdx = globalChunkIdx++;
                  const isCurrentChunk = thisChunkIdx === chunkIndex;
                  const isPast = thisChunkIdx < chunkIndex;

                  const focusOpacity = readerMode === 'focus'
                    ? (isCurrentChunk ? 1 : Math.max(0, 1 - Math.abs(thisChunkIdx - chunkIndex) * 0.15))
                    : 1;

                  return (
                    <span
                      key={wi}
                      id={isCurrentChunk ? 'current-chunk' : undefined}
                      className={`px-1.5 py-0.5 rounded-lg transition-all duration-200 ${
                        isCurrentChunk
                          ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40'
                          : isPast
                            ? 'text-slate-600'
                            : 'text-slate-400'
                      }`}
                      style={{ opacity: focusOpacity }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {immersiveOverlay}
      <div className="max-w-4xl mx-auto w-full pb-12" dir="rtl">

        {/* ── Header ── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-1 flex items-center gap-2">
              <Zap size={22} className="text-indigo-500" />
              القراءة السريعة الذكية
            </h2>
            <p className="text-gray-500 text-sm">محرك قراءة متكامل بتوقيت لغوي وتحليل جلسات</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setActiveTab('session')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'session' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Zap size={15} /> قراءة سريعة
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'plan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarIcon size={15} /> خطة القراءة
            </button>
          </div>
        </div>

        {/* ── SESSION TAB ── */}
        {activeTab === 'session' ? (
          <>
            {/* File mode toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-2xl w-fit">
              {(['md', 'pdf'] as FileMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setFileMode(m); setFileName(null); setMdText(null); setSessionState('idle'); setElapsed(0); setError(null); tokensRef.current = []; chunksRef.current = []; }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${fileMode === m ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {m === 'md' ? <><Zap size={15} /> نص / Markdown</> : <><BookOpen size={15} /> PDF — صفحة/دقيقة</>}
                </button>
              ))}
            </div>

            <input ref={mdInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleMdFilePick} />

            {/* File picker card */}
            <div className="card mb-6">
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={handlePickFile}
                  disabled={loading || sessionState === 'reading'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                >
                  <Upload size={17} />
                  {loading ? 'جاري التحميل...' : `اختر ملف ${fileMode === 'md' ? 'نص / MD' : 'PDF'}`}
                </button>
                {fileName && !loading && (
                  <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                    <FileText size={15} className="text-indigo-500" />
                    <span className="font-medium text-sm">{fileName}</span>
                    {totalWords > 0 && (
                      <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                        {totalWords.toLocaleString()} كلمة
                      </span>
                    )}
                    {language && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                        {language === 'ar' ? 'عربي' : language === 'en' ? 'إنجليزي' : 'مختلط'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {fileMode === 'pdf' && !fileName && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={useOcr} onChange={e => setUseOcr(e.target.checked)} />
                    <div>
                      <span className="text-sm font-bold text-gray-700">استخدام Tahweel OCR (للملفات المصورة)</span>
                      <p className="text-[11px] text-gray-400">يحوّل الصفحات المصورة لنص ثم يبنى محرك القراءة عليه</p>
                    </div>
                  </label>
                </div>
              )}
              {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            </div>

            {/* Reader Mode + Controls (MD mode) */}
            {fileMode === 'md' && mdText && sessionState !== 'done' && (
              <div className="card mb-6 overflow-hidden p-0">
                {/* Reader mode tabs */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setReaderMode('rsvp')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${readerMode === 'rsvp' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
                      <Zap size={13} /> RSVP
                    </button>
                    <button onClick={() => setReaderMode('normal')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${readerMode === 'normal' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
                      <Eye size={13} /> عرض النص
                    </button>
                    <button onClick={() => setReaderMode('focus')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${readerMode === 'focus' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
                      <Target size={13} /> تركيز
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {sessionState === 'reading' && (
                      <span className="text-sm font-bold text-indigo-600 tabular-nums bg-indigo-50 px-3 py-1 rounded-lg">
                        {formatTime(elapsed)}
                      </span>
                    )}
                    {/* Immersive / chunk settings */}
                    {readerMode === 'rsvp' && (
                      <button
                        onClick={() => setIsImmersive(true)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all"
                        title="وضع الانغماس الكامل (F)"
                      >
                        <Maximize2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* RSVP Display */}
                {readerMode === 'rsvp' ? (
                  <RSVPDisplay
                    currentChunk={currentChunk}
                    nextChunk={nextChunk}
                    language={language}
                    progress={progressPct}
                    wpm={liveWPM}
                    elapsed={elapsed}
                    targetWPM={targetWPM}
                    onSpeedChange={handleSpeedChange}
                  />
                ) : (
                  renderNormalReader()
                )}

                {/* Chunk size settings for RSVP */}
                {readerMode === 'rsvp' && (
                  <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/50 flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">حجم المقطع:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 text-indigo-600 rounded" checked={autoChunkSize} onChange={e => setAutoChunkSize(e.target.checked)} />
                        <span className="text-xs text-gray-600 font-medium">تلقائي</span>
                      </label>
                      <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 8, 10].map(c => (
                          <button
                            key={c}
                            onClick={() => {
                              setAutoChunkSize(false);
                              setManualChunkSize(c);
                            }}
                            className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                              !autoChunkSize && manualChunkSize === c
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-gray-400 border border-gray-200 hover:border-indigo-300 hover:text-indigo-500'
                            } ${autoChunkSize ? 'opacity-50 grayscale' : ''}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      {autoChunkSize && (
                        <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg mr-1">
                          (الحالي: {chunkSize})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mr-auto">
                      <span className="text-xs font-bold text-gray-500">سرعة الانطلاق:</span>
                      <div className="flex gap-1.5">
                        {[150, 250, 350, 500, 700].map(v => (
                          <button key={v} onClick={() => setTargetWPM(v)} className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${targetWPM === v ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border border-gray-200 hover:border-indigo-300'}`}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PDF page tracker */}
            {fileMode === 'pdf' && totalPages > 0 && sessionState !== 'done' && (
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-600">تتبّع الصفحة الحالية</span>
                  {sessionState === 'reading' && <span className="text-sm font-bold text-indigo-600 tabular-nums">{formatTime(elapsed)}</span>}
                </div>
                <div className="flex items-center gap-4 justify-center py-4">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1 || sessionState !== 'reading'} className="w-10 h-10 rounded-full bg-gray-100 font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-40">‹</button>
                  <div className="text-center">
                    <div className="text-5xl font-extrabold text-indigo-600 tabular-nums">{currentPage}</div>
                    <div className="text-sm text-gray-400 mt-1">من {totalPages}</div>
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || sessionState !== 'reading'} className="w-10 h-10 rounded-full bg-indigo-100 font-bold text-indigo-600 hover:bg-indigo-200 disabled:opacity-40">›</button>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Live stats while reading */}
            {(sessionState === 'reading' || sessionState === 'paused') && (
              <div className="mb-6 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-6 text-white shadow-2xl border border-slate-700/50">
                <div className="flex justify-around items-center">
                  <SpeedRing wpm={fileMode === 'md' ? liveWPM : 0} targetWPM={targetWPM} />
                  <div className="text-center border-x border-white/10 px-8">
                    <div className="text-5xl font-black tabular-nums">{formatTime(elapsed)}</div>
                    <div className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-2">Elapsed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-5xl font-black tabular-nums text-white">
                      {fileMode === 'md' ? `${Math.round(progressPct)}%` : currentPage}
                    </div>
                    <div className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-2">
                      {fileMode === 'md' ? 'Progress' : 'Page'}
                    </div>
                  </div>
                </div>
                {/* Warm-up indicator */}
                {sessionState === 'reading' && elapsed < WARM_UP_SECONDS && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400/70 transition-all duration-500" style={{ width: `${(elapsed / WARM_UP_SECONDS) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold">الإحماء ({WARM_UP_SECONDS - elapsed}ث)</span>
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            {fileName && !loading && sessionState !== 'done' && (
              <div className="flex flex-col items-center gap-4 mb-10">
                {sessionState === 'idle' && (
                  <div className="flex flex-col items-center gap-5 animate-slide-up">
                    <button
                      onClick={handleStart}
                      disabled={fileMode === 'md' && !mdText}
                      className="flex items-center gap-4 px-16 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 transform active:scale-95 group disabled:opacity-40"
                    >
                      <Play size={28} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                      ابدأ القراءة
                    </button>
                    <p className="text-xs text-gray-400">Space للإيقاف · ↑↓ لضبط السرعة · F للوضع الكامل</p>
                  </div>
                )}
                {(sessionState === 'reading' || sessionState === 'paused') && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => { if (sessionState === 'reading') handlePause(); else handleResume(); }}
                      className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-xl ${
                        sessionState === 'reading'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {sessionState === 'reading' ? <><Pause size={22} fill="currentColor" /> إيقاف مؤقت</> : <><Play size={22} fill="currentColor" /> استئناف</>}
                    </button>
                    <button onClick={handleFinish} className="flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">
                      <CheckCircle size={22} /> انتهيت
                    </button>
                    {readerMode === 'rsvp' && (
                      <button onClick={() => setIsImmersive(true)} className="p-4 bg-slate-800 text-slate-300 rounded-2xl hover:bg-slate-700 transition-all">
                        <Maximize2 size={20} />
                      </button>
                    )}
                    <button onClick={handleStop} className="p-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 hover:text-red-500 transition-all">
                      <Square size={22} fill="currentColor" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Session Result */}
            {sessionState === 'done' && lastSession && (
              <div className="card mb-6 overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 text-white border-slate-700">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-emerald-500/20 rounded-2xl">
                    <Award className="text-emerald-400" size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {lastSession.averageWPM >= 400 ? '🚀 أداء استثنائي!' : lastSession.averageWPM >= 250 ? '🎯 أداء ممتاز!' : '📈 استمر في التدريب!'}
                    </h3>
                    <p className="text-slate-400 text-sm">{lastSession.fileName}</p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  <StatBadge label="WPM متوسط" value={lastSession.averageWPM} color="indigo" />
                  <StatBadge label="ذروة WPM" value={lastSession.peakWPM} color="purple" />
                  <StatBadge label="الاتساق" value={`${lastSession.consistency}%`} color="emerald" />
                  <StatBadge label="المدة" value={formatTime(lastSession.durationSeconds)} color="amber" />
                  {lastSession.regressions > 0 && (
                    <StatBadge label="تراجعات" value={lastSession.regressions} color="amber" />
                  )}
                </div>

                {/* Coach message */}
                <div className="bg-white/5 rounded-2xl p-4 mb-5 border border-white/10">
                  <div className="flex items-start gap-3">
                    <TrendingUp size={18} className="text-indigo-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-slate-300 leading-relaxed">
                      {lastSession.consistency >= 80
                        ? `أداء متسق جداً! الجلسة القادمة جرّب ${lastSession.averageWPM + 25} كلمة/د`
                        : lastSession.consistency >= 60
                          ? 'أداء جيد. حاول الحفاظ على وتيرة ثابتة لتحسين الاتساق.'
                          : 'جرّب خفض السرعة قليلاً للحصول على قراءة أكثر اتساقاً.'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setSessionState('idle'); setElapsed(0); setChunkIndex(0); setLiveWPM(0); }}
                  className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all"
                >
                  قراءة جلسة جديدة
                </button>
              </div>
            )}

            {/* Session history chart */}
            {sessions.length >= 2 && (
              <div className="card mb-6 overflow-hidden">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-500" /> تطور سرعة القراءة
                </h3>
                <div className="h-40 w-full relative">
                  <svg viewBox="0 0 400 80" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const data = [...sessions].reverse().slice(-10);
                      if (data.length < 2) return null;
                      const max = Math.max(...data.map(s => s.averageWPM)) * 1.2;
                      const pts = data.map((s, i) => `${(i / (data.length - 1)) * 400},${80 - (s.averageWPM / max) * 80}`).join(' ');
                      return (
                        <>
                          <path d={`M ${pts}`} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d={`M 0,80 ${pts} 400,80`} fill="url(#histGrad)" />
                          {data.map((s, i) => (
                            <circle key={i} cx={(i / (data.length - 1)) * 400} cy={80 - (s.averageWPM / max) * 80} r="3" fill="white" stroke="#6366f1" strokeWidth="2">
                              <title>{s.averageWPM} WPM — {s.date}</title>
                            </circle>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute bottom-0 left-0 w-full flex justify-between px-1 text-[8px] text-gray-400">
                    <span>البداية</span><span>أحدث جلسة</span>
                  </div>
                </div>
              </div>
            )}

            {/* Session list */}
            {sessions.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-500" /> سجل الجلسات
                </h3>
                <div className="space-y-2">
                  {sessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm border border-gray-100 hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-indigo-400" />
                        <span className="font-medium text-gray-700 truncate max-w-[160px]">{s.fileName}</span>
                        <span className="text-xs text-gray-400">{s.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{formatTime(s.durationSeconds)}</span>
                        <span className="text-xs text-emerald-600 font-bold">{s.consistency}%</span>
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold text-xs">{s.averageWPM} WPM</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── PLAN TAB ── */
          <div className="space-y-6 animate-fade-in">
            {/* Book indexing card */}
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><BarChart3 size={20} /></div>
                <div>
                  <h3 className="font-bold text-gray-900">فهرسة الكتاب</h3>
                  <p className="text-xs text-gray-500">حساب كلمات كل صفحة لتوليد خطة دقيقة</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap mb-5">
                <button onClick={handlePdfFilePick} disabled={loading || isIndexing} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm">
                  <Upload size={17} />
                  {loading ? 'جاري...' : fileName ? 'تغيير الملف' : 'اختر ملف PDF'}
                </button>
                {fileName && (
                  <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl text-sm font-medium border border-indigo-100">
                    <FileText size={15} /><span className="truncate max-w-[200px]">{fileName}</span>
                    {wordIndex && <CheckCircle size={13} className="text-green-500" />}
                  </div>
                )}
              </div>
              {fileName && (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:border-indigo-200 transition-all">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={useOcr} onChange={e => setUseOcr(e.target.checked)} />
                    <div>
                      <span className="text-sm font-bold text-gray-700">Tahweel OCR (للملفات المصورة)</span>
                      <p className="text-[11px] text-gray-400">تحويل الصفحات المصورة لنص لحساب WPM بدقة</p>
                    </div>
                  </label>
                  <button
                    onClick={handleIndexBook}
                    disabled={isIndexing || !fileName}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all shadow-lg ${wordIndex ? 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                  >
                    {isIndexing ? <Loader2 size={19} className="animate-spin" /> : wordIndex ? <Clock size={19} /> : <Play size={19} />}
                    {isIndexing ? 'جاري الفهرسة...' : wordIndex ? 'إعادة الفهرسة' : 'بدء فهرسة الكلمات'}
                  </button>
                  {isIndexing && (
                    <div className="mt-3 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-600">{indexingMessage}</span>
                        {indexingProgress !== null && <span className="text-xs font-bold text-indigo-600">{indexingProgress}%</span>}
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${indexingProgress || 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            </div>

            {/* Plan config */}
            {wordIndex && (
              <div className="card bg-gradient-to-br from-white to-indigo-50/30 border-indigo-100 shadow-xl shadow-indigo-50/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Zap size={15} className="text-amber-500" /> سرعة القراءة (WPM)</label>
                    <input type="number" value={targetWPM} onChange={e => setTargetWPM(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-right" />
                    <p className="text-[10px] text-gray-400">من آخر جلسة قياس</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={15} className="text-indigo-500" /> الدقائق اليومية</label>
                    <input type="number" value={dailyMinutes} onChange={e => setDailyMinutes(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-right" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><CalendarIcon size={15} className="text-purple-500" /> تاريخ البدء</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold" />
                  </div>
                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-indigo-100">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={includeRestDays} onChange={e => setIncludeRestDays(e.target.checked)} />
                      <div>
                        <span className="text-sm font-bold text-gray-700">أيام الراحة</span>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-gray-400">تخطي يوم</p>
                          <select value={restDayOfWeek} onChange={e => setRestDayOfWeek(parseInt(e.target.value))} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border-0 rounded px-1 cursor-pointer">
                            {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition-all">
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={syncWithChapters} onChange={e => setSyncWithChapters(e.target.checked)} />
                      <div>
                        <span className="text-sm font-bold text-gray-700">مزامنة مع الفصول</span>
                        <p className="text-[10px] text-gray-400">إنهاء الورد عند نهاية فصل منطقي</p>
                      </div>
                    </label>
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Zap size={15} className="text-indigo-600" /> صعوبة الكتاب</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['easy', 'medium', 'hard'] as const).map(d => (
                        <button key={d} onClick={() => setDifficulty(d)} className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${difficulty === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'}`}>
                          {d === 'easy' ? 'سهل (سريع)' : d === 'medium' ? 'متوسط' : 'صعب (متأني)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={handleGeneratePlan} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                  <BarChart3 size={22} /> إنشاء خطة القراءة
                </button>
              </div>
            )}

            {/* Generated Plan */}
            {isPlanGenerated && (
              <div className="card shadow-2xl border-indigo-50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200"><CheckCircle size={20} /></div>
                    <div>
                      <h3 className="font-bold text-gray-900">خطة القراءة ({plan.length} يوم)</h3>
                      <p className="text-xs text-gray-500">هدف {targetWPM} كلمة/د · {dailyMinutes} دقيقة/يوم</p>
                    </div>
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setPlanViewMode('table')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${planViewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>جدول</button>
                    <button onClick={() => setPlanViewMode('calendar')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${planViewMode === 'calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>تقويم</button>
                  </div>
                </div>
                {planViewMode === 'table' ? (
                  <div className="overflow-x-auto rounded-2xl border border-gray-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-right">
                      <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                          {['اليوم', 'التاريخ', 'الصفحات', 'الكمية', 'التقييم'].map(h => (
                            <th key={h} className="py-4 px-5 text-xs font-bold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {plan.map((day, idx) => (
                          <tr key={idx} className={`hover:bg-indigo-50/40 transition-colors group ${day.isRest ? 'opacity-50' : ''}`}>
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-extrabold group-hover:bg-indigo-600 group-hover:text-white transition-colors">{day.day}</span>
                                <span className="font-bold text-gray-700">اليوم {day.day}</span>
                              </div>
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-500">{new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                            <td className="py-4 px-5 text-sm font-bold text-gray-900">{day.pages}</td>
                            <td className="py-4 px-5">
                              {!day.isRest && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-bold">{day.page_count} ص</span>
                                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-bold">{day.word_count.toLocaleString()} ك</span>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-5">
                              {!day.isRest && (
                                <div className="flex items-center gap-1">
                                  {(['hard', 'good', 'easy'] as const).map(r => (
                                    <button
                                      key={r}
                                      onClick={() => handleDayRating(day.day, r)}
                                      className={`p-1.5 rounded-lg border transition-all text-xs font-bold ${
                                        dayRatings[day.day] === r
                                          ? r === 'hard' ? 'bg-red-500 border-red-500 text-white' : r === 'good' ? 'bg-green-500 border-green-500 text-white' : 'bg-blue-500 border-blue-500 text-white'
                                          : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'
                                      }`}
                                    >
                                      {r === 'hard' ? '😓' : r === 'good' ? '✅' : '⚡'}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {['أحد', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {plan.map((day, idx) => (
                        <div key={idx} className={`aspect-square rounded-xl flex flex-col items-center justify-center shadow-sm cursor-default relative overflow-hidden group transition-all hover:scale-105 ${
                          day.isRest
                            ? 'bg-gray-100 text-gray-400'
                            : dayRatings[day.day] === 'hard'
                              ? 'bg-red-50 border-2 border-red-200 text-red-600'
                              : dayRatings[day.day] === 'easy'
                                ? 'bg-blue-50 border-2 border-blue-200 text-blue-600'
                                : 'bg-white border border-gray-100 text-indigo-600'
                        }`}>
                          <span className="text-sm font-black">{day.day}</span>
                          <span className="text-[9px] font-bold text-gray-400">{day.isRest ? '☕' : `${day.page_count}ص`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
