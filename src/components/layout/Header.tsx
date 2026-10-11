import { CircleHelp, Menu, Search, Settings2, UserRound, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface HeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  activeTaskCount: number;
  onOpenTasks: () => void;
  onOpenSettings: () => void;
  onToggleNavigation: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  lifetime: 'مدى الحياة',
  yearly: 'سنوي',
  monthly: 'شهري',
  trial: 'تجريبي',
  free: 'مجاني',
};

export function Header({
  searchValue,
  onSearchChange,
  onSearchFocus,
  activeTaskCount,
  onOpenTasks,
  onOpenSettings,
  onToggleNavigation,
}: HeaderProps) {
  const { plan, status, isLoading } = useSubscription();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="workspace-topbar">
      <div className="workspace-brand">
        <button type="button" className="mobile-nav-button" onClick={onToggleNavigation} title="فتح التنقل"><Menu size={19} /></button>
        <img className="workspace-logo" src="/warraq-icon.png" alt="" />
        <strong>مَتن</strong>
        <span>Matn</span>
      </div>

      <div className="global-search">
        <Search size={17} />
        <input
          ref={searchRef}
          value={searchValue}
          onFocus={onSearchFocus}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ابحث عن أداة أو ملف أو كتاب..."
          aria-label="البحث في مَتن"
        />
        {searchValue ? (
          <button type="button" onClick={() => onSearchChange('')} title="مسح البحث"><X size={15} /></button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </div>

      <div className="topbar-actions">
        <button type="button" className={`task-count-button ${activeTaskCount > 0 ? 'active' : ''}`} onClick={onOpenTasks}>
          <i /> {activeTaskCount > 0 ? `${activeTaskCount} مهام جارية` : 'المحرك جاهز'}
        </button>
        <button type="button" className="topbar-icon-button" onClick={onOpenSettings} title="الإعدادات"><Settings2 size={18} /></button>
        <button type="button" className="topbar-icon-button" title="المساعدة"><CircleHelp size={18} /></button>
        <button type="button" className="plan-avatar" onClick={onOpenSettings} title="الخطة والحساب">
          <UserRound size={17} />
          {!isLoading && <span>{status === 'expired' ? 'منتهي' : PLAN_LABELS[plan] || 'مجاني'}</span>}
        </button>
      </div>
    </header>
  );
}
