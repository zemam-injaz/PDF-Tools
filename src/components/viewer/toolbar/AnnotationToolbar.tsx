import React from 'react';
import { Type, Circle, Clock, Pointer, Undo2, Redo2, Highlighter, Underline, StickyNote, Download, Layers } from 'lucide-react';
import { type ExportMode } from '../../../api/annotationApi';

export type Tool =
  | 'none'
  | 'text'
  | 'dot-red'
  | 'dot-black'
  | 'timestamp'
  | 'highlight'
  | 'underline'
  | 'note';

/** Tools that place a mark by a single click (vs. passage tools that use text selection). */
export const POINT_TOOLS: Tool[] = ['text', 'dot-red', 'dot-black', 'timestamp'];
/** Tools that create a passage annotation from a text selection. */
export const PASSAGE_TOOLS: Tool[] = ['highlight', 'underline', 'note'];

export function isPointTool(tool: Tool): boolean {
  return POINT_TOOLS.includes(tool);
}

export function isPassageTool(tool: Tool): boolean {
  return PASSAGE_TOOLS.includes(tool);
}

interface AnnotationToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onExport: (mode: ExportMode) => void;
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
  const pointTools: { id: Tool; icon: any; label: string; color?: string }[] = [
    { id: 'none', icon: Pointer, label: 'تصفح' },
    { id: 'text', icon: Type, label: 'نص (عربي/إنجليزي)', color: 'text-blue-500' },
    { id: 'dot-red', icon: Circle, label: 'نقطة حمراء', color: 'text-red-500' },
    { id: 'dot-black', icon: Circle, label: 'نقطة سوداء', color: 'text-black' },
    { id: 'timestamp', icon: Clock, label: 'طابع زمني', color: 'text-indigo-500' },
  ];

  const passageTools: { id: Tool; icon: any; label: string; color?: string }[] = [
    { id: 'highlight', icon: Highlighter, label: 'تظليل تحديد', color: 'text-amber-500' },
    { id: 'underline', icon: Underline, label: 'تسطير تحديد', color: 'text-sky-500' },
    { id: 'note', icon: StickyNote, label: 'ملاحظة على تحديد', color: 'text-emerald-500' },
  ];

  const buttonClass = (id: Tool) =>
    `p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
      activeTool === id
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
        : 'text-gray-500 hover:bg-gray-100'
    }`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl z-20">
      <div className="flex items-center gap-1 border-r border-gray-100 pr-2 mr-1">
        {pointTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={buttonClass(tool.id)}
          >
            <tool.icon size={20} className={activeTool === tool.id ? 'text-white' : tool.color} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-r border-gray-100 pr-2 mr-1">
        {passageTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={buttonClass(tool.id)}
          >
            <tool.icon size={20} className={activeTool === tool.id ? 'text-white' : tool.color} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-r border-gray-100 pr-2 mr-1">
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
        onClick={() => onExport('native')}
        disabled={isExporting}
        className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
      >
        <Download size={16} />
        {isExporting ? 'جاري التصدير...' : 'تصدير مع التعليقات'}
      </button>

      <button
        onClick={() => onExport('flatten')}
        disabled={isExporting}
        title="دمج التعليقات داخل محتوى الصفحة"
        className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <Layers size={16} />
        تصدير مسطّح
      </button>
    </div>
  );
};
