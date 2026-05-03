import { useState } from 'react';
import { api } from '../../lib/api';
import { Stamp, Plus, X, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { getDefaultOutputPath } from '../../lib/utils';

export const WatermarkTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');

  // Auto-set output path based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputPath && path) {
      setOutputPath(getDefaultOutputPath(path, mode === 'add' ? '_watermarked' : '_cleaned'));
    }
  };

  const [text, setText] = useState('');
  const [position, setPosition] = useState('center');
  const [opacity, setOpacity] = useState(50);
  const [fontSize, setFontSize] = useState(50);
  const [color, setColor] = useState('#808080');
  const [rotation, setRotation] = useState(45);
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleAction = async () => {
    if (!inputPath || !outputPath) return;
    if (mode === 'add' && !text) return;
    
    setLoading(true);
    setStatus({ type: '', message: 'جاري المعالجة...' });
    
    let res;
    if (mode === 'add') {
      res = await api.addTextWatermark(inputPath, outputPath, text, {
        position, opacity: opacity / 100, fontSize, color, rotation
      });
    } else {
      res = await api.removeWatermark(inputPath, outputPath, false);
    }
    
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: mode === 'add' ? 'تمت إضافة العلامة المائية!' : 'تمت إزالة العلامة المائية!' });
      setInputPath('');
      setOutputPath('');
      setText('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  const positions = [
    { value: 'center', label: 'الوسط' },
    { value: 'top-left', label: 'أعلى اليسار' },
    { value: 'top-right', label: 'أعلى اليمين' },
    { value: 'bottom-left', label: 'أسفل اليسار' },
    { value: 'bottom-right', label: 'أسفل اليمين' },
  ];

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-rose-50 text-rose-600 shadow-sm">
          <Stamp size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">العلامة المائية</h2>
          <p className="text-secondary mt-1">إضافة علامة مائية نصية أو إزالتها من صفحات PDF.</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => { setMode('add'); setStatus({ type: '', message: '' }); }}
          className={`flex-1 py-4 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 border ${mode === 'add' ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm' : 'bg-white border-border text-secondary hover:bg-gray-50'
          }`}
        >
          <Plus size={20} className={mode === 'add' ? 'text-current' : 'text-rose-500'} /> إضافة علامة
        </button>
        <button
          onClick={() => { setMode('remove'); setStatus({ type: '', message: '' }); }}
          className={`flex-1 py-4 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 border ${mode === 'remove' ? 'bg-gray-100 border-gray-300 text-gray-800 shadow-sm' : 'bg-white border-border text-secondary hover:bg-gray-50'
          }`}
        >
          <X size={20} className={mode === 'remove' ? 'text-current' : 'text-gray-500'} /> إزالة علامة
        </button>
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

          {mode === 'add' && (
            <div className="bg-gray-50/50 p-6 rounded-xl border border-border/50 space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2.5">نص العلامة المائية</label>
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="مثال: سري للغاية - CONFIDENTIAL"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2.5">الموضع</label>
                  <select value={position} onChange={e => setPosition(e.target.value)} className="input appearance-none">
                    {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2.5">الشفافية: {opacity}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={opacity}
                    onChange={e => setOpacity(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2.5">حجم الخط</label>
                  <input type="number" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="input text-center" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2.5">اللون</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-full rounded-md cursor-pointer border border-border" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2.5">التدوير</label>
                  <input type="number" value={rotation} onChange={e => setRotation(parseInt(e.target.value))} className="input text-center" />
                </div>
              </div>
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label={mode === 'add' ? "3. مسار الملف الناتج" : "2. مسار الملف الناتج"}
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
            onClick={handleAction}
            disabled={loading || !inputPath || !outputPath || (mode === 'add' && !text)}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-rose-600 hover:bg-rose-700 border-transparent focus:ring-rose-500"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                {mode === 'add' ? 'إضافة العلامة المائية' : 'إزالة العلامة المائية'}
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
