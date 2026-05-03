import { useState } from 'react';
import { api } from '../../lib/api';
import { Image, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { FileInput } from '../ui/FileInput';

export const PDFExtractImagesTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputDir, setOutputDir] = useState('');

  // Auto-set output directory based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputDir && path) {
      // Extract directory from input path
      const separator = path.includes('\\') ? '\\' : '/';
      const lastSep = path.lastIndexOf(separator);
      if (lastSep > 0) {
        setOutputDir(path.substring(0, lastSep));
      }
    }
  };

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleExtract = async () => {
    if (!inputPath || !outputDir) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري الاستخراج...' });
    const res = await api.extractImages(inputPath, outputDir);
    setLoading(false);
    if (res.success) {
      setStatus({ type: 'success', message: `تم استخراج ${res.data?.files.length} صورة بنجاح!` });
      setInputPath('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-purple-50 text-purple-600 shadow-sm">
          <Image size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">استخراج الصور</h2>
          <p className="text-secondary mt-1">استخراج جميع الصور الموجودة داخل ملف PDF بجودتها الأصلية.</p>
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

          <FileInput
            value={outputDir}
            onChange={setOutputDir}
            label="2. مجلد حفظ الصور"
            placeholder="اختر مجلد لاستخراج الصور إليه..."
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
            onClick={handleExtract}
            disabled={loading || !inputPath || !outputDir}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                استخراج الصور
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
