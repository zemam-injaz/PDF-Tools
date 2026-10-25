import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { pdfjs, Document } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  Loader2, ZoomIn, ZoomOut, X, Maximize2, Minimize2, AlertCircle, CheckCircle2,
  Rows3, Square, Columns2, MoveHorizontal, MoveVertical, PanelRight, MessageSquare,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { PDFPageRenderer } from './PDFPageRenderer';
import { ReaderSidebar } from './ReaderSidebar';
import { CommentsPanel } from './CommentsPanel';
import { AnnotationToolbar, type Tool, isPointTool, isPassageTool } from './toolbar/AnnotationToolbar';
import {
  annotationApi,
  type Annotation,
  type AnnotationData,
  type PassageSelection,
  type ExportMode
} from '../../api/annotationApi';
import {
  bookLibraryApi,
  type Annotation as NativePdfAnnotation,
  type BookmarkItem
} from '../../api/bookLibraryApi';
import {
  loadReaderPrefs,
  saveReaderPrefs,
  type ReaderLayout,
  type FitMode
} from '../../lib/readerPrefs';

// Bundle the PDF.js worker locally so opening a book never waits on a CDN
// request (and the reader works offline). Using `new URL(..., import.meta.url)`
// lets Vite resolve and emit the worker as an asset without going through the
// dependency pre-bundler.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface InteractivePDFViewerProps {
  pdfPath: string;
  bookId: string;
  bookTitle: string;
  readingCount: number;
  onClose: () => void;
  assetUrl: string;
}

interface PendingInput {
  kind: 'text' | 'note';
  page: number;
  x: number;
  y: number;
  selection?: PassageSelection;
}

const PAGE_BUFFER = 2;
const CONTAINER_PADDING = 48;

export const InteractivePDFViewer: React.FC<InteractivePDFViewerProps> = ({
  pdfPath,
  bookId,
  bookTitle,
  readingCount,
  onClose,
  assetUrl
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [basePageSize, setBasePageSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const [layout, setLayout] = useState<ReaderLayout>('continuous');
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [zoom, setZoom] = useState(1.2);
  const [currentPage, setCurrentPage] = useState(1);
  const [anchorPage, setAnchorPage] = useState<number | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [pageInput, setPageInput] = useState('1');

  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [nativeAnnotations, setNativeAnnotations] = useState<NativePdfAnnotation[]>([]);
  const [loadingNative, setLoadingNative] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [hasBookmarks, setHasBookmarks] = useState(false);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [sourceWarning, setSourceWarning] = useState<string | null>(null);

  const [loadingPdf, setLoadingPdf] = useState(true);
  const [loadingAnnotations, setLoadingAnnotations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [commentText, setCommentText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageElRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRaf = useRef<number | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const bookmarksLoadedRef = useRef(false);
  const nativeLoadedRef = useRef(false);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const scale = useMemo(() => {
    if (fitMode === 'custom' || !basePageSize || containerSize.width === 0) return zoom;
    const availW = Math.max(100, containerSize.width - CONTAINER_PADDING);
    const availH = Math.max(100, containerSize.height - CONTAINER_PADDING);
    const widthScale = availW / basePageSize.width;
    const pageScale = Math.min(widthScale, availH / basePageSize.height);
    const s = fitMode === 'width' ? widthScale : pageScale;
    return Math.min(Math.max(0.2, s), 5);
  }, [fitMode, zoom, basePageSize, containerSize]);

  const estimatedPageHeight = (basePageSize ? basePageSize.height : 800) * scale;
  const estimatedPageWidth = (basePageSize ? basePageSize.width : 600) * scale;

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // --- Preferences ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await loadReaderPrefs(bookId);
      if (cancelled) return;
      setLayout(prefs.layout);
      setFitMode(prefs.fitMode);
      setZoom(prefs.zoom);
      setCommentsOpen(prefs.commentsOpen);
      setCurrentPage(prefs.lastPage);
      setPageInput(String(prefs.lastPage));
      setAnchorPage(prefs.lastPage);
      setPrefsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  useEffect(() => {
    if (!prefsLoaded) return;
    const t = window.setTimeout(() => {
      saveReaderPrefs(bookId, { layout, fitMode, zoom, lastPage: currentPage, commentsOpen });
    }, 500);
    return () => window.clearTimeout(t);
  }, [prefsLoaded, bookId, layout, fitMode, zoom, currentPage, commentsOpen]);

  // Restore scroll position after a scale or layout change, and after the
  // initial document load. If the target page is not mounted yet we keep the
  // anchor so a later render (when base size / page count arrive) completes the
  // restore instead of silently dropping it.
  useEffect(() => {
    if (anchorPage == null) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (layout === 'continuous') {
          const el = pageElRefs.current.get(anchorPage);
          if (!el) return; // retry on next dependency change
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        setAnchorPage(null);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [scale, layout, anchorPage, numPages, basePageSize]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // --- Container size -------------------------------------------------------
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setContainerSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Data loading ---------------------------------------------------------
  const loadAnnotations = useCallback(async () => {
    try {
      const annots = await annotationApi.getAnnotations(bookId);
      // Native annotations already render through PDF.js; the DB mirror only
      // supports search/progress and must not draw a second overlay.
      setAnnotations(annots.filter(annot => annot.data.source !== 'qt-native'));
      setUndoStack([]);
      setRedoStack([]);
    } catch (err) {
      console.warn('[Reader] Failed to load annotations:', err);
    } finally {
      setLoadingAnnotations(false);
    }
  }, [bookId]);

  useEffect(() => { loadAnnotations(); }, [loadAnnotations]);

  // Bookmarks and native PDF annotations are only read from disk when their
  // panels are opened, so opening a book does not trigger extra PDF parses.
  useEffect(() => {
    bookmarksLoadedRef.current = false;
    nativeLoadedRef.current = false;
    setBookmarks([]);
    setHasBookmarks(false);
    setLoadingBookmarks(false);
    setNativeAnnotations([]);
    setLoadingNative(false);
    setSourceWarning(null);
  }, [pdfPath]);

  useEffect(() => {
    if (!sidebarOpen || bookmarksLoadedRef.current) return;
    bookmarksLoadedRef.current = true;
    let cancelled = false;
    setLoadingBookmarks(true);
    bookLibraryApi
      .extractBookmarks(pdfPath)
      .then((res) => {
        if (cancelled) return;
        setBookmarks(res.bookmarks || []);
        setHasBookmarks(Boolean(res.has_bookmarks));
      })
      .catch(() => {
        if (cancelled) return;
        setHasBookmarks(false);
        setSourceWarning('تعذّر قراءة فهرس المستند. تأكد من وجود الملف في مساره.');
      })
      .finally(() => { if (!cancelled) setLoadingBookmarks(false); });
    return () => { cancelled = true; };
  }, [sidebarOpen, pdfPath]);

  useEffect(() => {
    if (!commentsOpen || nativeLoadedRef.current) return;
    nativeLoadedRef.current = true;
    let cancelled = false;
    setLoadingNative(true);
    bookLibraryApi
      .extractAnnotations(pdfPath)
      .then((res) => { if (!cancelled) setNativeAnnotations(res || []); })
      .catch(() => {
        if (cancelled) return;
        setNativeAnnotations([]);
        setSourceWarning((prev) => prev || 'تعذّر استخراج تعليقات PDF الأصلية. قد يكون الملف مفقودًا أو متغيّرًا.');
      })
      .finally(() => { if (!cancelled) setLoadingNative(false); });
    return () => { cancelled = true; };
  }, [commentsOpen, pdfPath]);

  // --- Document -------------------------------------------------------------
  const onDocumentLoadSuccess = async (pdf: any) => {
    setNumPages(pdf.numPages);
    setLoadingPdf(false);
    setError(null);
    try {
      const page1 = await pdf.getPage(1);
      const viewport = page1.getViewport({ scale: 1 });
      setBasePageSize({ width: viewport.width, height: viewport.height });
    } catch {
      // keep zoom fallback
    }
  };

  const onDocumentLoadError = (err: Error) => {
    setError(err.message || 'فشل تحميل ملف PDF. يرجى التأكد من صحة الملف.');
    setLoadingPdf(false);
  };

  // --- Navigation -----------------------------------------------------------
  const goToPage = useCallback((page: number, behavior: ScrollBehavior = 'smooth') => {
    const clamped = Math.min(Math.max(1, page), Math.max(1, numPages));
    setCurrentPage(clamped);
    if (layout === 'continuous') {
      const el = pageElRefs.current.get(clamped);
      if (el) el.scrollIntoView({ behavior, block: 'start' });
    }
  }, [layout, numPages]);

  const handleScroll = useCallback(() => {
    if (scrollRaf.current != null) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      const cTop = container.getBoundingClientRect().top;
      let best = currentPageRef.current;
      let bestDist = Infinity;
      pageElRefs.current.forEach((el, num) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < cTop || r.top > cTop + container.clientHeight) return;
        const dist = Math.abs(r.top - cTop);
        if (dist < bestDist) { bestDist = dist; best = num; }
      });
      if (best !== currentPageRef.current) setCurrentPage(best);
    });
  }, []);

  // --- Annotation persistence ----------------------------------------------
  const commitAnnotation = useCallback(async (
    partial: Omit<Annotation, 'id' | 'created_at'>
  ): Promise<void> => {
    const tempId = uuidv4();
    const optimistic: Annotation = { ...partial, id: tempId, created_at: new Date().toISOString() };
    setUndoStack((prev) => [...prev, annotationsRef.current]);
    setRedoStack([]);
    setAnnotations((prev) => [...prev, optimistic]);
    try {
      const saved = await annotationApi.addAnnotation({ ...partial, id: tempId });
      setAnnotations((prev) => prev.map((a) => (a.id === tempId ? saved : a)));
    } catch (err: any) {
      setAnnotations((prev) => prev.filter((a) => a.id !== tempId));
      showToast('error', 'فشل حفظ التعليق: ' + (err?.message || 'خطأ غير معروف'));
    }
  }, [showToast]);

  const handleAddAnnotation = useCallback((x: number, y: number, page: number) => {
    if (activeTool === 'text') {
      setPendingInput({ kind: 'text', page, x, y });
      return;
    }
    if (activeTool === 'timestamp') {
      commitAnnotation({
        book_id: bookId, page, x, y, type: 'timestamp',
        data: { timestamp: new Date().toISOString(), reading_count: readingCount }
      });
      return;
    }
    if (activeTool === 'dot-red' || activeTool === 'dot-black') {
      commitAnnotation({
        book_id: bookId, page, x, y, type: 'dot',
        data: { color: activeTool === 'dot-red' ? 'red' : 'black' }
      });
    }
  }, [activeTool, bookId, readingCount, commitAnnotation]);

  const handlePassageSelected = useCallback((selection: PassageSelection, page: number) => {
    const first = selection.rects[0];
    const x = first ? first.x + first.w / 2 : 0.5;
    const y = first ? first.y + first.h / 2 : 0.5;

    if (activeTool === 'highlight' || activeTool === 'underline') {
      commitAnnotation({
        book_id: bookId, page, x, y, type: activeTool,
        data: {
          quote: selection.quote,
          context_before: selection.context_before,
          context_after: selection.context_after,
          rects: selection.rects,
          source: 'matn',
          colorHex: activeTool === 'highlight' ? '#facc15' : '#38bdf8'
        }
      });
      return;
    }
    if (activeTool === 'note') {
      setPendingInput({ kind: 'note', page, x, y, selection });
    }
  }, [activeTool, bookId, commitAnnotation]);

  const savePendingInput = async () => {
    const p = pendingInput;
    if (!p) return;
    const text = commentText.trim();
    setPendingInput(null);
    setCommentText('');
    if (!text) return;

    const isArabic = /[\u0600-\u06FF]/.test(text);
    if (p.kind === 'text') {
      await commitAnnotation({
        book_id: bookId, page: p.page, x: p.x, y: p.y, type: 'text',
        data: { text, language: isArabic ? 'ar' : 'en' }
      });
    } else {
      await commitAnnotation({
        book_id: bookId, page: p.page, x: p.x, y: p.y, type: 'note',
        data: {
          text,
          language: isArabic ? 'ar' : 'en',
          quote: p.selection?.quote,
          context_before: p.selection?.context_before,
          context_after: p.selection?.context_after,
          rects: p.selection?.rects,
          source: 'matn',
          colorHex: '#10b981'
        }
      });
    }
  };

  const handleUpdateAnnotation = useCallback(async (id: string, newData: AnnotationData) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, data: newData } : a)));
    try {
      await annotationApi.updateAnnotation(id, newData);
    } catch (err: any) {
      showToast('error', 'فشل تحديث التعليق: ' + (err?.message || 'خطأ'));
      loadAnnotations();
    }
  }, [showToast, loadAnnotations]);

  const handleDeleteAnnotation = async (annot: Annotation) => {
    const previous = annotations;
    setUndoStack((prev) => [...prev, previous]);
    setAnnotations((prev) => prev.filter((a) => a.id !== annot.id));
    try {
      await annotationApi.deleteAnnotation(annot.id);
    } catch {
      setAnnotations(previous);
      showToast('error', 'فشل حذف التعليق');
    }
  };

  const handleReply = (annot: Annotation, text: string) => {
    const replies = [
      ...(annot.data.replies || []),
      { id: uuidv4(), text, created_at: new Date().toISOString() }
    ];
    handleUpdateAnnotation(annot.id, { ...annot.data, replies });
  };

  const handleToggleResolved = (annot: Annotation) => {
    handleUpdateAnnotation(annot.id, { ...annot.data, resolved: !annot.data.resolved });
  };

  const focusAnnotation = (annot: Annotation) => {
    goToPage(annot.page, 'smooth');
    setHighlightedId(annot.id);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightedId(null), 3000);
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const current = [...annotations];
    const added = current.filter((c) => !previous.find((p) => p.id === c.id));
    setRedoStack((prev) => [...prev, current]);
    setUndoStack((prev) => prev.slice(0, -1));
    setAnnotations(previous);
    for (const annot of added) {
      try { await annotationApi.deleteAnnotation(annot.id); } catch { /* best-effort */ }
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const current = [...annotations];
    const toReAdd = next.filter((n) => !current.find((c) => c.id === n.id));
    setUndoStack((prev) => [...prev, current]);
    setRedoStack((prev) => prev.slice(0, -1));
    setAnnotations(next);
    for (const annot of toReAdd) {
      try { await annotationApi.addAnnotation(annot); } catch { /* best-effort */ }
    }
  };

  const handleExport = async (mode: ExportMode) => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const suffix = mode === 'flatten' ? '_flattened.pdf' : '_annotated.pdf';
      const outputPath = await save({
        defaultPath: bookTitle.replace(/\.pdf$/i, '') + suffix,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (!outputPath) return;
      setExporting(true);
      await annotationApi.burnAnnotations(pdfPath, outputPath, annotations, mode);
      showToast('success', mode === 'flatten' ? 'تم تصدير نسخة مسطّحة من التعليقات' : 'تم تصدير نسخة مع تعليقات PDF');
    } catch (err: any) {
      showToast('error', 'فشل التصدير: ' + (err?.message || ''));
    } finally {
      setExporting(false);
    }
  };

  const requestPage = useCallback((delta: number) => {
    const step = layout === 'two' ? 2 : 1;
    goToPage(currentPageRef.current + delta * step, 'smooth');
  }, [layout, goToPage]);

  // Keyboard navigation (RTL-aware): Left/PageDown = next, Right/PageUp = prev.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      switch (e.key) {
        case 'PageDown':
        case 'ArrowLeft':
          e.preventDefault();
          requestPage(1);
          break;
        case 'PageUp':
        case 'ArrowRight':
          e.preventDefault();
          requestPage(-1);
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1, 'auto');
          break;
        case 'End':
          e.preventDefault();
          goToPage(numPages, 'auto');
          break;
        case 'Escape':
          if (pendingInput) {
            setPendingInput(null);
            setCommentText('');
          } else {
            setActiveTool('none');
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [requestPage, goToPage, numPages, pendingInput]);

  const submitPageInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (!Number.isNaN(parsed)) goToPage(parsed, 'auto');
    else setPageInput(String(currentPage));
  };

  const changeLayout = (next: ReaderLayout) => { setAnchorPage(currentPageRef.current); setLayout(next); };
  const changeFit = (next: FitMode) => { setAnchorPage(currentPageRef.current); setFitMode(next); };
  const zoomBy = (delta: number) => {
    setAnchorPage(currentPageRef.current);
    setFitMode('custom');
    setZoom((z) => Math.min(5, Math.max(0.2, +(z + delta).toFixed(2))));
  };

  const capturePointer = isPointTool(activeTool);
  const passageToolActive = isPassageTool(activeTool);

  const pageWindow = useMemo(() => {
    const start = Math.max(1, currentPage - PAGE_BUFFER);
    const end = Math.min(numPages, currentPage + PAGE_BUFFER);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }, [currentPage, numPages]);

  const renderPage = (pageNumber: number) => (
    <PDFPageRenderer
      key={`page_${pageNumber}`}
      pageNumber={pageNumber}
      scale={scale}
      annotations={annotations}
      capturePointer={capturePointer}
      passageToolActive={passageToolActive}
      highlightedId={highlightedId}
      onAddAnnotation={handleAddAnnotation}
      onUpdateAnnotation={handleUpdateAnnotation}
      onPassageSelected={handlePassageSelected}
    />
  );

  const layoutButton = (id: ReaderLayout, icon: any, label: string) => (
    <button
      onClick={() => changeLayout(id)}
      title={label}
      className={`p-2 rounded-lg transition-colors ${layout === id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
    >
      {React.createElement(icon, { size: 16 })}
    </button>
  );

  return (
    <div className={`relative w-full h-full flex flex-col bg-gray-900 ${fullscreen ? 'fixed inset-0 z-[60]' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-900 text-white border-b border-gray-800" dir="rtl">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors" title="إغلاق">
            <X size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-sm leading-tight truncate max-w-[16rem]">{bookTitle}</h2>
          </div>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1">
          <button onClick={() => requestPage(-1)} className="p-1.5 hover:bg-gray-700 rounded-lg" title="السابق">
            <ChevronRight size={16} />
          </button>
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={submitPageInput}
            onKeyDown={(e) => { if (e.key === 'Enter') submitPageInput(); }}
            className="w-12 text-center text-xs font-mono bg-transparent focus:outline-none"
            dir="ltr"
          />
          <span className="text-xs text-gray-500">/ {numPages || '—'}</span>
          <button onClick={() => requestPage(1)} className="p-1.5 hover:bg-gray-700 rounded-lg" title="التالي">
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Layout */}
          <div className="hidden md:flex items-center gap-1 bg-gray-800 rounded-xl p-1">
            {layoutButton('continuous', Rows3, 'عرض مستمر')}
            {layoutButton('single', Square, 'صفحة واحدة')}
            {layoutButton('two', Columns2, 'صفحتان')}
          </div>

          {/* Zoom / fit */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1">
            <button onClick={() => zoomBy(-0.2)} className="p-1.5 hover:bg-gray-700 rounded-lg" title="تصغير"><ZoomOut size={16} /></button>
            <span className="text-xs font-mono w-10 text-center" dir="ltr">{Math.round(scale * 100)}%</span>
            <button onClick={() => zoomBy(0.2)} className="p-1.5 hover:bg-gray-700 rounded-lg" title="تكبير"><ZoomIn size={16} /></button>
            <button
              onClick={() => changeFit('width')}
              title="ملاءمة العرض"
              className={`p-1.5 rounded-lg ${fitMode === 'width' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              <MoveHorizontal size={16} />
            </button>
            <button
              onClick={() => changeFit('page')}
              title="ملاءمة الصفحة"
              className={`p-1.5 rounded-lg ${fitMode === 'page' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              <MoveVertical size={16} />
            </button>
          </div>

          <button
            onClick={() => setCommentsOpen((v) => !v)}
            className={`p-2 rounded-full transition-colors ${commentsOpen ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
            title="لوحة التعليقات"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className={`p-2 rounded-full transition-colors ${sidebarOpen ? 'bg-indigo-600 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
            title="التنقّل"
          >
            <PanelRight size={18} />
          </button>
          <button onClick={() => setFullscreen((v) => !v)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400" title="ملء الشاشة">
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Main viewer area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {commentsOpen && (
          <CommentsPanel
            annotations={annotations}
            nativeAnnotations={nativeAnnotations}
            loadingNative={loadingNative}
            currentPage={currentPage}
            highlightedId={highlightedId}
            onSelect={focusAnnotation}
            onReply={handleReply}
            onToggleResolved={handleToggleResolved}
            onDelete={handleDeleteAnnotation}
            onNavigateNative={goToPage}
          />
        )}

        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
            <AnnotationToolbar
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              onExport={handleExport}
              isExporting={exporting}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
            />
          </div>

          {sourceWarning && (
            <div
              className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-xl bg-amber-500/95 text-white text-xs rounded-xl shadow-lg px-3 py-2 flex items-center gap-2"
              dir="rtl"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="flex-1">{sourceWarning}</span>
              <button onClick={() => setSourceWarning(null)} className="p-1 hover:bg-white/20 rounded" title="إغلاق">
                <X size={14} />
              </button>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto bg-gray-800 p-6 custom-scrollbar"
          >
            {!assetUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-40 p-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-3xl text-center max-w-sm">
                  <AlertCircle size={44} className="text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">رابط الملف مفقود</h3>
                  <p className="text-gray-400 text-sm">تعذّر الحصول على مسار الملف لمعاينته.</p>
                </div>
              </div>
            )}

            {(loadingPdf || loadingAnnotations) && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-sm z-40">
                <Loader2 size={44} className="animate-spin text-indigo-500 mb-4" />
                <p className="text-white font-medium">جاري تهيئة القارئ...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-40 p-4">
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center max-w-sm">
                  <AlertCircle size={44} className="text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">تعذّر فتح الكتاب</h3>
                  <p className="text-gray-400 text-sm mb-6">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              </div>
            )}

            {assetUrl && (
              <Document
                file={assetUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
              >
                {layout === 'continuous' && numPages > 0 && (
                  <div className="flex flex-col items-center">
                    {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => {
                      const inWindow = pageWindow.includes(pageNumber);
                      return (
                        <div
                          key={`slot_${pageNumber}`}
                          ref={(el) => {
                            if (el) pageElRefs.current.set(pageNumber, el);
                            else pageElRefs.current.delete(pageNumber);
                          }}
                          className="mb-6 flex justify-center"
                          style={{ width: estimatedPageWidth, minHeight: estimatedPageHeight }}
                        >
                          {inWindow && renderPage(pageNumber)}
                        </div>
                      );
                    })}
                  </div>
                )}

                {layout === 'single' && numPages > 0 && (
                  <div className="flex justify-center">{renderPage(currentPage)}</div>
                )}

                {layout === 'two' && numPages > 0 && (
                  <div className="flex flex-row-reverse justify-center items-start gap-4">
                    {[currentPage, currentPage + 1]
                      .filter((p) => p >= 1 && p <= numPages)
                      .map((p) => renderPage(p))}
                  </div>
                )}
              </Document>
            )}
          </div>
        </div>

        {sidebarOpen && (
          <ReaderSidebar
            assetUrl={assetUrl}
            numPages={numPages}
            currentPage={currentPage}
            bookmarks={bookmarks}
            hasBookmarks={hasBookmarks}
            loadingBookmarks={loadingBookmarks}
            onNavigate={(p) => goToPage(p, 'smooth')}
          />
        )}
      </div>

      {/* Text / note input modal */}
      {pendingInput && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100" dir="rtl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {pendingInput.kind === 'note' ? 'إضافة ملاحظة على المقطع' : 'إضافة تعليق نصي'}
            </h3>
            {pendingInput.selection?.quote && (
              <p className="text-xs text-gray-500 bg-amber-50 border-r-2 border-amber-300 pr-2 py-1 mb-3 rounded leading-relaxed line-clamp-3">
                {pendingInput.selection.quote}
              </p>
            )}
            <textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none mb-4 font-arabic"
              placeholder="اكتب تعليقك هنا (يدعم العربية والإنجليزية)..."
            />
            <div className="flex gap-3">
              <button
                onClick={savePendingInput}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                حفظ
              </button>
              <button
                onClick={() => { setPendingInput(null); setCommentText(''); }}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 left-4 z-[70] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
          dir="rtl"
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};
