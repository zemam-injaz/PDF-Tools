import { CheckCircle2, Clock, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTaskManager } from '../../hooks/useTaskManager';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const TaskMonitor = () => {
  const { activeTasks, completedTasks } = useTaskManager();
  const [isExpanded, setIsExpanded] = useState(false);

  if (activeTasks.length === 0 && completedTasks.length === 0) return null;

  const totalActive = activeTasks.length;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 pointer-events-none">
      <div className="pointer-events-auto">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-between p-3 rounded-xl shadow-lg border transition-all ${
            totalActive > 0 
              ? 'bg-indigo-600 text-white border-indigo-500' 
              : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {totalActive > 0 ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <CheckCircle2 className="text-green-500" size={18} />
            )}
            <span className="font-bold text-sm">
              {totalActive > 0 ? `جاري تنفيذ ${totalActive} مهام...` : 'اكتملت المهام'}
            </span>
          </div>
          {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-96 flex flex-col"
            >
              <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">سجل المهام</span>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar flex-1">
                {activeTasks.length > 0 && (
                  <div className="p-2 space-y-1">
                    {activeTasks.map(task => (
                      <TaskItem key={task.task_id} task={task} />
                    ))}
                  </div>
                )}
                
                {completedTasks.length > 0 && (
                  <div className="p-2 space-y-1 border-t border-dashed">
                    {completedTasks.slice(0, 5).map(task => (
                      <TaskItem key={task.task_id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const TaskItem = ({ task }: { task: any }) => {
  const getIcon = () => {
    switch (task.status) {
      case 'running': return <Loader2 className="animate-spin text-indigo-500" size={14} />;
      case 'completed': return <CheckCircle2 className="text-green-500" size={14} />;
      case 'failed': return <XCircle className="text-red-500" size={14} />;
      default: return <Clock className="text-gray-400" size={14} />;
    }
  };

  const getTaskLabel = (type: string) => {
    switch (type) {
      case 'tahweel_ocr': return 'تحويل OCR (Tahweel)';
      case 'merge': return 'دمج ملفات PDF';
      case 'split': return 'تقسيم ملف PDF';
      case 'compress': return 'ضغط ملف PDF';
      case 'extract_images': return 'استخراج صور';
      default: return type;
    }
  };

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-gray-900 truncate">
            {getTaskLabel(task.task_type)}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(task.updated_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 truncate">{task.message}</p>
        
        {task.status === 'running' && (
          <div className="mt-1.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${task.progress || 10}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
