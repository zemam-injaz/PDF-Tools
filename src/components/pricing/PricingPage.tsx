import { useState } from 'react';
import { Check, Loader2, ExternalLink, XCircle, Key } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { api } from '../../lib/api';

export const PricingPage = ({ onClose }: { onClose?: () => void }) => {
  const plans = [
    {
      id: 'monthly',
      name: 'شهري',
      price: '49 ج.م',
      period: '/ شهر',
      features: ['جميع أدوات PDF', 'قراءة سريعة', 'بدون إعلانات'],
      recommended: false
    },
    {
      id: 'annual',
      name: 'سنوي',
      price: '299 ج.م',
      period: '/ سنة',
      features: ['جميع أدوات PDF', 'قراءة سريعة', 'بدون إعلانات', 'خصم 40%'],
      recommended: true
    },
    {
      id: 'lifetime',
      name: 'مدى الحياة',
      price: '899 ج.م',
      period: 'مرة واحدة',
      features: ['جميع المزايا السابقة', 'تحديثات مجانية للأبد', 'دعم فني ذو أولوية'],
      recommended: false
    }
  ];

  const { userId, refreshSubscription } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [activationPlan, setActivationPlan] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseEmail, setLicenseEmail] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');

  const handleSubscribe = async (planId: string) => {
    if (!userId) return;
    setLoadingPlan(planId);
    setActivationError('');
    try {
      const res = await api.payment.gumroad.start(userId, planId);
      setLoadingPlan(null);
      if (res.success && res.data) {
        window.open(res.data.data.payment_url, '_blank', 'width=900,height=700');
        setActivationPlan(planId);
      } else {
        alert('تعذر فتح صفحة الدفع: ' + res.error);
      }
    } catch (e) {
      setLoadingPlan(null);
      console.error(e);
      alert('حدث خطأ غير متوقع');
    }
  };

  const handleActivate = async () => {
    if (!userId || !activationPlan || !licenseKey.trim()) return;
    setActivating(true);
    setActivationError('');
    try {
      const res = await api.payment.gumroad.activate(
        userId,
        licenseKey.trim(),
        activationPlan,
        licenseEmail.trim() || undefined,
      );
      if (res.success && res.data?.data?.activated) {
        setActivationPlan(null);
        setLicenseKey('');
        setLicenseEmail('');
        await refreshSubscription();
        alert('تم تفعيل اشتراكك بنجاح 🎉');
        if (onClose) onClose();
      } else {
        setActivationError(res.error || 'فشل التفعيل');
      }
    } catch (e) {
      console.error(e);
      setActivationError('حدث خطأ غير متوقع');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 text-center relative">
          {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              ✕
            </button>
          )}
          <h2 className="text-3xl font-bold text-gray-900 mb-4">اختر خطتك المناسبة</h2>
          <p className="text-gray-500 max-w-2xl mx-auto mb-2">
            الدفع يتم عبر <span className="font-bold text-indigo-600">Gumroad</span>. بعد الشراء، أدخل رمز الترخيص (License Key) لتفعيل اشتراكك.
          </p>
          <p className="text-xs text-gray-400 max-w-xl mx-auto mb-6">
            تظهر العملة النهائية والضرائب وشروط المنتج في صفحة الدفع على Gumroad قبل إتمام الشراء.
          </p>

          {!activationPlan && (
            <div className="mb-6">
              <button
                onClick={() => setActivationPlan('annual')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <Key size={16} />
                لديك رمز ترخيص بالفعل؟ ادخله هنا لتفعيل الاشتراك
              </button>
            </div>
          )}

          {activationPlan && (
            <div className="max-w-xl mx-auto mb-8 bg-gray-50 border border-indigo-100 rounded-2xl p-6 text-right animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <ExternalLink size={18} className="text-indigo-500" />
                  تفعيل الاشتراك
                </h3>
                <button onClick={() => setActivationPlan(null)} className="text-gray-400 hover:text-gray-600" title="إلغاء">
                  <XCircle size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                اكتمل الشراء؟ افتح رسالة Gumroad التي وصلت لبريدك، انسخ <span className="font-bold text-gray-700">License Key</span> وألصقه هنا.
              </p>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="License Key"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono text-sm mb-3"
                dir="ltr"
              />
              <input
                type="text"
                value={licenseEmail}
                onChange={(e) => setLicenseEmail(e.target.value)}
                placeholder="بريد الشراء على Gumroad (اختياري)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm mb-4"
                dir="ltr"
              />
              {activationError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                  {activationError}
                </p>
              )}
              <button
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activating ? <Loader2 className="animate-spin" size={20} /> : null}
                {activating ? 'جارٍ التحقق من الشراء...' : 'تفعيل الاشتراك'}
              </button>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div 
                key={plan.id}
                className={`transform transition-all duration-200 hover:scale-105 rounded-xl border-2 p-6 flex flex-col ${
                  plan.recommended 
                    ? 'border-indigo-600 bg-indigo-50 shadow-xl scale-105' 
                    : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
              >
                {plan.recommended && (
                  <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full self-center mb-4">
                    الأكثر طلباً
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1 text-right">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={16} className="text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan !== null || activationPlan !== null}
                  className={`w-full py-3 px-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  plan.recommended
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-50'
                }`}>
                  {loadingPlan === plan.id ? <Loader2 className="animate-spin" size={20} /> : 'اشترِ عبر Gumroad'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
