import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { FileInput } from '../ui/FileInput';
import { Layers, CheckCircle, AlertCircle, FolderOpen, ArrowRight } from 'lucide-react';

const ANNOTATION_TYPES = [
  { id: 'Highlight', label: 'تمييز' },
  { id: 'Underline', label: 'تسطير' },
  { id: 'StrikeOut', label: 'شطب' },
  { id: 'Squiggly', label: 'متعرج' },
  { id: 'Text', label: 'نص' },
  { id: 'Stamp', label: 'ختم' },
  { id: 'Ink', label: 'رسم' },
  { id: 'Link', label: 'رابط' },
];

type Mode = 'flatten' | 'remove' | 'both';

export const CleanPDFTool: React.FC = () => {
  const [pdfPath, setPdfPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [mode, setMode] = useState<Mode>('both');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastFolder, setLastFolder] = useState('');

  const handleFileChange = (path: string) => {
    setPdfPath(path);
    if (!outputPath) setOutputPath(getDefaultOutputPath(path, '_cleaned'));
  };

  const toggleType = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    );
  };

  const handleProcess = async () => {
    if (!pdfPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري المعالجة...' });
    setLastFolder('');

    const folder = outputPath.substring(0, Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\')));

    try {
      if (mode === 'flatten' || mode === 'both') {
        const res = await api.flattenPDF(pdfPath, outputPath);
        if (!res.success) throw new Error(res.error);
      }
      if (mode === 'remove' || mode === 'both') {
        const res = await api.removeAnnotations(pdfPath, mode === 'remove' ? outputPath : outputPath, selectedTypes.length > 0 ? selectedTypes : undefined);
        if (!res.success) throw new Error(res.error);
      }
      setStatus({ type: 'success', message: 'تم تنظيف الملف بنجاح!' });
      setLastFolder(folder);
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message || 'حدث خطأ' });
    }
    setLoading(false);
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600 shadow-sm">
          <Layers size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">تنظيف PDF</h2>
          <p className="text-secondary mt-1">إزالة التعليقات التوضيحية أو دمجها بشكل دائم.</p>
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
            <label className="block text-sm font-semibold text-primary mb-3">2. وضع المعالجة</label>
            <div className="flex gap-3">
              {([{ id: 'flatten', label: 'دمج (Flatten)' }, { id: 'remove', label: 'إزالة' }, { id: 'both', label: 'كليهما' }] as { id: Mode; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === opt.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {mode !== 'flatten' && (
            <div>
              <label className="block text-sm font-semibold text-primary mb-3">3. أنواع التعليقات للإزالة (اختياري)</label>
              <div className="flex flex-wrap gap-2">
                {ANNOTATION_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleType(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedTypes.includes(t.id)
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {selectedTypes.length === 0 && <p className="text-xs text-secondary mt-2">سيتم إزالة جميع الأنواع إذا لم يتم التحديد.</p>}
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label={mode === 'both' ? '4. مسار الحفظ' : '3. مسار الحفظ'}
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
            onClick={handleProcess}
            disabled={loading || !pdfPath || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                بدء التنظيف <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
