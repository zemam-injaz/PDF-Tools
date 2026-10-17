import React, { useState } from 'react';
import {
  MessageSquare, Highlighter, Underline, StickyNote, Type as TypeIcon, Circle, Clock,
  Check, Trash2, Send, FileDown, Loader2, Landmark
} from 'lucide-react';
import { type Annotation } from '../../api/annotationApi';
import { type Annotation as NativePdfAnnotation } from '../../api/bookLibraryApi';

interface CommentsPanelProps {
  annotations: Annotation[];
  nativeAnnotations: NativePdfAnnotation[];
  loadingNative: boolean;
  currentPage: number;
  highlightedId: string | null;
  onSelect: (annot: Annotation) => void;
  onReply: (annot: Annotation, text: string) => void;
  onToggleResolved: (annot: Annotation) => void;
  onDelete: (annot: Annotation) => void;
  onNavigateNative: (page: number) => void;
}

const typeMeta: Record<string, { label: string; icon: any; color: string }> = {
  text: { label: 'نص', icon: TypeIcon, color: 'text-blue-600 bg-blue-50' },
  dot: { label: 'نقطة', icon: Circle, color: 'text-red-600 bg-red-50' },
  timestamp: { label: 'طابع زمني', icon: Clock, color: 'text-indigo-600 bg-indigo-50' },
  highlight: { label: 'تظليل', icon: Highlighter, color: 'text-amber-600 bg-amber-50' },
  underline: { label: 'تسطير', icon: Underline, color: 'text-sky-600 bg-sky-50' },
  note: { label: 'ملاحظة', icon: StickyNote, color: 'text-emerald-600 bg-emerald-50' },
};

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  annotations,
  nativeAnnotations,
  loadingNative,
  currentPage,
  highlightedId,
  onSelect,
  onReply,
  onToggleResolved,
  onDelete,
  onNavigateNative
}) => {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const matnAnnotations = [...annotations].sort((a, b) => a.page - b.page);

  const submitReply = (annot: Annotation) => {
    const text = replyText.trim();
    if (!text) return;
    onReply(annot, text);
    setReplyText('');
    setReplyTo(null);
  };

  return (
    <div className="w-80 flex-shrink-0 h-full flex flex-col bg-gray-50 border-r border-gray-200" dir="rtl">
      <div className="p-3 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare size={16} className="text-indigo-500" />
          التعليقات ({matnAnnotations.length})
        </h3>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {/* Matn (app-stored) notes */}
        <div className="p-3">
          <h4 className="text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1">
            <Landmark size={12} /> ملاحظات مَتن
          </h4>
          {matnAnnotations.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">لا توجد ملاحظات بعد.</p>
          ) : (
            <div className="space-y-2">
              {matnAnnotations.map((annot) => {
                const meta = typeMeta[annot.type] || typeMeta.note;
                const Icon = meta.icon;
                const isActive = highlightedId === annot.id;
                const replies = annot.data.replies || [];
                return (
                  <div
                    key={annot.id}
                    onClick={() => onSelect(annot)}
                    className={`bg-white rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
                      isActive ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'
                    } ${annot.data.resolved ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                        <Icon size={10} /> {meta.label}
                      </span>
                      <span className="text-gray-400" title={annot.page === currentPage ? 'الصفحة الحالية' : ''}>
                        صفحة {annot.page}
                      </span>
                      {annot.data.resolved && (
                        <span className="text-emerald-600 flex items-center gap-0.5 mr-auto">
                          <Check size={11} /> محلول
                        </span>
                      )}
                    </div>

                    {annot.data.quote && (
                      <p className="text-xs text-gray-500 border-r-2 border-amber-300 pr-2 mb-1 leading-relaxed line-clamp-3">
                        {annot.data.quote}
                      </p>
                    )}
                    {annot.data.text && (
                      <p className="text-sm text-gray-800 leading-relaxed" dir="auto">{annot.data.text}</p>
                    )}

                    {replies.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                        {replies.map((r) => (
                          <div key={r.id} className="text-xs text-gray-600 bg-gray-50 rounded p-1.5" dir="auto">
                            {r.text}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyTo(replyTo === annot.id ? null : annot.id); }}
                        className="text-[11px] text-gray-500 hover:text-indigo-600 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100"
                      >
                        <Send size={11} /> رد
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleResolved(annot); }}
                        className="text-[11px] text-gray-500 hover:text-emerald-600 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100"
                      >
                        <Check size={11} /> {annot.data.resolved ? 'إلغاء الحل' : 'حل'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(annot); }}
                        className="text-[11px] text-gray-400 hover:text-red-600 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100 mr-auto"
                      >
                        <Trash2 size={11} /> حذف
                      </button>
                    </div>

                    {replyTo === annot.id && (
                      <div className="mt-2 flex items-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(annot); }
                          }}
                          rows={2}
                          placeholder="اكتب ردًا..."
                          className="flex-1 text-xs p-1.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                        <button
                          onClick={() => submitReply(annot)}
                          className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          title="إرسال"
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Native PDF annotations */}
        <div className="p-3 border-t border-gray-200">
          <h4 className="text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1">
            <FileDown size={12} /> تعليقات داخل ملف PDF (أصلية)
          </h4>
          {loadingNative ? (
            <div className="flex items-center justify-center py-4 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : nativeAnnotations.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">لا توجد تعليقات أصلية في الملف.</p>
          ) : (
            <div className="space-y-2">
              {nativeAnnotations.map((annot, idx) => (
                <div
                  key={idx}
                  onClick={() => onNavigateNative(annot.page)}
                  className="bg-white rounded-lg border border-sky-100 p-2.5 cursor-pointer hover:border-sky-300 hover:shadow-sm transition-all"
                  title={`الانتقال إلى صفحة ${annot.page}`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600">{annot.type}</span>
                    <span className="text-gray-400">صفحة {annot.page}</span>
                    {annot.author && <span className="text-gray-400 truncate">{annot.author}</span>}
                  </div>
                  {annot.content && (
                    <p className="text-xs text-gray-700 leading-relaxed" dir="auto">{annot.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
