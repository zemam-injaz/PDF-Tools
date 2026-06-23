import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, BarChart3, Calendar, BookOpen,
  Loader2, AlertCircle, Clock,
  Play, CheckCircle, History as HistoryIcon, Bell, Calendar as CalendarIcon, Trash2,
  Folder, FolderOpen, Plus, Minus
} from 'lucide-react';
async function getTauriNotification() {
  const isTauri = !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;
  if (!isTauri) return null;
  return import('@tauri-apps/plugin-notification');
}
import { bookmarkApi, type Bookmark, type PdfTreeEntry, type ScanFolderResponse } from '../../api/bookmarkApi';
import { getApiBaseUrl } from '../../lib/api';
import type { Tool } from '../layout/Sidebar';

interface Chapter extends Bookmark {
  percentage: number;
  included: boolean;
}

interface HistoryItem {
  id: string;
  pdfName: string;
  pdfPath: string;
  createdAt: string;
  chapters: Chapter[];
  settings: {
    startDate: string;
    pagesPerDay: number;
    availableDays: number;
  };
}

interface DayPlan {
  day: number;
  date: string;
  chapter: string;
  pages: string;
  page_count: number;
}

interface FolderDayPlan {
  day: number;
  date: string;
  file: string;
  page_count: number;
}

type AnalysisMode = 'file' | 'folder';

function collectAllFiles(entries: PdfTreeEntry[]): PdfTreeEntry[] {
  const result: PdfTreeEntry[] = [];
  for (const e of entries) {
    if (e.type === 'file') result.push(e);
    else result.push(...collectAllFiles(e.children));
  }
  return result;
}

function assignDaysToTree(
  entries: PdfTreeEntry[],
  targetPath: string,
  newDays: number
): PdfTreeEntry[] {
  return entries.map(e => {
    if (e.path === targetPath) {
      return { ...e, assignedDays: newDays };
    }
    if (e.type === 'folder') {
      return { ...e, children: assignDaysToTree(e.children, targetPath, newDays) };
    }
    return e;
  });
}

function autoAssignDays(entries: PdfTreeEntry[], pagesPerDay: number): PdfTreeEntry[] {
  return entries.map(e => {
    if (e.type === 'file') {
      const days = Math.max(1, Math.ceil(e.page_count / pagesPerDay));
      return { ...e, assignedDays: days };
    }
    if (e.type === 'folder') {
      const children = autoAssignDays(e.children, pagesPerDay);
      const totalDays = children.reduce((s, c) => s + ((c as EntryWithDays).assignedDays || 0), 0);
      return { ...e, children, assignedDays: totalDays };
    }
    return e;
  });
}

function sumDays(entries: PdfTreeEntry[]): number {
  return entries.reduce((s, e) => {
    if (e.type === 'file') return s + ((e as EntryWithDays).assignedDays || 0);
    return s + sumDays(e.children);
  }, 0);
}

function folderDaysFromTree(entries: PdfTreeEntry[]): PdfTreeEntry[] {
  return entries.map(e => {
    if (e.type === 'folder') {
      const children = folderDaysFromTree(e.children);
      const totalDays = children.reduce((s, c) => s + ((c as EntryWithDays).assignedDays || 0), 0);
      return { ...e, children, assignedDays: totalDays };
    }
    return e;
  });
}

type EntryWithDays = PdfTreeEntry & {
  assignedDays?: number;
};

function TreeNodes({ entries, depth, onAssignDays }: { entries: PdfTreeEntry[]; depth: number; onAssignDays: (path: string, delta: number) => void }) {
  return (
    <>
      {entries.map((entry, i) => {
        const ef = entry as EntryWithDays;
        const isFolder = entry.type === 'folder';
        return (
          <div key={`${entry.path}-${i}`}>
            <div
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded-lg group transition-colors"
              style={{ paddingRight: `${12 + depth * 24}px` }}
            >
              {isFolder ? (
                <FolderOpen size={16} className="text-amber-500 shrink-0" />
              ) : (
                <FileText size={16} className="text-blue-500 shrink-0" />
              )}
              <span className="text-sm text-gray-800 truncate flex-1" title={entry.name}>{entry.name}</span>
              <span className="text-xs text-gray-500 ml-2 dir-ltr">{entry.page_count} صفحة</span>
              {isFolder && ef.assignedDays ? (
                <span className="text-xs font-medium text-indigo-600 ml-1">{ef.assignedDays} يوم</span>
              ) : null}
              {!isFolder && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onAssignDays(entry.path, -1)}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                    title="تخفيف يوم"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-medium text-indigo-600 min-w-[16px] text-center dir-ltr">
                    {ef.assignedDays || 0}
                  </span>
                  <button
                    onClick={() => onAssignDays(entry.path, 1)}
                    className="p-0.5 text-gray-400 hover:text-green-500"
                    title="إضافة يوم"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
            {isFolder && entry.children.length > 0 && (
              <TreeNodes entries={entry.children} depth={depth + 1} onAssignDays={onAssignDays} />
            )}
          </div>
        );
      })}
    </>
  );
}

export function ChapterWeightTool({ onNavigate }: { onNavigate?: (tool: Tool) => void }) {
  const [mode, setMode] = useState<AnalysisMode>('file');

  // File mode state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [availableDays, setAvailableDays] = useState(30);
  const [pagesPerDay, setPagesPerDay] = useState(10);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalBookPages, setTotalBookPages] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Folder mode state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderData, setFolderData] = useState<ScanFolderResponse | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderPlan, setFolderPlan] = useState<FolderDayPlan[]>([]);
  const [isFolderPlanGenerated, setIsFolderPlanGenerated] = useState(false);
  const [folderPagesPerDay, setFolderPagesPerDay] = useState(10);

  useEffect(() => {
    const saved = localStorage.getItem('chapter_weight_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const saveToHistory = (newPlanSettings: HistoryItem['settings']) => {
    if (!selectedFile) return;
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      pdfName: selectedFile.split(/[/\\]/).pop() || 'Unknown PDF',
      pdfPath: selectedFile,
      createdAt: new Date().toISOString(),
      chapters: chapters,
      settings: newPlanSettings
    };
    const updated = [newItem, ...history].slice(0, 50);
    setHistory(updated);
    localStorage.setItem('chapter_weight_history', JSON.stringify(updated));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setSelectedFile(item.pdfPath);
    setChapters(item.chapters);
    setStartDate(item.settings.startDate);
    setPagesPerDay(item.settings.pagesPerDay);
    setAvailableDays(item.settings.availableDays);
    setIsAnalyzed(true);
    showToast('تم استرجاع الإعدادات من السجل', 'success');
    setShowHistory(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('chapter_weight_history', JSON.stringify(updated));
  };

  const handleTestNotification = async () => {
    const notifModule = await getTauriNotification();
    if (!notifModule) {
      showToast('الإشعارات متاحة فقط في تطبيق المكتب', 'error');
      return;
    }
    const { isPermissionGranted, requestPermission, sendNotification } = notifModule;
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    if (permissionGranted) {
      sendNotification({ title: 'تذكير القراءة', body: 'حان وقت قراءة وردك اليومي من الكتاب!', sound: 'default' });
      showToast('تم إرسال إشعار تجريبي', 'success');
    } else {
      showToast('لم يتم منح إذن الإشعارات', 'error');
    }
  };

  const handleScheduledTest = async () => {
    const notifModule = await getTauriNotification();
    if (!notifModule) {
      showToast('الإشعارات متاحة فقط في تطبيق المكتب', 'error');
      return;
    }
    const { isPermissionGranted, requestPermission, sendNotification } = notifModule;
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    if (permissionGranted) {
      showToast('سيتم إرسال إشعار بعد 5 ثواني...', 'success');
      setTimeout(() => {
        sendNotification({ title: '⏳ تذكير مجدول', body: 'نجاح! هذا اختبار للإشعار المجدول.', sound: 'default' });
      }, 5000);
    } else {
      showToast('لم يتم منح إذن الإشعارات', 'error');
    }
  };

  const handleExportICS = async () => {
    if (plan.length === 0) return;
    const formatDateItem = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    const events = plan.map(day => {
      const start = new Date(day.date);
      start.setHours(9, 0, 0);
      const end = new Date(day.date);
      end.setHours(10, 0, 0);
      return `BEGIN:VEVENT
UID:${crypto.randomUUID()}
DTSTAMP:${formatDateItem(new Date().toISOString())}
DTSTART:${formatDateItem(start.toISOString())}
DTEND:${formatDateItem(end.toISOString())}
SUMMARY:قراءة ${day.page_count} صفحة من ${selectedFile?.split(/[/\\]/).pop()}
DESCRIPTION:مطلوب قراءة الفصول: ${day.chapter} \nالصفحات: ${day.pages}
END:VEVENT`;
    }).join('\n');
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PDF Tools//Reading Plan//AR
calscale:GREGORIAN
METHOD:PUBLISH
${events}
END:VCALENDAR`;
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [{ name: 'Calendar File', extensions: ['ics'] }],
        defaultPath: 'reading_schedle.ics'
      });
      if (!filePath) return;
      const API_BASE = await getApiBaseUrl();
      const response = await fetch(`${API_BASE}/api/system/save-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, content: icsContent })
      });
      if (!response.ok) throw new Error('Failed');
      showToast('تم إنشاء ملف التقويم بنجاح', 'success');
    } catch (e) {
      console.error(e);
      showToast('فشل إنشاء ملف التقويم', 'error');
    }
  };

  // File mode handlers
  const handleSelectFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (selected && typeof selected === 'string') {
        setSelectedFile(selected);
        setChapters([]);
        setPlan([]);
        setIsAnalyzed(false);
        setIsPlanGenerated(false);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to open file dialog', err);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await bookmarkApi.extractBookmarks(selectedFile);
      setTotalBookPages(data.total_pages);
      if (!data.has_bookmarks) {
        setError('لم يتم العثور على فصول في هذا الملف. تأكد من أن ملف PDF يحتوي على فهرس (Bookmarks).');
        setLoading(false);
        return;
      }
      let filtered = data.bookmarks.filter(b => b.level === 1);
      if (filtered.length === 0 && data.bookmarks.length > 0) {
        const minLevel = Math.min(...data.bookmarks.map(b => b.level));
        filtered = data.bookmarks.filter(b => b.level === minLevel);
      }
      const processed: Chapter[] = filtered.map(b => ({
        ...b,
        percentage: (b.page_count / data.total_pages) * 100,
        included: true
      }));
      setChapters(processed);
      setIsAnalyzed(true);
      setPagesPerDay(Math.ceil(data.total_pages / 30));
    } catch (err) {
      console.error(err);
      setError('فشل تحليل الملف. الرجاء المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (index: number) => {
    setChapters(prev => prev.map((ch, i) =>
      i === index ? { ...ch, included: !ch.included } : ch
    ));
  };

  const getIncludedPageCount = () => {
    return chapters.reduce((sum, ch) => ch.included ? sum + ch.page_count : sum, 0);
  };

  const handleGeneratePlan = () => {
    const includedPagesTotal = getIncludedPageCount();
    if (includedPagesTotal === 0) return;
    const generatedPlan: DayPlan[] = [];
    const pagesQueue: number[] = [];
    chapters.forEach(ch => {
      if (ch.included) {
        for (let p = ch.page; p <= ch.end_page; p++) {
          pagesQueue.push(p);
        }
      }
    });
    const totalDays = Math.ceil(pagesQueue.length / pagesPerDay);
    let currentDate = new Date(startDate);
    for (let i = 0; i < pagesQueue.length; i += pagesPerDay) {
      const dayPages = pagesQueue.slice(i, i + pagesPerDay);
      if (dayPages.length === 0) break;
      const dayIndex = Math.floor(i / pagesPerDay) + 1;
      const ranges: string[] = [];
      let rStart = dayPages[0];
      let rPrev = dayPages[0];
      for (let k = 1; k < dayPages.length; k++) {
        if (dayPages[k] !== rPrev + 1) {
          ranges.push(rStart === rPrev ? `${rStart}` : `${rStart}-${rPrev}`);
          rStart = dayPages[k];
        }
        rPrev = dayPages[k];
      }
      ranges.push(rStart === rPrev ? `${rStart}` : `${rStart}-${rPrev}`);
      const startP = dayPages[0];
      const currentChapter = chapters.find(ch => ch.page <= startP && ch.end_page >= startP);
      const chapterTitle = currentChapter ? currentChapter.title : 'صفحات مختارة';
      generatedPlan.push({
        day: dayIndex,
        date: currentDate.toISOString(),
        chapter: chapterTitle,
        pages: ranges.join(', '),
        page_count: dayPages.length
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setPlan(generatedPlan);
    setIsPlanGenerated(true);
    setAvailableDays(totalDays);
    saveToHistory({ startDate: startDate, pagesPerDay: pagesPerDay, availableDays: totalDays });
  };

  const handleExportPlan = async (format: 'csv' | 'md' | 'txt' | 'doc') => {
    if (plan.length === 0) return;
    let content = '';
    let ext = '';
    let bom = '';
    try {
      if (format === 'csv') {
        ext = 'csv';
        bom = '\uFEFF';
        const header = "Day,Date,Chapter,Pages,PageCount\n";
        content = header + plan.map(d =>
          `${d.day},${new Date(d.date).toLocaleDateString()},"${d.chapter}",${d.pages},${d.page_count}`
        ).join("\n");
      } else if (format === 'md') {
        ext = 'md';
        content = "| Day | Date | Chapter | Pages | Count |\n|---|---|---|---|---|\n" +
          plan.map(d => `| ${d.day} | ${new Date(d.date).toLocaleDateString()} | ${d.chapter} | ${d.pages} | ${d.page_count} |`).join("\n");
      } else if (format === 'txt') {
        ext = 'txt';
        content = plan.map(d => `Day ${d.day} (${new Date(d.date).toLocaleDateString()}): ${d.chapter} [${d.pages}]`).join("\n");
      } else if (format === 'doc') {
        ext = 'doc';
        content = `<html><head><meta charset='utf-8'></head><body>
          <h2>Reading Plan</h2>
          <table border='1' style='border-collapse: collapse; width: 100%;'>
            <thead><tr style='background-color: #f0f0f0;'><th>Day</th><th>Date</th><th>Chapter</th><th>Pages</th><th>Count</th></tr></thead>
            <tbody>` +
          plan.map(d => `<tr>
            <td style='padding: 5px;'>${d.day}</td>
            <td style='padding: 5px;'>${new Date(d.date).toLocaleDateString()}</td>
            <td style='padding: 5px;'>${d.chapter}</td>
            <td style='padding: 5px;'>${d.pages}</td>
            <td style='padding: 5px;'>${d.page_count}</td>
          </tr>`).join("") +
          `</tbody></table></body></html>`;
      }
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [{ name: `${format.toUpperCase()} File`, extensions: [ext] }],
        defaultPath: `reading_plan.${ext}`
      });
      if (!filePath) return;
      const API_BASE = await getApiBaseUrl();
      const response = await fetch(`${API_BASE}/api/system/save-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, content: bom + content })
      });
      if (!response.ok) throw new Error('Failed to save file');
      showToast('تم التصدير بنجاح', 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('فشل التصدير', 'error');
    }
  };

  const handleExportFolderPlan = async (format: 'csv' | 'md' | 'txt' | 'doc') => {
    if (folderPlan.length === 0) return;
    let content = '';
    let ext = '';
    let bom = '';
    try {
      if (format === 'csv') {
        ext = 'csv';
        bom = '\uFEFF';
        const header = "Day,Date,File,PageCount\n";
        content = header + folderPlan.map(d =>
          `${d.day},${new Date(d.date).toLocaleDateString()},"${d.file}",${d.page_count}`
        ).join("\n");
      } else if (format === 'md') {
        ext = 'md';
        content = "| Day | Date | File | Pages |\n|---|---|---|---|\n" +
          folderPlan.map(d => `| ${d.day} | ${new Date(d.date).toLocaleDateString()} | ${d.file} | ${d.page_count} |`).join("\n");
      } else if (format === 'txt') {
        ext = 'txt';
        content = folderPlan.map(d => `Day ${d.day} (${new Date(d.date).toLocaleDateString()}): ${d.file} — ${d.page_count} pages`).join("\n");
      } else if (format === 'doc') {
        ext = 'doc';
        content = `<html><head><meta charset='utf-8'></head><body>
          <h2>Reading Plan</h2>
          <table border='1' style='border-collapse: collapse; width: 100%;'>
            <thead><tr style='background-color: #f0f0f0;'><th>Day</th><th>Date</th><th>File</th><th>Pages</th></tr></thead>
            <tbody>` +
          folderPlan.map(d => `<tr>
            <td style='padding: 5px;'>${d.day}</td>
            <td style='padding: 5px;'>${new Date(d.date).toLocaleDateString()}</td>
            <td style='padding: 5px;'>${d.file}</td>
            <td style='padding: 5px;'>${d.page_count}</td>
          </tr>`).join("") +
          `</tbody></table></body></html>`;
      }
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        filters: [{ name: `${format.toUpperCase()} File`, extensions: [ext] }],
        defaultPath: `folder_reading_plan.${ext}`
      });
      if (!filePath) return;
      const API_BASE = await getApiBaseUrl();
      const response = await fetch(`${API_BASE}/api/system/save-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, content: bom + content })
      });
      if (!response.ok) throw new Error('Failed to save file');
      showToast('تم التصدير بنجاح', 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('فشل التصدير', 'error');
    }
  };

  // Folder mode handlers
  const handleSelectFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false
      });
      if (selected && typeof selected === 'string') {
        setSelectedFolder(selected);
        setFolderData(null);
        setFolderPlan([]);
        setIsFolderPlanGenerated(false);
        setFolderError(null);
      }
    } catch (err) {
      console.error('Failed to open folder dialog', err);
    }
  };

  const recalculateFolderDays = useCallback((data: ScanFolderResponse, ppd: number) => {
    const treeWithDays = autoAssignDays(data.tree, ppd);
    const treeWithFolderDays = folderDaysFromTree(treeWithDays);
    return { ...data, tree: treeWithFolderDays };
  }, []);

  const handleScanFolder = async () => {
    if (!selectedFolder) return;
    setFolderLoading(true);
    setFolderError(null);
    try {
      const data = await bookmarkApi.scanFolder(selectedFolder, true);
      const updated = recalculateFolderDays(data, folderPagesPerDay);
      setFolderData(updated);
    } catch (err) {
      console.error(err);
      setFolderError('فشل مسح المجلد. الرجاء المحاولة مرة أخرى.');
    } finally {
      setFolderLoading(false);
    }
  };

  const handleAssignDays = (path: string, delta: number) => {
    if (!folderData) return;
    const allFiles = collectAllFiles(folderData.tree);
    const target = allFiles.find(f => f.path === path);
    if (!target) return;
    const currentVal = (target as EntryWithDays).assignedDays || 0;
    const newVal = Math.max(0, currentVal + delta);
    setFolderData({
      ...folderData,
      tree: assignDaysToTree(folderData.tree, path, newVal)
    });
  };

  const handleSetDays = (path: string, days: number) => {
    if (!folderData) return;
    const newVal = Math.max(0, days);
    setFolderData({
      ...folderData,
      tree: assignDaysToTree(folderData.tree, path, newVal)
    });
  };

  const handleGenerateFolderPlan = () => {
    if (!folderData) return;
    const allFiles = collectAllFiles(folderData.tree);
    if (allFiles.length === 0) return;

    const withDays = allFiles
      .map(f => ({ file: f, days: (f as EntryWithDays).assignedDays || 0 }))
      .filter(f => f.days > 0);

    if (withDays.length === 0) {
      showToast('فضلاً أدخل عدد الصفحات اليومية أولاً', 'error');
      return;
    }

    const plan: FolderDayPlan[] = [];
    let currentDate = new Date(startDate);
    let dayCounter = 1;

    for (const { file, days } of withDays) {
      const pagesPerDayChunk = Math.max(1, Math.ceil(file.page_count / days));
      for (let d = 0; d < days; d++) {
        plan.push({
          day: dayCounter++,
          date: currentDate.toISOString(),
          file: file.name,
          page_count: pagesPerDayChunk
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    setFolderPlan(plan);
    setIsFolderPlanGenerated(true);
    showToast(`تم إنشاء خطة: ${withDays.length} ملفات في ${plan.length} يوم`, 'success');
  };

  const getBarColor = (percentage: number) => {
    if (percentage >= 25) return 'bg-red-500';
    if (percentage >= 15) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تحليل وزن الفصول</h2>
          <p className="text-gray-500">تحليل أحجام الفصول وإنشاء خطة قراءة مخصصة</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`btn ${showHistory ? 'btn-primary' : 'btn-outline'} gap-2`}
        >
          <HistoryIcon size={18} />
          <span>سجل العمليات</span>
        </button>
      </div>

      <div className="flex gap-6 h-full overflow-hidden">
        {showHistory && (
          <div className="w-80 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-lg z-10 animate-in slide-in-from-right duration-200">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-medium text-gray-700 flex justify-between items-center">
              <span>السجل السابق ({history.length})</span>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><CheckCircle size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">لا يوجد سجل سابق</div>
              ) : (
                history.map(item => (
                  <div key={item.id} onClick={() => loadHistoryItem(item)} className="p-3 bg-gray-50 hover:bg-indigo-50 rounded-lg cursor-pointer border border-transparent hover:border-indigo-200 transition-all group">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-gray-800 text-sm truncate w-40" title={item.pdfName}>{item.pdfName}</h4>
                      <button onClick={(e) => deleteHistoryItem(item.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(item.createdAt).toLocaleDateString()} - {new Date(item.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="flex gap-2 text-xs text-indigo-600 bg-indigo-50/50 p-1 rounded">
                      <span>{item.settings.pagesPerDay} ص/يوم</span>
                      <span>•</span>
                      <span>{item.settings.availableDays} يوم</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mode Toggle */}
          <div className="card mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => { setMode('file'); setIsAnalyzed(false); setIsPlanGenerated(false); setError(null); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <FileText size={16} className="inline ml-1" />
                  ملف واحد
                </button>
                <button
                  onClick={() => { setMode('folder'); setFolderError(null); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'folder' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Folder size={16} className="inline ml-1" />
                  مجلد + مجلدات فرعية
                </button>
              </div>
            </div>

            {mode === 'file' && (
              <>
                <div className="flex items-center justify-between">
                  <button onClick={handleSelectFile} className="btn btn-outline flex items-center gap-2" disabled={loading}>
                    <FileText size={18} />
                    <span>{selectedFile ? 'تغيير الملف' : 'اختيار ملف PDF'}</span>
                  </button>
                  {selectedFile && (
                    <button onClick={handleAnalyze} className="btn btn-primary flex items-center gap-2 px-6" disabled={loading}>
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
                      <span className="font-semibold">تحليل الفصول</span>
                    </button>
                  )}
                </div>
                {selectedFile && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-medium text-gray-900 truncate" title={selectedFile}>
                        {selectedFile.split(/[/\\]/).pop()}
                      </h3>
                      <p className="text-xs text-gray-500 truncate dir-ltr text-right">{selectedFile}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === 'folder' && (
              <>
                <div className="flex items-center justify-between">
                  <button onClick={handleSelectFolder} className="btn btn-outline flex items-center gap-2" disabled={folderLoading}>
                    <Folder size={18} />
                    <span>{selectedFolder ? 'تغيير المجلد' : 'اختيار مجلد'}</span>
                  </button>
                  {selectedFolder && (
                    <button onClick={handleScanFolder} className="btn btn-primary flex items-center gap-2 px-6" disabled={folderLoading}>
                      {folderLoading ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
                      <span className="font-semibold">مسح المجلد</span>
                    </button>
                  )}
                </div>
                {selectedFolder && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                      <Folder size={20} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-medium text-gray-900 truncate" title={selectedFolder}>
                        {selectedFolder.split(/[/\\]/).pop()}
                      </h3>
                      <p className="text-xs text-gray-500 truncate dir-ltr text-right">{selectedFolder}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {toast && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>{toast.message}</span>
              </div>
            )}
            {error && mode === 'file' && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex flex-col gap-3 border border-red-100 animate-fade-in text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
                {onNavigate && error.includes('Bookmarks') && (
                  <div className="flex justify-end">
                    <button onClick={() => onNavigate('bookmark')} className="px-4 py-2 bg-white border border-red-200 rounded-lg text-red-700 hover:bg-red-100 transition-colors flex items-center gap-2 font-medium">
                      <BookOpen size={16} />
                      انتقل لـ "إدارة الفهرس" لإضافة فصول للملف
                    </button>
                  </div>
                )}
              </div>
            )}
            {folderError && mode === 'folder' && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-100 text-sm">
                <AlertCircle size={18} />
                <span>{folderError}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">

            {/* File Mode: Chapter Analysis */}
            {mode === 'file' && isAnalyzed && (
              <>
                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={20} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">توزيع أوزان الفصول</h3>
                    <span className="text-sm text-gray-500 mr-auto flex items-center gap-2">
                      <span>الصفحات المختارة: <strong>{getIncludedPageCount()}</strong></span>
                      <span className="text-gray-300">|</span>
                      <span>الإجمالي: {totalBookPages}</span>
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {chapters.map((chapter, index) => (
                      <div key={index} className={`group ${!chapter.included ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex items-center gap-3 mb-1">
                          <input type="checkbox" checked={chapter.included} onChange={() => toggleChapter(index)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" title="تضمين الفصل في الخطة" />
                          <span className="text-sm font-medium text-gray-700 truncate flex-1 block">{chapter.title}</span>
                          <span className="text-xs text-gray-500">{chapter.page_count} صفحة ({chapter.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                          <div className={`absolute top-0 right-0 h-full ${getBarColor(chapter.percentage)} opacity-20`} style={{ width: `${chapter.percentage}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={20} className="text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">إنشاء خطة القراءة</h3>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-xl mb-6 flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-indigo-900 mb-1.5 opacity-80">تاريخ البدء</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input bg-white border-indigo-200 focus:border-indigo-500 h-10" />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className="block text-xs font-medium text-indigo-900 mb-1.5 opacity-80">صفحات يومياً</label>
                      <input type="number" value={pagesPerDay} onChange={(e) => { const val = parseInt(e.target.value) || 1; setPagesPerDay(val); setAvailableDays(Math.ceil(getIncludedPageCount() / val)); }} min={1} className="input bg-white border-indigo-200 focus:border-indigo-500 h-10" />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className="block text-xs font-medium text-indigo-900 mb-1.5 opacity-80">الأيام المقدرة</label>
                      <input type="number" value={availableDays} onChange={(e) => { const val = parseInt(e.target.value) || 1; setAvailableDays(val); setPagesPerDay(Math.ceil(getIncludedPageCount() / val)); }} min={1} className="input bg-white border-indigo-200 focus:border-indigo-500 h-10" />
                    </div>
                    <button onClick={handleGeneratePlan} className="btn btn-primary h-10 px-6 gap-2 shadow-sm">
                      <Play size={18} />
                      <span>إنشاء الخطة</span>
                    </button>
                  </div>
                </div>

                {isPlanGenerated && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BookOpen size={20} className="text-indigo-600" />
                        <h3 className="font-semibold text-gray-900">خطة القراءة</h3>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                          <button onClick={() => setViewMode('table')} className={`px-3 py-1 text-xs font-medium rounded transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>جدول</button>
                          <button onClick={() => setViewMode('calendar')} className={`px-3 py-1 text-xs font-medium rounded transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>تقويم</button>
                        </div>
                        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 items-center">
                          <span className="text-xs font-medium text-gray-500 mx-1">تصدير:</span>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportPlan('csv')}>CSV</button>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportPlan('md')}>MD</button>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportPlan('txt')}>TXT</button>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportPlan('doc')}>Word</button>
                          <div className="w-px h-4 bg-gray-300 mx-1"></div>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-indigo-700 flex items-center gap-1" onClick={handleExportICS} title="Add to Calendar">
                            <CalendarIcon size={12} /> ICS
                          </button>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-amber-600 flex items-center gap-1" onClick={handleTestNotification} title="Test Notification">
                            <Bell size={12} />
                          </button>
                          <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-cyan-600 flex items-center gap-1" onClick={handleScheduledTest} title="Test Schedule (5s)">
                            <Clock size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {viewMode === 'table' ? (
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full relative">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">اليوم</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">التاريخ</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">الفصل</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">الصفحات</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">الكمية</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.map((day, index) => (
                              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium text-indigo-600">اليوم {day.day}</td>
                                <td className="py-3 px-4 text-gray-600">{new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                                <td className="py-3 px-4 text-gray-900 max-w-xs truncate" title={day.chapter}>{day.chapter}</td>
                                <td className="py-3 px-4 text-gray-600 ltr text-right">{day.pages}</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{day.page_count} صفحة</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-xl max-h-[500px] overflow-y-auto custom-scrollbar">
                        {Array.from(new Set(plan.map(d => d.date.substring(0, 7)))).sort().map(monthStr => {
                          const monthDate = new Date(monthStr + '-01');
                          return (
                            <div key={monthStr} className="mb-8">
                              <h4 className="font-bold text-gray-800 mb-3 sticky top-0 bg-gray-50 py-2 border-b border-gray-200">{monthDate.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</h4>
                              <div className="grid grid-cols-7 gap-2 text-center text-xs dir-rtl">
                                {['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(d => <div key={d} className="text-gray-400 font-medium py-1">{d}</div>)}
                                {Array.from({ length: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`}></div>)}
                                {(() => {
                                  const days = [];
                                  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                                  for (let i = 1; i <= lastDay; i++) {
                                    const dateStr = `${monthStr}-${String(i).padStart(2, '0')}`;
                                    const planDay = plan.find(d => d.date.startsWith(dateStr));
                                    days.push(
                                      <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${planDay ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-100' : 'bg-white border-gray-100 text-gray-300 scale-95'}`} title={planDay ? `${planDay.chapter} (${planDay.pages})` : ''}>
                                        <span className="font-bold text-lg leading-none">{i}</span>
                                        {planDay && <span className="text-[10px] opacity-80 mt-1 font-medium">{planDay.page_count} ص</span>}
                                      </div>
                                    );
                                  }
                                  return days;
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Folder Mode: Tree + Plan */}
            {mode === 'folder' && folderData && (
              <>
                {/* Summary */}
                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={20} className="text-amber-600" />
                    <h3 className="font-semibold text-gray-900">هيكل المجلدات والملفات</h3>
                    <span className="text-sm text-gray-500 mr-auto">
                      <strong>{folderData.total_files}</strong> ملف • <strong>{folderData.total_pages}</strong> صفحة • <strong className="text-indigo-600">{sumDays(folderData.tree)}</strong> يوم
                    </span>
                  </div>

                  {/* Tree */}
                  <div className="bg-gray-50 rounded-xl p-3 max-h-[400px] overflow-y-auto border border-gray-100">
                    {folderData.tree.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">لا توجد ملفات PDF في هذا المجلد</div>
                    ) : (
                      <TreeNodes
                        entries={folderData.tree}
                        depth={0}
                        onAssignDays={handleAssignDays}
                      />
                    )}
                  </div>
                </div>

                {/* Day Assignment */}
                <div className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={20} className="text-amber-600" />
                    <h3 className="font-semibold text-gray-900">جدول القراءة حسب عدد الصفحات</h3>
                  </div>

                  <div className="bg-amber-50 p-4 rounded-xl">
                    <div className="flex flex-wrap items-end gap-4 mb-4">
                      <div className="min-w-[120px]">
                        <label className="block text-xs font-medium text-amber-900 mb-1.5 opacity-80">
                          الصفحات يومياً
                        </label>
                        <input
                          type="number"
                          value={folderPagesPerDay}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setFolderPagesPerDay(val);
                            if (folderData) {
                              const updated = recalculateFolderDays(folderData, val);
                              setFolderData(updated);
                            }
                          }}
                          min={1}
                          className="input bg-white border-amber-200 focus:border-amber-500 h-10"
                        />
                      </div>
                      <div className="min-w-[120px]">
                        <label className="block text-xs font-medium text-amber-900 mb-1.5 opacity-80">
                          تاريخ البدء
                        </label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input bg-white border-amber-200 focus:border-amber-500 h-10" />
                      </div>
                      <button
                        onClick={handleGenerateFolderPlan}
                        className="btn btn-primary h-10 px-6 gap-2 shadow-sm"
                      >
                        <Play size={18} />
                        <span>إنشاء الخطة</span>
                      </button>
                    </div>

                    <div className="bg-white rounded-xl p-3 mb-3 border border-amber-100">
                      <div className="text-sm text-amber-900 flex items-center justify-between">
                        <span>
                          إجمالي الصفحات: <strong>{folderData.total_pages}</strong>
                        </span>
                        <span>
                          صفحات/يوم: <strong>{folderPagesPerDay}</strong>
                        </span>
                        <span className="text-indigo-700 font-semibold text-base">
                          إجمالي الأيام: <strong>{sumDays(folderData.tree)}</strong>
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-amber-700 mb-3">
                      توزيع الأيام تلقائي حسب حجم كل ملف. يمكنك تعديل الأيام يدوياً لكل ملف.
                    </p>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {(() => {
                        const allFiles = collectAllFiles(folderData.tree);
                        if (allFiles.length === 0) {
                          return <div className="text-center py-4 text-gray-400 text-sm">لا توجد ملفات لعرضها</div>;
                        }
                        return allFiles.map((file, i) => {
                          const ef = file as EntryWithDays;
                          return (
                            <div key={i} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-amber-100">
                              <FileText size={16} className="text-blue-500 shrink-0" />
                              <span className="text-sm text-gray-700 truncate flex-1" title={file.name}>{file.name}</span>
                              <span className="text-xs text-gray-500 ml-2">{file.page_count} صفحة</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleAssignDays(file.path, -1)}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  value={ef.assignedDays || 0}
                                  onChange={(e) => handleSetDays(file.path, parseInt(e.target.value) || 0)}
                                  min={0}
                                  className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1 px-2 focus:border-indigo-400 focus:ring-0 dir-ltr"
                                />
                                <button
                                  onClick={() => handleAssignDays(file.path, 1)}
                                  className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <span className="text-xs text-gray-400">يوم</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Folder Plan */}
                {isFolderPlanGenerated && folderPlan.length > 0 && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BookOpen size={20} className="text-amber-600" />
                        <h3 className="font-semibold text-gray-900">خطة القراءة - حسب الملفات</h3>
                        <span className="text-sm text-gray-500 mr-3">{folderPlan.length} يوم</span>
                      </div>
                      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 items-center">
                        <span className="text-xs font-medium text-gray-500 mx-1">تصدير:</span>
                        <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportFolderPlan('csv')}>CSV</button>
                        <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportFolderPlan('md')}>MD</button>
                        <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportFolderPlan('txt')}>TXT</button>
                        <button className="px-3 py-1 text-xs font-medium hover:bg-white rounded shadow-sm transition-colors text-gray-700" onClick={() => handleExportFolderPlan('doc')}>Word</button>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="w-full relative">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                          <tr>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">اليوم</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">التاريخ</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">الملف</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">الصفحات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {folderPlan.map((day, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-amber-50">
                              <td className="py-3 px-4 font-medium text-amber-600">اليوم {day.day}</td>
                              <td className="py-3 px-4 text-gray-600">
                                {new Date(day.date).toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="py-3 px-4 text-gray-900 max-w-xs truncate" title={day.file}>{day.file}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{day.page_count} صفحة</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty states */}
            {mode === 'file' && !isAnalyzed && (
              <div className="card text-center py-16">
                <BarChart3 size={64} className="mx-auto text-gray-200 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">ابدأ بتحليل ملف PDF</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  اختر ملف PDF يحتوي على فهرس (bookmarks) لتحليل توزيع الفصول وإنشاء خطة قراءة مخصصة
                </p>
              </div>
            )}
            {mode === 'folder' && !folderData && (
              <div className="card text-center py-16">
                <Folder size={64} className="mx-auto text-gray-200 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">ابدأ بمسح مجلد</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  اختر مجلد يحتوي على ملفات PDF في مجلدات فرعية لتحليل أوزانها وإنشاء خطة قراءة
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
