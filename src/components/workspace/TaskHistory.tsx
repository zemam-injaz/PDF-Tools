import { CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TaskInfo } from '../../lib/api';

type TaskFilter = 'all' | 'active' | 'completed' | 'failed';

interface TaskHistoryProps {
  tasks: TaskInfo[];
  onRefresh: () => void;
}

const TASK_LABELS: Record<string, string> = {
  tahweel_ocr: 'تحويل OCR',
  merge: 'دمج ملفات PDF',
  split: 'تقسيم ملف PDF',
  compress: 'ضغط ملف PDF',
  extract_images: 'استخراج الصور',
};

export function TaskHistory({ tasks, onRefresh }: TaskHistoryProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'active') return task.status === 'pending' || task.status === 'running';
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'failed') return task.status === 'failed';
    return true;
  }), [filter, tasks]);

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div>
          <p className="workspace-eyebrow">المعالجة المحلية</p>
          <h1>سجل المهام</h1>
          <p>تابع العمليات الجارية وراجع النتائج السابقة.</p>
        </div>
        <button type="button" className="workspace-secondary-button" onClick={onRefresh}><RefreshCw size={16} /> تحديث</button>
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="تصفية المهام">
        {([
          ['all', 'الكل'],
          ['active', 'الجارية'],
          ['completed', 'المكتملة'],
          ['failed', 'الفاشلة'],
        ] as Array<[TaskFilter, string]>).map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <div className="workspace-empty-state">
          <Clock3 size={25} />
          <h2>لا توجد مهام في هذا القسم</h2>
          <p>ستظهر عمليات الدمج والضغط والتحويل هنا تلقائياً.</p>
        </div>
      ) : (
        <div className="task-history-list">
          {visibleTasks.map((task) => {
            const isActive = task.status === 'pending' || task.status === 'running';
            return (
              <article key={task.task_id} className="task-history-row">
                <span className={`task-status-icon ${task.status}`}>
                  {isActive ? <Loader2 size={17} className="animate-spin" /> : task.status === 'completed' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="task-history-title">
                    <strong>{TASK_LABELS[task.task_type] || task.task_type}</strong>
                    <time>{new Date(task.updated_at).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </div>
                  <p>{task.message || (task.status === 'completed' ? 'اكتملت العملية' : 'بانتظار البدء')}</p>
                  {isActive && (
                    <div className="workspace-progress" aria-label={`التقدم ${task.progress}%`}>
                      <span style={{ width: `${Math.max(task.progress || 0, 4)}%` }} />
                    </div>
                  )}
                </div>
                <span className={`workspace-status ${task.status}`}>{task.status === 'running' ? `${task.progress}%` : task.status === 'pending' ? 'في الانتظار' : task.status === 'completed' ? 'مكتمل' : 'فشل'}</span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
