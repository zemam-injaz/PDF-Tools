import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Play, Pause, Square, SkipForward, SkipBack, 
  Settings, Zap, History,
  Eye, FastForward, AlignCenter, Minus, Loader2, AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { UpgradeButton } from '../pricing/UpgradeButton';
import { PricingPage } from '../pricing/PricingPage';
import { Lock } from 'lucide-react';

type ReadingMode = 'standard' | 'rsvp' | 'scrolling' | 'chunking' | 'elimination';

interface ReadingSession {
  id: number;
  file_name: string;
  mode: ReadingMode;
  date: string;
  duration_minutes: number;
  words_read: number;
  wpm: number;
}

// Mock data
const mockSessions: ReadingSession[] = [
  { id: 1, file_name: 'كتاب البرمجة.pdf', mode: 'rsvp', date: '2025-12-14', duration_minutes: 15, words_read: 4500, wpm: 300 },
  { id: 2, file_name: 'مقدمة في الذكاء الاصطناعي.pdf', mode: 'standard', date: '2025-12-13', duration_minutes: 30, words_read: 6000, wpm: 200 },
  { id: 3, file_name: 'كتاب البرمجة.pdf', mode: 'chunking', date: '2025-12-12', duration_minutes: 20, words_read: 5000, wpm: 250 },
];

const mockWords = [
  'هذا', 'نص', 'تجريبي', 'للقراءة', 'السريعة', 'يمكنك', 'استخدام', 'هذه',
  'الأداة', 'لتحسين', 'سرعة', 'القراءة', 'الخاصة', 'بك', 'من', 'خلال',
  'التدريب', 'المستمر', 'على', 'القراءة', 'بسرعات', 'مختلفة', 'وأنماط', 'متنوعة'
];

const modeLabels: Record<ReadingMode, string> = {
  standard: 'عادي',
  rsvp: 'عرض سريع (RSVP)',
  scrolling: 'تمرير تلقائي',
  chunking: 'مجموعات',
  elimination: 'إزالة تدريجية'
};

const modeIcons: Record<ReadingMode, React.ElementType> = {
  standard: Eye,
  rsvp: Zap,
  scrolling: FastForward,
  chunking: AlignCenter,
  elimination: Minus
};

const modeDescriptions: Record<ReadingMode, string> = {
  standard: 'قراءة تقليدية مع تتبع الوقت',
  rsvp: 'عرض كلمة واحدة في المركز',
  scrolling: 'تمرير النص تلقائياً بسرعة محددة',
  chunking: 'عرض 3-5 كلمات في كل مرة',
  elimination: 'إزالة الكلمات تدريجياً لزيادة السرعة'
};

// ... lines 8-57 ...

export function ReadingSpeedTool() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [mode, setMode] = useState<ReadingMode>('rsvp');
  const [wpm, setWpm] = useState(300);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [words, setWords] = useState<string[]>(mockWords);
  const [sessions] = useState<ReadingSession[]>(mockSessions);
  const [showHistory, setShowHistory] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  // Subscription & Gating
  const { checkAccess } = useSubscription();
  const [showPricing, setShowPricing] = useState(false);
  const hasAccess = checkAccess('fast_reading');

  if (!hasAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
        <div className="absolute inset-0 bg-gray-100 blur-[2px] opacity-50 z-0"></div>
        <div className="z-10 bg-white p-8 rounded-2xl shadow-xl max-w-md w-full relative">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">خاصية مدفوعة</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            ميزة "القراءة السريعة" متاحة فقط في النسخة الكاملة. قم بالترقية الآن واستمتع بهذه الميزة وعشرات المزايا الأخرى.
          </p>
          <UpgradeButton onClick={() => setShowPricing(true)} className="w-full justify-center" />
        </div>
      </div>
    );
  }


  // Settings
  const [fontSize, setFontSize] = useState(48);
  const [bgColor, setBgColor] = useState('#18181B');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [chunkSize, setChunkSize] = useState(3);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate ms per word based on WPM
  const msPerWord = 60000 / wpm;

  // RSVP Timer
  // Timer Logic
  useEffect(() => {
    if (isPlaying) {
      if (mode === 'rsvp' || mode === 'elimination') {
        intervalRef.current = setInterval(() => {
          setCurrentWordIndex(prev => {
            if (prev >= words.length - 1) {
              setIsPlaying(false);
              return prev;
            }
            return prev + 1;
          });
        }, msPerWord);
      } else if (mode === 'chunking') {
        const delay = msPerWord * chunkSize;
        intervalRef.current = setInterval(() => {
          setCurrentWordIndex(prev => {
            if (prev >= words.length - chunkSize) {
              setIsPlaying(false);
              return prev;
            }
            return prev + chunkSize;
          });
        }, delay);
      }
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, mode, msPerWord, words.length, chunkSize]);

  // Elapsed time counter
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Auto-Scroll Logic
  useEffect(() => {
    let animationFrameId: number;
    if (isPlaying && mode === 'scrolling') {
      // Estimate: 300 WPM ~ 0.5 lines/sec ~ 20px/sec
      const pixelsPerFrame = wpm / 1000;

      const scroll = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += pixelsPerFrame;
          // Check if reached end?
          if (scrollRef.current.scrollTop + scrollRef.current.clientHeight >= scrollRef.current.scrollHeight - 5) {
            // optional: stop?
          }
        }
        animationFrameId = requestAnimationFrame(scroll);
      };
      animationFrameId = requestAnimationFrame(scroll);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, mode, wpm]);

  const handleSelectFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{
          name: 'PDF Files',
          extensions: ['pdf']
        }]
      });

      if (selected && typeof selected === 'string') {
        setSelectedFile(selected.split(/[/\\]/).pop() || selected);
        setLoading(true);
        setError(null);

        // Extract text
        const res = await api.extractText(selected, 'all');
        if (res.success && res.data) {
          const text = res.data.data.text;
          // Clean and split text
          const cleanText = text.replace(/\s+/g, ' ').trim();
          const newWords = cleanText.split(' ').filter(w => w.length > 0);

          if (newWords.length > 0) {
            setWords(newWords);
            setIsPlaying(false);
            setCurrentWordIndex(0);
            setElapsedTime(0);
          } else {
            setError('لم يتم العثور على نص في هذا الملف');
          }
        } else {
          setError('فشل استخراج النص: ' + (res.error || 'خطأ غير معروف'));
        }
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء فتح الملف');
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (scrollRef.current && (mode === 'standard' || mode === 'scrolling')) {
      const el = scrollRef.current;
      if (el.scrollHeight > el.clientHeight) {
        const percent = el.scrollTop / (el.scrollHeight - el.clientHeight);
        const index = Math.min(words.length - 1, Math.floor(percent * words.length));
        // Only update if difference is significant to avoid jitter
        if (Math.abs(index - currentWordIndex) > 5) {
          setCurrentWordIndex(index);
        }
      }
    }
  };

  const handleStart = () => {
    setCurrentWordIndex(0);
    setElapsedTime(0);
    setIsPlaying(true);
  };

  const handlePauseResume = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentWordIndex(0);
    setElapsedTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (currentWordIndex / words.length) * 100;
  const wordsRead = currentWordIndex + 1;
  const currentWpm = elapsedTime > 0 ? Math.round((wordsRead / elapsedTime) * 60) : 0;

  // Stats
  const totalSessions = sessions.length;
  const avgWpm = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => sum + s.wpm, 0) / sessions.length) 
    : 0;
  const bestWpm = sessions.length > 0 
    ? Math.max(...sessions.map(s => s.wpm)) 
    : 0;
  const totalReadingTime = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">سرعة القراءة</h2>
        <p className="text-gray-500">تدريب على القراءة السريعة بأنماط مختلفة</p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card py-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{totalSessions}</div>
          <div className="text-xs text-gray-500">جلسات التدريب</div>
        </div>
        <div className="card py-4 text-center">
          <div className="text-2xl font-bold text-green-600">{avgWpm}</div>
          <div className="text-xs text-gray-500">متوسط WPM</div>
        </div>
        <div className="card py-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{bestWpm}</div>
          <div className="text-xs text-gray-500">أفضل WPM</div>
        </div>
        <div className="card py-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{totalReadingTime}</div>
          <div className="text-xs text-gray-500">دقيقة تدريب</div>
        </div>
      </div>

      {/* Setup Section */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* File Selection */}
          <button 
            onClick={handleSelectFile}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            <span>{loading ? 'جاري التحضير...' : 'اختيار ملف PDF'}</span>
          </button>
          {selectedFile && !loading && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-sm font-medium">{selectedFile}</span>
              <span className="text-xs text-gray-400">({words.length} كلمة)</span>
            </div>
          )}

          {/* Mode Selection */}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ReadingMode)}
            className="input w-auto min-w-[180px]"
          >
            {Object.entries(modeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* WPM Slider */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">السرعة:</label>
            <input
              type="range"
              min={100}
              max={800}
              step={25}
              value={wpm}
              onChange={(e) => setWpm(parseInt(e.target.value))}
              className="w-32"
            />
            <span className="text-sm font-medium text-indigo-600 w-16">{wpm} WPM</span>
          </div>

          {/* Settings Toggle */}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`btn ${showSettings ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Settings size={18} />
          </button>

          {/* History Toggle */}
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
          >
            <History size={18} />
            <span>السجل</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 mx-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-100">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">إعدادات العرض</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">حجم الخط</label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  min={24}
                  max={120}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">لون الخلفية</label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">لون النص</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
              {mode === 'chunking' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">حجم المجموعة</label>
                  <input
                    type="number"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(parseInt(e.target.value))}
                    min={2}
                    max={7}
                    className="input"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode Description */}
        <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          {(() => {
            const Icon = modeIcons[mode];
            return <Icon size={18} className="text-indigo-600" />;
          })()}
          <span className="text-sm text-indigo-700">{modeDescriptions[mode]}</span>
        </div>
      </div>

      {/* Reading Display */}
      <div 
        className="flex-1 rounded-xl flex flex-col items-center justify-center mb-6 relative overflow-hidden"
        style={{ backgroundColor: bgColor, minHeight: '200px' }}
      >
        {/* Word Display (RSVP Mode) */}
        {mode === 'rsvp' && (
          <div 
            className="font-bold transition-all duration-75"
            style={{ color: textColor, fontSize: `${fontSize}px` }}
          >
            {words[currentWordIndex] || 'ابدأ التدريب'}
          </div>
        )}

        {/* Chunking Mode */}
        {mode === 'chunking' && (
          <div 
            className="font-bold text-center"
            style={{ color: textColor, fontSize: `${fontSize * 0.7}px` }}
          >
            {words.slice(currentWordIndex, currentWordIndex + chunkSize).join(' ') || 'ابدأ التدريب'}
          </div>
        )}

        {/* Standard / Scrolling Mode */}
        {(mode === 'standard' || mode === 'scrolling') && (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="w-full h-full overflow-y-auto p-8 text-right leading-loose custom-scrollbar"
            style={{ color: textColor, fontSize: `${fontSize * 0.5}px`, lineHeight: '1.8' }}
          >
            {words.join(' ')}
          </div>
        )}

        {/* Elimination Mode - Disappearing Text */}
        {mode === 'elimination' && (
          <div
            className="w-full h-full overflow-y-auto p-8 text-right leading-loose custom-scrollbar transition-all"
            style={{ color: textColor, fontSize: `${fontSize * 0.5}px`, lineHeight: '1.8' }}
          >
            <span className="opacity-50 text-sm block mb-4 border-b border-gray-700 pb-2">اقرأ النص المتبقي قبل أن يختفي!</span>
            {words.slice(currentWordIndex).join(' ')}
          </div>
        )}

        {/* Focus Point (for RSVP) */}
        {mode === 'rsvp' && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 w-1 h-3 rounded-full opacity-50"
            style={{ backgroundColor: textColor, bottom: '30%' }}
          />
        )}
      </div>

      {/* Progress & Controls */}
      <div className="card">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>{wordsRead} / {words.length} كلمة</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-8 mb-4 py-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{currentWpm}</div>
            <div className="text-xs text-gray-500">WPM الحالي</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{formatTime(elapsedTime)}</div>
            <div className="text-xs text-gray-500">الوقت</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{wordsRead}</div>
            <div className="text-xs text-gray-500">كلمات مقروءة</div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button 
            onClick={() => setCurrentWordIndex(Math.max(0, currentWordIndex - 10))}
            className="btn btn-secondary"
            disabled={currentWordIndex === 0}
          >
            <SkipBack size={18} />
          </button>
          
          {!isPlaying ? (
            <button 
              onClick={currentWordIndex === 0 ? handleStart : handlePauseResume}
              className="btn btn-primary px-8"
            >
              <Play size={20} />
              <span>{currentWordIndex === 0 ? 'ابدأ' : 'استئناف'}</span>
            </button>
          ) : (
            <button 
              onClick={handlePauseResume}
              className="btn btn-secondary px-8"
            >
              <Pause size={20} />
              <span>إيقاف مؤقت</span>
            </button>
          )}
          
          <button 
            onClick={handleStop}
            className="btn btn-secondary"
            disabled={currentWordIndex === 0 && !isPlaying}
          >
            <Square size={18} />
          </button>
          
          <button 
            onClick={() => setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 10))}
            className="btn btn-secondary"
            disabled={currentWordIndex >= words.length - 1}
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="card mt-6">
          <div className="flex items-center gap-2 mb-4">
            <History size={20} className="text-indigo-600" />
            <h3 className="font-semibold text-gray-900">سجل الجلسات</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">الملف</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">الوضع</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">التاريخ</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">المدة</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">الكلمات</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">WPM</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm">{session.file_name}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{modeLabels[session.mode]}</td>
                    <td className="py-2 px-3 text-sm text-gray-500">{session.date}</td>
                    <td className="py-2 px-3 text-sm">{session.duration_minutes} د</td>
                    <td className="py-2 px-3 text-sm">{session.words_read.toLocaleString()}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                        {session.wpm}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
