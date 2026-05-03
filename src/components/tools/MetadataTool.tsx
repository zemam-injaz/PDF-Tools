import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { FileText, CheckCircle, AlertCircle, Save, RefreshCw, Info, Tag, User, Briefcase } from 'lucide-react';
import { FileInput } from '../ui/FileInput';

export const MetadataTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  // Load metadata when file is selected
  useEffect(() => {
    if (inputPath) {
      loadMetadata();
      // Auto-set output path
      if (!outputPath) {
        setOutputPath(inputPath.replace('.pdf', '_edited.pdf'));
      }
    }
  }, [inputPath]);

  const loadMetadata = async () => {
    setLoadingInfo(true);
    const res = await api.info(inputPath);
    setLoadingInfo(false);
    
    if (res.success && res.data?.metadata) {
       // Filter and cast metadata to string dict
       const meta: Record<string, string> = {};
       Object.entries(res.data.metadata).forEach(([k, v]) => {
         if (typeof v === 'string') meta[k] = v;
       });
       setMetadata(meta);
       setStatus({ type: '', message: '' });
    }
  };

  const handleSave = async () => {
    if (!inputPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري الحفظ...' });
    
    const res = await api.updateMetadata(inputPath, outputPath, metadata);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: '✅ تم تحديث البيانات الوصفية بنجاح!' });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء الحفظ' });
    }
  };

  const updateField = (key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const fields = [
    { key: 'title', label: 'العنوان (Title)', icon: Info },
    { key: 'author', label: 'المؤلف (Author)', icon: User },
    { key: 'subject', label: 'الموضوع (Subject)', icon: FileText },
    { key: 'keywords', label: 'الكلمات المفتاحية (Keywords)', icon: Tag },
    { key: 'creator', label: 'المنشئ (Creator)', icon: Briefcase },
    { key: 'producer', label: 'المُنتج (Producer)', icon: Briefcase },
  ];

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-violet-50 text-violet-600 shadow-sm">
          <FileText size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">تعديل الوصف</h2>
          <p className="text-secondary mt-1">تعديل البيانات الوصفية (Metadata) للملف.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={inputPath}
            onChange={setInputPath}
            label="1. ملف PDF المصدر"
            placeholder="اختر ملف PDF..."
            accept=".pdf"
            filterName="PDF Files"
          />

          {!inputPath && (
             <div className="text-center py-12 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
               <Info className="mx-auto mb-2 opacity-50" size={32} />
               <p>اختر ملفاً لعرض بياناته وتعديلها</p>
             </div>
          )}

          {inputPath && (
            <div className="bg-white border boundary-violet-100 rounded-xl p-6 shadow-sm animate-fade-in relative ring-1 ring-black/5">
              
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  البيانات الحالية
                </h3>
                <button 
                  onClick={loadMetadata}
                  disabled={loadingInfo}
                  className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  title="تحديث البيانات"
                >
                  <RefreshCw size={16} className={loadingInfo ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingInfo && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 backdrop-blur-sm rounded-xl">
                  <RefreshCw className="animate-spin text-violet-600" size={32} />
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {fields.map(field => (
                  <div key={field.key} className={field.key === 'keywords' || field.key === 'subject' || field.key === 'title' ? 'md:col-span-2' : ''}>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                      <field.icon size={14} className="text-gray-400" />
                      {field.label}
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      value={metadata[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      className="input w-full focus:ring-violet-500/20 focus:border-violet-500"
                      placeholder={`أدخل ${field.label}...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {inputPath && (
             <FileInput
               value={outputPath}
               onChange={setOutputPath}
               label="2. مسار الملف الناتج"
               placeholder="اختر مكان الحفظ..."
               accept=".pdf"
               isSave
               filterName="PDF Files"
             />
          )}
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
            onClick={handleSave}
            disabled={loading || !inputPath || !outputPath}
            className="btn btn-primary w-full py-4 text-lg shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-violet-600 hover:bg-violet-700 border-transparent focus:ring-violet-500"
          >
            {loading ? 'جاري الحفظ...' : (
              <span className="flex items-center justify-center gap-2">
                حفظ التغييرات
                <Save size={20} />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
