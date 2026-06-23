import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import {
  BookOpen, Copy, ChevronLeft, ChevronRight, Check, Plus,
  Scissors, FileText, Sparkles, ExternalLink,
  Edit3, Info, X, Search, Loader2,
  ZoomIn, ZoomOut, Hash, Bookmark, LayoutGrid
} from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { getDefaultOutputPath } from '../../lib/utils';

type Mode = 'extract' | 'split' | 'insert' | 'transfer';
type InsertStep = 1 | 2 | 3 | 4;

// Optimized Thumbnail Item for Bookmarking
const BookmarkThumbnailItem: React.FC<{
  pageNum: number;
  title: string;
  isBookmarked: boolean;
  onToggle: (page: number) => void;
  onSetTitle: (page: number, title: string) => void;
  onVisible: (page: number) => void;
  thumbnail?: string;
  isLoading: boolean;
  zoomLevel: number;
}> = ({ pageNum, title, isBookmarked, onToggle, onSetTitle, onVisible, thumbnail, isLoading }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(pageNum);
        }
      },
      { threshold: 0.01, rootMargin: '600px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  return (
    <div ref={ref} id={`page-${pageNum}`} className="relative flex flex-col gap-3 group">
      {/* Bookmark Toggle Indicator */}
      <button 
        onClick={() => onToggle(pageNum)}
        className={`
          absolute -left-4 top-10 z-10 
          w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-300
          ${isBookmarked ? 'bg-amber-500 border-white text-white scale-110' : 'bg-white border-gray-200 text-gray-300 opacity-0 group-hover:opacity-100 scale-90'}
        `}
      >
        <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
      </button>

      {/* Thumbnail Card */}
      <div 
        className={`
          aspect-[3/4] rounded-xl overflow-hidden shadow-sm border-2 transition-all duration-300 bg-white relative cursor-pointer
          ${isBookmarked ? 'border-amber-500 ring-4 ring-amber-50 shadow-amber-100' : 'border-gray-200 group-hover:border-amber-200'}
        `}
        onClick={() => !isBookmarked && onToggle(pageNum)}
      >
        {thumbnail ? (
          <img src={thumbnail} alt={`Page ${pageNum}`} className="w-full h-full object-cover animate-fade-in" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-300 gap-2">
            {isLoading ? <Loader2 size={24} className="animate-spin text-amber-400" /> : <Hash size={24} />}
            <span className="text-[10px] font-medium">{isLoading ? 'جاري التحميل' : `صفحة ${pageNum}`}</span>
          </div>
        )}
        
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
          {pageNum}
        </div>
      </div>
      
      {/* Title Input */}
      <div className={`transition-all duration-300 ${isBookmarked ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2 pointer-events-none'}`}>
        <input 
          type="text"
          value={title}
          onChange={(e) => onSetTitle(pageNum, e.target.value)}
          placeholder="عنوان الإشارة..."
          className="w-full text-[11px] font-bold p-2 border-2 border-amber-100 rounded-lg focus:border-amber-500 outline-none transition-colors text-center bg-amber-50/30"
          dir="rtl"
        />
      </div>
    </div>
  );
};

export const BookmarkTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [outputDir, setOutputDir] = useState('');

  // Auto-set output path/dir based on input file
  const handleInputChange = async (path: string) => {
    setInputPath(path);
    setPdfInfo(null);
    setThumbnails({});
    setManualBookmarks({});
    if (path) {
      if (!outputPath && mode === 'insert') {
        const separator = path.includes('\\') ? '\\' : '/';
        const lastSep = path.lastIndexOf(separator);
        if (lastSep > 0) {
          setOutputPath(path.substring(0, lastSep));
        }
      }
      if (mode === 'split') {
        if (!outputDir) {
          const separator = path.includes('\\') ? '\\' : '/';
          const lastSep = path.lastIndexOf(separator);
          if (lastSep > 0) {
            setOutputDir(path.substring(0, lastSep));
          }
        }
      }
      
      // Fetch PDF info
      try {
        const res = await api.info(path);
        if (res.success && res.data) {
            setPdfInfo({ pageCount: res.data.page_count });
        }
      } catch (e) {
        console.error('Failed to fetch PDF info:', e);
      }
    }
  };

  const [bookmarks, setBookmarks] = useState('');
  const [bookmarkText, setBookmarkText] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const [parsedBookmarks, setParsedBookmarks] = useState<Array<{title: string, page: number, level: number}>>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('extract');
  const [insertStep, setInsertStep] = useState<InsertStep>(1);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [sourcePath, setSourcePath] = useState('');
  const [considerLevels, setConsiderLevels] = useState(true);
  const [ignoreHierarchy, setIgnoreHierarchy] = useState(false);
  const [availableLevels, setAvailableLevels] = useState<number[]>([]);
  const [targetLevel, setTargetLevel] = useState<number>(1);

  // Smart Visual Mode State
  const [showSmartMode, setShowSmartMode] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{ pageCount: number } | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Record<number, boolean>>({});
  // Ref-based in-flight tracker to prevent duplicate thumbnail fetches (stale-closure safe)
  const thumbnailsInFlight = useRef<Set<number>>(new Set());
  const [manualBookmarks, setManualBookmarks] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchPage, setSearchPage] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Split settings
  const [splitLevel1Only, setSplitLevel1Only] = useState(true);

  // Preview state
  const [currentPreviewPage, setCurrentPreviewPage] = useState<number>(1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeBookmarkIndex, setActiveBookmarkIndex] = useState<number>(-1);

  // Auto-clear status messages
  useEffect(() => {
    if (status.type === 'success') {
      const timer = setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Fetch preview when page or offset changes
  const fetchPreview = async (page: number) => {
    if (!inputPath) return;
    setLoadingPreview(true);
    try {
      const res = await api.renderPage(inputPath, page);
      if (res.success && res.data?.data) {
        setPreviewImage(res.data.data.image);
        setCurrentPreviewPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Smart Mode Loading Logic
  const loadThumbnail = useCallback(async (page: number) => {
    if (!inputPath) return;

    // Guard: skip if already fetched or currently in-flight (ref is always current)
    if (thumbnails[page] || thumbnailsInFlight.current.has(page)) return;

    thumbnailsInFlight.current.add(page);
    setLoadingThumbnails(prev => ({ ...prev, [page]: true }));

    try {
      const dpi = zoomLevel === 1 ? 72 : (zoomLevel === 2 ? 100 : 150);
      const res = await api.renderPage(inputPath, page, dpi);
      if (res.success && res.data?.data?.image) {
        setThumbnails(curr => ({ ...curr, [page]: res.data!.data.image }));
      }
    } catch (e) {
      console.error(`Failed to load thumbnail for page ${page}:`, e);
    } finally {
      thumbnailsInFlight.current.delete(page);
      setLoadingThumbnails(curr => ({ ...curr, [page]: false }));
    }
  }, [inputPath, thumbnails, zoomLevel]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !pdfInfo) return;
    
    const container = scrollContainerRef.current;
    const items = container.querySelectorAll('[id^="page-"]');
    
    let currentInView = 1;
    let minDistance = Infinity;
    const containerCenter = container.scrollTop + container.clientHeight / 2;

    items.forEach((item) => {
      const rect = (item as HTMLElement).offsetTop;
      const distance = Math.abs(rect - containerCenter);
      if (distance < minDistance) {
        minDistance = distance;
        currentInView = parseInt(item.id.replace('page-', ''));
      }
    });

    if (currentInView !== currentPage) {
      setCurrentPage(currentInView);
    }
  }, [currentPage, pdfInfo]);

  const toggleManualBookmark = (page: number) => {
    setManualBookmarks(prev => {
      const next = { ...prev };
      if (next[page] !== undefined) {
        delete next[page];
      } else {
        next[page] = '';
      }
      return next;
    });
  };

  const setManualBookmarkTitle = (page: number, title: string) => {
    setManualBookmarks(prev => ({ ...prev, [page]: title }));
  };

  const confirmSmartMode = () => {
    // Convert manual bookmarks to text format
    const lines = Object.entries(manualBookmarks)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([page, title]) => `${(title || '').trim() || 'عنوان غير محدد'} - ${page}`);
    
    setBookmarkText(lines.join('\n'));
    setConsiderLevels(false);
    setShowSmartMode(false);
    setInsertStep(2);
  };

  // Fetch levels when mode splits or input path changes
  useEffect(() => {
    const fetchLevels = async () => {
      if (mode === 'split' && inputPath) {
        try {
          const res = await api.getBookmarkLevels(inputPath);
          if (res.success && res.data?.data) {
            const levels = Object.keys(res.data.data.levels).map(Number).sort((a, b) => a - b);
            setAvailableLevels(levels);
            setTargetLevel(levels.includes(1) ? 1 : (levels[0] || 1));
          }
        } catch (err) {
          console.error("Failed to fetch levels:", err);
        }
      }
    };
    fetchLevels();
  }, [mode, inputPath]);

  // Extract bookmarks (Extract Mode)
  const handleExtract = async () => {
    if (!inputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري استخراج الفهرس...' });
    
    const res = await api.extractBookmarks(inputPath);
    setLoading(false);
    
    if (res.success && res.data?.data) {
      setBookmarks(res.data.data.formatted_text);
      setStatus({ type: 'success', message: `تم استخراج ${res.data.data.count} عنصر` });
    } else {
      setStatus({ type: 'error', message: res.error || 'لم يتم العثور على فهرس' });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookmarks);
    setStatus({ type: 'success', message: 'تم النسخ للحافظة' });
  };

  const copyPromptForAi = () => {
    const prompt = `Based on the text provided, please generate a structured Table of Contents (Bookmarks) in the exact format: "Title - Page".
Rules:
1. Every line must follow: "Chapter Title - PageNumber"
2. Use indentation (2 spaces) for sub-chapters.
3. Only output the list.`;

    // Optimistic success
    navigator.clipboard.writeText(prompt);
    setStatus({ type: 'success', message: '✅ تم نسخ الطلب (Prompt) بنجاح!' });
  };

  const openAiStudio = async () => {
    const url = 'https://aistudio.google.com/prompts/new_chat';
    api.openUrl(url); // Fire and forget for robustness
  };

  // Split by bookmarks
  const handleSplit = async () => {
    if (!inputPath || !outputDir) {
      if (!outputDir) setStatus({ type: 'error', message: 'يرجى اختيار مجلد الحفظ أولاً' });
      return;
    }
    setLoading(true);
    setStatus({ type: '', message: 'جاري التقسيم...' });
    
    const res = await api.splitByBookmarks(
      inputPath,
      outputDir,
      splitLevel1Only,
      true, // preserveBookmarks
      undefined, // selectedIndices
      ignoreHierarchy,
      targetLevel
    );
    setLoading(false);
    
    if (res.success && res.data?.data) {
      setStatus({ type: 'success', message: `تم إنشاء ${res.data.data.total_files} ملف` });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  // Parse text into bookmarks
  const handleParse = async () => {
    if (!bookmarkText.trim()) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري التحليل...' });

    const res = await api.parseBookmarks(bookmarkText, considerLevels);
    setLoading(false);

    if (res.success && res.data) {
      setParsedBookmarks(res.data.data);
      setInsertStep(3);
      setStatus({ type: 'success', message: `تم تحليل ${res.data.data.length} عنوان بنجاح` });
    } else {
      setStatus({ type: 'error', message: res.error || 'لم نتمكن من تحليل النص. تأكد من التنسيق: (العنوان - الصفحة)' });
    }
  };

  // Insert bookmarks into PDF
  const handleInsert = async () => {
    if (!inputPath || !outputPath || parsedBookmarks.length === 0) return;
    
    const separator = outputPath.includes('\\') ? '\\' : '/';
    const inputName = inputPath.substring(inputPath.lastIndexOf(separator) + 1);
    const nameWithoutExt = inputName.endsWith('.pdf') ? inputName.slice(0, -4) : inputName;
    const finalOutputPath = `${outputPath}${outputPath.endsWith(separator) ? '' : separator}${nameWithoutExt}_bookmarked.pdf`;

    setLoading(true);
    setStatus({ type: '', message: 'جاري إدراج الفهرس...' });
    
    // Pass pageOffset to backend to ensure it applies to all bookmarks
    const res = await api.insertBookmarks(inputPath, parsedBookmarks, finalOutputPath, pageOffset);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: `✅ تم إدراج ${parsedBookmarks.length} إشارة مرجعية بنجاح!` });
      setInsertStep(4);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء الإدراج' });
    }
  };

  // Transfer bookmarks
  const handleTransfer = async () => {
    if (!sourcePath || !inputPath || !outputPath) return;
    
    const separator = outputPath.includes('\\') ? '\\' : '/';
    const inputName = inputPath.substring(inputPath.lastIndexOf(separator) + 1);
    const nameWithoutExt = inputName.endsWith('.pdf') ? inputName.slice(0, -4) : inputName;
    const finalOutputPath = outputPath.toLowerCase().endsWith('.pdf')
      ? outputPath
      : `${outputPath}${outputPath.endsWith(separator) ? '' : separator}${nameWithoutExt}_with_bookmarks.pdf`;

    setLoading(true);
    setStatus({ type: '', message: 'جاري نقل الفهرس...' });

    const res = await api.transferBookmarks(sourcePath, inputPath, finalOutputPath);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: `✅ تم نقل الفهرس (${res.data?.data?.count} عنصر) بنجاح!` });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء النقل' });
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(searchPage);
    if (isNaN(p) || !pdfInfo || p < 1 || p > pdfInfo.pageCount) return;
    
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setSearchPage('');
  };

  const modes = [
    { id: 'extract' as Mode, label: 'استخراج الفهرس', icon: FileText },
    { id: 'insert' as Mode, label: 'إدراج فهرس', icon: Plus },
    { id: 'transfer' as Mode, label: 'نقل الفهرس', icon: Copy },
    { id: 'split' as Mode, label: 'تقسيم حسب الفهرس', icon: Scissors },
  ];

  return (
    <div className="card h-full flex flex-col animate-fade-in relative z-0">
      {/* Smart Mode Overlay */}
      {showSmartMode && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowSmartMode(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <Bookmark size={20} className="text-amber-600" />
                إدراج فهرس مرئي (يدوي)
              </h3>
              <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />
              <div className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-500">
                <span className="bg-white px-2 py-1 rounded border border-gray-100 text-amber-600 font-bold tabular-nums">
                  {currentPage}
                </span>
                <span>من</span>
                <span className="font-bold text-gray-700 tabular-nums">
                  {pdfInfo?.pageCount || 0}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                <button 
                    onClick={() => setZoomLevel(p => Math.max(1, p-1))}
                    disabled={zoomLevel === 1}
                    className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors text-gray-600"
                >
                    <ZoomOut size={18} />
                </button>
                <div className="px-3 text-xs font-bold text-gray-700 min-w-[3rem] text-center">
                    {zoomLevel === 1 ? '100%' : (zoomLevel === 2 ? '150%' : '200%')}
                </div>
                <button 
                    onClick={() => setZoomLevel(p => Math.min(3, p+1))}
                    disabled={zoomLevel === 3}
                    className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors text-gray-600"
                >
                    <ZoomIn size={18} />
                </button>
              </div>

              <form onSubmit={handleJumpToPage} className="relative hidden md:block">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="انتقال..." 
                  className="input pl-9 h-9 w-32 text-sm"
                  value={searchPage}
                  onChange={e => setSearchPage(e.target.value)}
                />
              </form>
              
              <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-amber-100 flex items-center gap-2">
                <Bookmark size={14} />
                {Object.keys(manualBookmarks).length} إشارات
              </div>
              
              <button 
                onClick={confirmSmartMode}
                className="btn btn-primary h-9 px-6 text-sm bg-amber-600 hover:bg-amber-700 text-white"
              >
                تأكيد الفهرس
              </button>
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={`
                flex-1 overflow-y-auto p-8 grid gap-8 custom-scrollbar bg-zinc-50/50 transition-all duration-500
                ${zoomLevel === 1 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8' : 
                  zoomLevel === 2 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'}
            `}
          >
            {pdfInfo && Array.from({ length: pdfInfo.pageCount }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <BookmarkThumbnailItem
                  key={pageNum}
                  pageNum={pageNum}
                  title={manualBookmarks[pageNum] || ''}
                  isBookmarked={manualBookmarks[pageNum] !== undefined}
                  onToggle={toggleManualBookmark}
                  onSetTitle={setManualBookmarkTitle}
                  onVisible={loadThumbnail}
                  thumbnail={thumbnails[pageNum]}
                  isLoading={loadingThumbnails[pageNum]}
                  zoomLevel={zoomLevel}
                />
              );
            })}
          </div>
          
          <div className="h-1 bg-gray-100 w-full overflow-hidden">
            <div 
                className="h-full bg-amber-500 transition-all duration-300 ease-out"
                style={{ width: `${(currentPage / (pdfInfo?.pageCount || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-amber-50 text-amber-600 shadow-sm">
          <BookOpen size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">إدارة الفهرس</h2>
          <p className="text-secondary mt-1">أدوات متكاملة للتعامل مع فهارس (Bookmarks) ملفات PDF.</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-4 mb-10 overflow-x-auto pb-2">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => { 
              setMode(m.id); 
              setInsertStep(1); 
              setStatus({ type: '', message: '' }); 
              // Initialize outputPath if we switch to insert mode and have an inputPath
              if (m.id === 'insert' && inputPath && !outputPath) {
                setOutputPath(getDefaultOutputPath(inputPath, '_bookmarked'));
              }
            }}
            className={`flex-1 py-4 px-6 rounded-xl font-medium text-base transition-all flex items-center justify-center gap-3 border ${mode === m.id
                ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                : 'bg-white border-border text-secondary hover:bg-gray-50'
            }`}
          >
            <m.icon size={20} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Status Notification */}
      {status.message && (
        <div className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 text-sm font-bold animate-slide-up shadow-sm ${
          loading
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : status.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : status.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {loading && <Loader2 size={20} className="animate-spin shrink-0" />}
          {!loading && status.type === 'success' && <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          {!loading && status.type === 'error' && <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          <span className="flex-1">{status.message}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {/* EXTRACT MODE */}
        {mode === 'extract' && (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto">
            <FileInput
              value={inputPath}
              onChange={handleInputChange}
              label="1. اختر ملف PDF"
              placeholder="مثال: E:\Documents\book.pdf"
              accept=".pdf"
            />

            <button
              onClick={handleExtract}
              disabled={loading || !inputPath}
              className="btn-enhanced w-full py-4 text-lg font-medium shadow-md hover:shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'جاري المعالجة...' : 'استخراج الفهرس الآن'}
            </button>

            {bookmarks && (
              <div className="mt-4 animate-slide-up">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-semibold text-primary">الفهرس المستخرج:</label>
                  <button
                    onClick={copyToClipboard}
                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2 text-sm font-medium px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
                  >
                    <Copy size={16} /> نسخ النص
                  </button>
                </div>
                <div className="relative group">
                  <pre className="p-5 bg-zinc-50 rounded-xl text-sm max-h-80 overflow-auto border border-zinc-200 whitespace-pre-wrap leading-relaxed font-mono custom-scrollbar shadow-inner">
                    {bookmarks}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRANSFER MODE */}
        {mode === 'transfer' && (
          <div className="flex flex-col gap-8 max-w-2xl mx-auto animate-fade-in">
            <div className="text-center mb-2">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Copy size={32} />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">نقل الفهرس بين الملفات</h3>
              <p className="text-secondary text-sm">قم بنقل الفهرس من ملف (أصلي) إلى ملف آخر (محسن/OCR)</p>
            </div>

            <div className="space-y-6">
              <FileInput
                value={sourcePath}
                onChange={setSourcePath}
                label="1. الملف المصدر (الذي يحتوي على الفهرس)"
                placeholder="اختر الملف الأصلي..."
                accept=".pdf"
              />

              <FileInput
                value={inputPath}
                onChange={(path) => {
                  setInputPath(path);
                  if (path && !outputPath) {
                    setOutputPath(getDefaultOutputPath(path, '_with_bookmarks'));
                  }
                }}
                label="2. الملف الوجهة (المراد إضافة الفهرس إليه)"
                placeholder="اختر الملف المحسن..."
                accept=".pdf"
              />

              <FileInput
                value={outputPath}
                onChange={setOutputPath}
                label="3. مسار حفظ الملف الناتج"
                placeholder="اختر مجلد الحفظ..."
                isDirectory
              />

              <button
                onClick={handleTransfer}
                disabled={loading || !sourcePath || !inputPath || !outputPath}
                className="btn-enhanced w-full py-5 text-xl font-bold mt-4 shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'جاري المعالجة...' : 'نقل الفهرس الآن'}
              </button>
            </div>

            <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg text-amber-600 shadow-sm shrink-0">
                <Info size={20} />
              </div>
              <div className="text-sm text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">تنبيه هام:</p>
                تأكد من أن الملفين لهما نفس عدد الصفحات أو أن الملف الوجهة يحتوي على نفس ترتيب الصفحات لضمان دقة الفهارس.
              </div>
            </div>
          </div>
        )}

        {/* INSERT MODE */}
        {mode === 'insert' && (
          <div className="space-y-8">
            {/* Step Indicator */}
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between relative px-2 py-6 mb-8">
                {/* Line across */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-[-1]" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-amber-500 -translate-y-1/2 z-[-1] transition-all duration-500 ease-out"
                  style={{ width: `${((insertStep - 1) / 3) * 100}%` }}
                />

                {[1, 2, 3, 4].map(step => (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${insertStep === step ? 'bg-amber-500 text-white border-amber-500 shadow-lg scale-110' :
                      insertStep > step ? 'bg-white text-amber-500 border-amber-500' : 'bg-white text-gray-300 border-gray-100'
                      }`}>
                      {insertStep > step ? <Check size={20} /> : step}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${insertStep >= step ? 'text-amber-600' : 'text-gray-300'}`}>
                      {step === 1 ? 'الملف' : step === 2 ? 'الفهرس' : step === 3 ? 'المراجعة' : 'النتيجة'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Select PDF */}
            {insertStep === 1 && (
              <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                    <FileText size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-2">اختيار ملف الوجهة</h3>
                  <p className="text-secondary">قم باختيار ملف الـ PDF الذي تود إضافة الفهارس إليه</p>
                </div>

                <FileInput
                  value={inputPath}
                  onChange={handleInputChange}
                  label="اختر ملف PDF"
                  placeholder="أدخل المسار الكامل للملف..."
                  accept=".pdf"
                />

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => inputPath && setInsertStep(2)}
                    disabled={!inputPath}
                    className="btn btn-primary px-10 py-4 gap-3 text-lg font-semibold shadow-lg shadow-amber-500/10"
                  >
                    التالي <ChevronLeft size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Prepare Text & Paste */}
            {insertStep === 2 && (
              <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-2">تجهيز ولصق الفهرس</h3>
                  <p className="text-secondary">قم بإدخال العناوين بتنسيق: <strong>العنوان - رقم الصفحة</strong></p>
                </div>

                {/* Manual Visual Mode Button */}
                <div className="flex justify-center mb-4">
                  <button 
                    onClick={() => setShowSmartMode(true)}
                    className="btn btn-enhanced px-8 py-4 bg-amber-50 border-2 border-amber-200 text-amber-700 font-bold flex items-center gap-3 hover:bg-amber-100 transition-all shadow-md group"
                  >
                    <LayoutGrid size={20} className="group-hover:rotate-12 transition-transform" />
                    فتح وضع الإدراج المرئي (Thumbnail Mode)
                    <Sparkles size={18} className="text-amber-500 animate-pulse" />
                  </button>
                </div>

                {/* AI Assistant Tool-box */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 shadow-sm">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm shrink-0">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-indigo-900 mb-1">المساعد الذكي (AI Studio)</h4>
                      <p className="text-sm text-indigo-700/80 leading-relaxed">
                        يمكنك استخدام نماذج الذكاء الاصطناعي (مثل Gemini) لمساعدتك في استخراج الفهرس من النص.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={copyPromptForAi}
                      className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-indigo-100 rounded-xl text-indigo-700 font-bold transition-all hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-md active:scale-95"
                    >
                      <Copy size={18} />
                      نسخ طلب التقسيم (Prompt)
                    </button>
                    <button
                      onClick={openAiStudio}
                      className="flex items-center justify-center gap-3 p-4 bg-indigo-600 rounded-xl text-white font-bold transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95 shadow-md shadow-indigo-200"
                    >
                      <ExternalLink size={18} />
                      فتح Google AI Studio
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute top-4 right-4 text-xs font-bold text-gray-400 bg-white/80 px-2 py-1 rounded">نص الفهرس</div>
                  <textarea
                    value={bookmarkText}
                    onChange={e => setBookmarkText(e.target.value)}
                    placeholder={'مقدمة الكتاب - 1\nالفصل الأول: البداية - 12\n  المطلب الأول - 14\nالخاتمة - 150'}
                    className="input min-h-[300px] pt-12 font-mono text-sm leading-loose resize-y shadow-inner border-gray-200"
                    dir="rtl"
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <label className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors border border-blue-100/50">
                    <input
                      type="checkbox"
                      checked={considerLevels}
                      onChange={(e) => setConsiderLevels(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-primary text-sm">مراعاة المستويات (Consider Levels)</span>
                      <p className="text-secondary text-[10px]">استخدام السطر الفارغ لتمييز العناوين الرئيسية</p>
                    </div>
                  </label>

                  <button
                    onClick={handleParse}
                    disabled={loading || !bookmarkText.trim()}
                    className="btn-enhanced w-full py-4 text-lg font-bold shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? 'جاري التحليل...' : 'تحليل العناوين للمراجعة 📋'}
                  </button>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setInsertStep(1)} className="btn btn-secondary flex-1 py-4 font-bold text-gray-500">
                    <ChevronRight size={20} /> السابق
                  </button>
                  <button
                    onClick={handleParse}
                    disabled={loading || !bookmarkText.trim()}
                    className="btn btn-primary flex-[2] py-4 text-lg font-bold shadow-lg shadow-blue-500/20"
                  >
                    {loading ? 'جاري التحليل...' : <span className="flex items-center gap-2">تحليل المراجعة والإدراج <ChevronLeft size={20} /></span>}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Final Settings */}
            {insertStep === 3 && (
              <div className="max-w-7xl mx-auto space-y-8 animate-fade-in px-4">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-2">المراجعة النهائية والتأكيد</h3>
                  <p className="text-secondary">تحقق من التنسيق وأرقام الصفحات قبل الإدراج</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                  {/* Right Column: Table and Settings */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <label className="text-sm font-bold text-secondary">العناوين المكتشفة ({parsedBookmarks.length})</label>
                      <button onClick={() => setInsertStep(2)} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
                        <Edit3 size={12} /> تعديل النص
                      </button>
                    </div>
                    <div className="max-h-[600px] overflow-auto border border-border rounded-2xl bg-white shadow-sm custom-scrollbar">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 text-secondary border-b z-10">
                          <tr>
                            <th className="p-4 text-right">العنوان</th>
                            <th className="p-4 text-center w-24">الصفحة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {parsedBookmarks.map((b, i) => (
                            <tr
                              key={i}
                              onClick={() => {
                                setActiveBookmarkIndex(i);
                                fetchPreview(b.page + pageOffset);
                              }}
                              className={`cursor-pointer transition-colors ${activeBookmarkIndex === i ? 'bg-amber-50 border-r-4 border-amber-500' : 'hover:bg-indigo-50/30'}`}
                            >
                              <td className="p-4" style={{ paddingRight: b.level === 1 ? '1rem' : `${b.level * 1.5}rem` }}>
                                <div className="flex items-center gap-2 w-full">
                                  {b.level > 1 && <span className="text-gray-300 shrink-0">↳</span>}
                                  <input
                                    type="text"
                                    value={b.title}
                                    onChange={(e) => {
                                      const newBookmarks = [...parsedBookmarks];
                                      newBookmarks[i] = { ...newBookmarks[i], title: e.target.value };
                                      setParsedBookmarks(newBookmarks);
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Prevent row click preview trigger
                                    className="bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-indigo-500 focus:bg-white outline-none w-full py-1 px-2 rounded text-indigo-900 font-bold transition-all text-right"
                                    dir="rtl"
                                    placeholder="أدخل عنوان الإشارة..."
                                  />
                                </div>
                              </td>
                              <td className="p-4 text-center tabular-nums font-bold text-amber-600">
                                {b.page + pageOffset}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Settings & Final Action */}
                    <div className="card p-8 border-amber-100 bg-amber-50/50 space-y-6 shadow-sm">
                      <div className="flex items-center gap-3 text-amber-700 font-bold mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                          <Info size={18} />
                        </div>
                        <span>إعدادات الإدراج النهائية</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-md flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <FileText size={18} />
                              <span className="font-bold text-sm">إزاحة الصفحات:</span>
                              <input
                                type="number"
                                value={pageOffset}
                                onChange={e => setPageOffset(parseInt(e.target.value) || 0)}
                                className="bg-transparent w-16 text-center font-bold text-white placeholder-white/50 border-b border-white/20 focus:border-white outline-none transition-colors"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPageOffset(prev => prev + 1)}
                                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                                title="زيادة (+1)"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button
                                onClick={() => setPageOffset(prev => prev - 1)}
                                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                                title="إنقاص (-1)"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-amber-700 leading-tight px-1">
                            سيتم إضافة هذا الرقم لجميع الصفحات (مثلاً: +15).
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-amber-900 block">مكان الحفظ</label>
                          <FileInput
                            value={outputPath}
                            onChange={(path) => {
                              setOutputPath(path || '');
                            }}
                            placeholder="اختر مجلد الحفظ..."
                            isDirectory
                          />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-amber-100 flex flex-col gap-4">
                        <button
                          onClick={handleInsert}
                          disabled={loading || !outputPath}
                          className="btn-enhanced w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 font-bold text-lg"
                        >
                          {loading ? 'جاري الإدراج...' : (
                            <span className="flex items-center justify-center gap-3">
                              تأكيد وإدراج الفهرس الآن <Check size={24} />
                            </span>
                          )}
                        </button>
                        <button onClick={() => setInsertStep(2)} className="text-sm font-bold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2">
                          <ChevronRight size={16} /> العودة لتعديل النص
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Left Column: Huge PDF Preview (Sticky) */}
                  <div className="space-y-6 order-1 lg:order-2 lg:sticky lg:top-8">
                    {/* PDF Preview Corner */}
                    <div className="card p-0 overflow-hidden border-indigo-200 bg-white shadow-xl relative group">
                      <div className="bg-indigo-600 text-white px-4 py-3 text-xs font-bold uppercase tracking-wider flex justify-between items-center shadow-md">
                        <div className="flex items-center gap-2">
                          <FileText size={16} />
                          <span>معاينة الصفحة: {currentPreviewPage}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => fetchPreview(currentPreviewPage - 1)}
                            disabled={currentPreviewPage <= 1 || loadingPreview}
                            className="bg-white/10 hover:bg-white/20 p-1 rounded-md transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                          >
                            <ChevronRight size={18} />
                          </button>
                          <button
                            onClick={() => fetchPreview(currentPreviewPage + 1)}
                            disabled={loadingPreview}
                            className="bg-white/10 hover:bg-white/20 p-1 rounded-md transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                          >
                            <ChevronLeft size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="bg-zinc-100 flex items-center justify-center relative min-h-[600px] lg:min-h-[750px] transition-all duration-500">
                        {loadingPreview ? (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                            <span className="text-sm font-bold text-indigo-600 tracking-widest">جاري التحميل...</span>
                          </div>
                        ) : previewImage ? (
                          <img
                            src={previewImage}
                            alt="Page Preview"
                            className="w-full h-full object-contain animate-fade-in shadow-inner"
                          />
                        ) : (
                          <div className="text-center p-12 text-gray-400 max-w-xs mx-auto">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 opacity-50">
                              <FileText size={48} />
                            </div>
                            <p className="text-sm font-medium leading-relaxed">
                              انقر على أحد العناوين في القائمة المقابلة لمعاينة الصفحة هنا والتأكد من تطابق الفهرس
                            </p>
                          </div>
                        )}

                        {/* Sync Overlay */}
                        {activeBookmarkIndex !== -1 && !loadingPreview && (
                          <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg animate-bounce border-2 border-white/20 backdrop-blur-sm">
                            متصل بالفهرس المحدد
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 italic text-[11px] text-gray-400 text-center mt-6">
                  نصيحة: يمكنك استعراض الملف الناتج وفتحه مباشرة عند الانتهاء.
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {insertStep === 4 && (
              <div className="max-w-2xl mx-auto text-center space-y-8 py-12 animate-fade-in shadow-sm bg-white rounded-3xl border border-gray-100">
                <div className="relative">
                  <div className="w-32 h-32 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check size={80} strokeWidth={3} />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-emerald-800 mb-3">رائع! تم الإدراج</h3>
                  <p className="text-secondary text-lg">
                    تمت إضافة <span className="font-bold text-indigo-600">{parsedBookmarks.length}</span> عنوان للفهرس بنجاح.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center px-8">
                  <button
                    onClick={() => { setInsertStep(1); setBookmarkText(''); setParsedBookmarks([]); setInputPath(''); setOutputPath(''); setStatus({ type: '', message: '' }); }}
                    className="btn btn-secondary py-4 px-10 text-lg font-bold flex-1"
                  >
                    إدراج فهرس جديد
                  </button>
                  {outputPath && (
                    <button
                      onClick={async () => {
                        const { openPath } = await import('../../lib/utils');
                        openPath(outputPath);
                      }}
                      className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-10 text-lg font-bold flex-1"
                    >
                      فتح المجلد
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SPLIT MODE */}
        {mode === 'split' && (
          <div className="space-y-8 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Scissors size={48} className="mx-auto text-amber-500 mb-4" />
              <h3 className="text-xl font-bold text-primary">التقسيم الآلي حسب الفصول</h3>
              <p className="text-secondary text-sm">يقوم هذا الخيار بتقسيم الملف الضخم إلى ملفات صغيرة بناءً على الفهرس الموجود مسبقاً</p>
            </div>

            <div className="space-y-6">
              <FileInput
                value={inputPath}
                onChange={handleInputChange}
                label="1. اختر ملف PDF"
                placeholder="أدخل المسار الكامل..."
                accept=".pdf"
              />

              <FileInput
                value={outputDir}
                onChange={setOutputDir}
                label="2. مجلد الإخراج"
                placeholder="مكان حفظ الملفات الناتجة..."
                isDirectory
              />

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col gap-3">
                <div className="mt-1 text-amber-600">
                  <Scissors size={20} />
                </div>
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={splitLevel1Only}
                    onChange={(e) => setSplitLevel1Only(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">تقسيم حسب العناوين الرئيسية فقط (Level 1)</span>
                    <p className="text-secondary text-xs">تجاهل العناوين الفرعية عند التقسيم</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                  <input
                    type="checkbox"
                    checked={ignoreHierarchy}
                    onChange={(e) => setIgnoreHierarchy(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">تسطيح الهيكل (Ignore Hierarchy)</span>
                    <p className="text-secondary text-xs">تحويل جميع العناوين لمستوى واحد لتجنب أخطاء التسلسل</p>
                  </div>
                </label>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-900">مستوى التقسيم (Target Level)</span>
                    <p className="text-secondary text-xs">اختر مستوى الفهرس الذي تريد التقسيم عنده</p>
                  </div>
                  <select
                    value={targetLevel}
                    onChange={(e) => setTargetLevel(Number(e.target.value))}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {availableLevels.map(level => (
                      <option key={level} value={level}>المستوى {level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSplit}
                disabled={loading || !inputPath || !outputDir}
                className="btn-enhanced w-full py-5 text-xl font-bold mt-4 shadow-xl shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? 'جاري المعالجة...' : 'بدء التقسيم حسب الفصول'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
