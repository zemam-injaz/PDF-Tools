import React from 'react';
import { Type, Circle, Clock, Pointer, Undo2, Redo2 } from 'lucide-react';

export type Tool = 'none' | 'text' | 'dot-red' | 'dot-black' | 'timestamp';

interface AnnotationToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onExport: () => void;
  isExporting?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  setActiveTool,
  onExport,
  isExporting,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  const tools: { id: Tool; icon: any; label: string; color?: string }[] = [
    { id: 'none', icon: Pointer, label: 'تصفح' },
    { id: 'text', icon: Type, label: 'نص (عربي/إنجليزي)', color: 'text-blue-500' },
    { id: 'dot-red', icon: Circle, label: 'نقطة حمراء', color: 'text-red-500' },
    { id: 'dot-black', icon: Circle, label: 'نقطة سوداء', color: 'text-black' },
    { id: 'timestamp', icon: Clock, label: 'طابع زمني', color: 'text-indigo-500' },
  ];

  return (
    <div className="flex items-center gap-2 p-2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl z-20">
      <div className="flex items-center gap-1 border-r border-gray-100 pr-2 mr-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
              activeTool === tool.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <tool.icon size={20} className={activeTool === tool.id ? 'text-white' : tool.color} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-r border-gray-100 pr-2 mr-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="تراجع"
          className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 size={20} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="إعادة"
          className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Redo2 size={20} />
        </button>
      </div>
      
      <button
        onClick={onExport}
        disabled={isExporting}
        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
      >
        {isExporting ? 'جاري التصدير...' : 'تصدير PDF مع التعليقات'}
      </button>
    </div>
  );
};
