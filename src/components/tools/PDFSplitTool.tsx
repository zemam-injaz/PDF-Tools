import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { 
  Split, ArrowRight, CheckCircle, AlertCircle, Scissors, 
  Eye, BookOpen, Hash,
  LayoutGrid, Search, X, Loader2, ZoomIn, ZoomOut
} from 'lucide-react';
import { FileInput } from '../ui/FileInput';

// Separate component for optimized thumbnail loading
const ThumbnailItem: React.FC<{
  pageNum: number;
  isSplitPoint: boolean;
  onToggle: (page: number) => void;
  onVisible: (page: number) => void;
  thumbnail?: string;
  isLoading: boolean;
  chapterIndex?: number;
}> = ({ pageNum, isSplitPoint, onToggle, onVisible, thumbnail, isLoading, chapterIndex }) => {
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
      {/* Page Marker / Split Indicator */}
      <div 
        onClick={() => onToggle(pageNum)}
        className={`
          absolute -left-4 top-1/2 -translate-y-1/2 z-10 
          flex flex-col items-center gap-1 cursor-pointer transition-all duration-300
          ${pageNum === 1 ? 'hidden' : 'flex'}
          ${isSplitPoint ? 'scale-110' : 'opacity-0 group-hover:opacity-100 scale-90'}
        `}
      >
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2
          ${isSplitPoint ? 'bg-red-500 border-white text-white' : 'bg-white border-indigo-200 text-indigo-400 hover:text-indigo-600'}
        `}>
          <Scissors size={14} className={isSplitPoint ? 'animate-pulse' : ''} />
        </div>
        {isSplitPoint && <span className="text-[10px] font-bold text-red-600 bg-white px-1.5 rounded-full shadow-sm">تقسيم</span>}
      </div>

      {/* Thumbnail Card */}
      <div 
        className={`
          aspect-[3/4] rounded-xl overflow-hidden shadow-sm border-2 transition-all duration-300 bg-white relative
          ${isSplitPoint ? 'border-red-500 shadow-red-100 ring-4 ring-red-50' : 'border-gray-200 group-hover:border-indigo-300'}
        `}
      >
        {thumbnail ? (
          <img src={thumbnail} alt={`Page ${pageNum}`} className="w-full h-full object-cover animate-fade-in" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-300 gap-2">
            {isLoading ? <Loader2 size={24} className="animate-spin text-indigo-400" /> : <Hash size={24} />}
            <span className="text-[10px] font-medium">{isLoading ? 'جاري التحميل' : `صفحة ${pageNum}`}</span>
          </div>
        )}
        
        {/* Page Label */}
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
          {pageNum}
        </div>

        {/* Overlay Action */}
        <div 
          className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 cursor-pointer transition-colors"
          onClick={() => onToggle(pageNum)}
        />
      </div>
      
      {/* Chapter Label */}
      <div className="text-center h-4">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {pageNum === 1 ? 'بداية الملف' : (isSplitPoint && chapterIndex !== undefined ? `بداية الجزء ${chapterIndex + 2}` : '')}
        </span>
      </div>
    </div>
  );
};

export const PDFSplitTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [splitPages, setSplitPages] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  // PDF Info & Smart Mode State
  const [pdfInfo, setPdfInfo] = useState<{ pageCount: number } | null>(null);
  const [showSmartMode, setShowSmartMode] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Record<number, boolean>>({});
  // Ref-based in-flight tracker to prevent duplicate thumbnail fetches (stale-closure safe)
  const thumbnailsInFlight = useRef<Set<number>>(new Set());
  const [selectedSplits, setSelectedSplits] = useState<number[]>([]);
  const [searchPage, setSearchPage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1); // 1: Small, 2: Medium, 3: Large
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-set output directory based on input file and fetch PDF info
  const handleInputChange = async (path: string) => {
    setInputPath(path);
    setPdfInfo(null);
    setThumbnails({});
    setSelectedSplits([]);
    setSplitPages('');

    if (!path) return;

    if (!outputDir) {
      const separator = path.includes('\\') ? '\\' : '/';
      const lastSep = path.lastIndexOf(separator);
      if (lastSep > 0) {
        setOutputDir(path.substring(0, lastSep));
      }
    }

    try {
      const res = await api.info(path);
      if (res.success && res.data) {
        setPdfInfo({ pageCount: res.data.page_count });
      }
    } catch (e) {
      console.error('Failed to fetch PDF info:', e);
    }
  };

  useEffect(() => {
    const pages = splitPages
      .split(',')
      .map(p => parseInt(p.trim()))
      .filter(p => !isNaN(p) && p > 1 && (!pdfInfo || p <= pdfInfo.pageCount));
    
    const uniqueSorted = Array.from(new Set(pages)).sort((a, b) => a - b);
    
    if (JSON.stringify(uniqueSorted) !== JSON.stringify(selectedSplits)) {
      setSelectedSplits(uniqueSorted);
    }
  }, [splitPages, pdfInfo]);

  const toggleSplitPoint = useCallback((page: number) => {
    if (page <= 1) return;
    
    setSelectedSplits(prev => {
      let newSplits;
      if (prev.includes(page)) {
        newSplits = prev.filter(p => p !== page);
      } else {
        newSplits = [...prev, page].sort((a, b) => a - b);
      }
      setSplitPages(newSplits.join(', '));
      return newSplits;
    });
  }, []);

  const loadThumbnail = useCallback(async (page: number) => {
    if (!inputPath) return;

    // Guard: skip if already fetched or currently in-flight (ref is always current)
    if (thumbnails[page] || thumbnailsInFlight.current.has(page)) return;

    thumbnailsInFlight.current.add(page);
    setLoadingThumbnails(prev => ({ ...prev, [page]: true }));

    try {
      // Adjust DPI based on zoom level for better readability
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

  // If zoom level changes, we might want to reload thumbnails with higher DPI
  useEffect(() => {
    if (zoomLevel > 1) {
        // Clear thumbnails to force reload with higher DPI for better readability
        // But only if we are in large zoom modes
        setThumbnails({});
    }
  }, [zoomLevel]);

  // Track current page on scroll
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

  const handleSplit = async () => {
    if (!inputPath || !splitPages || !outputDir) return;
    
    const pages = selectedSplits;
    if (pages.length === 0) {
      setStatus({ type: 'error', message: 'يرجى تحديد نقطة تقسيم واحدة على الأقل' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: 'جاري التقسيم...' });
    const res = await api.split(inputPath, pages, outputDir);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: `تم تقسيم الملف إلى ${res.data?.files?.length || (pages.length + 1)} أجزاء بنجاح!` });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء التقسيم' });
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(searchPage);
    if (isNaN(p) || !pdfInfo || p < 1 || p > pdfInfo.pageCount) return;
    
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-indigo-500', 'ring-opacity-50');
      setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500', 'ring-opacity-50'), 2000);
    }
    setSearchPage('');
  };

  const adjustZoom = (delta: number) => {
    setZoomLevel(prev => {
        const next = prev + delta;
        return Math.max(1, Math.min(3, next));
    });
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in relative overflow-hidden">
      {/* Smart Mode Overlay */}
      {showSmartMode && (
        <div className="absolute inset-0 z-40 bg-white flex flex-col animate-slide-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowSmartMode(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-600" />
                المعاينة والتقسيم الذكي
              </h3>
              <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />
              <div className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-500">
                <span className="bg-white px-2 py-1 rounded border border-gray-100 text-indigo-600 font-bold tabular-nums">
                  {currentPage}
                </span>
                <span>من</span>
                <span className="font-bold text-gray-700 tabular-nums">
                  {pdfInfo?.pageCount || 0}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Zoom Controls */}
              <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                <button 
                    onClick={() => adjustZoom(-1)}
                    disabled={zoomLevel === 1}
                    className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors text-gray-600"
                    title="تصغير"
                >
                    <ZoomOut size={18} />
                </button>
                <div className="px-3 text-xs font-bold text-gray-700 min-w-[3rem] text-center">
                    {zoomLevel === 1 ? '100%' : (zoomLevel === 2 ? '150%' : '200%')}
                </div>
                <button 
                    onClick={() => adjustZoom(1)}
                    disabled={zoomLevel === 3}
                    className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors text-gray-600"
                    title="تكبير"
                >
                    <ZoomIn size={18} />
                </button>
              </div>

              <form onSubmit={handleJumpToPage} className="relative hidden md:block">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="انتقال للصفحة..." 
                  className="input pl-9 h-9 w-40 text-sm"
                  value={searchPage}
                  onChange={e => setSearchPage(e.target.value)}
                />
              </form>
              <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-100 flex items-center gap-2">
                <Scissors size={14} />
                {selectedSplits.length} نقاط تقسيم
              </div>
              <button 
                onClick={() => setShowSmartMode(false)}
                className="btn btn-primary h-9 px-4 text-sm"
              >
                تأكيد
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
                <ThumbnailItem
                  key={pageNum}
                  pageNum={pageNum}
                  isSplitPoint={selectedSplits.includes(pageNum)}
                  onToggle={toggleSplitPoint}
                  onVisible={loadThumbnail}
                  thumbnail={thumbnails[pageNum]}
                  isLoading={loadingThumbnails[pageNum]}
                  chapterIndex={selectedSplits.indexOf(pageNum)}
                />
              );
            })}
          </div>
          
          {/* Progress Indicator at the bottom */}
          <div className="h-1 bg-gray-100 w-full overflow-hidden">
            <div 
                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${(currentPage / (pdfInfo?.pageCount || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main UI */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
          <Split size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">تقسيم ملف PDF</h2>
          <p className="text-secondary mt-1">تقسيم ملف PDF كبير إلى أجزاء متعددة بدقة وسهولة.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={inputPath}
            onChange={handleInputChange}
            label="1. الملف المراد تقسيمه"
            placeholder="اختر ملف PDF..."
            accept=".pdf"
          />

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-sm font-semibold text-primary">2. نقاط التقسيم (أرقام الصفحات)</label>
              {pdfInfo && (
                <button 
                  onClick={() => setShowSmartMode(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full transition-all"
                >
                  <Eye size={14} />
                  فتح وضع المعاينة الذكي
                </button>
              )}
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="relative flex-1 group">
                <Scissors className={`absolute left-3 top-3 transition-colors ${splitPages ? 'text-indigo-500' : 'text-gray-400'}`} size={18} />
                <input
                  type="text"
                  value={splitPages}
                  onChange={e => setSplitPages(e.target.value)}
                  placeholder="مثال: 5, 10, 15"
                  className="input pl-10 text-right font-mono" 
                  dir="ltr"
                />
              </div>
              <button
                onClick={() => setShowSmartMode(true)}
                disabled={!pdfInfo}
                className="btn btn-secondary h-[42px] px-4 whitespace-nowrap shadow-sm border-indigo-100 text-indigo-600"
              >
                <LayoutGrid size={18} className="ml-2" />
                معاينة مرئية
              </button>
            </div>
            <p className="text-xs text-secondary mt-1.5 mr-1 leading-relaxed">
              سيتم إنشاء ملف جديد بدءاً من كل صفحة تحددها. 
              {pdfInfo && <span className="text-indigo-600 font-semibold"> (إجمالي الصفحات: {pdfInfo.pageCount})</span>}
            </p>
          
            {/* Quick Summary of Selected Splits */}
            {selectedSplits.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 animate-fade-in">
                {selectedSplits.map((page, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 pl-1 pr-3 py-1 rounded-lg text-xs font-medium text-gray-600 shadow-sm group hover:border-red-200 transition-colors">
                    <Hash size={12} className="text-indigo-400" />
                    <span>صفحة {page}</span>
                    <button 
                      onClick={() => toggleSplitPoint(page)}
                      className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <FileInput
            value={outputDir}
            onChange={setOutputDir}
            label="3. مجلد الحفظ"
            placeholder="اختر مجلد لحفظ الملفات المقسمة..."
            isDirectory
          />
        </section>

        <section className="mt-auto pt-4 pb-2">
          {status.message && (
            <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-fade-in shadow-sm ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
              'bg-indigo-50 text-indigo-700 border border-indigo-100'
            }`}>
              {status.type === 'success' ? <CheckCircle size={18} /> :
                status.type === 'error' ? <AlertCircle size={18} /> :
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {status.message}
            </div>
          )}

          <button
            onClick={handleSplit}
            disabled={loading || !inputPath || !splitPages || !outputDir}
            className="btn-enhanced w-full py-4 text-lg shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-2xl group"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-3">
                <Scissors size={22} className="group-hover:rotate-12 transition-transform" />
                تأكيد تقسيم الملف
                <ArrowRight size={22} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};



