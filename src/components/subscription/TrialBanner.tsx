import { useSubscription } from '../../contexts/SubscriptionContext';
import { Sparkles } from 'lucide-react';

export const TrialBanner = () => {
  const { plan, daysRemaining, isLoading } = useSubscription();

  if (isLoading || plan !== 'trial' || daysRemaining === null) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-yellow-300" />
          <span className="font-medium text-sm">
            أنت تستمتع بالفترة المجانية الكاملة.
            <span className="mx-1 font-bold text-yellow-300">{daysRemaining} أيام</span>
            متبقية.
          </span>
        </div>
        <button className="text-xs bg-white text-indigo-600 px-3 py-1 rounded-full font-bold hover:bg-indigo-50 transition-colors">
          ترقية الآن (خصم 40%)
        </button>
      </div>
    </div>
  );
};
