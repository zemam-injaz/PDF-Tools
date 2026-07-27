import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { FileInput } from '../ui/FileInput';
import { EyeOff, CheckCircle, AlertCircle, FolderOpen, ArrowRight, Plus, Trash2 } from 'lucide-react';

interface RectInput {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const RedactPDFTool: React.FC = () => {
  const [pdfPath, setPdfPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [searchTerms, setSearchTerms] = useState('');
  const [rects, setRects] = useState<RectInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastFolder, setLastFolder] = useState('');

  const handleFileChange = (path: string) => {
    setPdfPath(path);
    if (!outputPath) setOutputPath(getDefaultOutputPath(path, '_redacted'));
  };

  const addRect = () => {
    setRects([...rects, { page: 1, x0: 100, y0: 100, x1: 300, y1: 150 }]);
  };

  const updateRect = (index: number, field: keyof RectInput, value: number) => {
    const updated = rects.map((r, i) => i === index ? { ...r, [field]: value } : r);
    setRects(updated);
  };

  const removeRect = (index: number) => {
    setRects(rects.filter((_, i) => i !== index));
  };

  const handleRedact = async () => {
    if (!pdfPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري التعتيم...' });
    setLastFolder('');

    const folder = outputPath.substring(0, Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\')));
    const options: any = {};

    if (mode === 'search' && searchTerms.trim()) {
      options.search_terms = searchTerms.split(',').map(t => t.trim()).filter(Boolean);
    }

    if (mode === 'manual' && rects.length > 0) {
      options.manual_rects = rects.map(r => ({
        page: r.page - 1,
        x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1,
      }));
    }

    const res = await api.redactPDF(pdfPath, outputPath, options);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: 'تم التعتيم بنجاح!' });
      setLastFolder(folder);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-red-50 text-red-600 shadow-sm">
          <EyeOff size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">تعتيم PDF</h2>
          <p className="text-secondary mt-1">إخفاء المعلومات الحساسة بشكل دائم — لا يمكن التراجع.</p>
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
            <label className="block text-sm font-semibold text-primary mb-3">2. وضع التعتيم</label>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('search')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'search' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                بحث وتعتيم
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'manual' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                تعتيم يدوي
              </button>
            </div>
          </div>

          {mode === 'search' ? (
            <div>
              <label className="block text-sm font-semibold text-primary mb-2.5">3. كلمات البحث (مفصولة بفواصل)</label>
              <textarea
                value={searchTerms}
                onChange={e => setSearchTerms(e.target.value)}
                placeholder="كلمة1, كلمة2, كلمة3"
                className="input min-h-[80px] resize-y"
                dir="auto"
              />
              <p className="text-xs text-secondary mt-1.5">يدعم النصوص العربية والإنجليزية. استخدم الفاصلة للفصل بين الكلمات.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-primary">3. المستطيلات اليدوية</label>
                <button onClick={addRect} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium">
                  <Plus size={14} /> إضافة مستطيل
                </button>
              </div>
              <div className="space-y-3">
                {rects.map((rect, i) => (
                  <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">مستطيل #{i + 1}</span>
                      <button onClick={() => removeRect(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div><label className="text-[10px] text-gray-500">الصفحة</label><input type="number" value={rect.page} onChange={e => updateRect(i, 'page', Number(e.target.value))} className="input text-xs" min={1} /></div>
                      <div><label className="text-[10px] text-gray-500">X0</label><input type="number" value={rect.x0} onChange={e => updateRect(i, 'x0', Number(e.target.value))} className="input text-xs" /></div>
                      <div><label className="text-[10px] text-gray-500">Y0</label><input type="number" value={rect.y0} onChange={e => updateRect(i, 'y0', Number(e.target.value))} className="input text-xs" /></div>
                      <div><label className="text-[10px] text-gray-500">X1</label><input type="number" value={rect.x1} onChange={e => updateRect(i, 'x1', Number(e.target.value))} className="input text-xs" /></div>
                    </div>
                    <div className="mt-1"><label className="text-[10px] text-gray-500">Y1</label><input type="number" value={rect.y1} onChange={e => updateRect(i, 'y1', Number(e.target.value))} className="input text-xs" /></div>
                  </div>
                ))}
                {rects.length === 0 && <p className="text-xs text-secondary">لم تتم إضافة أي مستطيلات بعد. انقر فوق "إضافة مستطيل".</p>}
              </div>
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="4. مسار الحفظ"
            placeholder="حدد مسار الحفظ..."
            accept=".pdf"
            isSave
          />

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">تحذير: التعتيم دائم ولا يمكن التراجع عنه</p>
                <p className="text-xs text-amber-700 mt-1">الملف الأصلي لن يتغير. قم بتنزيل النسخة المعتمة. يُرجى الاحتفاظ بنسخة احتياطية.</p>
              </div>
            </div>
          </div>
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
            onClick={handleRedact}
            disabled={
              loading || !pdfPath || !outputPath ||
              (mode === 'search' && !searchTerms.trim()) ||
              (mode === 'manual' && rects.length === 0)
            }
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                بدء التعتيم <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
