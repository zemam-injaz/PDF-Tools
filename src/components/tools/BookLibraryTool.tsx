import { useState, useEffect, useRef } from 'react';
import { 
  Search, Star, StarOff, Grid, List, Plus,
  BookOpen, Trash2, FolderOpen, Edit3,
  Loader2, AlertCircle, CheckCircle2, X, ExternalLink,
  Copy, Flag, MoreVertical, MessageSquare, StickyNote, PieChart, BarChart3, Eye, Save, BookMarked
} from 'lucide-react';
import { bookLibraryApi, type Book, type AddBooksResult, type Annotation, type BookmarkItem } from '../../api/bookLibraryApi';
import { InteractivePDFViewer } from '../viewer/InteractivePDFViewer';

// Tauri APIs - conditionally imported
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

async function openFileDialog(): Promise<string[] | null> {
  if (!isTauri) {
    console.warn('File dialog only available in Tauri');
    return null;
  }
  
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      multiple: true,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    
    if (result === null) return null;
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error('Error opening file dialog:', error);
    return null;
  }
}

async function openWithDefaultApp(filePath: string): Promise<boolean> {
  try {
    const opener = await import('@tauri-apps/plugin-opener');
    const openFn = (opener as any).open || (opener as any).default?.open;
    if (openFn) {
      await openFn(filePath);
      return true;
    }
    throw new Error('Opener plugin not found');
  } catch (error) {
    console.warn('Frontend opener failed, trying backend fallback:', error);
    try {
      await bookLibraryApi.systemOpenFile(filePath);
      return true;
    } catch (backendError) {
      console.error('Backend open fallback failed:', backendError);
      return false;
    }
  }
}

async function revealInExplorer(filePath: string): Promise<boolean> {
  try {
    const opener = await import('@tauri-apps/plugin-opener');
    // Get directory path
    const dirPath = filePath.substring(0, filePath.lastIndexOf('\\'));
    const openFn = (opener as any).open || (opener as any).default?.open;
    if (openFn) {
      // Logic for Windows to select the file if possible, otherwise open folder
      // Since we use basic opener, simply opening directory is safe
      await openFn(dirPath || filePath);
      return true;
    }
    throw new Error('Opener plugin not found');
  } catch (error) {
    console.warn('Frontend reveal failed, trying backend fallback:', error);
    try {
      await bookLibraryApi.systemRevealFile(filePath);
      return true;
    } catch (backendError) {
      console.error('Backend reveal fallback failed:', backendError);
      return false;
    }
  }
}

async function getAssetUrl(filePath: string): Promise<string> {
  if (!isTauri) {
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(filePath);
  } catch (error) {
    console.error('convertFileSrc failed:', error);
    return `file:///${filePath.replace(/\\/g, '/')}`;
  }
}

const priorityColors = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-green-100 text-green-700 border-green-200'
};

const priorityLabels = {
  High: 'عالية',
  Medium: 'متوسطة', 
  Low: 'منخفضة'
};

const statusColors = {
  'To Read': 'bg-slate-100 text-slate-700 border-slate-200',
  'Reading': 'bg-blue-100 text-blue-700 border-blue-200',
  'Read': 'bg-green-100 text-green-700 border-green-200'
};

const statusLabels = {
  'To Read': 'للقراءة',
  'Reading': 'جاري القراءة',
  'Read': 'مكتمل'
};

const progressColors = (percentage: number) => {
  if (percentage >= 100) return 'bg-green-500';
  if (percentage >= 67) return 'bg-blue-500';
  if (percentage >= 34) return 'bg-amber-500';
  return 'bg-red-500';
};

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  book: Book | null;
}

interface EditDialogState {
  visible: boolean;
  book: Book | null;
  title: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'To Read' | 'Reading' | 'Read';
  notes: string;
}

export function BookLibraryTool() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_added' | 'title' | 'reading_percentage' | 'priority'>('date_added');
  const [filterStarred, setFilterStarred] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [localCategories, setLocalCategories] = useState<string[]>([]); // New categories added during edit
  const [toast, setToast] = useState<ToastMessage | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    book: null
  });
  
  // Edit dialog state
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    visible: false,
    book: null,
    title: '',
    category: '',
    priority: 'Medium',
    status: 'To Read',
    notes: ''
  });

  const [commentsDialog, setCommentsDialog] = useState<{
    visible: boolean;
    book: Book | null;
    annotations: Annotation[];
    loading: boolean;
  }>({
    visible: false,
    book: null,
    annotations: [],
    loading: false
  });

  const [chapterAnalysisDialog, setChapterAnalysisDialog] = useState<{
    visible: boolean;
    book: Book | null;
    bookmarks: BookmarkItem[];
    loading: boolean;
    totalPages: number;
  }>({
    visible: false,
    book: null,
    bookmarks: [],
    loading: false,
    totalPages: 0
  });

  const [previewDialog, setPreviewDialog] = useState<{
    visible: boolean;
    book: Book | null;
    assetUrl: string;
    bookmarks: BookmarkItem[];
    showBookmarks: boolean;
    loadingBookmarks: boolean;
  }>({
    visible: false,
    book: null,
    assetUrl: '',
    bookmarks: [],
    showBookmarks: true,
    loadingBookmarks: false
  });

  const [progressDialog, setProgressDialog] = useState<{
    visible: boolean;
    book: Book | null;
    pageInput: string;
  }>({
    visible: false,
    book: null,
    pageInput: ''
  });

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Load books on mount
  useEffect(() => {
    loadBooks();
    loadCategories();
  }, [sortBy, filterStarred, selectedCategory]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const showToast = (type: ToastMessage['type'], message: string) => {
    setToast({ type, message });
  };

  const loadBooks = async () => {
    try {
      setLoading(true);
      const result = await bookLibraryApi.getAllBooks({
        sortBy,
        order: 'desc',
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        starredOnly: filterStarred,
      });
      setBooks(result.books);
    } catch (error) {
      console.error('Error loading books:', error);
      showToast('error', 'فشل في تحميل المكتبة');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await bookLibraryApi.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleAddBooks = async () => {
    const filePaths = await openFileDialog();
    if (!filePaths || filePaths.length === 0) return;

    setAdding(true);
    try {
      if (filePaths.length === 1) {
        const book = await bookLibraryApi.addBook(filePaths[0]);
        setBooks(prev => [book, ...prev]);
        showToast('success', `تمت إضافة "${book.title}"`);
      } else {
        const result: AddBooksResult = await bookLibraryApi.addBooks(filePaths);
        if (result.added_count > 0) {
          await loadBooks();
          showToast('success', `تمت إضافة ${result.added_count} كتاب${result.skipped_count > 0 ? ` (تم تخطي ${result.skipped_count} موجود مسبقاً)` : ''}`);
        } else if (result.skipped_count > 0) {
          showToast('info', `جميع الكتب موجودة مسبقاً في المكتبة`);
        }
        if (result.error_count > 0) {
          showToast('error', `فشل في إضافة ${result.error_count} كتاب`);
        }
      }
      await loadCategories();
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        showToast('info', 'هذا الكتاب موجود مسبقاً في المكتبة');
      } else {
        showToast('error', 'فشل في إضافة الكتاب');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleOpenBook = async (book: Book) => {
    try {
      // Mark as opened regardless of whether the file opens successfully (user intent)
      await bookLibraryApi.markOpened(book.id);
      setBooks(prev => prev.map(b => 
        b.id === book.id ? { ...b, last_opened: new Date().toISOString() } : b
      ));

      const success = await openWithDefaultApp(book.file_path);
      if (!success) {
        showToast('error', 'لم يتم العثور على الملف أو التطبيق الافتراضي');
      }
    } catch (error) {
      console.error('Open book error:', error);
      showToast('error', 'فشل في فتح سجل الكتاب');
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleToggleStar = async (bookId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // Optimistic Update: toggle immediately
    setBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, is_starred: !b.is_starred } : b
    ));

    try {
      await bookLibraryApi.toggleStar(bookId);
      // Success: do nothing (state is already correct)
    } catch (error: any) {
    // Error: revert change
      setBooks(prev => prev.map(b => 
        b.id === bookId ? { ...b, is_starred: !b.is_starred } : b
      ));
      console.error('Toggle star error:', error);
      showToast('error', error.message || 'فشل في تحديث المفضلة');
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleDeleteBook = async (bookId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف هذا الكتاب من المكتبة؟')) return;
    
    try {
      await bookLibraryApi.deleteBook(bookId);
      setBooks(prev => prev.filter(b => b.id !== bookId));
      showToast('success', 'تم حذف الكتاب');
    } catch (error) {
      showToast('error', 'فشل في حذف الكتاب');
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent, book: Book) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      book
    });
  };
  
  const handleCopyPath = async (book: Book) => {
    try {
      await navigator.clipboard.writeText(book.file_path);
      showToast('success', 'تم نسخ المسار');
    } catch (err) {
      console.error('Clipboard error:', err);
      showToast('error', 'فشل في نسخ المسار');
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const handleRevealInExplorer = async (book: Book) => {
    const success = await revealInExplorer(book.file_path);
    if (!success) {
      showToast('error', 'فشل في فتح المجلد');
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const handleSetPriority = async (book: Book, priority: 'High' | 'Medium' | 'Low') => {
    const oldPriority = book.priority;

    // Optimistic Update
    setBooks(prev => prev.map(b =>
      b.id === book.id ? { ...b, priority } : b
    ));

    try {
      await bookLibraryApi.updateBook(book.id, { priority });
      showToast('success', 'تم تحديث الأولوية');
    } catch (error: any) {
    // Revert on error
      setBooks(prev => prev.map(b => 
        b.id === book.id ? { ...b, priority: oldPriority } : b
      ));
      showToast('error', error.message || 'فشل في تحديث الأولوية');
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleSetStatus = async (book: Book, status: 'To Read' | 'Reading' | 'Read') => {
    const oldStatus = book.status;

    // Optimistic Update
    setBooks(prev => prev.map(b =>
      b.id === book.id ? { ...b, status } : b
    ));

    try {
      await bookLibraryApi.updateBook(book.id, { status });
      showToast('success', 'تم تحديث حالة القراءة');
    } catch (error: any) {
      // Revert on error
      setBooks(prev => prev.map(b =>
        b.id === book.id ? { ...b, status: oldStatus } : b
      ));
      showToast('error', error.message || 'فشل في تحديث الحالة');
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleOpenEditDialog = (book: Book) => {
    setEditDialog({
      visible: true,
      book,
      title: book.title,
      category: book.category,
      priority: book.priority,
      status: book.status || 'To Read',
      notes: book.notes || ''
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const handleSaveEdit = async () => {
    if (!editDialog.book) return;
    
    try {
      await bookLibraryApi.updateBook(editDialog.book.id, {
        title: editDialog.title,
        category: editDialog.category,
        priority: editDialog.priority,
        status: editDialog.status,
        notes: editDialog.notes
      });
      setBooks(prev => prev.map(b => 
        b.id === editDialog.book!.id ? { 
          ...b, 
          title: editDialog.title,
          category: editDialog.category,
          priority: editDialog.priority,
          status: editDialog.status,
          notes: editDialog.notes
        } : b
      ));
      showToast('success', 'تم تحديث الكتاب');
      setEditDialog(prev => ({ ...prev, visible: false }));
      await loadCategories();
    } catch (error) {
      showToast('error', 'فشل في تحديث الكتاب');
    }

  };

  const handleShowChapterAnalysis = (book: Book) => {
    // TODO: Implement chapter analysis dialog
    console.log('Show chapter analysis for:', book);
    setChapterAnalysisDialog({ visible: true, book, bookmarks: [], loading: false, totalPages: 0 }); // Open dialog if it exists or just log
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleShowComments = async (book: Book) => {
    setCommentsDialog({ visible: true, book, annotations: [], loading: true });
    setContextMenu(prev => ({ ...prev, visible: false }));
    try {
      const annotations = await bookLibraryApi.extractAnnotations(book.file_path);
      setCommentsDialog(prev => ({ ...prev, annotations, loading: false }));
    } catch (error) {
      console.error('Extract annotations error:', error);
      showToast('error', 'فشل في استخراج التعليقات');
      setCommentsDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredBooks = books.filter(book => 
    !searchQuery || book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'لم يُفتح بعد';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'اليوم';
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    return date.toLocaleDateString('ar-SA');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg animate-fade-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
            <X size={16} />
          </button>
        </div>
      )}
      
      {/* Context Menu */}
      {contextMenu.visible && contextMenu.book && (
        <div 
          ref={contextMenuRef}
          dir="rtl"
          className="fixed z-50 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-100 p-1.5 min-w-[220px] animate-fade-in ring-1 ring-black/5"
          style={{ 
            left: contextMenu.x > window.innerWidth / 2 ? 'auto' : contextMenu.x,
            right: contextMenu.x > window.innerWidth / 2 ? (window.innerWidth - contextMenu.x) : 'auto',
            top: Math.min(contextMenu.y, window.innerHeight - 300),
            transform: 'translateY(-5px)'
          }}
        >
          <div className="px-5 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 text-right">
            إجراءات الكتاب
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => handleOpenBook(contextMenu.book!)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-indigo-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <ExternalLink size={16} className="text-gray-500 group-hover:text-indigo-600" />
              <span className="font-medium text-sm">فتح الكتاب</span>
            </button>

            <button
              onClick={async () => {
                const url = await getAssetUrl(contextMenu.book!.file_path);
                setPreviewDialog({ visible: true, book: contextMenu.book, assetUrl: url, bookmarks: [], showBookmarks: true, loadingBookmarks: true });
                setContextMenu(prev => ({ ...prev, visible: false }));
                // Fetch bookmarks
                try {
                  const result = await bookLibraryApi.extractBookmarks(contextMenu.book!.file_path);
                  setPreviewDialog(prev => ({ ...prev, bookmarks: result.bookmarks, loadingBookmarks: false }));
                } catch (e) {
                  setPreviewDialog(prev => ({ ...prev, loadingBookmarks: false }));
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-cyan-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <Eye size={16} className="text-gray-500 group-hover:text-cyan-600" />
              <span className="font-medium text-sm">معاينة</span>
            </button>

            <button
              onClick={() => handleShowComments(contextMenu.book!)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-indigo-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <MessageSquare size={16} className="text-gray-500 group-hover:text-indigo-600" />
              <span className="font-medium text-sm">عرض التعليقات</span>
            </button>

            <button
              onClick={() => handleToggleStar(contextMenu.book!.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-amber-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <Star size={16} className={contextMenu.book.is_starred ? 'text-amber-500' : 'text-gray-500 group-hover:text-amber-500'}
                fill={contextMenu.book.is_starred ? 'currentColor' : 'none'} />
              <span className="font-medium text-sm">{contextMenu.book.is_starred ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</span>
            </button>

            <button
              onClick={() => handleShowChapterAnalysis(contextMenu.book!)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-emerald-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <PieChart size={16} className="text-gray-500 group-hover:text-emerald-600" />
              <span className="font-medium text-sm">تحليل أوزان الفصول</span>
            </button>
          
            <div className="h-px bg-gray-100 my-1 mx-2" />

            <button
              onClick={() => handleOpenEditDialog(contextMenu.book!)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-blue-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <Edit3 size={16} className="text-gray-500 group-hover:text-blue-600" />
              <span className="font-medium text-sm">تعديل البيانات</span>
            </button>

            {/* Priority Submenu */}
            <div className="relative group/priority">
              <button className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-gray-50 text-gray-700 rounded-lg transition-all duration-200 group">
                <div className="flex items-center gap-3">
                  <Flag size={16} className="text-gray-500" />
                  <span className="font-medium text-sm">تغيير الأولوية</span>
                </div>
                <span className="text-gray-400 font-bold text-sm">›</span>
              </button>

              {/* Smart positioning for submenu: If space on left is limited, show on right. Default to Left (right:100%) in RTL if possible, else flip. */}
              <div className="absolute right-[calc(100%+8px)] top-0 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 p-2 min-w-[200px] opacity-0 invisible group-hover/priority:opacity-100 group-hover/priority:visible transition-all ring-1 ring-black/5" dir="rtl">
                <button
                  onClick={() => handleSetPriority(contextMenu.book!, 'High')}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-xl transition-colors mb-1"
                >
                  <span className="font-medium">عالية</span>
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm ring-2 ring-red-100" />
                </button>
                <button
                  onClick={() => handleSetPriority(contextMenu.book!, 'Medium')}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-amber-50 text-gray-700 hover:text-amber-700 rounded-xl transition-colors mb-1"
                >
                  <span className="font-medium">متوسطة</span>
                  <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm ring-2 ring-amber-100" />
                </button>
                <button
                  onClick={() => handleSetPriority(contextMenu.book!, 'Low')}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-green-50 text-gray-700 hover:text-green-700 rounded-xl transition-colors"
                >
                  <span className="font-medium">منخفضة</span>
                  <span className="w-3 h-3 rounded-full bg-green-500 shadow-sm ring-2 ring-green-100" />
                </button>
              </div>
            </div>

            {/* Status Submenu */}
            <div className="relative group/status">
              <button className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-gray-50 text-gray-700 rounded-lg transition-all duration-200 group">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-gray-500" />
                  <span className="font-medium text-sm">حالة القراءة</span>
                </div>
                <span className="text-gray-400 font-bold text-sm">›</span>
              </button>

              <div className="absolute right-[calc(100%+8px)] top-0 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-100 p-1.5 min-w-[180px] opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all ring-1 ring-black/5" dir="rtl">
                <button
                  onClick={() => handleSetStatus(contextMenu.book!, 'To Read')}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-gray-50 text-gray-700 rounded-lg transition-colors mb-0.5"
                >
                  <span className="font-medium text-sm">للقراءة</span>
                  <span className={`w-2.5 h-2.5 rounded-full border border-gray-300 ${contextMenu.book.status === 'To Read' ? 'bg-gray-500' : 'bg-transparent'}`} />
                </button>
                <button
                  onClick={() => handleSetStatus(contextMenu.book!, 'Reading')}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 rounded-lg transition-colors mb-0.5"
                >
                  <span className="font-medium text-sm">جاري القراءة</span>
                  <span className={`w-2.5 h-2.5 rounded-full border border-indigo-300 ${contextMenu.book.status === 'Reading' ? 'bg-indigo-500' : 'bg-transparent'}`} />
                </button>
                <button
                  onClick={() => handleSetStatus(contextMenu.book!, 'Read')}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-green-50 text-gray-700 hover:text-green-700 rounded-lg transition-colors"
                >
                  <span className="font-medium text-sm">مكتمل</span>
                  <span className={`w-2.5 h-2.5 rounded-full border border-green-300 ${contextMenu.book.status === 'Read' ? 'bg-green-500' : 'bg-transparent'}`} />
                </button>
              </div>
            </div>

            {/* Update Progress */}
            <button
              onClick={() => {
                setProgressDialog({ visible: true, book: contextMenu.book, pageInput: contextMenu.book!.pages_read.toString() });
                setContextMenu(prev => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-orange-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <BookMarked size={16} className="text-gray-500 group-hover:text-orange-600" />
              <span className="font-medium text-sm">تحديث التقدم ({contextMenu.book.pages_read}/{contextMenu.book.total_pages})</span>
            </button>

            <div className="h-px bg-gray-100 my-1 mx-2" />

            <button
              onClick={() => handleRevealInExplorer(contextMenu.book!)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-purple-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <FolderOpen size={16} className="text-gray-500 group-hover:text-purple-600" />
              <span className="font-medium text-sm">فتح مجلد الملف</span>
            </button>

            <button
              onClick={() => handleCopyPath(contextMenu.book!)}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-teal-50 text-gray-700 rounded-lg transition-all duration-200 group"
            >
              <Copy size={16} className="text-gray-500 group-hover:text-teal-600" />
              <span className="font-medium text-sm">نسخ المسار</span>
            </button>

            <div className="h-px bg-gray-100 my-1 mx-2" />

            <button
              onClick={() => { handleDeleteBook(contextMenu.book!.id); setContextMenu(prev => ({ ...prev, visible: false })); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-right hover:bg-red-50 text-red-600 rounded-lg transition-all duration-200 group"
            >
              <Trash2 size={16} className="text-red-500 group-hover:text-red-600" />
              <span className="font-medium text-sm">حذف من المكتبة</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Edit Dialog */}
      {editDialog.visible && editDialog.book && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl animate-fade-in overflow-hidden ring-1 ring-black/5" dir="rtl">
            {/* Header */}
            <div className="px-8 py-8 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                <Edit3 size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">تعديل بيانات الكتاب</h3>
                <p className="text-gray-500 text-sm mt-1">تحديث المعلومات وتنظيم المكتبة</p>
              </div>
            </div>
            
            {/* Form Content */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Book Title - Full Width */}
                <div className="col-span-1 md:col-span-2 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <BookOpen size={16} className="text-indigo-500" />
                    عنوان الكتاب
                  </label>
                  <input
                    type="text"
                    value={editDialog.title}
                    onChange={(e) => setEditDialog(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-6 py-4 text-base bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-gray-400 font-medium"
                    placeholder="أدخل عنوان الكتاب..."
                  />
                </div>

                {/* Category */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Grid size={16} className="text-purple-500" />
                    التصنيف
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={editDialog.category}
                        onChange={(e) => setEditDialog(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-6 py-4 pl-12 text-base bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                        placeholder="أدخل تصنيفاً جديداً أو اختر من القائمة..."
                      />
                      {editDialog.category && (() => {
                        const allCategories = [...categories, ...localCategories];
                        const isNewCategory = editDialog.category.trim() !== '' &&
                          !allCategories.includes(editDialog.category.trim());

                        return isNewCategory ? (
                          // Plus button for adding new category
                          <button
                            type="button"
                            onClick={() => {
                              const newCat = editDialog.category.trim();
                              if (newCat && !localCategories.includes(newCat)) {
                                setLocalCategories(prev => [...prev, newCat]);
                              }
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors shadow-sm"
                            title="إضافة تصنيف جديد"
                          >
                            <Plus size={14} />
                          </button>
                        ) : (
                          // X button for clearing
                          <button
                            type="button"
                            onClick={() => setEditDialog(prev => ({ ...prev, category: '' }))}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                            title="مسح"
                          >
                            <X size={14} />
                          </button>
                        );
                      })()}
                    </div>
                    {/* Category chips - combined from server and locally added */}
                    {(() => {
                      const allCategories = [...categories, ...localCategories.filter(c => !categories.includes(c))];
                      return allCategories.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {allCategories.map(cat => {
                            const isLocal = localCategories.includes(cat) && !categories.includes(cat);
                            const isSelected = editDialog.category === cat;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setEditDialog(prev => ({ ...prev, category: cat }))}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-all flex items-center gap-1.5 ${isSelected
                                    ? 'bg-purple-100 text-purple-700 border-purple-300 font-medium'
                                    : isLocal
                                      ? 'bg-green-50 text-green-700 border-green-300'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-purple-50 hover:border-purple-200'
                                  }`}
                              >
                                {cat}
                                {isLocal && <span className="text-xs opacity-70">(جديد)</span>}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <CheckCircle2 size={16} className="text-green-500" />
                    حالة القراءة
                  </label>
                  <div className="relative">
                    <select
                      value={editDialog.status}
                      onChange={(e) => setEditDialog(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full px-6 py-4 text-base bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="To Read">للقراءة</option>
                      <option value="Reading">جاري القراءة</option>
                      <option value="Read">مكتمل</option>
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <MoreVertical size={16} />
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Flag size={16} className="text-red-500" />
                    الأولوية
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['High', 'Medium', 'Low'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setEditDialog(prev => ({ ...prev, priority: p as any }))}
                        className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${editDialog.priority === p
                          ? p === 'High' ? 'bg-red-50 text-red-700 border-red-200 ring-2 ring-red-500/20'
                            : p === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200 ring-2 ring-amber-500/20'
                              : 'bg-green-50 text-green-700 border-green-200 ring-2 ring-green-500/20'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        {p === 'High' ? 'عالية' : p === 'Medium' ? 'متوسطة' : 'منخفضة'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes - Full Width */}
                <div className="col-span-1 md:col-span-2 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <BookOpen size={16} className="text-amber-500" />
                    ملاحظات
                  </label>
                  <textarea
                    value={editDialog.notes}
                    onChange={(e) => setEditDialog(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-6 py-4 text-base bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all min-h-[100px] resize-none"
                    placeholder="أضف ملاحظاتك حول الكتاب..."
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditDialog(prev => ({ ...prev, visible: false }))}
                className="px-8 py-3.5 text-base font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-10 py-3.5 text-base font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={20} />
                <span>حفظ التغييرات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 pr-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">مكتبة الكتب</h2>
        <p className="text-gray-500">إدارة ومتابعة كتبك وتقدم القراءة • انقر بالزر الأيمن للمزيد من الخيارات</p>
      </div>

      {/* Toolbar */}
      <div className="card mb-4 p-2 border-b border-gray-100">
        <div className="flex items-center gap-3 w-full" dir="rtl">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="البحث في المكتبة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-10 pr-4 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="flex-shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-40 sm:w-48 h-9 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-4 pl-8 py-0 leading-9 text-gray-900"
            >
              <option value="all">جميع الفئات</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex-shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-40 sm:w-48 h-9 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer pr-4 pl-8 py-0 leading-9 text-gray-900"
            >
              <option value="date_added">تاريخ الإضافة</option>
              <option value="title">العنوان</option>
              <option value="reading_percentage">التقدم</option>
              <option value="priority">الأولوية</option>
            </select>
          </div>

          <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />

          {/* Starred Filter */}
          <button
            onClick={() => setFilterStarred(!filterStarred)}
            className={`btn ${filterStarred ? 'btn-primary' : 'btn-secondary'} py-1.5 px-3 h-9 text-sm flex-shrink-0`}
            title="المفضلة"
          >
            <Star size={16} fill={filterStarred ? 'currentColor' : 'none'} />
          </button>

          {/* View Toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden h-9 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 flex items-center justify-center ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="شبكة"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 flex items-center justify-center ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="قائمة"
            >
              <List size={16} />
            </button>
          </div>

          {/* Add Book */}
          <button 
            onClick={handleAddBooks}
            disabled={adding}
            className="btn btn-primary py-1.5 px-3 h-9 text-sm whitespace-nowrap flex-shrink-0"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span className="hidden sm:inline mr-1">إضافة</span>
          </button>
        </div>
      </div>

      {/* Books Display */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="card text-center py-12">
            <Loader2 size={48} className="mx-auto text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-500">جاري تحميل المكتبة...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {books.length === 0 
                ? 'المكتبة فارغة، أضف كتبك الأولى!' 
                : 'لا توجد كتب مطابقة للبحث'
              }
            </p>
            {books.length === 0 && (
              <button onClick={handleAddBooks} className="btn btn-primary mt-4">
                <Plus size={18} />
                <span>إضافة كتاب</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
              /* Grid View - Compact Mode */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {filteredBooks.map(book => (
              <div 
                key={book.id} 
                className="card card-hover group cursor-pointer p-2"
                onClick={async () => {
                  const url = await getAssetUrl(book.file_path);
                  setPreviewDialog({ visible: true, book, assetUrl: url, bookmarks: [], showBookmarks: true, loadingBookmarks: false });
                }}
                onContextMenu={(e) => handleContextMenu(e, book)}
              >
                {/* Thumbnail with overlays */}
                <div className="relative aspect-[2/3] bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {book.thumbnail_base64 ? (
                    <img src={book.thumbnail_base64} alt={book.title} className="object-cover w-full h-full" />
                  ) : (
                      <BookOpen size={28} className="text-indigo-300" />
                  )}

                  {/* Top row: Star and Options */}
                  <button
                    onClick={(e) => handleToggleStar(book.id, e)}
                    className="absolute top-1.5 left-1.5 p-1.5 rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors"
                  >
                    {book.is_starred ? (
                      <Star size={14} className="text-amber-500" fill="currentColor" />
                    ) : (
                        <StarOff size={14} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleContextMenu(e, book)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white shadow-md hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <MoreVertical size={14} className="text-gray-600" />
                  </button>

                  {/* Priority button - lower left with dropdown */}
                  <div className="absolute bottom-2 left-2 group/priority">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Cycle through priorities
                        const nextPriority = book.priority === 'High' ? 'Medium' : book.priority === 'Medium' ? 'Low' : 'High';
                        handleSetPriority(book, nextPriority);
                      }}
                      className={`p-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-all hover:scale-110 ${book.priority === 'High' ? 'bg-red-500' :
                          book.priority === 'Medium' ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                      title={`الأولوية: ${priorityLabels[book.priority]} (انقر للتغيير)`}
                    >
                      <Flag size={16} className="text-white" />
                    </button>
                  </div>

                  {/* Status button - lower right with dropdown */}
                  <div className="absolute bottom-2 right-2 group/status">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Cycle through statuses
                        const nextStatus = book.status === 'To Read' ? 'Reading' : book.status === 'Reading' ? 'Read' : 'To Read';
                        handleSetStatus(book, nextStatus);
                      }}
                      className={`p-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-all hover:scale-110 ${book.status === 'Read' ? 'bg-green-500' :
                          book.status === 'Reading' ? 'bg-blue-500' : 'bg-slate-500'
                        }`}
                      title={`الحالة: ${statusLabels[book.status || 'To Read']} (انقر للتغيير)`}
                    >
                      {book.status === 'Read' ? (
                        <CheckCircle2 size={16} className="text-white" />
                      ) : book.status === 'Reading' ? (
                        <BookOpen size={16} className="text-white" />
                      ) : (
                        <BookOpen size={16} className="text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-medium text-gray-900 text-xs line-clamp-1 mb-1.5" title={book.title}>{book.title}</h3>
                
                {/* Progress bar below title */}
                <div
                  className="h-1.5 bg-gray-100 rounded-full overflow-hidden"
                  title={`${book.reading_percentage.toFixed(0)}% مكتمل`}
                >
                  <div
                    className={`h-full ${progressColors(book.reading_percentage)} transition-all`}
                    style={{ width: `${book.reading_percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الكتاب</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">التقدم</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الأولوية</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">آخر فتح</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الحجم</th>
                        <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map(book => (
                  <tr 
                    key={book.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group h-14"
                    onClick={async () => {
                      const url = await getAssetUrl(book.file_path);
                      setPreviewDialog({ visible: true, book, assetUrl: url, bookmarks: [], showBookmarks: true, loadingBookmarks: false });
                    }}
                    onContextMenu={(e) => handleContextMenu(e, book)}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => handleToggleStar(book.id, e)} className="hover:scale-110 transition-transform flex-shrink-0">
                          {book.is_starred ? (
                            <Star size={16} className="text-amber-500" fill="currentColor" />
                          ) : (
                              <StarOff size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <span className="font-semibold text-gray-900 text-sm block truncate" title={book.title}>{book.title}</span>
                          <span className="text-[10px] text-gray-400 block truncate font-mono" dir="ltr">{book.file_path.split('\\').pop()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progressColors(book.reading_percentage)}`}
                            style={{ width: `${book.reading_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{book.reading_percentage.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityColors[book.priority]}`}>
                        {priorityLabels[book.priority]}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[book.status || 'To Read']}`}>
                        {statusLabels[book.status || 'To Read']}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600 font-medium">{book.category}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{formatDate(book.last_opened)}</td>
                    <td className="py-2 px-3 text-xs text-gray-500">{formatFileSize(book.file_size)}</td>
                    <td className="py-2 px-3">
                      <button 
                        onClick={(e) => handleContextMenu(e, book)}
                        className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comments Dialog */}
      {commentsDialog.visible && commentsDialog.book && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col animate-fade-in overflow-hidden ring-1 ring-black/5" dir="rtl">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">التعليقات والملاحظات</h3>
                  <p className="text-gray-500 text-sm mt-1">{commentsDialog.book.title}</p>
                </div>
              </div>
              <button
                onClick={() => setCommentsDialog(prev => ({ ...prev, visible: false }))}
                className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
              {commentsDialog.loading ? (
                <div className="flex flex-col items-center justify-center h-full text-indigo-600 gap-4">
                  <Loader2 size={40} className="animate-spin" />
                  <span className="font-medium text-gray-600">جاري استخراج التعليقات...</span>
                </div>
              ) : commentsDialog.annotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                  <StickyNote size={64} className="opacity-20" />
                  <span className="text-lg font-medium text-gray-500">لا توجد تعليقات في هذا الكتاب</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {commentsDialog.annotations.map((annot, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between mb-3 text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-lg font-medium text-xs ${annot.type === 'Highlight' ? 'bg-yellow-100 text-yellow-700' :
                            annot.type === 'Underline' ? 'bg-blue-100 text-blue-700' :
                              annot.type === 'StrikeOut' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {annot.type}
                          </span>
                          <span className="text-gray-400 font-medium">صفحة {annot.page}</span>
                          {annot.author && <span className="text-gray-400">• {annot.author}</span>}
                        </div>
                        {annot.created_date && (
                          <span className="text-gray-400 text-xs dir-ltr font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                            {annot.created_date}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                        {annot.content || '(لا يوجد نص)'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chapter Analysis Dialog */}
      {chapterAnalysisDialog.visible && chapterAnalysisDialog.book && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col animate-fade-in overflow-hidden ring-1 ring-black/5" dir="rtl">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                  <PieChart size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">تحليل أوزان الفصول</h3>
                  <p className="text-gray-500 text-sm mt-1">{chapterAnalysisDialog.book.title} • {chapterAnalysisDialog.totalPages} صفحة</p>
                </div>
              </div>
              <button
                onClick={() => setChapterAnalysisDialog(prev => ({ ...prev, visible: false }))}
                className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
              {chapterAnalysisDialog.loading ? (
                <div className="flex flex-col items-center justify-center h-full text-emerald-600 gap-4">
                  <Loader2 size={40} className="animate-spin" />
                  <span className="font-medium text-gray-600">جاري تحليل هيكل الكتاب...</span>
                </div>
              ) : chapterAnalysisDialog.bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                  <BarChart3 size={64} className="opacity-20" />
                  <span className="text-lg font-medium text-gray-500">لم يتم العثور على فصول في هذا الكتاب</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Analysis Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                      <span className="text-gray-500 text-sm font-medium mb-1">متوسط الصفحات/فصل</span>
                      <strong className="text-2xl text-gray-900 font-bold">
                        {Math.round(chapterAnalysisDialog.totalPages / Math.max(1, chapterAnalysisDialog.bookmarks.filter(b => b.level === 1).length))}
                      </strong>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                      <span className="text-gray-500 text-sm font-medium mb-1">أطول فصل</span>
                      <strong className="text-2xl text-emerald-600 font-bold">
                        {Math.max(...chapterAnalysisDialog.bookmarks.map(b => b.page_count))}
                        <span className="text-sm font-normal text-gray-400 mr-1">صفحة</span>
                      </strong>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                      <span className="text-gray-500 text-sm font-medium mb-1">عدد الفصول الرئيسية</span>
                      <strong className="text-2xl text-gray-900 font-bold">
                        {chapterAnalysisDialog.bookmarks.filter(b => b.level === 1).length}
                      </strong>
                    </div>
                  </div>

                  {/* Chapter List */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <div className="col-span-6">عنوان الفصل</div>
                      <div className="col-span-2 text-center">الصفحات</div>
                      <div className="col-span-4">الوزن النسبي</div>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {chapterAnalysisDialog.bookmarks.map((chapter, idx) => {
                        const percentage = (chapter.page_count / chapterAnalysisDialog.totalPages) * 100;
                        const isMain = chapter.level === 1;

                        // Limit to level 1 for cleaner initial view, or all if few?
                        // Let's show all but indent sub-levels
                        // Actually, purely flat list might be overwhelming.
                        // For analysis, usually Level 1 is most relevant.
                        // Let's show Level 1 + Level 2 only
                        if (chapter.level > 2) return null;

                        return (
                          <div key={idx} className={`grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors ${!isMain ? 'bg-gray-50/30' : ''}`}>
                            <div className="col-span-6 flex items-center gap-3">
                              <div style={{ width: (chapter.level - 1) * 24 }} />
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isMain ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                              <span className={`truncate ${isMain ? 'font-bold text-gray-800' : 'text-gray-600 font-medium'}`}>
                                {chapter.title}
                              </span>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="font-mono font-medium text-gray-700">{chapter.page_count}</span>
                              <span className="text-xs text-gray-400 mr-1">ص</span>
                            </div>
                            <div className="col-span-4 flex items-center gap-3">
                              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${percentage > 15 ? 'bg-red-500' : percentage > 5 ? 'bg-emerald-500' : 'bg-blue-400'}`}
                                  style={{ width: `${Math.min(100, percentage)}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono font-medium text-gray-400 w-12 text-left dir-ltr">
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Dialog */}
      {previewDialog.visible && previewDialog.book && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden ring-1 ring-black/10" dir="rtl">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-100">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 truncate max-w-md">{previewDialog.book.title}</h3>
                  <p className="text-gray-400 text-xs">معاينة الكتاب • {previewDialog.book.total_pages} صفحة</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Current Progress Display + Record Button */}
                <button
                  onClick={() => {
                    setProgressDialog({ visible: true, book: previewDialog.book, pageInput: previewDialog.book!.pages_read.toString() });
                  }}
                  className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 rounded-lg px-3 py-1.5 border border-orange-200 text-orange-700 transition-colors"
                >
                  <BookMarked size={16} />
                  <span className="text-sm font-medium">تسجيل التقدم</span>
                  <span className="text-xs bg-white px-2 py-0.5 rounded border border-orange-200">
                    {previewDialog.book.pages_read} / {previewDialog.book.total_pages}
                  </span>
                </button>
                <button
                  onClick={() => setPreviewDialog(prev => ({ ...prev, visible: false }))}
                  className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
              <InteractivePDFViewer
                pdfPath={previewDialog.book.file_path}
                bookId={previewDialog.book.id.toString()}
                bookTitle={previewDialog.book.title}
                readingCount={1} // Placeholder, should be fetched if needed
                onClose={() => setPreviewDialog(prev => ({ ...prev, visible: false }))}
                assetUrl={previewDialog.assetUrl}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress Dialog */}
      {progressDialog.visible && progressDialog.book && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6 ring-1 ring-black/10" dir="rtl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shadow-sm border border-orange-100">
                <BookMarked size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">تحديث التقدم</h3>
                <p className="text-gray-400 text-xs truncate max-w-[280px]">{progressDialog.book.title}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">الصفحة الحالية</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={progressDialog.book.total_pages}
                  value={progressDialog.pageInput}
                  onChange={(e) => setProgressDialog(prev => ({ ...prev, pageInput: e.target.value }))}
                  className="flex-1 text-center text-lg font-semibold bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="0"
                />
                <span className="text-gray-400 text-lg">/ {progressDialog.book.total_pages}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${((parseInt(progressDialog.pageInput) || 0) / progressDialog.book.total_pages) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setProgressDialog(prev => ({ ...prev, visible: false }))}
                className="flex-1 py-2 px-4 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  const pagesRead = parseInt(progressDialog.pageInput) || 0;
                  if (pagesRead < 0 || pagesRead > progressDialog.book!.total_pages) {
                    showToast('error', 'رقم الصفحة غير صالح');
                    return;
                  }
                  try {
                    await bookLibraryApi.updateBook(progressDialog.book!.id, { pages_read: pagesRead });
                    // Reload books to maintain proper sort order (especially for reading_percentage sort)
                    await loadBooks();
                    showToast('success', 'تم حفظ التقدم');
                    setProgressDialog(prev => ({ ...prev, visible: false }));
                  } catch (error) {
                    showToast('error', 'فشل في حفظ التقدم');
                  }
                }}
                className="flex-1 py-2 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save size={16} />
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>إجمالي الكتب: <strong className="text-gray-900">{books.length}</strong></span>
          <span>المفضلة: <strong className="text-gray-900">{books.filter(b => b.is_starred).length}</strong></span>
          <span>مكتملة: <strong className="text-gray-900">{books.filter(b => b.reading_percentage === 100).length}</strong></span>
        </div>
      </div>
    </div>
  );
}
