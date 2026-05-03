import { useState } from 'react';
import { api } from '../../lib/api';
import { Image as ImageIcon, ArrowRight, CheckCircle, AlertCircle, Settings, Monitor, Printer } from 'lucide-react';
import { FileInput } from '../ui/FileInput';

export const PDFToImagesTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [dpi, setDpi] = useState(150);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleConvert = async () => {
    if (!inputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري التحويل...' });
    
    // Default output dir to same as input if not specified
    let finalOutputDir = outputDir;
    if (!finalOutputDir) {
      const lastSlash = Math.max(inputPath.lastIndexOf('/'), inputPath.lastIndexOf('\\'));
      finalOutputDir = lastSlash > 0 ? inputPath.substring(0, lastSlash) : '.';
    }

    const res = await api.convertToImages(inputPath, finalOutputDir, format, dpi);
    setLoading(false);
    
    if (res.success && res.data?.files) {
      setStatus({ type: 'success', message: `✅ تم تحويل ${res.data.files.length} صفحة بنجاح!` });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء التحويل' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-orange-50 text-orange-600 shadow-sm">
          <ImageIcon size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">PDF إلى صور</h2>
          <p className="text-secondary mt-1">تحويل صفحات PDF إلى صور عالية الجودة (PNG, JPG).</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={inputPath}
            onChange={setInputPath}
            label="1. ملف PDF المصدر"
            placeholder="اختر ملف PDF..."
            accept=".pdf"
            filterName="PDF Files"
          />

          <div className="bg-white border boundary-orange-100 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-primary font-semibold border-b border-gray-100 pb-3 mb-2">
              <Settings size={18} className="text-orange-500" />
              <h3>إعدادات التحويل</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-semibold text-primary mb-3">صيغة الصور</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormat('png')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      format === 'png' 
                        ? 'border-orange-500 bg-orange-50 text-orange-700' 
                        : 'border-gray-100 hover:border-orange-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-lg">PNG</div>
                    <div className="text-[10px] opacity-70">جودة عالية (شفافية)</div>
                  </button>
                  <button
                    onClick={() => setFormat('jpg')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      format === 'jpg' 
                        ? 'border-orange-500 bg-orange-50 text-orange-700' 
                        : 'border-gray-100 hover:border-orange-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-lg">JPG</div>
                    <div className="text-[10px] opacity-70">حجم أصغر</div>
                  </button>
                </div>
              </div>

              {/* DPI Selection */}
              <div>
                <label className="block text-sm font-semibold text-primary mb-3">الدقة (DPI): <span className="text-orange-600 font-bold">{dpi}</span></label>
                <div className="px-1">
                    <input
                      type="range"
                      min="72"
                      max="300"
                      step="1"
                      value={dpi}
                      onChange={e => setDpi(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>
                <div className="flex justify-between mt-3 gap-2">
                   <button onClick={() => setDpi(72)} className="text-xs flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-100 text-gray-500">
                     <Monitor size={12} />
                     شاشة (72)
                   </button>
                   <button onClick={() => setDpi(150)} className="text-xs flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-100 text-gray-500 font-medium">
                     متوسط (150)
                   </button>
                   <button onClick={() => setDpi(300)} className="text-xs flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-100 text-gray-500">
                     <Printer size={12} />
                     طباعة (300)
                   </button>
                </div>
              </div>
            </div>
          </div>

          <FileInput
            value={outputDir}
            onChange={setOutputDir}
            label="3. مجلد الحفظ (اختياري)"
            placeholder="اتركه فارغًا للحفظ بجانب الملف الأصلي"
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
            onClick={handleConvert}
            disabled={loading || !inputPath}
            className="btn btn-primary w-full py-4 text-lg shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-orange-600 hover:bg-orange-700 border-transparent focus:ring-orange-500"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                تحويل إلى صور
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
