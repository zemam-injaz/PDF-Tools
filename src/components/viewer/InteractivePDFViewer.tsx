import React, { useState, useEffect, useRef } from 'react';
import { pdfjs, Document } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2, ZoomIn, ZoomOut, X, Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { PDFPageRenderer } from './PDFPageRenderer';
import { AnnotationToolbar, type Tool } from './toolbar/AnnotationToolbar';
import { annotationApi, type Annotation, type AnnotationData } from '../../api/annotationApi';

// Set up PDF.js worker using CDN to ensure version matching
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface InteractivePDFViewerProps {
  pdfPath: string;
  bookId: string;
  bookTitle: string;
  readingCount: number;
  onClose: () => void;
  assetUrl: string;
}

export const InteractivePDFViewer: React.FC<InteractivePDFViewerProps> = ({
  pdfPath,
  bookId,
  bookTitle,
  readingCount,
  onClose,
  assetUrl
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [loadingAnnotations, setLoadingAnnotations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Text Input Modal State
  const [textInput, setTextInput] = useState<{ x: number, y: number, page: number } | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // History for Undo/Redo
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAnnotations();
  }, [bookId]);

  const loadAnnotations = async () => {
    try {
      const annots = await annotationApi.getAnnotations(bookId);
      setAnnotations(annots);
      // Clear history when switching books
      setUndoStack([]);
      setRedoStack([]);
    } catch (err) {
      console.error('Failed to load annotations:', err);
    } finally {
      setLoadingAnnotations(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF Loaded successfully, pages:', numPages);
    setNumPages(numPages);
    setLoadingPdf(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF Load Error:', err);
    setError(err.message || 'فشل تحميل ملف PDF. يرجى التأكد من صحة الملف.');
    setLoadingPdf(false);
  };

  const handleAddAnnotation = async (x: number, y: number, page: number) => {
    console.log(`handleAddAnnotation triggered: tool=${activeTool}, x=${x}, y=${y}, page=${page}`);
    
    if (activeTool === 'text') {
      setTextInput({ x, y, page });
      return;
    }

    // Optimistic Update
    const tempId = uuidv4();
    const type = activeTool.startsWith('dot') ? 'dot' : 'timestamp';
    const data = (activeTool === 'timestamp' 
      ? { timestamp: new Date().toISOString(), reading_count: readingCount }
      : { color: activeTool === 'dot-red' ? 'red' : 'black' }) as AnnotationData;

    const optimisticAnnot: Annotation = {
      id: tempId,
      book_id: bookId,
      page,
      type,
      x,
      y,
      data,
      created_at: new Date().toISOString()
    };

    setUndoStack(prev => [...prev, annotations]);
    setRedoStack([]);
    setAnnotations((prev) => [...prev, optimisticAnnot]);

    try {
      const savedAnnot = await annotationApi.addAnnotation({
        book_id: bookId,
        page,
        type,
        x,
        y,
        data: data as AnnotationData
      });
      // Replace optimistic with real
      setAnnotations((prev) => prev.map(a => a.id === tempId ? savedAnnot : a));
    } catch (err: any) {
      console.error('Failed to save annotation:', err);
      // Rollback
      setAnnotations((prev) => prev.filter(a => a.id !== tempId));
      alert('فشل في حفظ التعليق: ' + (err.message || 'حدث خطأ غير معروف'));
    }
  };

  const saveTextAnnotation = async () => {
    if (!textInput || !commentText.trim()) {
      setTextInput(null);
      setCommentText('');
      return;
    }

    // Detect language simply by checking for Arabic characters
    const isArabic = /[\u0600-\u06FF]/.test(commentText);
    const tempId = uuidv4();
    const data: AnnotationData = { 
      text: commentText,
      language: isArabic ? 'ar' : 'en'
    };

    // Optimistic Update
    const optimisticAnnot: Annotation = {
      id: tempId,
      book_id: bookId,
      page: textInput.page,
      type: 'text',
      x: textInput.x,
      y: textInput.y,
      data,
      created_at: new Date().toISOString()
    };

    setUndoStack(prev => [...prev, annotations]);
    setRedoStack([]);
    setAnnotations((prev) => [...prev, optimisticAnnot]);
    const savedTextInput = { ...textInput };
    
    setTextInput(null);
    setCommentText('');

    try {
      const savedAnnot = await annotationApi.addAnnotation({
        book_id: bookId,
        page: savedTextInput.page,
        type: 'text',
        x: savedTextInput.x,
        y: savedTextInput.y,
        data
      });
      // Replace optimistic with real
      setAnnotations((prev) => prev.map(a => a.id === tempId ? savedAnnot : a));
    } catch (err: any) {
      console.error('Failed to save text annotation:', err);
      // Rollback
      setAnnotations((prev) => prev.filter(a => a.id !== tempId));
      alert('فشل في حفظ التعليق النصي: ' + (err.message || 'حدث خطأ غير معروف'));
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    
    const previous = undoStack[undoStack.length - 1];
    const current = [...annotations];
    
    // Find what was added
    const added = current.filter(c => !previous.find(p => p.id === c.id));
    
    setRedoStack(prev => [...prev, current]);
    setUndoStack(prev => prev.slice(0, -1));
    setAnnotations(previous);

    // Sync with backend - delete the added ones
    for (const annot of added) {
      try {
        await annotationApi.deleteAnnotation(annot.id);
      } catch (err) {
        console.error('Failed to sync undo to backend:', err);
      }
    }
  };

  const handleUpdateAnnotation = async (id: string, newData: AnnotationData) => {
    // Optimistic Update
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, data: newData } : a));
    
    try {
      await annotationApi.updateAnnotation(id, newData);
    } catch (err: any) {
      console.error('Failed to update annotation:', err);
      alert('فشل في تحديث التعليق: ' + (err.message || 'حدث خطأ'));
      // Reload from server to rollback accurately
      loadAnnotations();
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];
    const current = [...annotations];

    // Find what is being re-added
    const toReAdd = next.filter(n => !current.find(c => c.id === n.id));

    setUndoStack(prev => [...prev, current]);
    setRedoStack(prev => prev.slice(0, -1));
    setAnnotations(next);

    // Sync with backend - re-add the deleted ones
    for (const annot of toReAdd) {
      try {
        await annotationApi.addAnnotation(annot);
      } catch (err) {
        console.error('Failed to sync redo to backend:', err);
      }
    }
  };

  const handleExport = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const defaultName = bookTitle.replace('.pdf', '') + '_annotated.pdf';
      const outputPath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (!outputPath) return;

      setExporting(true);
      await annotationApi.burnAnnotations(pdfPath, outputPath, annotations);
      alert('تم تصدير الكتاب بنجاح مع كافة التعليقات');
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('فشل التصدير: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`relative w-full h-full flex flex-col bg-gray-900 ${fullscreen ? 'fixed inset-0 z-[60]' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div>
            <h2 className="font-bold text-lg leading-tight truncate max-w-md">{bookTitle}</h2>
            <p className="text-xs text-gray-500">جاري العرض والمعالجة التفاعلية</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-xl mr-4">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-2 hover:bg-gray-700 rounded-lg"><ZoomOut size={16}/></button>
            <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-2 hover:bg-gray-700 rounded-lg"><ZoomIn size={16}/></button>
          </div>
          
          <button onClick={() => setFullscreen(!fullscreen)} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400">
            {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
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

        {/* PDF Document */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-gray-800 p-8 flex flex-col items-center custom-scrollbar"
        >
          {!assetUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-40 p-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-3xl text-center max-w-sm">
                <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">رابط الملف مفقود</h3>
                <p className="text-gray-400 text-sm mb-6">تعذر الحصول على مسار الملف لمعاينته.</p>
              </div>
            </div>
          )}
          {(loadingPdf || loadingAnnotations) && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm z-40">
              <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
              <p className="text-white font-medium">جاري تهيئة المعالج التفاعلي...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-40 p-4">
              <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl text-center max-w-sm">
                <X size={48} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">تعذر فتح الكتاب</h3>
                <p className="text-gray-400 text-sm mb-2">{error}</p>
                <p className="text-[10px] text-gray-500 font-mono break-all mb-6">Source: {assetUrl || 'Empty'}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}

          <Document
            file={assetUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="flex flex-col items-center"
          >
            {Array.from(new Array(numPages), (_, index) => (
              <PDFPageRenderer
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={800} // Base width, scale handles the rest
                scale={scale}
                annotations={annotations}
                activeTool={activeTool}
                onAddAnnotation={handleAddAnnotation}
                onUpdateAnnotation={handleUpdateAnnotation}
              />
            ))}
          </Document>
        </div>
      </div>

      {/* Text Input Modal */}
      {textInput && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100" dir="rtl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">إضافة تعليق نصي</h3>
            <textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none mb-4 font-arabic"
              placeholder="اكتب تعليقك هنا (يدعم العربية والإنجليزية)..."
            />
            <div className="flex gap-3">
              <button
                onClick={saveTextAnnotation}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                حفظ التعليق
              </button>
              <button
                onClick={() => { setTextInput(null); setCommentText(''); }}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
