import { useState } from 'react';
import { api } from '../../lib/api';
import { FileText, ArrowRight, CheckCircle, AlertCircle, FileType, Timer, BookOpen, ALargeSmall, FolderOpen, Type } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { openPath } from '../../lib/utils';


export const TextExtractTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [pageRange, setPageRange] = useState('');

  // Auto-set output directory based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputDir && path) {
      // Default to input file directory
      const separator = path.includes('\\') ? '\\' : '/';
      const lastSep = path.lastIndexOf(separator);
      if (lastSep > 0) {
        setOutputDir(path.substring(0, lastSep));
      }
    }
  };

  const [format, setFormat] = useState('txt');
  const [docOptions, setDocOptions] = useState({ fontFamily: 'Calibri', fontSize: 11 });
  const [customFilename, setCustomFilename] = useState('');

  const [useOcr, setUseOcr] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastOutputFolder, setLastOutputFolder] = useState('');
  const [stats, setStats] = useState<{ wordCount?: number; duration?: number; pageCount?: number } | null>(null);

  const handleExtract = async () => {
    if (!inputPath) return;

    if (useOcr && (!authStatus || !authStatus.authenticated)) {
      setLoading(true);
      const auth = await api.tahweel.getAuthStatus();
      if (!auth.success || !auth.data?.authenticated) {
        setStatus({ type: 'error', message: 'يرجى تسجيل الدخول بـ Google أولاً لاستخدام ميزة Tahweel OCR' });
        setLoading(false);
        return;
      }
      setAuthStatus(auth.data);
    }

    setLoading(true);
    setStatus({ type: '', message: useOcr ? 'جاري التحويل عبر Google OCR... قد يستغرق هذا وقتاً.' : 'جاري الاستخراج...' });
    setLastOutputFolder('');
    
    let finalOutputDir = outputDir;
    if (!finalOutputDir) {
      const lastSlash = Math.max(inputPath.lastIndexOf('/'), inputPath.lastIndexOf('\\'));
      finalOutputDir = lastSlash > 0 ? inputPath.substring(0, lastSlash) : '.';
    }
    
    const defaultName = inputPath.split(/[/\\]/).pop()?.replace('.pdf', '') || 'output';
    const finalName = customFilename.trim() || defaultName;
    const outputPath = `${finalOutputDir}/${finalName}.${format}`;
    
    let res;
    if (useOcr) {
      // Tahweel conversion (Async)
      res = await api.tahweel.convert(inputPath, finalOutputDir, true, true, true);
      setLoading(false);
      if (res.success && res.data?.task_id) {
        setStatus({ 
          type: 'success', 
          message: '🚀 تم بدء عملية تحويل OCR في الخلفية. يمكنك متابعة التقدم من لوحة المهام بالأسفل.' 
        });
        setLastOutputFolder(finalOutputDir);
      } else {
        setStatus({ type: 'error', message: res.error || 'حدث خطأ في بدء التحويل' });
      }
    } else {
      // Standard extraction
      res = await api.extractTextToFile(
        inputPath,
        outputPath,
        pageRange || 'all',
        format,
        true,
        docOptions.fontFamily,
        docOptions.fontSize
      );
      setLoading(false);
      if (res.success) {
        setStatus({ type: 'success', message: `✅ تم استخراج النص بنجاح إلى: ${finalName}.${format}` });
        setLastOutputFolder(finalOutputDir);
        setStats({
          wordCount: res.data?.data.word_count,
          duration: res.data?.data.duration_seconds,
          pageCount: res.data?.data.pages_extracted
        });
      } else {
        setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
      }
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-cyan-50 text-cyan-600 shadow-sm">
          <FileText size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">استخراج النص</h2>
          <p className="text-secondary mt-1">تحويل محتوى PDF إلى نص قابل للتحرير (TXT, Word, Markdown).</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={inputPath}
            onChange={handleInputChange}
            label="1. ملف PDF المصدر"
            placeholder="اختر ملف PDF..."
            accept=".pdf"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500" 
                  checked={useOcr}
                  onChange={(e) => setUseOcr(e.target.checked)}
                />
                <div>
                  <span className="text-sm font-bold text-orange-800">استخدام Tahweel OCR للملفات المصورة</span>
                  <p className="text-[11px] text-orange-600 mt-0.5">للتعامل مع الكتب العربية الممسوحة ضوئياً (سكان) بدقة عالية.</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-primary mb-2.5">2. صيغة الإخراج</label>
              <div className="relative">
                <FileType className="absolute right-3 top-3 text-gray-400" size={18} />
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value)}
                  disabled={useOcr} // Tahweel always generates docx and txt
                  className="input !pr-12 appearance-none cursor-pointer disabled:bg-gray-100"
                >
                  <option value="txt">TXT - نص عادي</option>
                  <option value="docx">DOCX - مستند Word</option>
                  <option value="md">MD - Markdown</option>
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>

            {!useOcr && (
              <div>
                <label className="block text-sm font-semibold text-primary mb-2.5">3. نطاق الصفحات (اختياري)</label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={e => setPageRange(e.target.value)}
                  placeholder="الكل (افتراضي) أو 1-5"
                  className="input"
                />
              </div>
            )}

            {/* Document Formatting Section - Only for DOCX */}
            {!useOcr && format === 'docx' && (
              <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-100 animate-slide-up">
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <Type size={16} />
                  4. تنسيق المستند (Font)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-secondary mb-1.5">نوع الخط</label>
                    <select
                      value={docOptions.fontFamily}
                      onChange={e => setDocOptions({ ...docOptions, fontFamily: e.target.value })}
                      className="input text-sm"
                    >
                      <option value="Calibri">Calibri (Standard)</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Arial">Arial</option>
                      <option value="Simplified Arabic">Simplified Arabic</option>
                      <option value="Traditional Arabic">Traditional Arabic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1.5">حجم الخط</label>
                    <div className="relative">
                      <select
                        value={docOptions.fontSize}
                        onChange={e => setDocOptions({ ...docOptions, fontSize: Number(e.target.value) })}
                        className="input text-sm appearance-none"
                      >
                        {[11, 12, 13, 14, 16, 18].map(size => (
                          <option key={size} value={size}>{size} px</option>
                        ))}
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-primary mb-2.5">5. اسم الملف الناتج (اختياري)</label>
              <input
                type="text"
                value={customFilename}
                onChange={e => setCustomFilename(e.target.value)}
                placeholder="اسم الملف بدون امتداد (اتركه للافتراضي)"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-primary mb-2.5">6. مجلد الحفظ (اختياري)</label>
              <div className="relative">
                <input
                  type="text"
                  value={outputDir}
                  onChange={e => setOutputDir(e.target.value)}
                  placeholder="اتركه فارغًا للحفظ بجانب الملف الأصلي"
                  className="input dir-ltr text-right"
                />
              </div>
            </div>
          </div>
          {!useOcr && <p className="text-xs text-secondary -mt-4 mr-1">سيتم حفظ الملف في: {outputDir || 'نفس المجلد'} / {customFilename || '(الاسم الأصلي)'}.{format}</p>}
        </section>

        <section className="mt-auto pt-4 pb-2">
          {status.message && (
            <div className={`mb-4 rounded-lg flex flex-col gap-3 animate-fade-in`}>
              <div className={`p-4 rounded-lg flex items-center justify-between gap-3 text-sm font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
                }`}>
                <div className="flex items-center gap-3">
                  {status.type === 'success' ? <CheckCircle size={18} /> :
                    status.type === 'error' ? <AlertCircle size={18} /> :
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  {status.message}
                </div>
                {status.type === 'success' && lastOutputFolder && (
                  <button
                    onClick={() => openPath(lastOutputFolder)}
                    className="text-xs bg-white/50 hover:bg-white text-emerald-700 px-3 py-1.5 rounded-md transition-colors border border-emerald-200 flex items-center gap-2"
                  >
                    <FolderOpen size={14} />
                    فتح المجلد
                  </button>
                )}
              </div>

              {status.type === 'success' && stats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-border flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="text-emerald-500 mb-1 bg-emerald-50 p-1.5 rounded-full">
                      <Timer size={16} />
                    </div>
                    <span className="text-xl font-bold text-gray-800 dir-ltr">{stats.duration}s</span>
                    <span className="text-xs text-secondary mt-1">المدة المستغرقة</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-border flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="text-blue-500 mb-1 bg-blue-50 p-1.5 rounded-full">
                      <ALargeSmall size={16} />
                    </div>
                    <span className="text-xl font-bold text-gray-800 dir-ltr">{stats.wordCount?.toLocaleString()}</span>
                    <span className="text-xs text-secondary mt-1">عدد الكلمات</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-border flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="text-indigo-500 mb-1 bg-indigo-50 p-1.5 rounded-full">
                      <BookOpen size={16} />
                    </div>
                    <span className="text-xl font-bold text-gray-800 dir-ltr">{stats.pageCount}</span>
                    <span className="text-xs text-secondary mt-1">الصفحات</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={loading || !inputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                استخراج النص
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
