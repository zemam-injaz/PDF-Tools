import {
  BookOpen,
  CheckCircle2,
  Grid2X2,
  Home,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';

export type { Tool } from '../../lib/toolCatalog';

export type WorkspaceView = 'home' | 'tools' | 'library' | 'tasks' | 'settings' | 'tool' | 'privacy' | 'terms';

interface SidebarProps {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const navigation = [
  { id: 'home' as const, label: 'الرئيسية', icon: Home },
  { id: 'tools' as const, label: 'دليل الأدوات', icon: Grid2X2 },
  { id: 'library' as const, label: 'المكتبة والقراءة', icon: BookOpen },
  { id: 'tasks' as const, label: 'سجل المهام', icon: CheckCircle2 },
];

export function Sidebar({ activeView, onNavigate, isCollapsed, setIsCollapsed, isMobileOpen, onCloseMobile }: SidebarProps) {
  const navigate = (view: WorkspaceView) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && <button type="button" className="mobile-sidebar-backdrop" onClick={onCloseMobile} aria-label="إغلاق التنقل" />}
      <aside className={`workspace-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div>
          <div className="sidebar-context">
            {!isCollapsed && <><strong>مساحة العمل المحلية</strong><span>إصدار سطح المكتب</span></>}
            <button type="button" className="mobile-sidebar-close" onClick={onCloseMobile} title="إغلاق"><X size={18} /></button>
          </div>
          <nav className="primary-navigation" aria-label="التنقل الرئيسي">
            {navigation.map((item) => (
              <button
                key={item.id}
                type="button"
                title={isCollapsed ? item.label : undefined}
                className={activeView === item.id || (item.id === 'tools' && activeView === 'tool') ? 'active' : ''}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={19} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-settings ${activeView === 'settings' || activeView === 'privacy' || activeView === 'terms' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
            title={isCollapsed ? 'الخطة والإعدادات' : undefined}
          >
            <Settings size={19} />
            {!isCollapsed && <span>الخطة والإعدادات</span>}
          </button>
          {!isCollapsed && (
            <div className="sidebar-privacy-note">
              <ShieldCheck size={17} />
              <div><strong>خصوصية محلية</strong><span>المعالجة الأساسية داخل جهازك</span></div>
            </div>
          )}
          <div className="sidebar-version">
            {!isCollapsed && <><span>Tauri Desktop</span><code>v0.1.0</code></>}
            <button type="button" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}><Menu size={17} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
