import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, Play, Pause, Square, Upload, CheckCircle, BookOpen, Zap, 
  Loader2, Clock, Calendar as CalendarIcon, BarChart3, Lock
} from 'lucide-react';
import { api, type TaskInfo } from '../../lib/api';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PricingPage } from '../pricing/PricingPage';
import { UpgradeButton } from '../pricing/UpgradeButton';

type FileMode = 'md' | 'pdf';
type SessionState = 'idle' | 'reading' | 'paused' | 'done';

interface Session {
  fileName: string;
  mode: FileMode;
  totalWords?: number;
  totalPages?: number;
  wordsRead?: number;
  pagesRead?: number;
  durationSeconds: number;
  wpm?: number;
  ppm?: number;
  date: string;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function SpeedGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="text-center">
      <div className="relative w-28 h-28 mx-auto mb-2">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold" style={{ color }}>{value}</span>
          <span className="text-[10px] text-gray-400 font-medium">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function ReadingSpeedTool() {
  const { checkAccess } = useSubscription();
  const [showPricing, setShowPricing] = useState(false);
  const hasAccess = checkAccess('fast_reading');
  const [activeTab, setActiveTab] = useState<'session' | 'plan'>('session');

  // File state
  const [fileMode, setFileMode] = useState<FileMode>('md');
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [mdText, setMdText] = useState<string | null>(null);
  const [totalWords, setTotalWords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastSession, setLastSession] = useState<Session | null>(null);

  // Planning state
  const [wordIndex, setWordIndex] = useState<{page: number, word_count: number}[] | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<number | null>(null);
  const [indexingMessage, setIndexingMessage] = useState<string | null>(null);
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [targetWPM, setTargetWPM] = useState(250);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState<any[]>([]);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [planViewMode, setPlanViewMode] = useState<'table' | 'calendar'>('table');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [feedbackFactor, setFeedbackFactor] = useState(1.0);
  const [dayRatings, setDayRatings] = useState<{[key: number]: 'easy' | 'good' | 'hard'}>({});
  const [includeRestDays, setIncludeRestDays] = useState(true);
  const [restDayOfWeek, setRestDayOfWeek] = useState(5); // Friday
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [syncWithChapters, setSyncWithChapters] = useState(true);

  // RSVP Reader state
  const [readerMode, setReaderMode] = useState<'normal' | 'rsvp'>('normal');
  const [rsvpIndex, setRsvpIndex] = useState(0);
  const [rsvpIsPlaying, setRsvpIsPlaying] = useState(false);
  const [chunkSize, setChunkSize] = useState(1); // Words per chunk
  const wordsArray = useRef<string[]>([]);
  const rsvpTimerRef = useRef<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // ── Timer ──────────────────────────────────────────────
  useEffect(() => {
    if (sessionState === 'reading') {
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  // ── File Picker ───────────────────────────────────────
  const mdInputRef = useRef<HTMLInputElement>(null);

  const handleMdFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setSessionState('idle');
    setElapsed(0);
    setCurrentPage(1);
    setMdText(null);
    setLastSession(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Strip MD markers for accurate WPM
      const cleanForCount = text
        .replace(/\*\*/g, '')
        .replace(/^#+\s*/gm, '')
        .replace(/^[|].*[|]$/gm, (match) => match.replace(/[|]/g, ' ')) // Keep table words but remove bars
        .replace(/^\|?[-: ]+\|[-: |]*$/gm, '') // Remove table separator lines
        .replace(/^---+\s*$/gm, ''); // Remove horizontal rules
        
      const words = cleanForCount.trim().split(/\s+/).filter(Boolean);
      wordsArray.current = words;
      setTotalWords(words.length);
      setMdText(text);
      setLoading(false);
      setRsvpIndex(0);
    };
    reader.onerror = () => { setError('فشل قراءة الملف'); setLoading(false); };
    reader.readAsText(file, 'utf-8');
    e.target.value = ''; 
  }, []);

  const [useOcr, setUseOcr] = useState(false);

  const handlePdfFilePick = useCallback(async () => {
    setError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!selected || typeof selected !== 'string') return;
      
      setFilePath(selected);
      const name = selected.split(/[/\\]/).pop() || selected;
      setFileName(name);
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
          const text = res.data.txt_content;
          const words = text.trim().split(/\s+/).filter(Boolean);
          wordsArray.current = words;
          setTotalWords(words.length);
          setMdText(text);
          setRsvpIndex(0);
          setFileMode('md'); 
        } else {
          setError('تعذّر إجراء التعرف الضوئي (OCR): ' + (res.error || 'تأكد من تسجيل الدخول بـ Google'));
        }
      } else {
        const res = await api.info(selected);
        if (res.success && res.data) {
          setTotalPages(res.data.page_count);
          try {
            const { bookmarkApi } = await import('../../api/bookmarkApi');
            const bData = await bookmarkApi.extractBookmarks(selected);
            if (bData.has_bookmarks) {
              setBookmarks(bData.bookmarks);
            }
          } catch (e) {
            console.error('Failed to load bookmarks', e);
          }
        } else {
          setError('تعذّر قراءة الملف: ' + (res.error || ''));
        }
      }
      setLoading(false);
    } catch (e: any) {
      setError('خطأ أثناء فتح الملف: ' + (e?.message || e));
      setLoading(false);
    }
  }, [useOcr]);

  const handlePickFile = fileMode === 'md'
    ? () => mdInputRef.current?.click()
    : handlePdfFilePick;

  // ── Controls ──────────────────────────────────────────
  const handleStart = () => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    setCurrentPage(1);
    setRsvpIndex(0);
    setSessionState('reading');
    setRsvpIsPlaying(true);
  };

  const handlePause = () => {
    pausedAtRef.current = elapsed;
    setSessionState('paused');
  };

  const handleResume = () => {
    startTimeRef.current = Date.now() - pausedAtRef.current * 1000;
    setSessionState('reading');
  };

  const handleStop = () => {
    setSessionState('idle');
    setElapsed(0);
    setCurrentPage(1);
    setRsvpIsPlaying(false);
    if (rsvpTimerRef.current) window.clearInterval(rsvpTimerRef.current);
  };

  const handleFinish = () => {
    const minutes = elapsed / 60;
    const measuredWpm = Math.round(rsvpIndex / Math.max(minutes, 0.01));
    const session: Session = {
      fileName: fileName!,
      mode: fileMode,
      date: new Date().toLocaleDateString('ar-EG'),
      durationSeconds: elapsed,
      ...(fileMode === 'md'
        ? { totalWords, wordsRead: rsvpIndex, wpm: measuredWpm }
        : { totalPages, pagesRead: currentPage, ppm: parseFloat((currentPage / Math.max(minutes, 0.01)).toFixed(1)) }
      )
    };
    
    if (session.wpm) setTargetWPM(session.wpm);
    
    setLastSession(session);
    setSessions(prev => [session, ...prev.slice(0, 9)]);
    setSessionState('done');
    setRsvpIsPlaying(false);
    if (rsvpTimerRef.current) window.clearInterval(rsvpTimerRef.current);
  };

  const handleIndexBook = async () => {
    if (!filePath) return;
    setIsIndexing(true);
    setIndexingProgress(0);
    setIndexingMessage('جاري بدء الفهرسة...');
    setError(null);

    try {
      if (useOcr) {
        setIndexingMessage('جاري التعرف الضوئي (OCR) لحساب الكلمات... قد يستغرق هذا وقتاً');
        const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
        const res = await api.tahweel.convert(filePath, dir || '.', true, true);
        
        if (res.success && res.data?.task_id) {
          const taskId = res.data.task_id;
          const pollInterval = setInterval(async () => {
            const statusRes = await api.tasks.getStatus(taskId);
            if (statusRes.success && statusRes.data) {
              const taskInfo = (statusRes.data as unknown) as TaskInfo;
              const { status, progress, message, result } = taskInfo;
              setIndexingProgress(progress);
              setIndexingMessage(message || 'جاري المعالجة...');
              
              if (status === 'completed') {
                clearInterval(pollInterval);
                if (result && result.word_index) {
                  setWordIndex(result.word_index);
                  setIsIndexing(false);
                } else {
                  setError('فشل استخراج الفهرس من النتيجة');
                  setIsIndexing(false);
                }
              } else if (status === 'failed') {
                clearInterval(pollInterval);
                setError(message || 'فشلت عملية الفهرسة');
                setIsIndexing(false);
              }
            }
          }, 2000);
        } else {
          setError(res.error || 'فشل بدء عملية الـ OCR');
          setIsIndexing(false);
        }
      } else {
        setIndexingMessage('جاري استخراج النصوص وحساب الكلمات...');
        const res = await api.tahweel.index(filePath, false, false);
        if (res.success && res.data) {
          setWordIndex((res.data as unknown) as {page: number, word_count: number}[]);
          setIsIndexing(false);
        } else {
          setError(res.error || 'فشل استخراج الكلمات');
          setIsIndexing(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الفهرسة');
      setIsIndexing(false);
    }
  };

  const handleGeneratePlan = () => {
    if (!wordIndex || wordIndex.length === 0) {
      setError('يجب فهرسة الكتاب أولاً لحساب الكلمات');
      return;
    }

    const difficultyMultiplier = difficulty === 'easy' ? 1.2 : difficulty === 'hard' ? 0.8 : 1.0;
    const effectiveWPM = targetWPM * difficultyMultiplier * feedbackFactor;
    const wordsPerDay = effectiveWPM * dailyMinutes;
    
    const newPlan = [];
    let currentDay = 1;
    let currentWordIndex = 0;
    const startDateTime = new Date(startDate);

    while (currentWordIndex < wordIndex.length) {
      const targetWordsForDay = wordsPerDay;
      let dayWords = 0;
      let dayPages = [];
      const startPage = wordIndex[currentWordIndex].page;

      while (currentWordIndex < wordIndex.length && dayWords < targetWordsForDay) {
        const page = wordIndex[currentWordIndex];
        if (dayWords > 0 && (dayWords + page.word_count) > (targetWordsForDay * 1.2)) {
          break;
        }
        dayWords += page.word_count;
        dayPages.push(page.page);
        currentWordIndex++;
      }

      if (dayPages.length > 0) {
        const endPage = dayPages[dayPages.length - 1];
        let adjustedEndPage = endPage;
        let adjustedDayWords = dayWords;
        
        if (syncWithChapters && bookmarks.length > 0) {
          const boundaryB = bookmarks.find(b => Math.abs(b.page - (endPage + 1)) <= 2);
          if (boundaryB && boundaryB.page > startPage) {
            adjustedEndPage = boundaryB.page - 1;
          }
        }

        const date = new Date(startDateTime);
        date.setDate(date.getDate() + (currentDay - 1));

        if (includeRestDays && date.getDay() === restDayOfWeek) {
           newPlan.push({
             day: currentDay,
             date: date.toISOString().split('T')[0],
             chapter: 'يوم راحة ☕',
             pages: '-',
             page_count: 0,
             word_count: 0,
             isRest: true
           });
           currentDay++;
           continue; 
        }

        newPlan.push({
          day: currentDay,
          date: date.toISOString().split('T')[0],
          chapter: `الصفحات ${startPage} - ${adjustedEndPage}`,
          pages: startPage === adjustedEndPage ? `${startPage}` : `${startPage} - ${adjustedEndPage}`,
          page_count: adjustedEndPage - startPage + 1,
          word_count: adjustedDayWords
        });
        currentDay++;
      }
    }

    setPlan(newPlan);
    setIsPlanGenerated(true);
  };

  const handleDayRating = (day: number, rating: 'easy' | 'good' | 'hard') => {
    setDayRatings(prev => ({ ...prev, [day]: rating }));
    if (rating === 'hard') {
      setFeedbackFactor(f => Math.max(0.5, f - 0.05));
    } else if (rating === 'easy') {
      setFeedbackFactor(f => Math.min(2.0, f + 0.05));
    }
    localStorage.setItem('fast_reading_feedback_factor', JSON.stringify(feedbackFactor));
  };

  useEffect(() => {
    const saved = localStorage.getItem('fast_reading_feedback_factor');
    if (saved) setFeedbackFactor(JSON.parse(saved));
  }, []);

  // ── RSVP Timer Logic ─────────────────────────────────
  useEffect(() => {
    if (rsvpIsPlaying) {
      const interval = (60 / targetWPM) * 1000 * chunkSize;
      rsvpTimerRef.current = window.setInterval(() => {
        setRsvpIndex(prev => {
          if (prev + chunkSize >= wordsArray.current.length) {
            setRsvpIsPlaying(false);
            return prev;
          }
          return prev + chunkSize;
        });
      }, interval);
    } else {
      if (rsvpTimerRef.current) window.clearInterval(rsvpTimerRef.current);
    }
    return () => { if (rsvpTimerRef.current) window.clearInterval(rsvpTimerRef.current); };
  }, [rsvpIsPlaying, targetWPM, chunkSize]);

  useEffect(() => {
    if (readerMode !== 'rsvp') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setRsvpIsPlaying(prev => !prev);
      } else if (e.code === 'ArrowRight') {
        setRsvpIndex(prev => Math.min(wordsArray.current.length - 1, prev + 5));
      } else if (e.code === 'ArrowLeft') {
        setRsvpIndex(prev => Math.max(0, prev - 5));
      } else if (e.code === 'ArrowUp') {
        setTargetWPM(prev => Math.min(1000, prev + 50));
      } else if (e.code === 'ArrowDown') {
        setTargetWPM(prev => Math.max(100, prev - 50));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readerMode]);

  useEffect(() => {
    if (readerMode === 'normal' && rsvpIsPlaying) {
      const currentWordEl = document.getElementById('current-word');
      const containerEl = document.getElementById('md-reader-container');
      if (currentWordEl && containerEl) {
        const containerRect = containerEl.getBoundingClientRect();
        const wordRect = currentWordEl.getBoundingClientRect();
        const targetTop = (wordRect.top + containerEl.scrollTop) - containerRect.top - (containerRect.height / 2) + (wordRect.height / 2);
        containerEl.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }
  }, [rsvpIndex, rsvpIsPlaying]);

  const renderOrpWord = (word: string) => {
    if (!word) return null;
    const mid = Math.floor(word.length / 2);
    return (
      <span className="inline-block text-center w-full">
        <span className="text-gray-300">{word.substring(0, mid)}</span>
        <span className="text-red-500 font-black">{word[mid]}</span>
        <span className="text-gray-300">{word.substring(mid + 1)}</span>
      </span>
    );
  };

  const liveWpm = fileMode === 'md' && elapsed > 2 ? Math.round(rsvpIndex / (elapsed / 60)) : 0;
  const livePpm = fileMode === 'pdf' && elapsed > 2 ? parseFloat((currentPage / (elapsed / 60)).toFixed(1)) : 0;

  if (!hasAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">خاصية مدفوعة</h2>
          <p className="text-gray-500 mb-8">قياس سرعة القراءة متاح في النسخة الكاملة فقط.</p>
          <UpgradeButton onClick={() => setShowPricing(true)} className="w-full justify-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full pb-12" dir="rtl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">سرعة القراءة الذكية</h2>
          <p className="text-gray-500 text-sm">قياس السرعة الحالية أو إنشاء خطة قراءة مخصصة بناءً على سرعة الكلمات</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
          <button onClick={() => setActiveTab('session')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'session' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Zap size={16} /> قياس الجلسة
          </button>
          <button onClick={() => setActiveTab('plan')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'plan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <CalendarIcon size={16} /> خطة القراءة
          </button>
        </div>
      </div>

      {activeTab === 'session' ? (
        <>
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
            {(['md', 'pdf'] as FileMode[]).map(m => (
              <button key={m} onClick={() => { setFileMode(m); setFileName(null); setMdText(null); setSessionState('idle'); setElapsed(0); setError(null); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${fileMode === m ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {m === 'md' ? <><Zap size={16} /> Markdown — كلمة/دقيقة</> : <><BookOpen size={16} /> PDF — صفحة/دقيقة</>}
              </button>
            ))}
          </div>

          <input ref={mdInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleMdFilePick} />

          <div className="card mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={handlePickFile} disabled={loading || sessionState === 'reading'} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  <Upload size={18} />
                  {loading ? 'جاري التحميل...' : `اختر ملف ${fileMode === 'md' ? 'Markdown / TXT' : 'PDF'}`}
                </button>
                {fileName && !loading && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <FileText size={16} className="text-indigo-500" />
                    <span className="font-medium text-sm">{fileName}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{fileMode === 'md' ? `${totalWords.toLocaleString()} كلمة` : `${totalPages} صفحة`}</span>
                  </div>
                )}
              </div>
              {fileMode === 'pdf' && !fileName && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} />
                    <div>
                      <span className="text-sm font-bold text-gray-700">استخدام Tahweel OCR (لحساب عدد الكلمات بدقة)</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">مفيد للملفات المصورة (سكان) لتحويلها لنص وحساب WPM بدلاً من الصفحات.</p>
                    </div>
                  </label>
                </div>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>

          {fileMode === 'md' && mdText && sessionState !== 'done' && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button onClick={() => setReaderMode('normal')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${readerMode === 'normal' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>عرض النص</button>
                  <button onClick={() => setReaderMode('rsvp')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${readerMode === 'rsvp' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>RSVP Reader</button>
                </div>
                {sessionState === 'reading' && <span className="text-sm font-bold text-indigo-600 tabular-nums">{formatTime(elapsed)}</span>}
              </div>

              {readerMode === 'normal' ? (
                <div id="md-reader-container" className="h-[500px] overflow-y-auto custom-scrollbar p-12 bg-white rounded-3xl text-right leading-[3.5] text-2xl border-4 border-indigo-50 shadow-inner relative" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                  <div className="max-w-2xl mx-auto space-y-8 pb-[400px] pt-40">
                    {(() => {
                      const lines = mdText?.split('\n') || [];
                      let globalWordCounter = 0;
                      return lines.map((line, lineIdx) => {
                        const isHeading = line.startsWith('#');
                        const isList = line.trim().startsWith('-') || line.trim().startsWith('*');
                        const isTable = line.trim().startsWith('|');
                        const isSeparator = isTable && /^\|?[-: ]+\|[-: |]*$/.test(line.trim());
                        const isDivider = line.trim().match(/^---+\s*$/);

                        if (isSeparator) return null;
                        if (isDivider) return <hr key={lineIdx} className="my-12 border-t-2 border-indigo-50/50" />;

                        // Hide # in headings
                        const cleanLine = isHeading ? line.replace(/^#+\s*/, '') : line;
                        
                        if (isTable) {
                          const cells = cleanLine.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
                          return (
                            <div key={lineIdx} className="flex w-full border-b border-gray-100 py-3 gap-6 bg-indigo-50/20 px-4 first:rounded-t-2xl last:rounded-b-2xl first:bg-indigo-100/50 first:font-bold">
                              {cells.map((cell, cellIdx) => {
                                const cellWords = cell.split(/\s+/).filter(Boolean);
                                return (
                                  <div key={cellIdx} className="flex-1 flex flex-wrap gap-x-2">
                                    {cellWords.map((word, wordIdx) => {
                                      const currentGlobalIdx = globalWordCounter++;
                                      const isCurrent = currentGlobalIdx >= rsvpIndex && currentGlobalIdx < rsvpIndex + chunkSize;
                                      const isPast = currentGlobalIdx < rsvpIndex;
                                      const isFirstOfChunk = currentGlobalIdx === rsvpIndex;
                                      const isLastOfChunk = currentGlobalIdx === rsvpIndex + chunkSize - 1 || currentGlobalIdx === wordsArray.current.length - 1;

                                      // Markdown Bold Logic
                                      let displayWord = word;
                                      let shouldBeBold = word.startsWith('**') || word.endsWith('**');
                                      if (word.startsWith('**') && word.endsWith('**') && word.length >= 4) {
                                        displayWord = word.slice(2, -2);
                                        shouldBeBold = true;
                                      } else if (word.startsWith('**')) {
                                        displayWord = word.slice(2);
                                        shouldBeBold = true;
                                      } else if (word.endsWith('**')) {
                                        displayWord = word.slice(0, -2);
                                        shouldBeBold = true;
                                      }

                                      return (
                                        <div key={wordIdx} className="inline-flex items-center">
                                          <span 
                                            id={isCurrent ? 'current-word' : undefined}
                                            className={`transition-all duration-150 py-1 px-1.5 ${
                                              isCurrent 
                                                ? 'text-indigo-900 bg-indigo-100 z-10' 
                                                : isPast ? 'text-gray-200' : 'text-gray-400 opacity-30'
                                            } ${
                                              isCurrent && isFirstOfChunk ? 'rounded-r-xl' : ''
                                            } ${
                                              isCurrent && isLastOfChunk ? 'rounded-l-xl' : ''
                                            } ${shouldBeBold ? 'font-bold' : ''}`}
                                          >
                                            {displayWord}
                                          </span>
                                          <span className={`h-full py-1 px-1 select-none transition-all duration-150 ${
                                            isCurrent && !isLastOfChunk ? 'bg-indigo-100' : 'text-transparent'
                                          }`}>
                                            &nbsp;
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        const lineWords = cleanLine.split(/\s+/).filter(Boolean);
                        let isInsideBold = false;

                        return (
                          <div key={lineIdx} className={`${isHeading ? 'text-5xl font-black text-gray-900 border-b-4 border-indigo-100 pb-6 mb-10 mt-16' : isList ? 'pr-8 relative before:content-["•"] before:absolute before:right-0 before:text-indigo-500 before:font-bold' : ''}`}>
                            <div className="flex flex-wrap">
                              {lineWords.map((word, wordIdx) => {
                                const currentGlobalIdx = globalWordCounter++;
                                const isCurrent = currentGlobalIdx >= rsvpIndex && currentGlobalIdx < rsvpIndex + chunkSize;
                                const isPast = currentGlobalIdx < rsvpIndex;
                                
                                const isFirstOfChunk = currentGlobalIdx === rsvpIndex;
                                const isLastOfChunk = currentGlobalIdx === rsvpIndex + chunkSize - 1 || currentGlobalIdx === wordsArray.current.length - 1;
                                
                                // Markdown Bold Logic
                                let displayWord = word;
                                let shouldBeBold = isInsideBold;
                                
                                if (word.startsWith('**') && word.endsWith('**') && word.length >= 4) {
                                  displayWord = word.slice(2, -2);
                                  shouldBeBold = true;
                                } else if (word.startsWith('**')) {
                                  displayWord = word.slice(2);
                                  isInsideBold = true;
                                  shouldBeBold = true;
                                } else if (word.endsWith('**')) {
                                  displayWord = word.slice(0, -2);
                                  isInsideBold = false;
                                  shouldBeBold = true;
                                }

                                return (
                                  <div key={wordIdx} className="inline-flex items-center">
                                    <span 
                                      id={isCurrent ? 'current-word' : undefined}
                                      className={`transition-all duration-150 py-1 px-1.5 ${
                                        isCurrent 
                                          ? 'text-indigo-900 bg-indigo-100 z-10' 
                                          : isPast ? 'text-gray-200' : 'text-gray-400 opacity-30'
                                      } ${
                                        isCurrent && isFirstOfChunk ? 'rounded-r-xl' : ''
                                      } ${
                                        isCurrent && isLastOfChunk ? 'rounded-l-xl' : ''
                                      } ${shouldBeBold ? 'font-bold' : ''}`}
                                    >
                                      {displayWord}
                                    </span>
                                    {/* Constant Width Gap */}
                                    <span className={`h-full py-1 px-1 select-none transition-all duration-150 ${
                                      isCurrent && !isLastOfChunk ? 'bg-indigo-100' : 'text-transparent'
                                    }`}>
                                      &nbsp;
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="relative h-80 flex flex-col items-center justify-center bg-gray-900 rounded-2xl border-4 border-indigo-900 overflow-hidden shadow-2xl">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-16 bg-indigo-500/30 blur-sm pointer-events-none" />
                  <div className="text-center w-full px-4 z-10">
                    {chunkSize === 1 ? (
                      <div className="text-5xl md:text-7xl font-extrabold tracking-tight tabular-nums">{renderOrpWord(wordsArray.current[rsvpIndex])}</div>
                    ) : (
                      <div className="text-3xl md:text-5xl font-bold text-white flex flex-wrap justify-center gap-4">
                        {wordsArray.current.slice(rsvpIndex, rsvpIndex + chunkSize).map((w, i) => (
                          <span key={i} className={i === 0 ? 'text-indigo-400' : 'text-white'}>{w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-20 text-gray-600 text-sm font-medium animate-pulse">{wordsArray.current[rsvpIndex + chunkSize] || ''}</div>
                  <div className="absolute bottom-6 left-0 w-full px-8 flex items-center justify-between z-20">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Speed</span>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setTargetWPM(v => Math.max(100, v - 50))} className="text-gray-400 hover:text-white">-</button>
                           <span className="text-indigo-400 font-black text-sm">{targetWPM}</span>
                           <button onClick={() => setTargetWPM(v => Math.min(1000, v + 50))} className="text-gray-400 hover:text-white">+</button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chunk</span>
                      <div className="flex gap-1.5 mt-1">
                        {[1, 2, 3, 4].map(c => (
                          <button key={c} onClick={() => setChunkSize(c)} className={`w-7 h-7 rounded-lg text-[11px] font-black transition-all ${chunkSize === c ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
                    <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-150" style={{ width: `${(rsvpIndex / wordsArray.current.length) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {fileMode === 'pdf' && totalPages > 0 && sessionState !== 'done' && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600">تتبّع الصفحة الحالية أثناء قراءتك للملف</span>
                {sessionState === 'reading' && <span className="text-sm font-bold text-indigo-600 tabular-nums">{formatTime(elapsed)}</span>}
              </div>
              <div className="flex items-center gap-4 justify-center py-4">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1 || sessionState !== 'reading'} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors">‹</button>
                <div className="text-center">
                  <div className="text-5xl font-extrabold text-indigo-600 tabular-nums">{currentPage}</div>
                  <div className="text-sm text-gray-400 mt-1">من {totalPages} صفحة</div>
                </div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || sessionState !== 'reading'} className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 hover:bg-indigo-200 disabled:opacity-40 transition-colors">›</button>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${(currentPage / totalPages) * 100}%` }} />
              </div>
            </div>
          )}

          {(sessionState === 'reading' || sessionState === 'paused') && (
            <div className="mb-6 bg-indigo-950 rounded-3xl p-6 text-white overflow-hidden relative shadow-2xl border-4 border-indigo-900">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={140} /></div>
              <div className="flex justify-around relative z-10 py-2">
                <SpeedGauge value={fileMode === 'md' ? liveWpm : livePpm} max={fileMode === 'md' ? 500 : 5} label={fileMode === 'md' ? 'WPM' : 'PPM'} color="#818cf8" />
                <div className="text-center self-center border-x border-white/10 px-8">
                  <div className="text-5xl font-black tabular-nums text-white drop-shadow-lg">{formatTime(elapsed)}</div>
                  <div className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-2">Time Elapsed</div>
                </div>
                <div className="text-center self-center">
                  <div className="text-5xl font-black tabular-nums text-white drop-shadow-lg">{fileMode === 'md' ? `${Math.round(rsvpIndex).toLocaleString()}` : currentPage}</div>
                  <div className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-2">{fileMode === 'md' ? 'Words Read' : 'Current Page'}</div>
                </div>
              </div>
            </div>
          )}

          {fileName && !loading && sessionState !== 'done' && (
            <div className="flex flex-col items-center gap-4 mb-10">
              {sessionState === 'idle' && (
                <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                    <span className="text-xs font-bold text-indigo-600 px-3 border-l border-indigo-50 ml-2">سرعة الانطلاق (WPM):</span>
                    <div className="flex gap-2">
                      {[200, 300, 400, 500, 600].map(v => (
                        <button key={v} onClick={() => setTargetWPM(v)} className={`w-12 h-10 rounded-xl text-xs font-black transition-all ${targetWPM === v ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleStart} className="flex items-center gap-4 px-16 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 transform active:scale-95 group">
                    <Play size={28} fill="currentColor" className="group-hover:scale-110 transition-transform" /> 
                    <span>ابدأ القراءة والقياس</span>
                  </button>
                </div>
              )}
              {(sessionState === 'reading' || sessionState === 'paused') && (
                <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                  <button 
                    onClick={() => { 
                      if (rsvpIsPlaying) {
                        handlePause();
                        setRsvpIsPlaying(false);
                      } else {
                        handleResume();
                        setRsvpIsPlaying(true);
                      }
                    }}
                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-xl ${
                      rsvpIsPlaying 
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-amber-100' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {rsvpIsPlaying ? <><Pause size={22} fill="currentColor" /> إيقاف مؤقت</> : <><Play size={22} fill="currentColor" /> استئناف</>}
                  </button>
                  <button onClick={handleFinish} className="flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">
                    <CheckCircle size={22} />
                    <span>انتهيت</span>
                  </button>
                  <button onClick={handleStop} className="p-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all hover:text-red-500">
                    <Square size={22} fill="currentColor" />
                  </button>
                </div>
              )}
            </div>
          )}

          {sessionState === 'done' && lastSession && (
            <div className="card mb-6 border-2 border-green-200 bg-green-50 shadow-lg shadow-green-100">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle className="text-green-600" size={22} />
                <h3 className="font-bold text-gray-900 text-lg">نتيجة الجلسة</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-3xl font-extrabold text-indigo-600">{lastSession.mode === 'md' ? lastSession.wpm : lastSession.ppm}</div>
                  <div className="text-xs text-gray-500 mt-1">{lastSession.mode === 'md' ? 'كلمة / دقيقة' : 'صفحة / دقيقة'}</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-3xl font-extrabold text-gray-700">{formatTime(lastSession.durationSeconds)}</div>
                  <div className="text-xs text-gray-500 mt-1">مدة القراءة</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-3xl font-extrabold text-purple-600">{lastSession.mode === 'md' ? lastSession.totalWords?.toLocaleString() : `${lastSession.pagesRead} / ${lastSession.totalPages}`}</div>
                  <div className="text-xs text-gray-500 mt-1">{lastSession.mode === 'md' ? 'إجمالي الكلمات' : 'الصفحات المقروءة'}</div>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <div className="text-3xl font-extrabold text-green-600">{lastSession.mode === 'md' ? lastSession.wpm! >= 300 ? 'ممتاز' : lastSession.wpm! >= 200 ? 'جيد' : 'مبتدئ' : lastSession.ppm! >= 2 ? 'سريع' : lastSession.ppm! >= 1 ? 'متوسط' : 'بطيء'}</div>
                  <div className="text-xs text-gray-500 mt-1">التقييم</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 text-sm text-gray-600 border border-gray-100">
                {lastSession.mode === 'md' ? <p>📊 <strong>معدل القراءة:</strong> المبتدئ 150–200 كلمة/د · الطبيعي 200–300 · المتقدم 300–500</p> : <p>📊 <strong>معدل القراءة:</strong> بطيء أقل من 1 صفحة/د · متوسط 1–2 · سريع أكثر من 2 صفحة/د</p>}
              </div>
              <button onClick={() => { setSessionState('idle'); setElapsed(0); setCurrentPage(1); }} className="mt-4 w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">قياس مرة أخرى</button>
            </div>
          )}

          {sessions.length >= 2 && (
            <div className="card mb-6 overflow-hidden">
              <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-500" /> تحليل تطور السرعة (WPM)
              </h3>
              <div className="h-48 w-full relative group">
                <svg viewBox="0 0 400 100" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const data = [...sessions].reverse().filter(s => s.wpm).slice(-10);
                    if (data.length < 2) return null;
                    const max = Math.max(...data.map(s => s.wpm!)) * 1.2;
                    const points = data.map((s, i) => `${(i / (data.length - 1)) * 400},${100 - (s.wpm! / max) * 100}`).join(' ');
                    const areaPoints = `0,100 ${points} 400,100`;
                    return (
                      <>
                        <path d={`M ${points}`} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={`M ${areaPoints}`} fill="url(#grad)" />
                        {data.map((s, i) => (
                          <circle key={i} cx={(i / (data.length - 1)) * 400} cy={100 - (s.wpm! / max) * 100} r="3" fill="white" stroke="#6366f1" strokeWidth="2" className="hover:r-4 transition-all">
                            <title>{s.wpm} WPM - {s.date}</title>
                          </circle>
                        ))}
                      </>
                    );
                  })()}
                </svg>
                <div className="absolute bottom-0 left-0 w-full flex justify-between px-1 text-[8px] text-gray-400 font-bold mt-2">
                   <span>البداية</span>
                   <span>أحدث الجلسات</span>
                </div>
              </div>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-500" /> سجل الجلسات
              </h3>
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border border-gray-100 hover:border-indigo-200 transition-colors">
                    <div className="flex items-center gap-2">
                      {s.mode === 'md' ? <Zap size={14} className="text-amber-500" /> : <BookOpen size={14} className="text-indigo-500" />}
                      <span className="font-medium text-gray-700 truncate max-w-[160px]">{s.fileName}</span>
                      <span className="text-xs text-gray-400">{s.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{formatTime(s.durationSeconds)}</span>
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold text-xs">{s.mode === 'md' ? `${s.wpm} WPM` : `${s.ppm} PPM`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BarChart3 size={20} /></div>
              <div>
                <h3 className="font-bold text-gray-900">تجهيز الكتاب للفهرسة</h3>
                <p className="text-xs text-gray-500">حساب عدد الكلمات في كل صفحة لإنشاء خطة دقيقة</p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap mb-6">
              <button onClick={handlePdfFilePick} disabled={loading || isIndexing} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm">
                <Upload size={18} />
                {loading ? 'جاري التحميل...' : fileName ? 'تغيير الملف' : 'اختر ملف PDF'}
              </button>
              {fileName && (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg text-sm font-medium border border-indigo-100">
                  <FileText size={16} />
                  <span className="truncate max-w-[200px]">{fileName}</span>
                  {wordIndex && <CheckCircle size={14} className="text-green-500" />}
                </div>
              )}
            </div>
            {fileName && (
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:border-indigo-200 transition-all">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} />
                  <div>
                    <span className="text-sm font-bold text-gray-700">استخدام Tahweel OCR (للملفات المصورة)</span>
                    <p className="text-[11px] text-gray-500">يحول الصفحات المصورة لنص لحساب الكلمات بدقة WPM</p>
                  </div>
                </label>
                <button onClick={handleIndexBook} disabled={isIndexing || !fileName} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all shadow-lg ${wordIndex ? 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 shadow-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}>
                  {isIndexing ? <Loader2 size={20} className="animate-spin" /> : wordIndex ? <Clock size={20} /> : <Play size={20} />}
                  {isIndexing ? 'جاري الفهرسة...' : wordIndex ? 'إعادة الفهرسة' : 'بدء فهرسة الكلمات'}
                </button>
                {isIndexing && (
                  <div className="mt-4 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
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
            {error && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>

          {wordIndex && (
            <div className="card bg-gradient-to-br from-white to-indigo-50/30 border-indigo-100 shadow-xl shadow-indigo-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Zap size={16} className="text-amber-500" /> سرعة القراءة (WPM)</label>
                  <input type="number" value={targetWPM} onChange={(e) => setTargetWPM(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-right" />
                  <p className="text-[10px] text-gray-400">تلقائياً من آخر جلسة قياس</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={16} className="text-indigo-500" /> الدقائق اليومية</label>
                  <input type="number" value={dailyMinutes} onChange={(e) => setDailyMinutes(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-right" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><CalendarIcon size={16} className="text-purple-500" /> تاريخ البدء</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold text-right" />
                </div>
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-indigo-100">
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition-all">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={includeRestDays} onChange={(e) => setIncludeRestDays(e.target.checked)} />
                    <div>
                      <span className="text-sm font-bold text-gray-700">تفعيل أيام الراحة</span>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-gray-400">تخطي يوم</p>
                        <select value={restDayOfWeek} onChange={(e) => setRestDayOfWeek(parseInt(e.target.value))} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border-0 rounded p-0 px-1 cursor-pointer">
                          {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                        <p className="text-[10px] text-gray-400">تلقائياً.</p>
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition-all">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={syncWithChapters} onChange={(e) => setSyncWithChapters(e.target.checked)} />
                    <div>
                      <span className="text-sm font-bold text-gray-700">المزامنة مع الفصول</span>
                      <p className="text-[10px] text-gray-400">محاولة إنهاء الورد اليومي عند نهاية فصل منطقي.</p>
                    </div>
                  </label>
                </div>
                <div className="md:col-span-3 space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Zap size={16} className="text-indigo-600" /> مستوى صعوبة الكتاب (Adaptive WPM)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['easy', 'medium', 'hard'] as const).map(d => (
                      <button key={d} onClick={() => setDifficulty(d)} className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${difficulty === d ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'}`}>
                        {d === 'easy' ? 'سهل (سريع)' : d === 'medium' ? 'متوسط' : 'صعب (متأني)'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">يتم تعديل السرعة المقترحة تلقائياً بناءً على مستوى الصعوبة المحدد.</p>
                </div>
              </div>
              <button onClick={handleGeneratePlan} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 transform active:scale-95 transition-all flex items-center justify-center gap-3">
                <BarChart3 size={24} />
                <span>إنشاء خطة قراءة ذكية</span>
              </button>
            </div>
          )}

          {isPlanGenerated && (
            <div className="card shadow-2xl border-indigo-50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200"><CheckCircle size={20} /></div>
                  <div>
                    <h3 className="font-bold text-gray-900">خطة القراءة المتولدة</h3>
                    <p className="text-xs text-gray-500">تم توزيع المحتوى بناءً على هدف {targetWPM} كلمة/د</p>
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
                        <th className="py-4 px-6 text-xs font-bold text-gray-500">اليوم</th>
                        <th className="py-4 px-6 text-xs font-bold text-gray-500">التاريخ</th>
                        <th className="py-4 px-6 text-xs font-bold text-gray-500">نطاق الصفحات</th>
                        <th className="py-4 px-6 text-xs font-bold text-gray-500 text-center">الكمية المقدرة</th>
                        <th className="py-4 px-6 text-xs font-bold text-gray-500 text-center">تقييم الأداء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {plan.map((day, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/40 transition-colors group">
                          <td className="py-4 px-6">
                             <div className="flex items-center gap-3">
                               <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-extrabold group-hover:bg-indigo-600 group-hover:text-white transition-colors">{day.day}</span>
                               <span className="font-bold text-gray-700">اليوم {day.day}</span>
                             </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-500 font-medium">{new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                          <td className="py-4 px-6 text-sm font-bold text-gray-900">{day.pages}</td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full font-bold">{day.page_count} صفحة</span>
                              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full font-bold">{day.word_count.toLocaleString()} كلمة</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => handleDayRating(day.day, 'hard')} className={`p-1.5 rounded-lg border transition-all ${dayRatings[day.day] === 'hard' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50'}`} title="صعب"><Square size={14} className="fill-current" /></button>
                              <button onClick={() => handleDayRating(day.day, 'good')} className={`p-1.5 rounded-lg border transition-all ${dayRatings[day.day] === 'good' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-100 text-gray-400 hover:text-green-500 hover:bg-green-50'}`} title="مناسب"><CheckCircle size={14} className="fill-current" /></button>
                              <button onClick={() => handleDayRating(day.day, 'easy')} className={`p-1.5 rounded-lg border transition-all ${dayRatings[day.day] === 'easy' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-100 text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`} title="سهل"><Zap size={14} className="fill-current" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="grid grid-cols-7 gap-3">
                     {['أحد', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map(d => <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-2">{d}</div>)}
                     {plan.map((day, idx) => (
                       <div key={idx} className="aspect-square bg-white border border-gray-100 text-indigo-600 rounded-xl flex flex-col items-center justify-center shadow-sm hover:border-indigo-400 hover:scale-105 transition-all cursor-default relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-full h-1 bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                         <span className="text-lg font-black">{day.day}</span>
                         <span className="text-[9px] font-bold text-gray-400">{day.page_count} ص</span>
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
  );
}
