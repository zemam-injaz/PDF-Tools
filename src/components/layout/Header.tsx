import { RefreshCw } from 'lucide-react';

export function Header() {
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
         <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs ring-2 ring-white">
            ME
         </div>
      </div>
    </header>
  );
}
