import React from 'react';
import { 
  FileText, Menu, LayoutDashboard, Files, Split, Minimize2, Image, 
  Type, BookOpen, Layers, Stamp, Shield, Library, MessageSquare, 
  BarChart3, Zap 
} from 'lucide-react';

export type Tool = 'merge' | 'split' | 'compress' | 'extract' | 'text' | 'bookmark' | 'pages' | 'watermark' | 'security' | 'library' | 'comments' | 'chapter-weight' | 'reading-speed' | 'images-to-pdf' | 'pdf-to-images' | 'metadata' | null;

interface SidebarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

interface NavItem {
    id: Tool;
    label: string;
    icon: React.ElementType;
    section?: 'main' | 'reading';
}
  
const navItems: NavItem[] = [
    { id: null, label: 'نظرة عامة', icon: LayoutDashboard, section: 'main' },
  // Reading & Library Section
  { id: 'library', label: 'مكتبة الكتب', icon: Library, section: 'reading' },
  { id: 'bookmark', label: 'إدارة الفهرس', icon: BookOpen, section: 'reading' },
  { id: 'comments', label: 'التعليقات', icon: MessageSquare, section: 'reading' },
  { id: 'chapter-weight', label: 'وزن الفصول', icon: BarChart3, section: 'reading' },
  { id: 'reading-speed', label: 'سرعة القراءة', icon: Zap, section: 'reading' },
    // PDF Tools Section
    { id: 'merge', label: 'دمج ملفات', icon: Files, section: 'main' },
    { id: 'split', label: 'تقسيم ملف', icon: Split, section: 'main' },
    { id: 'compress', label: 'ضغط ملف', icon: Minimize2, section: 'main' },
    { id: 'extract', label: 'استخراج الصور', icon: Image, section: 'main' },
  { id: 'text', label: 'استخراج النص', icon: Type, section: 'main' },
    { id: 'pages', label: 'عمليات الصفحات', icon: Layers, section: 'main' },
    { id: 'watermark', label: 'علامة مائية', icon: Stamp, section: 'main' },
    { id: 'security', label: 'إزالة الحماية', icon: Shield, section: 'main' },
  { id: 'images-to-pdf', label: 'صور إلى PDF', icon: Image, section: 'main' },
  { id: 'pdf-to-images', label: 'PDF إلى صور', icon: Image, section: 'main' },
  { id: 'metadata', label: 'تعديل الوصف', icon: FileText, section: 'main' },
];

export function Sidebar({ activeTool, setActiveTool, isCollapsed, setIsCollapsed }: SidebarProps) {
    const mainNavItems = navItems.filter(item => item.section === 'main');
    const readingNavItems = navItems.filter(item => item.section === 'reading');

  return (
    <aside className={`bg-[var(--bg-sidebar)] flex flex-col py-6 text-[var(--text-on-dark)] shrink-0 z-20 transition-all duration-300 ${isCollapsed ? 'w-20 items-center' : 'w-[240px]'}`}>
      
      {/* Logo Section */}
      <div className={`px-6 mb-8 flex items-center gap-3 opacity-90 ${isCollapsed ? 'justify-center px-0' : ''}`}>
         <div className="w-8 h-8 rounded-md bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
            <FileText className="w-5 h-5" />
         </div>
         {!isCollapsed && (
             <div className="overflow-hidden whitespace-nowrap">
                <span className="font-semibold tracking-wide text-sm block">PDF Pro Tools</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Professional Edition</span>
             </div>
         )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar">
        
        {/* Reading Tools */}
        <div className="space-y-1">
          {readingNavItems.map((item) => (
             <button
               key={item.id}
               onClick={() => setActiveTool(item.id)}
               title={isCollapsed ? item.label : undefined}
               className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 group
                 ${activeTool === item.id 
                 ? 'bg-purple-600 text-white font-medium shadow-md shadow-purple-900/20' 
                   : 'text-zinc-400 hover:text-white hover:bg-white/5'
                 } ${isCollapsed ? 'justify-center' : ''}`}
             >
               <item.icon className={`w-4 h-4 shrink-0 transition-colors ${activeTool === item.id ? 'text-white' : 'opacity-70 group-hover:opacity-100'}`} />
               {!isCollapsed && <span>{item.label}</span>}
             </button>
           ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-2 my-2" />

        {/* Main Tools */}
        <div className="space-y-1">
          {!isCollapsed && <div className="px-3 text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">File Tools</div>}
          {mainNavItems.map((item) => (
            item.id && (
              <button
                key={item.id}
                onClick={() => setActiveTool(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 group
                   ${activeTool === item.id
                    ? 'bg-primary text-white font-medium shadow-md shadow-indigo-900/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${activeTool === item.id ? 'text-white' : 'opacity-70 group-hover:opacity-100'}`} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
             )
           ))}
        </div>

      </nav>
      
      {/* Footer / Toggle */}
      <div className="pt-4 mt-4 border-t border-white/5 mx-3 space-y-2">
        <button 
           onClick={() => setIsCollapsed(!isCollapsed)}
           className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-200 text-zinc-500 hover:text-white hover:bg-white/5 ${isCollapsed ? 'justify-center' : ''}`}
           title={isCollapsed ? "Expand" : "Collapse"}
        >
           <Menu className="w-4 h-4 opacity-70" />
           {!isCollapsed && <span>تصغير القائمة</span>}
        </button>
        
        {!isCollapsed && (
            <div className="px-3 text-[10px] text-zinc-600 text-center pt-2">
                v1.0.0 • Local
            </div>
        )}
      </div>

    </aside>
  );
}
