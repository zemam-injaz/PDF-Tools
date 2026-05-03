import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { api } from '../../lib/api';

export const PricingPage = ({ onClose }: { onClose?: () => void }) => {
  const plans = [
    {
      id: 'monthly',
      name: 'شهري',
      price: '49 ج.م',
      period: '/ شهر',
      features: ['جميع أدوات PDF', 'قراءة سريعة', 'مساحة تخزين سحابية', 'بدون إعلانات'],
      recommended: false
    },
    {
      id: 'yearly',
      name: 'سنوي',
      price: '299 ج.م',
      period: '/ سنة',
      features: ['جميع أدوات PDF', 'قراءة سريعة', 'مساحة تخزين سحابية', 'بدون إعلانات', 'خصم 40%'],
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

  const handleSubscribe = async (planId: string, price: string) => {
    if (!userId) return;
    setLoadingPlan(planId);
    
    // Parse amount (remove currency string)
    // Assumes format like "49 ج.م"
    const amount = parseFloat(price.replace(/[^0-9.]/g, ''));

    try {
        const res = await api.payment.checkout(userId, planId, amount);
        if (res.success && res.data) {
            // Open payment URL
            // In a real app we might redirect or open modal
            // Here we check if it is our mock gateway
            const url = res.data.data.payment_url;
            
            // Open in new window
            const paymentWindow = window.open(url, '_blank', 'width=600,height=800');
            
            // Poll for closure? Or simple timeout?
            // In a real integration, we'd listen for a success URL redirect.
            // For now, let's just close the pricing modal and maybe show "Processing..."
            if (paymentWindow) {
                 const timer = setInterval(() => {
                    if (paymentWindow.closed) {
                        clearInterval(timer);
                        refreshSubscription(); // Refresh to check if active
                        if (onClose) onClose();
                    }
                 }, 1000);
            }
        } else {
            alert('فشل في إنشاء رابط الدفع: ' + res.error);
        }
    } catch (e) {
        console.error(e);
        alert('حدث خطأ غير متوقع');
    } finally {
        setLoadingPlan(null);
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
          <p className="text-gray-500 max-w-2xl mx-auto mb-8">
            استمتع بتجربة كاملة مع أدوات احترافية لتحسين سرعة القراءة وإدارة ملفات PDF.
          </p>

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
                  onClick={() => handleSubscribe(plan.id, plan.price)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-3 px-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  plan.recommended
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-50'
                }`}>
                  {loadingPlan === plan.id ? <Loader2 className="animate-spin" size={20} /> : 'اشترك الآن'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
