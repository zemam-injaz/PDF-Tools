import { useState } from 'react';
import { api } from '../../lib/api';
import { Minimize2, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { getDefaultOutputPath } from '../../lib/utils';

export const PDFCompressTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');

  // Auto-set output path based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputPath && path) {
      setOutputPath(getDefaultOutputPath(path, '_compressed'));
    }
  };

  const [level, setLevel] = useState(2);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleCompress = async () => {
    if (!inputPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري الضغط...' });
    const res = await api.compress(inputPath, outputPath, level);
    setLoading(false);
    if (res.success) {
      setStatus({ type: 'success', message: 'تم ضغط الملف بنجاح!' });
      setInputPath('');
      setOutputPath('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600 shadow-sm">
          <Minimize2 size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">ضغط ملف PDF</h2>
          <p className="text-secondary mt-1">تقليل حجم الملف مع الحفاظ على الجودة</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={inputPath}
            onChange={handleInputChange}
            label="1. الملف المراد ضغطه"
            placeholder="اختر ملف PDF..."
            accept=".pdf"
          />

          <div>
            <label className="block text-sm font-semibold text-primary mb-2.5">2. مستوى الضغط</label>
            <div className="relative">
              <select
                value={level}
                onChange={e => setLevel(parseInt(e.target.value))}
                className="input appearance-none cursor-pointer"
              >
                <option value={0}>بدون ضغط (0)</option>
                <option value={1}>تنظيف (1)</option>
                <option value={2}>متوسط (2) - موصى به</option>
                <option value={3}>عالي (3)</option>
                <option value={4}>أقصى (4)</option>
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <p className="text-xs text-secondary mt-1.5 mr-1">المستوى الموصى به (2) يوفر أفضل توازن بين الحجم والجودة.</p>
          </div>

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="3. مسار الملف الناتج"
            placeholder="اختر مكان الحفظ..."
            accept=".pdf"
            isSave
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
            onClick={handleCompress}
            disabled={loading || !inputPath || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                ضغط الملف الآن
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
