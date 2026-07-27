import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { FileInput } from '../ui/FileInput';
import { Hash, CheckCircle, AlertCircle, FolderOpen, ArrowRight } from 'lucide-react';

const POSITIONS = [
  { id: 'bottom-right', label: 'أسفل اليمين' },
  { id: 'bottom-left', label: 'أسفل اليسار' },
  { id: 'bottom-center', label: 'أسفل الوسط' },
  { id: 'top-right', label: 'أعلى اليمين' },
  { id: 'top-left', label: 'أعلى اليسار' },
  { id: 'top-center', label: 'أعلى الوسط' },
];

const FORMATS = [
  { id: '{n}', label: '1, 2, 3...' },
  { id: '{n} / {total}', label: '1 / 10, 2 / 10...' },
  { id: 'Page {n}', label: 'Page 1, Page 2...' },
  { id: 'صفحة {n}', label: 'صفحة 1, صفحة 2...' },
];

export const PageNumbersTool: React.FC = () => {
  const [pdfPath, setPdfPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [position, setPosition] = useState('bottom-right');
  const [format, setFormat] = useState('{n}');
  const [rtl, setRtl] = useState(false);
  const [startFrom, setStartFrom] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastFolder, setLastFolder] = useState('');

  const handleFileChange = (path: string) => {
    setPdfPath(path);
    if (!outputPath) setOutputPath(getDefaultOutputPath(path, '_numbered'));
  };

  const handleAddNumbers = async () => {
    if (!pdfPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري إضافة أرقام الصفحات...' });
    setLastFolder('');

    const folder = outputPath.substring(0, Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\')));
    const res = await api.addPageNumbers(pdfPath, outputPath, {
      position, format, rtl, start_from: startFrom, size: fontSize,
    });
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: 'تمت إضافة أرقام الصفحات بنجاح!' });
      setLastFolder(folder);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-teal-50 text-teal-600 shadow-sm">
          <Hash size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">أرقام الصفحات</h2>
          <p className="text-secondary mt-1">إضافة أرقام صفحات ورؤوس/تذييلات مع دعم العربية.</p>
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
            <label className="block text-sm font-semibold text-primary mb-3">2. الموقع</label>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPosition(p.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    position === p.id ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-3">3. تنسيق الرقم</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    format === f.id ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">البدء من رقم</label>
              <input type="number" value={startFrom} onChange={e => setStartFrom(Number(e.target.value))} className="input" min={1} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">حجم الخط</label>
              <input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="input" min={6} max={72} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">&nbsp;</label>
              <button
                onClick={() => setRtl(!rtl)}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  rtl ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {rtl ? 'عربي (RTL)' : 'إنجليزي (LTR)'}
              </button>
            </div>
          </div>

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="4. مسار الحفظ"
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
            onClick={handleAddNumbers}
            disabled={loading || !pdfPath || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-teal-600 hover:bg-teal-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                إضافة أرقام الصفحات <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
