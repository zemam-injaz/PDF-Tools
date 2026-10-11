import { Search, X, FileCheck2 } from 'lucide-react';
import { TOOL_CATALOG, TOOL_CATEGORIES, type ToolCategory, type ToolId } from '../../lib/toolCatalog';
import { useMemo, useState } from 'react';

interface ToolsDirectoryProps {
  query: string;
  onQueryChange: (value: string) => void;
  selectedFile: string;
  onClearSelectedFile: () => void;
  onSelectTool: (tool: ToolId) => void;
}

export function ToolsDirectory({ query, onQueryChange, selectedFile, onClearSelectedFile, onSelectTool }: ToolsDirectoryProps) {
  const [category, setCategory] = useState<ToolCategory | 'all'>('all');
  const normalizedQuery = query.trim().toLocaleLowerCase('ar');

  const visibleTools = useMemo(() => TOOL_CATALOG.filter((tool) => {
    if (category !== 'all' && tool.category !== category) return false;
    if (!normalizedQuery) return true;
    return [tool.label, tool.description, ...tool.keywords]
      .join(' ')
      .toLocaleLowerCase('ar')
      .includes(normalizedQuery);
  }), [category, normalizedQuery]);

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <div>
          <p className="workspace-eyebrow">مساحة العمل</p>
          <h1>دليل أدوات PDF</h1>
          <p>ابحث عن المهمة المطلوبة أو اخترها حسب نوع العمل.</p>
        </div>
        <div className="workspace-search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="ابحث عن أداة..."
            aria-label="البحث في الأدوات"
          />
          {query && <button type="button" onClick={() => onQueryChange('')} title="مسح البحث"><X size={15} /></button>}
        </div>
      </div>

      {selectedFile && (
        <div className="selected-file-banner">
          <FileCheck2 size={18} />
          <div className="min-w-0 flex-1">
            <span>سيتم تمرير الملف إلى الأداة المختارة</span>
            <code dir="ltr">{selectedFile}</code>
          </div>
          <button type="button" onClick={onClearSelectedFile}>إزالة</button>
        </div>
      )}

      <div className="workspace-tabs" role="tablist" aria-label="تصنيفات الأدوات">
        <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>الكل</button>
        {TOOL_CATEGORIES.map((item) => (
          <button key={item.id} type="button" className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>
        ))}
      </div>

      {visibleTools.length > 0 ? (
        <div className="tool-directory-grid">
          {visibleTools.map((tool) => (
            <button key={tool.id} type="button" className="tool-directory-item" onClick={() => onSelectTool(tool.id)}>
              <span className="tool-directory-icon"><tool.icon size={20} /></span>
              <span className="min-w-0">
                <strong>{tool.label}</strong>
                <small>{tool.description}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="workspace-empty-state">
          <Search size={24} />
          <h2>لا توجد أدوات مطابقة</h2>
          <p>جرّب كلمة بحث أخرى أو اختر تصنيفاً مختلفاً.</p>
        </div>
      )}
    </div>
  );
}
