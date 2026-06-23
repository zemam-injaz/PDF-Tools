import { RefreshCw } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';

const PLAN_CONFIG: Record<string, { label: string; initials: string; ring: string; badge: string }> = {
  lifetime: { label: 'مدى الحياة', initials: '∞', ring: 'ring-yellow-400', badge: 'bg-yellow-100 text-yellow-800' },
  yearly:   { label: 'سنوي',       initials: 'Y',  ring: 'ring-indigo-500', badge: 'bg-indigo-100 text-indigo-800' },
  monthly:  { label: 'شهري',       initials: 'M',  ring: 'ring-indigo-400', badge: 'bg-indigo-100 text-indigo-800' },
  trial:    { label: 'تجريبي',     initials: 'T',  ring: 'ring-emerald-400', badge: 'bg-emerald-100 text-emerald-800' },
  free:     { label: 'مجاني',      initials: 'F',  ring: 'ring-gray-300',   badge: 'bg-gray-100 text-gray-600' },
};

export function Header() {
  const { plan, status, daysRemaining, isLoading } = useSubscription();
  const cfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;
  const isExpired = status === 'expired';

  return (
    <header className="h-16 px-8 flex items-center justify-between bg-[var(--bg-app)] z-10 shrink-0">
      <div className="flex items-center gap-4 text-[var(--text-secondary)]">
         <span className="text-sm font-medium">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
         </span>
      </div>
      <div className="flex items-center gap-3">
         <button title="Refresh" className="p-2 rounded-full hover:bg-white transition-colors text-[var(--text-secondary)]">
           <RefreshCw className="w-5 h-5" />
         </button>

         {/* Subscription status badge */}
         {!isLoading && (
           <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : cfg.badge}`}>
             {isExpired ? 'منتهي' : cfg.label}
             {plan === 'trial' && daysRemaining !== null ? ` · ${daysRemaining}ي` : ''}
           </span>
         )}

         {/* Avatar */}
         <div className={`w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white ${!isLoading ? cfg.ring : 'ring-gray-200'} transition-all`}>
            {isLoading ? '…' : cfg.initials}
         </div>
      </div>
    </header>
  );
}
