import { useState } from 'react';
import { api } from '../../lib/api';
import { RotateCw, Trash2, Layers, ArrowRight, CheckCircle, AlertCircle, FileOutput } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { getDefaultOutputPath } from '../../lib/utils';

type Operation = 'rotate' | 'delete' | 'extract';

export const PageOperationsTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');

  // Auto-set output path based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputPath && path) {
      setOutputPath(getDefaultOutputPath(path, '_modified'));
    }
  };

  const [pages, setPages] = useState('');
  const [rotation, setRotation] = useState(90);
  const [operation, setOperation] = useState<Operation>('rotate');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleOperation = async () => {
    if (!inputPath || !outputPath || !pages) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري المعالجة...' });
    
    let res;
    if (operation === 'rotate') {
      res = await api.rotatePages(inputPath, outputPath, pages, rotation);
    } else if (operation === 'delete') {
      res = await api.deletePages(inputPath, outputPath, pages);
    } else {
      res = await api.extractPages(inputPath, outputPath, pages);
    }
    
    setLoading(false);
    
    if (res.success) {
      const messages = {
        rotate: 'تم تدوير الصفحات بنجاح!',
        delete: 'تم حذف الصفحات بنجاح!',
        extract: 'تم استخراج الصفحات بنجاح!'
      };
      setStatus({ type: 'success', message: messages[operation] });
      setInputPath('');
      setOutputPath('');
      setPages('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  const operations = [
    { id: 'rotate' as Operation, label: 'تدوير الصفحات', icon: RotateCw, color: 'text-blue-600', activeBg: 'bg-blue-50 border-blue-200 text-blue-700' },
    { id: 'delete' as Operation, label: 'حذف صفحات', icon: Trash2, color: 'text-red-600', activeBg: 'bg-red-50 border-red-200 text-red-700' },
    { id: 'extract' as Operation, label: 'استخراج صفحات', icon: FileOutput, color: 'text-green-600', activeBg: 'bg-green-50 border-green-200 text-green-700' },
  ];

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm">
          <Layers size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">عمليات الصفحات</h2>
          <p className="text-secondary mt-1">أدوات تعديل صفحات PDF (تدوير، حذف، استخراج).</p>
        </div>
      </div>

      {/* Operation Tabs */}
      <div className="flex gap-4 mb-8">
        {operations.map(op => (
          <button
            key={op.id}
            onClick={() => { setOperation(op.id); setStatus({ type: '', message: '' }); }}
            className={`flex-1 py-4 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 border ${operation === op.id ? op.activeBg + ' shadow-sm' : 'bg-white border-border text-secondary hover:bg-gray-50'
            }`}
          >
            <op.icon size={20} className={operation === op.id ? 'text-current' : op.color} />
            {op.label}
          </button>
        ))}
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
            <label className="block text-sm font-semibold text-primary mb-2.5">2. تحديد الصفحات</label>
            <input
              type="text"
              value={pages}
              onChange={e => setPages(e.target.value)}
              placeholder="مثال: 1-10 أو 1,5,10 أو odd أو even"
              className="input"
            />
            <p className="text-xs text-secondary mt-1.5 mr-1">يمكنك استخدام النطاقات (1-5) أو الفواصل (1,3,5) أو الكلمات odd (فردي) و even (زوجي).</p>
          </div>

          {operation === 'rotate' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-primary mb-2.5">3. زاوية التدوير</label>
              <div className="relative">
                <RotateCw className="absolute right-3 top-3 text-gray-400" size={18} />
                <select
                  value={rotation}
                  onChange={e => setRotation(parseInt(e.target.value))}
                  className="input !pr-12 appearance-none cursor-pointer"
                >
                  <option value={90}>90° - ربع دورة (مع عقارب الساعة)</option>
                  <option value={180}>180° - نصف دورة (قلب)</option>
                  <option value={270}>270° - ثلاثة أرباع (عكس عقارب الساعة)</option>
                </select>
              </div>
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label={`${operation === 'rotate' && '3' || '4'}. مسار الملف الناتج`}
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
            className={`btn-enhanced w-full py-4 text-lg shadow-lg transition-all disabled:opacity-50 disabled:shadow-none text-white ${operation === 'delete' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20 hover:shadow-red-500/30' :
                operation === 'extract' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20 hover:shadow-green-500/30' :
                  'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 hover:shadow-indigo-500/30'
              }`}
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                تنفيذ العملية
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
