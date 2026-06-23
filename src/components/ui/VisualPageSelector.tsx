import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { X, Search, Loader2, ZoomIn, ZoomOut, Hash, Check } from 'lucide-react';

interface VisualPageSelectorProps {
  inputPath: string;
  onConfirm: (pagesStr: string) => void;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
}

const ThumbnailItem: React.FC<{
  pageNum: number;
  isSelected: boolean;
  onToggle: (page: number) => void;
  onVisible: (page: number) => void;
  thumbnail?: string;
  isLoading: boolean;
  zoomLevel: number;
}> = ({ pageNum, isSelected, onToggle, onVisible, thumbnail, isLoading }) => {
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
      {/* Toggle Indicator */}
      <button 
        onClick={() => onToggle(pageNum)}
        className={`
          absolute -left-4 top-10 z-10 
          w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-300
          ${isSelected ? 'bg-indigo-500 border-white text-white scale-110' : 'bg-white border-gray-200 text-gray-300 opacity-0 group-hover:opacity-100 scale-90'}
        `}
      >
        <Check size={18} />
      </button>

      {/* Thumbnail Card */}
      <div 
        className={`
          aspect-[3/4] rounded-xl overflow-hidden shadow-sm border-2 transition-all duration-300 bg-white relative cursor-pointer
          ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-indigo-100' : 'border-gray-200 group-hover:border-indigo-200'}
        `}
        onClick={() => onToggle(pageNum)}
      >
        {thumbnail ? (
          <img src={thumbnail} alt={`Page ${pageNum}`} className="w-full h-full object-cover animate-fade-in" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-300 gap-2">
            {isLoading ? <Loader2 size={24} className="animate-spin text-indigo-400" /> : <Hash size={24} />}
            <span className="text-[10px] font-medium">{isLoading ? 'جاري التحميل' : `صفحة ${pageNum}`}</span>
          </div>
        )}
        
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
          {pageNum}
        </div>
      </div>
    </div>
  );
};

export const VisualPageSelector: React.FC<VisualPageSelectorProps> = ({ 
  inputPath, 
  onConfirm, 
  onClose,
  title = "تحديد الصفحات مرئياً",
  confirmLabel = "تأكيد التحديد"
}) => {
  const [pdfInfo, setPdfInfo] = useState<{ pageCount: number } | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Record<number, boolean>>({});
  const thumbnailsInFlight = useRef<Set<number>>(new Set());
  
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchPage, setSearchPage] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await api.info(inputPath);
        if (res.success && res.data) {
          setPdfInfo({ pageCount: res.data.page_count });
        }
      } catch (e) {
        console.error('Failed to fetch PDF info:', e);
      }
    };
    if (inputPath) fetchInfo();
  }, [inputPath]);

  const loadThumbnail = useCallback(async (page: number) => {
    if (!inputPath || thumbnails[page] || thumbnailsInFlight.current.has(page)) return;

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

  const togglePageSelection = (page: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    onConfirm(sorted.join(','));
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

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-50/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            {title}
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
          
          <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-100 flex items-center gap-2">
            <Check size={14} />
            {selectedPages.size} محددة
          </div>
          
          <button 
            onClick={handleConfirm}
            className="btn btn-primary h-9 px-6 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {confirmLabel}
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
              isSelected={selectedPages.has(pageNum)}
              onToggle={togglePageSelection}
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
            className="h-full bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${(currentPage / (pdfInfo?.pageCount || 1)) * 100}%` }}
        />
      </div>
    </div>
  );
};
