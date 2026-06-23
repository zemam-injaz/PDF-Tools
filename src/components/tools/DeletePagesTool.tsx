import { useState } from 'react';
import { api } from '../../lib/api';
import { Trash2, LayoutGrid, ArrowRight, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { VisualPageSelector } from '../ui/VisualPageSelector';
import { getDefaultOutputPath } from '../../lib/utils';

export const DeletePagesTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [pages, setPages] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [showVisualSelector, setShowVisualSelector] = useState(false);

  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputPath && path) {
      setOutputPath(getDefaultOutputPath(path, '_deleted'));
    }
  };

  const handleOperation = async () => {
    if (!inputPath || !outputPath || !pages) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري المعالجة...' });
    
    const res = await api.deletePages(inputPath, outputPath, pages);
    
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: 'تم حذف الصفحات بنجاح!' });
      setInputPath('');
      setOutputPath('');
      setPages('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  const handleVisualConfirm = (pagesStr: string) => {
    setPages(pagesStr);
    setShowVisualSelector(false);
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in relative z-0">
      {showVisualSelector && (
        <VisualPageSelector 
          inputPath={inputPath}
          onConfirm={handleVisualConfirm}
          onClose={() => setShowVisualSelector(false)}
          title="تحديد الصفحات للحذف"
          confirmLabel="تأكيد صفحات الحذف"
        />
      )}

      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-red-50 text-red-600 shadow-sm">
          <Trash2 size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">حذف صفحات</h2>
          <p className="text-secondary mt-1">حذف صفحات معينة من ملف PDF الخاص بك.</p>
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

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-sm font-semibold text-primary">2. تحديد الصفحات للحذف</label>
              {inputPath && (
                <button 
                  onClick={() => setShowVisualSelector(true)}
                  className="text-red-600 hover:text-red-700 flex items-center gap-2 text-sm font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                >
                  <LayoutGrid size={16} /> وضع التحديد المرئي
                  <Sparkles size={14} className="text-amber-500" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={pages}
              onChange={e => setPages(e.target.value)}
              placeholder="مثال: 1-10 أو 1,5,10 أو odd أو even"
              className="input border-red-100 focus:border-red-500 focus:ring-red-500"
            />
            <p className="text-xs text-secondary mt-1.5 mr-1">يمكنك استخدام النطاقات (1-5) أو الفواصل (1,3,5) أو الكلمات odd (فردي) و even (زوجي).</p>
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
            onClick={handleOperation}
            disabled={loading || !inputPath || !outputPath || !pages}
            className="btn-enhanced w-full py-4 text-lg shadow-lg transition-all disabled:opacity-50 disabled:shadow-none text-white bg-red-600 hover:bg-red-700 shadow-red-500/20 hover:shadow-red-500/30"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                حذف الصفحات
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
