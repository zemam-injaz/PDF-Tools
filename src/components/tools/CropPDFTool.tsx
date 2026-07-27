import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { FileInput } from '../ui/FileInput';
import { Crop, CheckCircle, AlertCircle, FolderOpen, ArrowRight } from 'lucide-react';

export const CropPDFTool: React.FC = () => {
  const [pdfPath, setPdfPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [x0, setX0] = useState(0);
  const [y0, setY0] = useState(0);
  const [x1, setX1] = useState(612);
  const [y1, setY1] = useState(792);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastFolder, setLastFolder] = useState('');

  const handleFileChange = (path: string) => {
    setPdfPath(path);
    if (!outputPath) setOutputPath(getDefaultOutputPath(path, '_cropped'));
  };

  const handleCrop = async () => {
    if (!pdfPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري قص الصفحات...' });
    setLastFolder('');

    const folder = outputPath.substring(0, Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\')));
    const res = await api.cropPDF(pdfPath, outputPath, x0, y0, x1, y1);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: 'تم قص الملف بنجاح!' });
      setLastFolder(folder);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-blue-50 text-blue-600 shadow-sm">
          <Crop size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">قص PDF</h2>
          <p className="text-secondary mt-1">قص الصفحات إلى أبعاد مخصصة مع الحفاظ على المحتوى الأصلي.</p>
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
            <label className="block text-sm font-semibold text-primary mb-3">2. أبعاد القص (بـ pt — النقطة)</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-secondary mb-1">X0 (يسار)</label>
                <input type="number" value={x0} onChange={e => setX0(Number(e.target.value))} className="input" min={0} />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Y0 (أعلى)</label>
                <input type="number" value={y0} onChange={e => setY0(Number(e.target.value))} className="input" min={0} />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">X1 (يمين)</label>
                <input type="number" value={x1} onChange={e => setX1(Number(e.target.value))} className="input" min={0} />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Y1 (أسفل)</label>
                <input type="number" value={y1} onChange={e => setY1(Number(e.target.value))} className="input" min={0} />
              </div>
            </div>
            <p className="text-xs text-secondary mt-2">
              لأحجام A4 الافتراضي: 595×842 pt | قيم افتراضية: 0 (يسار) - 612 (يمين) - 0 (أعلى) - 792 (أسفل)
            </p>
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
            onClick={handleCrop}
            disabled={loading || !pdfPath || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                بدء القص <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
