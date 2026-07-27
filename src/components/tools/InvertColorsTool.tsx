import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { FileInput } from '../ui/FileInput';
import { Contrast, CheckCircle, AlertCircle, FolderOpen, ArrowRight } from 'lucide-react';

export const InvertColorsTool: React.FC = () => {
  const [pdfPath, setPdfPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [mode, setMode] = useState<'full' | 'smart'>('full');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastFolder, setLastFolder] = useState('');

  const handleFileChange = (path: string) => {
    setPdfPath(path);
    if (!outputPath) setOutputPath(getDefaultOutputPath(path, '_inverted'));
  };

  const handleInvert = async () => {
    if (!pdfPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري عكس الألوان...' });
    setLastFolder('');

    const folder = outputPath.substring(0, Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\')));
    const res = await api.invertColors(pdfPath, outputPath, undefined, mode);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: 'تم عكس الألوان بنجاح!' });
      setLastFolder(folder);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-purple-50 text-purple-600 shadow-sm">
          <Contrast size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">عكس الألوان</h2>
          <p className="text-secondary mt-1">تحويل PDF إلى الوضع الليلي المقلوب الألوان.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={pdfPath}
            onChange={handleFileChange}
            label="1. اختر ملف PDF"
            placeholder="حدد مسار الملف..."
            accept=".pdf"
          />

          <div>
            <label className="block text-sm font-semibold text-primary mb-3">2. وضع العكس</label>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('full')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'full' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                عكس كامل (يدعم جميع الملفات)
              </button>
              <button
                onClick={() => setMode('smart')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'smart' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                عكس ذكي (للملفات النصية فقط)
              </button>
            </div>
          </div>

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="3. مسار الحفظ"
            placeholder="حدد مسار الحفظ..."
            accept=".pdf"
            isSave
          />
        </section>

        <section className="mt-auto pt-4 pb-2">
          {status.message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center justify-between gap-3 text-sm font-medium animate-fade-in ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
              'bg-zinc-50 text-zinc-600 border border-zinc-200'
            }`}>
              <div className="flex items-center gap-3">
                {status.type === 'success' ? <CheckCircle size={18} /> :
                  status.type === 'error' ? <AlertCircle size={18} /> :
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {status.message}
              </div>
              {status.type === 'success' && lastFolder && (
                <button onClick={() => openPath(lastFolder)} className="text-xs bg-white/50 hover:bg-white text-emerald-700 px-3 py-1.5 rounded-md transition-colors border border-emerald-200 flex items-center gap-2">
                  <FolderOpen size={14} /> فتح المجلد
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleInvert}
            disabled={loading || !pdfPath || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                بدء عكس الألوان <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
