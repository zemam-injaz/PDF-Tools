import { useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import type { TaskInfo } from '../../lib/api';
import { QUICK_TOOL_IDS, TOOL_CATALOG, type ToolId } from '../../lib/toolCatalog';
import type { RecentFile } from '../../hooks/useRecentFiles';
import { openPath } from '../../lib/utils';

interface HomeWorkspaceProps {
  selectedFile: string;
  recentFiles: RecentFile[];
  activeTasks: TaskInfo[];
  completedTasks: TaskInfo[];
  onFileChosen: (path: string) => void;
  onClearFile: () => void;
  onSelectTool: (tool: ToolId) => void;
  onOpenTools: () => void;
  onOpenTasks: () => void;
}

function taskLabel(type: string): string {
  const labels: Record<string, string> = {
    tahweel_ocr: 'تحويل OCR',
    merge: 'دمج ملفات PDF',
    split: 'تقسيم ملف PDF',
    compress: 'ضغط ملف PDF',
    extract_images: 'استخراج الصور',
  };
  return labels[type] || type;
}

export function HomeWorkspace({
  selectedFile,
  recentFiles,
  activeTasks,
  completedTasks,
  onFileChosen,
  onClearFile,
  onSelectTool,
  onOpenTools,
  onOpenTasks,
}: HomeWorkspaceProps) {
  const browserInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const chooseFile = async () => {
    const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
        if (typeof selected === 'string') onFileChosen(selected);
        return;
      } catch (error) {
        console.warn('Native file dialog failed:', error);
      }
    }
    browserInputRef.current?.click();
  };

  const quickTools = QUICK_TOOL_IDS.map((id) => TOOL_CATALOG.find((tool) => tool.id === id)).filter(Boolean);
  const latestCompleted = completedTasks[0];

  return (
    <div className="workspace-page workspace-home">
      <section className="welcome-strip">
        <div>
          <div className="welcome-title-line">
            <h1>مرحباً بك في مَتن</h1>
            <span className="engine-badge"><i /> Tauri Local Engine</span>
          </div>
          <p>مساحة عمل عربية لمعالجة مستندات PDF والقراءة على جهازك.</p>
        </div>
        <div className="local-trust-note">
          <ShieldCheck size={19} />
          <div><strong>معالجة محلية</strong><span>ملفات أدوات PDF لا تغادر جهازك</span></div>
        </div>
      </section>

      <section
        className={`workspace-drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files[0] as (File & { path?: string }) | undefined;
          if (file) onFileChosen(file.path || file.name);
        }}
      >
        <input
          ref={browserInputRef}
          className="hidden"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0] as (File & { path?: string }) | undefined;
            if (file) onFileChosen(file.path || file.name);
          }}
        />
        <span className="drop-zone-icon"><FilePlus2 size={28} /></span>
        {selectedFile ? (
          <>
            <h2>الملف جاهز لاختيار الأداة</h2>
            <code dir="ltr">{selectedFile}</code>
            <div className="drop-zone-actions">
              <button type="button" className="workspace-primary-button" onClick={onOpenTools}>اختيار الإجراء <ArrowLeft size={16} /></button>
              <button type="button" className="workspace-secondary-button" onClick={onClearFile}><X size={16} /> إزالة الملف</button>
            </div>
          </>
        ) : (
          <>
            <h2>ابدأ بملف أو أسقطه هنا</h2>
            <p>اختر ملف PDF لعرض الأدوات المناسبة وبدء العمل مباشرة.</p>
            <button type="button" className="workspace-primary-button" onClick={chooseFile}><FolderOpen size={17} /> استعراض الملفات</button>
            <small>يدعم ملفات PDF والصفحات المصورة متعددة الصفحات</small>
          </>
        )}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-heading">
          <div><Zap size={18} /><h2>أدوات المعالجة السريعة</h2></div>
          <button type="button" onClick={onOpenTools}>عرض كافة الأدوات <ArrowLeft size={15} /></button>
        </div>
        <div className="quick-tools-grid">
          {quickTools.map((tool) => tool && (
            <button key={tool.id} type="button" className="quick-tool-item" onClick={() => onSelectTool(tool.id)}>
              <span className="quick-tool-icon"><tool.icon size={20} /></span>
              <span><strong>{tool.label}</strong><small>{tool.description}</small></span>
              <kbd>{tool.id === 'merge' ? 'M' : tool.id === 'split' ? 'S' : tool.id === 'compress' ? 'C' : tool.id === 'text' ? 'E' : tool.id === 'tahweel' ? 'O' : 'I'}</kbd>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-overview-grid">
        <div className="workspace-panel recent-panel">
          <div className="workspace-section-heading compact">
            <div><Clock3 size={18} /><h2>الملفات الأخيرة</h2><span className="count-badge">{recentFiles.length}</span></div>
          </div>
          {recentFiles.length === 0 ? (
            <div className="panel-empty"><FileText size={24} /><strong>لا توجد ملفات حديثة</strong><span>اختر ملفاً من مساحة البدء ليظهر هنا.</span></div>
          ) : (
            <div className="recent-files-list">
              {recentFiles.slice(0, 5).map((file) => (
                <div key={file.path} className="recent-file-row">
                  <span className="recent-file-icon"><FileText size={18} /></span>
                  <div className="min-w-0 flex-1"><strong>{file.name}</strong><code dir="ltr">{file.path}</code></div>
                  <span className="recent-file-action">{file.lastAction}</span>
                  <button type="button" title="استخدام الملف" onClick={() => onFileChosen(file.path)}>استخدام</button>
                  <button type="button" title="فتح موقع الملف" onClick={() => void openPath(file.path)}><FolderOpen size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="workspace-panel activity-panel">
          <div className="workspace-section-heading compact">
            <div><Zap size={18} /><h2>المهام والنشاط</h2></div>
            <button type="button" onClick={onOpenTasks}>السجل الكامل <ArrowLeft size={15} /></button>
          </div>
          {activeTasks.length > 0 ? activeTasks.slice(0, 2).map((task) => (
            <div key={task.task_id} className="activity-card active">
              <div className="activity-title"><Loader2 size={17} className="animate-spin" /><strong>{taskLabel(task.task_type)}</strong><span>{task.progress}%</span></div>
              <p>{task.message}</p>
              <div className="workspace-progress"><span style={{ width: `${Math.max(task.progress || 0, 4)}%` }} /></div>
            </div>
          )) : latestCompleted ? (
            <div className="activity-card completed">
              <div className="activity-title"><CheckCircle2 size={17} /><strong>{taskLabel(latestCompleted.task_type)}</strong><span>مكتمل</span></div>
              <p>{latestCompleted.message || 'اكتملت العملية بنجاح.'}</p>
            </div>
          ) : (
            <div className="panel-empty compact"><Clock3 size={22} /><strong>المحرك جاهز</strong><span>لا توجد مهام جارية الآن.</span></div>
          )}
        </div>
      </section>
    </div>
  );
}
