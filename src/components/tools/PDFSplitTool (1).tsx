import { useState } from 'react';
import { api } from '../../lib/api';
import { Split, ArrowRight, CheckCircle, AlertCircle, Scissors } from 'lucide-react';
import { FileInput } from '../ui/FileInput';


export const PDFSplitTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [splitPages, setSplitPages] = useState('');
  const [outputDir, setOutputDir] = useState('');

  // Auto-set output directory based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputDir && path) {
      // For split tool, we default to the same directory as input
      // Extract directory from path
      const separator = path.includes('\\') ? '\\' : '/';
      const lastSep = path.lastIndexOf(separator);
      if (lastSep > 0) {
        setOutputDir(path.substring(0, lastSep));
      }
    }
  };

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const [previewImages, setPreviewImages] = useState<{ page: number; image: string }[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handlePreview = async () => {
    if (!inputPath || !splitPages) return;
    
    // Parse pages
    const pages = splitPages.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    if (pages.length === 0) {
      setStatus({ type: 'error', message: 'أرقام صفحات غير صالحة' });
      return;
    }

    setLoadingPreview(true);
    setPreviewImages([]);
    setStatus({ type: '', message: 'جاري تحميل المعاينة...' });

    try {
      const images = [];
      for (const page of pages) {
        const res = await api.renderPage(inputPath, page);
        if (res.success && res.data && res.data.data) {
          images.push({ page: page, image: res.data.data.image });
        }
      }
      setPreviewImages(images);
      
      if (images.length > 0) {
        setStatus({ type: 'success', message: 'تم تحميل المعاينة' });
      } else {
        setStatus({ type: 'error', message: 'تعذر تحميل صفحات المعاينة. تأكد من صحة أرقام الصفحات.' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: 'حدث خطأ أثناء تحميل المعاينة' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSplit = async () => {
    if (!inputPath || !splitPages || !outputDir) return;
    
    const pages = splitPages.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    if (pages.length === 0) {
      setStatus({ type: 'error', message: 'أرقام صفحات غير صالحة' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: 'جاري التقسيم...' });
    const res = await api.split(inputPath, pages, outputDir);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: `تم إنشاء ${res.data?.files.length} ملفات بنجاح!` });
      // Keep input populated for repeated operations if needed, or clear? original cleared.
      // setInputPath(''); 
      // setSplitPages('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
          <Split size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">تقسيم ملف PDF</h2>
          <p className="text-secondary mt-1">تقسيم ملف PDF كبير إلى أجزاء متعددة.</p>
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
            <label className="block text-sm font-semibold text-primary mb-2.5">2. نقاط التقسيم (أرقام الصفحات)</label>
            <div className="flex gap-4 items-start">
              <div className="relative flex-1">
                <Scissors className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  value={splitPages}
                  onChange={e => setSplitPages(e.target.value)}
                  placeholder="مثال: 5, 10, 15"
                  className="input pl-10 text-right" 
                  dir="ltr"
                />
              </div>
              <button
                onClick={handlePreview}
                disabled={loadingPreview || !inputPath || !splitPages}
                className="btn btn-secondary h-[42px] px-4 whitespace-nowrap"
              >
                {loadingPreview ? 'جاري التحميل...' : 'معاينة'}
              </button>
            </div>
            <p className="text-xs text-secondary mt-1.5 mr-1">سيتم إنشاء ملف جديد بدءاً من كل صفحة تحددها. (مثال: "5" سيقسم الملف إلى: 1-4 و 5-النهاية)</p>
          
            {/* Preview Section */}
            {previewImages.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-border animate-fade-in">
                <h3 className="text-sm font-semibold text-primary mb-3">معاينة صفحات التقسيم:</h3>
                <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                  {previewImages.map((item, idx) => (
                    <div key={idx} className="flex-shrink-0 flex flex-col items-center gap-2">
                       <div className="relative group">
                         <img 
                           src={item.image} 
                           alt={`Page ${item.page}`} 
                           className="h-32 w-auto object-contain rounded-md shadow-sm border border-gray-200 bg-white"
                         />
                         <div className="absolute top-1 right-1 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold shadow-sm">
                           ص {item.page}
                         </div>
                       </div>
                       <span className="text-xs font-medium text-gray-600">بداية الجزء {idx + 2}</span>
                    </div>
                  ))}
                </div>
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
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 text-sm font-medium animate-fade-in ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
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
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                بدء التقسيم
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
