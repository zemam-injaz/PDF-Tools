import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ArrowRight, CheckCircle, AlertCircle, LogIn, LogOut, Check, Zap, Settings, HelpCircle, FolderOpen, Lock } from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { openPath } from '../../lib/utils';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PricingPage } from '../pricing/PricingPage';
import { UpgradeButton } from '../pricing/UpgradeButton';

export const TahweelTool: React.FC = () => {
  const { checkAccess } = useSubscription();
  const [showPricing, setShowPricing] = useState(false);
  const hasAccess = checkAccess('tahweel');

  const [inputPath, setInputPath] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [removeNewlines, setRemoveNewlines] = useState(true);
  
  const [isFolderMode, setIsFolderMode] = useState(false);
  const [convertToPdf, setConvertToPdf] = useState(true);
  
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; user?: { displayName: string; emailAddress: string; photoLink?: string } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastOutputFolder, setLastOutputFolder] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    const res = await api.tahweel.getAuthStatus();
    if (res.success && res.data) {
      setAuthStatus(res.data);
    }
    setLoading(false);
  };

  const handleSignIn = async () => {
    setLoading(true);
    const res = await api.tahweel.signIn();
    if (res.success) {
      // Poll until authenticated (OAuth browser flow can take variable time)
      const maxAttempts = 60; // 60 × 1.5s = 90 seconds max
      let attempts = 0;
      const poll = async () => {
        attempts++;
        const authRes = await api.tahweel.getAuthStatus();
        if (authRes.success && authRes.data?.authenticated) {
          setAuthStatus(authRes.data);
          setLoading(false);
        } else if (attempts < maxAttempts) {
          setTimeout(poll, 1500);
        } else {
          // Timed out — stop polling, let user retry manually
          setLoading(false);
          setStatus({ type: 'error', message: 'انتهت مهلة الانتظار. يرجى المحاولة مجدداً.' });
        }
      };
      setTimeout(poll, 1500);
    } else {
      setStatus({ type: 'error', message: res.error || 'فشل تسجيل الدخول' });
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    const res = await api.tahweel.signOut();
    if (res.success) {
      setAuthStatus({ authenticated: false });
    }
    setLoading(false);
  };

  const handleInputChange = (path: string) => {
    setInputPath(path);
    if (!outputDir && path) {
      const separator = path.includes('\\') ? '\\' : '/';
      const lastSep = path.lastIndexOf(separator);
      if (lastSep > 0) {
        setOutputDir(path.substring(0, lastSep));
      }
    }
  };

  const handleConvert = async () => {
    if (!inputPath || !authStatus?.authenticated) return;
    
    setConverting(true);
    setStatus({ type: '', message: 'تم بدء عملية التحويل في الخلفية. يمكنك متابعة التقدم من لوحة المهام بالأسفل.' });
    
    // API updated to include convert_to_pdf
    const res = await api.tahweel.convert(inputPath, outputDir, removeNewlines, true, convertToPdf);
    
    setConverting(false);
    if (res.success && res.data?.task_id) {
      setStatus({ 
        type: 'success', 
        message: isFolderMode ? '🚀 تم بدء معالجة المجلد بنجاح!' : '🚀 تم بدء المهمة بنجاح! سيتم تحويل الملف عبر Google Drive وحفظه في مجلد الإخراج.' 
      });
      setLastOutputFolder(outputDir || '.');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء بدء التحويل' });
    }
  };

  if (!hasAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-orange-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">خاصية مدفوعة</h2>
          <p className="text-gray-500 mb-8">أداة Tahweel للتحويل الاحترافي متاحة في النسخة الكاملة فقط.</p>
          <UpgradeButton onClick={() => setShowPricing(true)} className="w-full justify-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-orange-50 text-orange-600 shadow-sm">
          <Zap size={28} />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-primary">Tahweel - تحويل احترافي</h2>
          <p className="text-secondary mt-1">تحويل PDF إلى Word بدقة عالية للغة العربية باستخدام تقنيات Google.</p>
        </div>
        
        {/* Folder Mode Toggle */}
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setIsFolderMode(false)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!isFolderMode ? 'bg-white shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}
          >
            ملف واحد
          </button>
          <button 
            onClick={() => setIsFolderMode(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${isFolderMode ? 'bg-white shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}
          >
            مجلد كامل
          </button>
        </div>

        {/* Auth status & logout */}
        {!loading && authStatus?.authenticated && (
          <div className="flex items-center gap-3 mr-2">
            <div className="text-left hidden md:block">
              <p className="text-[10px] font-bold text-primary">{authStatus.user?.displayName}</p>
              <p className="text-[9px] text-gray-400">{authStatus.user?.emailAddress}</p>
            </div>
            {authStatus.user?.photoLink && (
              <img src={authStatus.user.photoLink} alt="User" className="w-8 h-8 rounded-full border border-gray-200" />
            )}
            <button 
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        {!authStatus?.authenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md mb-6">
              <LogIn size={40} className="text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-primary mb-3">مطلوب تسجيل الدخول</h3>
            <p className="text-secondary max-w-md mb-8">
              هذه الأداة تعتمد على محرك التعرف الضوئي (OCR) من Google Drive لضمان أفضل دقة للنصوص العربية. يرجى تسجيل الدخول بحساب Google الخاص بك للمتابعة.
            </p>
            <button 
              onClick={handleSignIn}
              disabled={loading}
              className="btn-enhanced px-10 py-3 bg-indigo-600 text-white flex items-center gap-3"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={20} />}
              {loading ? 'جاري التحضير...' : 'تسجيل الدخول بـ Google'}
            </button>
            <p className="text-xs text-gray-400 mt-6 flex items-center gap-1">
              <HelpCircle size={12} />
              سيتم استخدام حسابك فقط لرفع الملف مؤقتاً ومعالجته ثم حذفه.
            </p>
          </div>
        ) : (
          <>
            <section className="space-y-6">
              <FileInput
                value={inputPath}
                onChange={handleInputChange}
                label={isFolderMode ? "1. اختر المجلد الذي يحتوي على ملفات PDF" : "1. اختر ملف PDF للتحويل"}
                placeholder={isFolderMode ? "اختر مجلداً..." : "اسحب الملف هنا أو اختر من الجهاز..."}
                accept={isFolderMode ? "folder" : ".pdf"}
                isDirectory={isFolderMode}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                  <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                    <Settings size={16} />
                    خيارات التحويل
                  </h3>
                  
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${removeNewlines ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={removeNewlines} 
                        onChange={() => setRemoveNewlines(!removeNewlines)} 
                      />
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${removeNewlines ? 'translate-x-6' : 'translate-x-1'}`}></div>
                    </div>
                    <span className="text-sm text-secondary group-hover:text-primary transition-colors">إزالة الأسطر الزائدة</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${convertToPdf ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={convertToPdf} 
                        onChange={() => setConvertToPdf(!convertToPdf)} 
                      />
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${convertToPdf ? 'translate-x-6' : 'translate-x-1'}`}></div>
                    </div>
                    <span className="text-sm text-secondary group-hover:text-primary transition-colors">تحويل الناتج إلى PDF أيضاً</span>
                  </label>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="block text-sm font-semibold text-primary mb-2.5">مجلد الحفظ</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={outputDir}
                      onChange={e => setOutputDir(e.target.value)}
                      placeholder="اتركه فارغاً للحفظ بجانب الملف الأصلي"
                      className="input dir-ltr text-right"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-auto pt-4 pb-2">
              {status.message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center justify-between gap-4 animate-fade-in ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-indigo-50 text-indigo-700 border border-indigo-100'
                }`}>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    {status.type === 'success' ? <CheckCircle size={20} /> :
                     status.type === 'error' ? <AlertCircle size={20} /> :
                     <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
                    {status.message}
                  </div>
                  {status.type === 'success' && lastOutputFolder && (
                    <button
                      onClick={() => openPath(lastOutputFolder)}
                      className="text-xs bg-white hover:bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg transition-colors border border-emerald-200 flex items-center gap-2 whitespace-nowrap"
                    >
                      <FolderOpen size={14} />
                      فتح المجلد
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleConvert}
                disabled={converting || !inputPath || !authStatus?.authenticated}
                className="btn-enhanced w-full py-4 text-lg bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200/50"
              >
                {converting ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التحويل...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    بدء التحويل الاحترافي (Tahweel)
                    <ArrowRight size={20} className="rtl:rotate-180" />
                  </span>
                )}
              </button>
              
              <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Check size={10} /> دعم كامل للعربية</span>
                <span className="flex items-center gap-1"><Check size={10} /> تحويل إلى Word & Text</span>
                <span className="flex items-center gap-1"><Check size={10} /> تقنية Google OCR</span>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
