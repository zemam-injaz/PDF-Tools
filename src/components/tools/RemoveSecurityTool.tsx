import { useState } from 'react';
import { api } from '../../lib/api';
import { Shield, Lock, Unlock, Check, X, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { getDefaultOutputPath } from '../../lib/utils';

export const RemoveSecurityTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');

  // Auto-set output path based on input file
  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputPath && path) {
      setOutputPath(getDefaultOutputPath(path, '_unlocked'));
    }
  };

  const [password, setPassword] = useState('');
  const [securityInfo, setSecurityInfo] = useState<{
    is_encrypted: boolean;
    needs_password: boolean;
    restrictions: Record<string, boolean>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const checkSecurity = async () => {
    if (!inputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري فحص الملف...' });
    
    const res = await api.checkSecurity(inputPath);
    setLoading(false);
    
    if (res.success && res.data?.data) {
      setSecurityInfo(res.data.data);
      setStatus({ type: '', message: '' });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء فحص الملف' });
    }
  };

  const removeSecurity = async () => {
    if (!inputPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري إزالة الحماية...' });
    
    const res = await api.removeSecurity(inputPath, outputPath, password || undefined);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: 'تمت إزالة الحماية بنجاح! الملف الجديد جاهز.' });
      setSecurityInfo(null);
      setInputPath('');
      setOutputPath('');
      setPassword('');
    } else {
      setStatus({ type: 'error', message: res.error || 'فشلت العملية. تأكد من كلمة المرور إذا كانت مطلوبة.' });
    }
  };

  const restrictionLabels: Record<string, string> = {
    printing: 'الطباعة',
    copying: 'النسخ',
    editing: 'التحرير',
    annotations: 'التعليقات'
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-orange-50 text-orange-600 shadow-sm">
          <Shield size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">إزالة الحماية</h2>
          <p className="text-secondary mt-1">فك تشفير ملفات PDF وإزالة كلمات المرور وقيود الاستخدام.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <FileInput
                value={inputPath}
                onChange={(path) => { handleInputChange(path); setSecurityInfo(null); }}
                label="1. ملف PDF المحمي"
                placeholder="اختر ملف PDF..."
                accept=".pdf"
              />
            </div>
            <button
              onClick={checkSecurity}
              disabled={loading || !inputPath}
              className="btn btn-secondary h-[50px] px-6 border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 hover:border-orange-200 text-orange-700 font-semibold mb-[2px]"
            >
              فحص أمني
            </button>
          </div>

          {securityInfo && (
            <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm animate-fade-in">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                {securityInfo.is_encrypted ? (
                  <div className="flex items-center gap-2 p-2 px-3 bg-red-50 text-red-700 rounded-lg text-sm font-semibold">
                    <Lock size={16} /> <span>ملف مشفر (محمي)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 px-3 bg-green-50 text-green-700 rounded-lg text-sm font-semibold">
                    <Unlock size={16} /> <span>ملف غير محمي</span>
                  </div>
                )}
                <div className="text-sm text-secondary flex-1 text-left">
                  {securityInfo.needs_password ? '🔐 يتطلب كلمة مرور للفتح' : '🔓 لا يتطلب كلمة مرور للفتح'}
                </div>
              </div>

              {securityInfo.is_encrypted && (
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-primary block">حالة القيود الحالية:</span>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(securityInfo.restrictions).map(([key, allowed]) => (
                      <div key={key} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${allowed ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                        {allowed ? <Check size={16} className="text-green-600" /> : <X size={16} className="text-red-500" />}
                        <span className={allowed ? 'text-green-800' : 'text-red-800'}>{restrictionLabels[key] || key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {securityInfo?.needs_password && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-primary mb-2.5">كلمة مرور المالك (Owner Password)</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور لفك التشفير..."
                  className="input pl-10"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
              <p className="text-xs text-secondary mt-1.5 mr-1">إذا كان الملف يتطلب كلمة مرور للفتح، يجب إدخالها هنا.</p>
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="2. مسار الملف الناتج (مفكوك الحماية)"
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
            onClick={removeSecurity}
            disabled={loading || !inputPath || !outputPath || (securityInfo?.needs_password && !password)}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-orange-600 hover:bg-orange-700 border-transparent focus:ring-orange-500"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                إزالة الحماية وفك التشفير
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
