import { useState, useEffect } from 'react';
import { 
  Search, FolderOpen, Play, Loader2, Folder, Eye,
  FileText, MessageSquare, BarChart3, Download, Highlighter, FileDown,
  Trash2, RefreshCw, ExternalLink, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, X, Copy, User
} from 'lucide-react';
import { pdfProgressApi, type ScannedPDF, type ProgressStatistics } from '../../api/pdfProgressApi';
import { bookLibraryApi, type Annotation } from '../../api/bookLibraryApi';
import { getApiBaseUrl } from '../../lib/api';

type SortColumn = 'file_name' | 'total_annotations' | 'reading_intensity_score' | 'last_modified' | 'last_scanned' | 'page_count';

// Tauri APIs - conditionally imported
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

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

export function CommentsTool() {
  // Data state
  const [pdfs, setPdfs] = useState<ScannedPDF[]>([]);
  const [statistics, setStatistics] = useState<ProgressStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  // Scan state
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: number; failed: number } | null>(null);

  // Filter/sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAnnotated, setFilterAnnotated] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('last_scanned');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedPdf, setSelectedPdf] = useState<ScannedPDF | null>(null);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  // Detail view state
  const [detailView, setDetailView] = useState<{
    visible: boolean;
    pdf: ScannedPDF | null;
    annotations: Annotation[];
    loading: boolean;
    assetUrl: string | null;
    sidebarCollapsed: boolean;
  }>({
    visible: false, pdf: null, annotations: [], loading: false,
    assetUrl: null, sidebarCollapsed: false
  });



  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Computed: unique folders from PDFs
  const uniqueFolders = [...new Set(pdfs.map(pdf => {
    const parts = pdf.file_path.replace(/\\/g, '/').split('/');
    parts.pop(); // remove filename
    return parts.join('/');
  }))].sort();

  // Filtered PDFs based on folder selection
  const filteredPdfs = folderFilter
    ? pdfs.filter(pdf => pdf.file_path.replace(/\\/g, '/').startsWith(folderFilter))
    : pdfs;

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load PDFs when filters change
  useEffect(() => {
    if (!loading) {
      loadPDFs();
    }
  }, [filterAnnotated, sortColumn, sortOrder, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPDFs(), loadStatistics()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPDFs = async () => {
    try {
      const result = await pdfProgressApi.getPDFList({
        filterAnnotated,
        sortBy: sortColumn,
        order: sortOrder,
        search: searchQuery || undefined,
      });
      setPdfs(result.pdfs);
    } catch (error) {
      console.error('Failed to load PDFs:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await pdfProgressApi.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleSelectFolder = async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const folder = await open({
      directory: true,
      multiple: false,
      title: 'اختر مجلداً للفحص',
    });

    if (folder) {
      setSelectedFolder(folder as string);
      setScanResult(null);
    }
  };

  const handleStartScan = async () => {
    if (!selectedFolder) return;

    setScanning(true);
    setScanResult(null);

    try {
      const result = await pdfProgressApi.scanDirectory(selectedFolder, includeSubfolders);
      setScanResult({
        success: result.successful_count,
        failed: result.failed_count,
      });

      // Reload data after scan
      await loadData();

      showToast(`تم فحص ${result.successful_count} ملف بنجاح`, 'success');
    } catch (error) {
      console.error('Scan failed:', error);
      showToast('فشل الفحص', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleExportMarkdown = async (pdf: ScannedPDF) => {
    try {
      const markdown = await pdfProgressApi.exportToMarkdown(pdf.file_path);

      // Copy to clipboard
      await navigator.clipboard.writeText(markdown);
      showToast('تم نسخ التعليقات إلى الحافظة', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('لا توجد تعليقات للتصدير', 'error');
    }
  };

  const handleDeletePdf = async (pdf: ScannedPDF) => {
    try {
      await pdfProgressApi.deletePDF(pdf.file_path);
      await loadData();
      if (selectedPdf?.id === pdf.id) setSelectedPdf(null);
      showToast('تم حذف السجل', 'success');
    } catch (error) {
      console.error('Delete failed:', error);
      showToast('فشل الحذف', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('هل أنت متأكد من حذف جميع البيانات؟')) return;

    try {
      await pdfProgressApi.clearAll();
      await loadData();
      setSelectedPdf(null);
      showToast('تم مسح جميع البيانات', 'success');
    } catch (error) {
      console.error('Clear failed:', error);
      showToast('فشل المسح', 'error');
    }
  };

  const handleOpenPdf = async (pdf: ScannedPDF) => {
    try {
      const API_BASE = await getApiBaseUrl();
      await fetch(`${API_BASE}/api/system/open-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: pdf.file_path }),
      });
    } catch (error) {
      console.error('Failed to open PDF:', error);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  const openDetailView = async (pdf: ScannedPDF) => {
    // Basic init
    setDetailView({
      visible: true, pdf, annotations: [], loading: true,
      assetUrl: null, sidebarCollapsed: false
    });

    try {
      // 1. Get asset URL for iframe
      const url = await getAssetUrl(pdf.file_path);

      // 2. Load annotations in parallel
      bookLibraryApi.extractAnnotations(pdf.file_path)
        .then(annotations => {
          setDetailView(prev => ({
            ...prev,
            annotations,
            loading: false,
            assetUrl: url  // Set URL once we are ready, or immediately if preferred
          }));
        })
        .catch(error => {
          console.error('Failed to load annotations:', error);
          setDetailView(prev => ({
            ...prev,
            loading: false,
            assetUrl: url
          }));
        });

    } catch (error) {
      console.error('Failed to open PDF view:', error);
      showToast('فشل فتح ملف PDF', 'error');
      setDetailView(prev => ({ ...prev, loading: false }));
    }
  };

  const copyAnnotationsToClipboard = async () => {
    if (!detailView.pdf) return;
    try {
      const markdown = await pdfProgressApi.exportToMarkdown(detailView.pdf.file_path);
      await navigator.clipboard.writeText(markdown);
      showToast('تم نسخ التعليقات إلى الحافظة', 'success');
    } catch (error) {
      showToast('فشل نسخ التعليقات', 'error');
    }
  };

  const exportAnnotationsToFile = async () => {
    if (!detailView.pdf) return;
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const markdown = await pdfProgressApi.exportToMarkdown(detailView.pdf.file_path);

      const fileName = detailView.pdf.file_name.replace('.pdf', '_annotations.md');
      const savePath = await save({
        defaultPath: fileName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });

      if (savePath) {
        // Use backend to save the file
        const API_BASE = await getApiBaseUrl();
        const response = await fetch(`${API_BASE}/api/system/save-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: savePath, content: markdown }),
        });

        if (response.ok) {
          showToast('تم حفظ الملف بنجاح', 'success');
        } else {
          throw new Error('Failed to save');
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      showToast('فشل حفظ الملف', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} ب`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">تتبع النشاط والتعليقات</h2>
        <p className="text-gray-500 text-sm">فحص الملفات واستخراج التعليقات وتتبع نشاط القراءة</p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Panel - Controls */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4">
          {/* Directory Selection */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FolderOpen size={16} className="text-indigo-500" />
              اختيار المجلد
            </h3>

            <div className="space-y-3">
              <button
                onClick={handleSelectFolder}
                className="btn btn-secondary w-full justify-center"
              >
                <FolderOpen size={16} />
                اختر مجلداً
              </button>

              {selectedFolder && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg truncate" title={selectedFolder}>
                  {selectedFolder}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubfolders}
                  onChange={(e) => setIncludeSubfolders(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                تضمين المجلدات الفرعية
              </label>
            </div>
          </div>

          {/* Scan Controls */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Play size={16} className="text-green-500" />
              التحكم بالفحص
            </h3>

            <div className="space-y-2">
              <button
                onClick={handleStartScan}
                disabled={!selectedFolder || scanning}
                className="btn btn-primary w-full justify-center"
              >
                {scanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الفحص...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    بدء الفحص
                  </>
                )}
              </button>

              {scanResult && (
                <div className="flex items-center gap-2 text-xs p-2 bg-green-50 text-green-700 rounded-lg">
                  <CheckCircle2 size={14} />
                  تم فحص {scanResult.success} ملف
                  {scanResult.failed > 0 && (
                    <span className="text-amber-600">({scanResult.failed} فشل)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Statistics */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-purple-500" />
              الإحصائيات
            </h3>

            {statistics ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <FileText size={14} className="text-indigo-500" />
                    إجمالي ملفات PDF
                  </span>
                  <span className="font-bold text-gray-900">{statistics.total_pdfs}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-green-500" />
                    ملفات مع تعليقات
                  </span>
                  <span className="font-bold text-green-600">{statistics.pdfs_with_annotations}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-blue-500" />
                    إجمالي التعليقات
                  </span>
                  <span className="font-bold text-blue-600">{statistics.total_annotations}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <BarChart3 size={14} className="text-amber-500" />
                    متوسط الكثافة
                  </span>
                  <span className="font-bold text-amber-600">{statistics.average_intensity.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                جاري التحميل...
              </div>
            )}

            <button
              onClick={loadData}
              className="btn btn-secondary w-full justify-center mt-3"
            >
              <RefreshCw size={14} />
              تحديث الإحصائيات
            </button>
          </div>

          {/* Actions */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              إجراءات خطرة
            </h3>
            <button
              onClick={handleClearAll}
              className="btn bg-red-50 text-red-600 hover:bg-red-100 w-full justify-center"
            >
              <Trash2 size={14} />
              مسح جميع البيانات
            </button>
          </div>
        </div>

        {/* Middle Panel - Folder List */}
        {uniqueFolders.length > 0 && (
          <div className="w-56 flex-shrink-0 flex flex-col">
            <div className="card flex-1 overflow-hidden flex flex-col">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Folder size={16} className="text-amber-500" />
                المجلدات ({uniqueFolders.length})
              </h3>

              <div className="flex-1 overflow-auto space-y-1">
                {/* All folders option */}
                <button
                  onClick={() => setFolderFilter(null)}
                  className={`w-full text-right px-2 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${folderFilter === null
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-600'
                    }`}
                >
                  <FolderOpen size={14} />
                  <span>جميع المجلدات</span>
                  <span className="mr-auto text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {pdfs.length}
                  </span>
                </button>

                {/* Individual folders */}
                {uniqueFolders.map(folder => {
                  const folderName = folder.split('/').pop() || folder;
                  const count = pdfs.filter(pdf =>
                    pdf.file_path.replace(/\\/g, '/').startsWith(folder)
                  ).length;

                  return (
                    <button
                      key={folder}
                      onClick={() => setFolderFilter(folder)}
                      title={folder}
                      className={`w-full text-right px-2 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${folderFilter === folder
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    >
                      <Folder size={14} className="flex-shrink-0" />
                      <span className="truncate flex-1">{folderName}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Right Panel - PDF Table */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search and Filters */}
          <div className="card mb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="البحث بالاسم أو المسار..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pr-10 w-full"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={filterAnnotated}
                  onChange={(e) => setFilterAnnotated(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                مع التعليقات فقط
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="card flex-1 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
              </div>
            ) : filteredPdfs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <FileText size={48} className="mb-3" />
                  <p>{folderFilter ? 'لا توجد ملفات في هذا المجلد' : 'لا توجد ملفات'}</p>
                  <p className="text-sm">{folderFilter ? 'اختر مجلداً آخر' : 'قم بفحص مجلد لبدء التتبع'}</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b border-gray-200">
                      <th
                        className="text-right p-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('file_name')}
                      >
                            <div className="flex items-center gap-1">
                              اسم الملف
                              <SortIcon column="file_name" />
                            </div>
                          </th>
                          <th
                            className="text-right p-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('page_count')}
                          >
                            <div className="flex items-center gap-1">
                              الصفحات
                              <SortIcon column="page_count" />
                            </div>
                          </th>
                          <th
                            className="text-right p-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('total_annotations')}
                          >
                            <div className="flex items-center gap-1">
                              التعليقات
                              <SortIcon column="total_annotations" />
                            </div>
                          </th>
                          <th
                            className="text-right p-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('reading_intensity_score')}
                          >
                            <div className="flex items-center gap-1">
                              الكثافة
                              <SortIcon column="reading_intensity_score" />
                            </div>
                          </th>
                          <th
                            className="text-right p-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => handleSort('last_modified')}
                          >
                            <div className="flex items-center gap-1">
                              آخر تعديل
                              <SortIcon column="last_modified" />
                            </div>
                          </th>
                          <th className="text-center p-3 font-semibold text-gray-600">
                            إجراءات
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPdfs.map(pdf => (
                          <tr
                            key={pdf.id}
                            className={`border-b border-gray-100 hover:bg-indigo-50/50 cursor-pointer transition-colors ${selectedPdf?.id === pdf.id ? 'bg-indigo-50' : ''
                              }`}
                            onClick={() => setSelectedPdf(pdf)}
                            onDoubleClick={() => openDetailView(pdf)}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <FileText size={16} className={pdf.total_annotations > 0 ? 'text-green-500' : 'text-gray-400'} />
                                <div>
                                  <div className="font-medium text-gray-900 truncate max-w-[200px]" title={pdf.file_name}>
                                    {pdf.file_name}
                                  </div>
                                  <div className="text-xs text-gray-400 truncate max-w-[200px]" title={pdf.file_path}>
                                    {formatFileSize(pdf.file_size)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-gray-600">{pdf.page_count}</td>
                            <td className="p-3">
                              <span className={`font-medium ${pdf.total_annotations > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {pdf.total_annotations}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full"
                                    style={{ width: `${(pdf.reading_intensity_score / 10) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{pdf.reading_intensity_score.toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="p-3 text-gray-500 text-xs">
                              {formatDate(pdf.last_modified)}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDetailView(pdf); }}
                                  className="p-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                                  title="عرض التفاصيل"
                                >
                                  <Eye size={14} className="text-purple-600" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenPdf(pdf); }}
                                  className="p-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                                  title="فتح"
                                >
                                  <ExternalLink size={14} className="text-indigo-600" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleExportMarkdown(pdf); }}
                                  className="p-1.5 rounded-lg hover:bg-green-100 transition-colors"
                                  title="تصدير التعليقات"
                                >
                                  <Download size={14} className="text-green-600" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeletePdf(pdf); }}
                                  className="p-1.5 rounded-lg hover:bg-red-100 transition-colors"
                                  title="حذف"
                                >
                                  <Trash2 size={14} className="text-red-600" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected PDF Details */}
          {selectedPdf && (
            <div className="card mt-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{selectedPdf.file_name}</h3>
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">{selectedPdf.file_path}</p>
                </div>
                <button onClick={() => setSelectedPdf(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{selectedPdf.page_count}</div>
                  <div className="text-xs text-gray-500">صفحة</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{selectedPdf.total_annotations}</div>
                  <div className="text-xs text-gray-500">تعليق</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{selectedPdf.reading_intensity_score.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">كثافة</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">{selectedPdf.estimated_reading_time}</div>
                  <div className="text-xs text-gray-500">دقيقة قراءة</div>
                </div>
              </div>

              {Object.keys(selectedPdf.annotations_by_type).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">أنواع التعليقات:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedPdf.annotations_by_type).map(([type, count]) => (
                      <span key={type} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 left-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {/* PDF Detail View Modal */}
      {detailView.visible && detailView.pdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDetailView(prev => ({ ...prev, visible: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] flex overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Left Panel - Comments & Export (Collapsible) */}
            <div className={`${detailView.sidebarCollapsed ? 'w-0' : 'w-96'} transition-all duration-300 border-l border-gray-200 flex flex-col bg-gray-50 overflow-hidden relative`}>
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-white min-w-[24rem]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-lg text-gray-900 truncate flex-1">{detailView.pdf.file_name}</h2>
                  <button
                    onClick={() => setDetailView(prev => ({ ...prev, visible: false }))}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 truncate">{detailView.pdf.file_path}</p>
              </div>

              {/* Stats */}
              <div className="p-4 border-b border-gray-200 bg-white min-w-[24rem]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{detailView.pdf.page_count}</div>
                    <div className="text-xs text-gray-500">صفحة</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{detailView.pdf.total_annotations}</div>
                    <div className="text-xs text-gray-500">تعليق</div>
                  </div>
                </div>
              </div>

              {/* Export Actions - Improved Icon Grid */}
              <div className="p-4 border-b border-gray-200 bg-white min-w-[24rem]">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={copyAnnotationsToClipboard}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 transition-all group"
                  >
                    <Copy size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium text-indigo-700">نسخ</span>
                  </button>
                  <button
                    onClick={exportAnnotationsToFile}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition-all group"
                  >
                    <FileDown size={20} className="text-green-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium text-green-700">تصدير</span>
                  </button>
                  <button
                    onClick={() => handleOpenPdf(detailView.pdf!)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 transition-all group"
                  >
                    <ExternalLink size={20} className="text-amber-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium text-amber-700">فتح</span>
                  </button>
                </div>
              </div>

              {/* Annotations List */}
              <div className="flex-1 overflow-auto p-4 min-w-[24rem]">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-500" />
                  التعليقات ({detailView.annotations.length})
                </h3>

                {detailView.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-indigo-500" />
                  </div>
                ) : detailView.annotations.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">لا توجد تعليقات</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailView.annotations.map((annot, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-1">
                            <Highlighter size={10} />
                            {annot.type}
                          </span>
                          <span className="text-gray-400">صفحة {annot.page}</span>
                          {annot.author && (
                            <span className="text-gray-400 flex items-center gap-1">
                              <User size={10} />
                              {annot.author}
                            </span>
                          )}
                        </div>
                        {annot.content && (
                          <p className="text-sm text-gray-700 leading-relaxed font-arabic" dir="auto">{annot.content}</p>
                        )}
                        {annot.subject && (
                          <p className="text-xs text-gray-500 mt-1 italic">{annot.subject}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - PDF Preview (Native Iframe) */}
            <div className="flex-1 bg-gray-100 flex flex-col relative h-full">
              {/* Toolbar */}
              <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between shadow-sm z-10 h-14">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailView(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }))}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    title={detailView.sidebarCollapsed ? "إظهار القائمة الجانبية" : "إخفاء القائمة الجانبية"}
                  >
                    {detailView.sidebarCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {detailView.pdf?.file_name}
                  </span>
                </div>
              </div>

              {/* PDF Contents */}
              <div className="flex-1 overflow-hidden relative bg-gray-900/5">
                {detailView.assetUrl ? (
                  <iframe
                    src={detailView.assetUrl}
                    className="w-full h-full border-0 block"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    {detailView.loading ? (
                      <>
                        <Loader2 size={32} className="animate-spin text-indigo-500 mb-4" />
                        <p>جاري تحميل الملف...</p>
                      </>
                    ) : (
                      <>
                        <FileText size={48} className="mb-4 opacity-50" />
                        <p >تعذر عرض الملف</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
