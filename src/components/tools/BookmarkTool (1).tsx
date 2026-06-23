import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  BookOpen, Copy, ChevronLeft, ChevronRight, Check, Plus,
  Scissors, FileText, ArrowRight, Sparkles, ExternalLink,
  Edit3, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { FileInput } from '../ui/FileInput';
import { getDefaultOutputPath } from '../../lib/utils';

type Mode = 'extract' | 'split' | 'insert' | 'transfer';
type InsertStep = 1 | 2 | 3 | 4;

export const BookmarkTool: React.FC = () => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [outputDir, setOutputDir] = useState('');

  // Auto-set output path/dir based on input file
  const handleInputChange = async (path: string) => {
    setInputPath(path);
    if (path) {
      if (!outputPath && mode === 'insert') {
        setOutputPath(getDefaultOutputPath(path, '_bookmarked'));
      }
      if (mode === 'split') {
        if (!outputDir) {
          const separator = path.includes('\\') ? '\\' : '/';
          const lastSep = path.lastIndexOf(separator);
          if (lastSep > 0) {
            setOutputDir(path.substring(0, lastSep));
          }
        }
      }
    }
  };

  const [bookmarks, setBookmarks] = useState('');
  const [bookmarkText, setBookmarkText] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const [parsedBookmarks, setParsedBookmarks] = useState<Array<{title: string, page: number, level: number}>>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('extract');
  const [insertStep, setInsertStep] = useState<InsertStep>(1);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [sourcePath, setSourcePath] = useState('');
  const [considerLevels, setConsiderLevels] = useState(true);
  const [ignoreHierarchy, setIgnoreHierarchy] = useState(false);
  const [availableLevels, setAvailableLevels] = useState<number[]>([]);
  const [targetLevel, setTargetLevel] = useState<number>(1);

  // Split settings
  const [splitLevel1Only, setSplitLevel1Only] = useState(true);

  // Preview state
  const [currentPreviewPage, setCurrentPreviewPage] = useState<number>(1);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeBookmarkIndex, setActiveBookmarkIndex] = useState<number>(-1);

  // Auto-clear status messages
  useEffect(() => {
    if (status.type === 'success') {
      const timer = setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Fetch preview when page or offset changes
  const fetchPreview = async (page: number) => {
    if (!inputPath) return;
    setLoadingPreview(true);
    try {
      const res = await api.renderPage(inputPath, page);
      if (res.success && res.data?.data) {
        setPreviewImage(res.data.data.image);
        setCurrentPreviewPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Fetch levels when mode splits or input path changes
  useEffect(() => {
    const fetchLevels = async () => {
      if (mode === 'split' && inputPath) {
        try {
          const res = await api.getBookmarkLevels(inputPath);
          if (res.success && res.data?.data) {
            const levels = Object.keys(res.data.data.levels).map(Number).sort((a, b) => a - b);
            setAvailableLevels(levels);
            setTargetLevel(levels.includes(1) ? 1 : (levels[0] || 1));
          }
        } catch (err) {
          console.error("Failed to fetch levels:", err);
        }
      }
    };
    fetchLevels();
  }, [mode, inputPath]);

  // Extract bookmarks (Extract Mode)
  const handleExtract = async () => {
    if (!inputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري استخراج الفهرس...' });
    
    const res = await api.extractBookmarks(inputPath);
    setLoading(false);
    
    if (res.success && res.data?.data) {
      setBookmarks(res.data.data.formatted_text);
      setStatus({ type: 'success', message: `تم استخراج ${res.data.data.count} عنصر` });
    } else {
      setStatus({ type: 'error', message: res.error || 'لم يتم العثور على فهرس' });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookmarks);
    setStatus({ type: 'success', message: 'تم النسخ للحافظة' });
  };

  const copyPromptForAi = () => {
    const prompt = `Based on the text provided, please generate a structured Table of Contents (Bookmarks) in the exact format: "Title - Page".
Rules:
1. Every line must follow: "Chapter Title - PageNumber"
2. Use indentation (2 spaces) for sub-chapters.
3. Only output the list.`;

    // Optimistic success
    navigator.clipboard.writeText(prompt);
    setStatus({ type: 'success', message: '✅ تم نسخ الطلب (Prompt) بنجاح!' });
  };

  const openAiStudio = async () => {
    const url = 'https://aistudio.google.com/prompts/new_chat';
    api.openUrl(url); // Fire and forget for robustness
  };

  // Split by bookmarks
  const handleSplit = async () => {
    if (!inputPath || !outputDir) {
      if (!outputDir) setStatus({ type: 'error', message: 'يرجى اختيار مجلد الحفظ أولاً' });
      return;
    }
    setLoading(true);
    setStatus({ type: '', message: 'جاري التقسيم...' });
    
    const res = await api.splitByBookmarks(
      inputPath,
      outputDir,
      splitLevel1Only,
      true, // preserveBookmarks
      undefined, // selectedIndices
      ignoreHierarchy,
      targetLevel
    );
    setLoading(false);
    
    if (res.success && res.data?.data) {
      setStatus({ type: 'success', message: `تم إنشاء ${res.data.data.total_files} ملف` });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  // Parse text into bookmarks
  const handleParse = async () => {
    if (!bookmarkText.trim()) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري التحليل...' });

    const res = await api.parseBookmarks(bookmarkText, considerLevels);
    setLoading(false);

    if (res.success && res.data) {
      setParsedBookmarks(res.data.data);
      setInsertStep(3);
      setStatus({ type: 'success', message: `تم تحليل ${res.data.data.length} عنوان بنجاح` });
    } else {
      setStatus({ type: 'error', message: res.error || 'لم نتمكن من تحليل النص. تأكد من التنسيق: (العنوان - الصفحة)' });
    }
  };

  // Insert bookmarks into PDF
  const handleInsert = async () => {
    if (!inputPath || !outputPath || parsedBookmarks.length === 0) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري إدراج الفهرس...' });
    
    // Pass pageOffset to backend to ensure it applies to all bookmarks
    const res = await api.insertBookmarks(inputPath, parsedBookmarks, outputPath, pageOffset);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: `✅ تم إدراج ${parsedBookmarks.length} إشارة مرجعية بنجاح!` });
      setInsertStep(4);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء الإدراج' });
    }
  };

  // Transfer bookmarks
  const handleTransfer = async () => {
    if (!sourcePath || !inputPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري نقل الفهرس...' });

    const res = await api.transferBookmarks(sourcePath, inputPath, outputPath);
    setLoading(false);

    if (res.success) {
      setStatus({ type: 'success', message: `✅ تم نقل الفهرس (${res.data?.data?.count} عنصر) بنجاح!` });
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء النقل' });
    }
  };

  const modes = [
    { id: 'extract' as Mode, label: 'استخراج الفهرس', icon: FileText },
    { id: 'insert' as Mode, label: 'إدراج فهرس', icon: Plus },
    { id: 'transfer' as Mode, label: 'نقل الفهرس', icon: Copy },
    { id: 'split' as Mode, label: 'تقسيم حسب الفهرس', icon: Scissors },
  ];

  return (
    <div className="card h-full flex flex-col animate-fade-in relative z-0">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-amber-50 text-amber-600 shadow-sm">
          <BookOpen size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">إدارة الفهرس</h2>
          <p className="text-secondary mt-1">أدوات متكاملة للتعامل مع فهارس (Bookmarks) ملفات PDF.</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-4 mb-10 overflow-x-auto pb-2">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setInsertStep(1); setStatus({ type: '', message: '' }); }}
            className={`flex-1 py-4 px-6 rounded-xl font-medium text-base transition-all flex items-center justify-center gap-3 border ${mode === m.id
                ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                : 'bg-white border-border text-secondary hover:bg-gray-50'
            }`}
          >
            <m.icon size={20} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {/* EXTRACT MODE */}
        {mode === 'extract' && (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto">
            <FileInput
              value={inputPath}
              onChange={handleInputChange}
              label="1. اختر ملف PDF"
              placeholder="مثال: E:\Documents\book.pdf"
              accept=".pdf"
            />

            <button
              onClick={handleExtract}
              disabled={loading || !inputPath}
              className="btn-enhanced w-full py-4 text-lg font-medium shadow-md hover:shadow-lg transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'جاري المعالجة...' : 'استخراج الفهرس الآن'}
            </button>

            {bookmarks && (
              <div className="mt-4 animate-slide-up">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-semibold text-primary">الفهرس المستخرج:</label>
                  <button
                    onClick={copyToClipboard}
                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2 text-sm font-medium px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
                  >
                    <Copy size={16} /> نسخ النص
                  </button>
                </div>
                <div className="relative group">
                  <pre className="p-5 bg-zinc-50 rounded-xl text-sm max-h-80 overflow-auto border border-zinc-200 whitespace-pre-wrap leading-relaxed font-mono custom-scrollbar shadow-inner">
                    {bookmarks}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRANSFER MODE */}
        {mode === 'transfer' && (
          <div className="flex flex-col gap-8 max-w-2xl mx-auto animate-fade-in">
            <div className="text-center mb-2">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Copy size={32} />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">نقل الفهرس بين الملفات</h3>
              <p className="text-secondary text-sm">قم بنقل الفهرس من ملف (أصلي) إلى ملف آخر (محسن/OCR)</p>
            </div>

            <div className="space-y-6">
              <FileInput
                value={sourcePath}
                onChange={setSourcePath}
                label="1. الملف المصدر (الذي يحتوي على الفهرس)"
                placeholder="اختر الملف الأصلي..."
                accept=".pdf"
              />

              <FileInput
                value={inputPath}
                onChange={(path) => {
                  setInputPath(path);
                  if (path && !outputPath) {
                    setOutputPath(getDefaultOutputPath(path, '_with_bookmarks'));
                  }
                }}
                label="2. الملف الوجهة (المراد إضافة الفهرس إليه)"
                placeholder="اختر الملف المحسن..."
                accept=".pdf"
              />

              <FileInput
                value={outputPath}
                onChange={setOutputPath}
                label="3. مسار حفظ الملف الناتج"
                placeholder="أين تود حفظ الملف الجديد؟"
                isSave
              />

              <button
                onClick={handleTransfer}
                disabled={loading || !sourcePath || !inputPath || !outputPath}
                className="btn-enhanced w-full py-5 text-xl font-bold mt-4 shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'جاري المعالجة...' : 'نقل الفهرس الآن'}
              </button>
            </div>

            <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg text-amber-600 shadow-sm shrink-0">
                <Info size={20} />
              </div>
              <div className="text-sm text-amber-800 leading-relaxed">
                <p className="font-bold mb-1">تنبيه هام:</p>
                تأكد من أن الملفين لهما نفس عدد الصفحات أو أن الملف الوجهة يحتوي على نفس ترتيب الصفحات لضمان دقة الفهارس.
              </div>
            </div>
          </div>
        )}

        {/* INSERT MODE */}
        {mode === 'insert' && (
          <div className="space-y-8">
            {/* Step Indicator */}
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between relative px-2 py-6 mb-8">
                {/* Line across */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-[-1]" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-amber-500 -translate-y-1/2 z-[-1] transition-all duration-500 ease-out"
                  style={{ width: `${((insertStep - 1) / 3) * 100}%` }}
                />

                {[1, 2, 3, 4].map(step => (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${insertStep === step ? 'bg-amber-500 text-white border-amber-500 shadow-lg scale-110' :
                      insertStep > step ? 'bg-white text-amber-500 border-amber-500' : 'bg-white text-gray-300 border-gray-100'
                      }`}>
                      {insertStep > step ? <Check size={20} /> : step}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${insertStep >= step ? 'text-amber-600' : 'text-gray-300'}`}>
                      {step === 1 ? 'الملف' : step === 2 ? 'الفهرس' : step === 3 ? 'المراجعة' : 'النتيجة'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Select PDF */}
            {insertStep === 1 && (
              <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
                    <FileText size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-2">اختيار ملف الوجهة</h3>
                  <p className="text-secondary">قم باختيار ملف الـ PDF الذي تود إضافة الفهارس إليه</p>
                </div>

                <FileInput
                  value={inputPath}
                  onChange={handleInputChange}
                  label="اختر ملف PDF"
                  placeholder="أدخل المسار الكامل للملف..."
                  accept=".pdf"
                />

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => inputPath && setInsertStep(2)}
                    disabled={!inputPath}
                    className="btn btn-primary px-10 py-4 gap-3 text-lg font-semibold shadow-lg shadow-amber-500/10"
                  >
                    التالي <ChevronLeft size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Prepare Text & Paste */}
            {insertStep === 2 && (
              <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-2">تجهيز ولصق الفهرس</h3>
                  <p className="text-secondary">قم بإدخال العناوين بتنسيق: <strong>العنوان - رقم الصفحة</strong></p>
                </div>

                {/* AI Assistant Tool-box */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 shadow-sm">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm shrink-0">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-indigo-900 mb-1">المساعد الذكي (AI Studio)</h4>
                      <p className="text-sm text-indigo-700/80 leading-relaxed">
                        يمكنك استخدام نماذج الذكاء الاصطناعي (مثل Gemini) لمساعدتك في استخراج الفهرس من النص.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={copyPromptForAi}
                      className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-indigo-100 rounded-xl text-indigo-700 font-bold transition-all hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-md active:scale-95"
                    >
                      <Copy size={18} />
                      نسخ طلب التقسيم (Prompt)
                    </button>
                    <button
                      onClick={openAiStudio}
                      className="flex items-center justify-center gap-3 p-4 bg-indigo-600 rounded-xl text-white font-bold transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95 shadow-md shadow-indigo-200"
                    >
                      <ExternalLink size={18} />
                      فتح Google AI Studio
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute top-4 right-4 text-xs font-bold text-gray-400 bg-white/80 px-2 py-1 rounded">نص الفهرس</div>
                  <textarea
                    value={bookmarkText}
                    onChange={e => setBookmarkText(e.target.value)}
                    placeholder={'مقدمة الكتاب - 1\nالفصل الأول: البداية - 12\n  المطلب الأول - 14\nالخاتمة - 150'}
                    className="input min-h-[300px] pt-12 font-mono text-sm leading-loose resize-y shadow-inner border-gray-200"
                    dir="rtl"
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <label className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors border border-blue-100/50">
                    <input
                      type="checkbox"
                      checked={considerLevels}
                      onChange={(e) => setConsiderLevels(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-primary text-sm">مراعاة المستويات (Consider Levels)</span>
                      <p className="text-secondary text-[10px]">استخدام السطر الفارغ لتمييز العناوين الرئيسية</p>
                    </div>
                  </label>

                  <button
                    onClick={handleParse}
                    disabled={loading || !bookmarkText.trim()}
                    className="btn-enhanced w-full py-4 text-lg font-bold shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? 'جاري التحليل...' : 'تحليل العناوين للمراجعة 📋'}
                  </button>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setInsertStep(1)} className="btn btn-secondary flex-1 py-4 font-bold text-gray-500">
                    <ChevronRight size={20} /> السابق
                  </button>
                  <button
                    onClick={handleParse}
                    disabled={loading || !bookmarkText.trim()}
                    className="btn btn-primary flex-[2] py-4 text-lg font-bold shadow-lg shadow-blue-500/20"
                  >
                    {loading ? 'جاري التحليل...' : <span className="flex items-center gap-2">تحليل المراجعة والإدراج <ChevronLeft size={20} /></span>}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Final Settings */}
            {insertStep === 3 && (
              <div className="max-w-7xl mx-auto space-y-8 animate-fade-in px-4">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-2">المراجعة النهائية والتأكيد</h3>
                  <p className="text-secondary">تحقق من التنسيق وأرقام الصفحات قبل الإدراج</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                  {/* Right Column: Table and Settings */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <label className="text-sm font-bold text-secondary">العناوين المكتشفة ({parsedBookmarks.length})</label>
                      <button onClick={() => setInsertStep(2)} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
                        <Edit3 size={12} /> تعديل النص
                      </button>
                    </div>
                    <div className="max-h-[600px] overflow-auto border border-border rounded-2xl bg-white shadow-sm custom-scrollbar">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 text-secondary border-b z-10">
                          <tr>
                            <th className="p-4 text-right">العنوان</th>
                            <th className="p-4 text-center w-24">الصفحة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {parsedBookmarks.map((b, i) => (
                            <tr
                              key={i}
                              onClick={() => {
                                setActiveBookmarkIndex(i);
                                fetchPreview(b.page + pageOffset);
                              }}
                              className={`cursor-pointer transition-colors ${activeBookmarkIndex === i ? 'bg-amber-50 border-r-4 border-amber-500' : 'hover:bg-indigo-50/30'}`}
                            >
                              <td className="p-4" style={{ paddingRight: b.level === 1 ? '1rem' : `${b.level * 1.5}rem` }}>
                                <div className="flex items-center gap-2">
                                  {b.level > 1 && <span className="text-gray-300">↳</span>}
                                  <span className={`${b.level === 1 ? 'font-bold text-indigo-900' : 'text-gray-600'}`}>
                                    {b.title}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-center tabular-nums font-bold text-amber-600">
                                {b.page + pageOffset}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Settings & Final Action */}
                    <div className="card p-8 border-amber-100 bg-amber-50/50 space-y-6 shadow-sm">
                      <div className="flex items-center gap-3 text-amber-700 font-bold mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                          <Info size={18} />
                        </div>
                        <span>إعدادات الإدراج النهائية</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-md flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <FileText size={18} />
                              <span className="font-bold text-sm">إزاحة الصفحات:</span>
                              <input
                                type="number"
                                value={pageOffset}
                                onChange={e => setPageOffset(parseInt(e.target.value) || 0)}
                                className="bg-transparent w-16 text-center font-bold text-white placeholder-white/50 border-b border-white/20 focus:border-white outline-none transition-colors"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPageOffset(prev => prev + 1)}
                                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                                title="زيادة (+1)"
                              >
                                <ChevronLeft size={20} />
                              </button>
                              <button
                                onClick={() => setPageOffset(prev => prev - 1)}
                                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                                title="إنقاص (-1)"
                              >
                                <ChevronRight size={20} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-amber-700 leading-tight px-1">
                            سيتم إضافة هذا الرقم لجميع الصفحات (مثلاً: +15).
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-amber-900 block">مكان الحفظ</label>
                          <FileInput
                            value={outputPath}
                            onChange={setOutputPath}
                            placeholder="مسار الحفظ..."
                            isSave
                          />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-amber-100 flex flex-col gap-4">
                        <button
                          onClick={handleInsert}
                          disabled={loading || !outputPath}
                          className="btn-enhanced w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 font-bold text-lg"
                        >
                          {loading ? 'جاري الإدراج...' : (
                            <span className="flex items-center justify-center gap-3">
                              تأكيد وإدراج الفهرس الآن <Check size={24} />
                            </span>
                          )}
                        </button>
                        <button onClick={() => setInsertStep(2)} className="text-sm font-bold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2">
                          <ChevronRight size={16} /> العودة لتعديل النص
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Left Column: Huge PDF Preview (Sticky) */}
                  <div className="space-y-6 order-1 lg:order-2 lg:sticky lg:top-8">
                    {/* PDF Preview Corner */}
                    <div className="card p-0 overflow-hidden border-indigo-200 bg-white shadow-xl relative group">
                      <div className="bg-indigo-600 text-white px-4 py-3 text-xs font-bold uppercase tracking-wider flex justify-between items-center shadow-md">
                        <div className="flex items-center gap-2">
                          <FileText size={16} />
                          <span>معاينة الصفحة: {currentPreviewPage}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => fetchPreview(currentPreviewPage - 1)}
                            disabled={currentPreviewPage <= 1 || loadingPreview}
                            className="bg-white/10 hover:bg-white/20 p-1 rounded-md transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                          >
                            <ChevronRight size={18} />
                          </button>
                          <button
                            onClick={() => fetchPreview(currentPreviewPage + 1)}
                            disabled={loadingPreview}
                            className="bg-white/10 hover:bg-white/20 p-1 rounded-md transition-all disabled:opacity-30 disabled:scale-95 active:scale-90"
                          >
                            <ChevronLeft size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="bg-zinc-100 flex items-center justify-center relative min-h-[600px] lg:min-h-[750px] transition-all duration-500">
                        {loadingPreview ? (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                            <span className="text-sm font-bold text-indigo-600 tracking-widest">جاري التحميل...</span>
                          </div>
                        ) : previewImage ? (
                          <img
                            src={previewImage}
                            alt="Page Preview"
                            className="w-full h-full object-contain animate-fade-in shadow-inner"
                          />
                        ) : (
                          <div className="text-center p-12 text-gray-400 max-w-xs mx-auto">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 opacity-50">
                              <FileText size={48} />
                            </div>
                            <p className="text-sm font-medium leading-relaxed">
                              انقر على أحد العناوين في القائمة المقابلة لمعاينة الصفحة هنا والتأكد من تطابق الفهرس
                            </p>
                          </div>
                        )}

                        {/* Sync Overlay */}
                        {activeBookmarkIndex !== -1 && !loadingPreview && (
                          <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg animate-bounce border-2 border-white/20 backdrop-blur-sm">
                            متصل بالفهرس المحدد
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 italic text-[11px] text-gray-400 text-center mt-6">
                  نصيحة: يمكنك استعراض الملف الناتج وفتحه مباشرة عند الانتهاء.
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {insertStep === 4 && (
              <div className="max-w-2xl mx-auto text-center space-y-8 py-12 animate-fade-in shadow-sm bg-white rounded-3xl border border-gray-100">
                <div className="relative">
                  <div className="w-32 h-32 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check size={80} strokeWidth={3} />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-emerald-800 mb-3">رائع! تم الإدراج</h3>
                  <p className="text-secondary text-lg">
                    تمت إضافة <span className="font-bold text-indigo-600">{parsedBookmarks.length}</span> عنوان للفهرس بنجاح.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center px-8">
                  <button
                    onClick={() => { setInsertStep(1); setBookmarkText(''); setParsedBookmarks([]); setInputPath(''); setOutputPath(''); setStatus({ type: '', message: '' }); }}
                    className="btn btn-secondary py-4 px-10 text-lg font-bold flex-1"
                  >
                    إدراج فهرس جديد
                  </button>
                  {outputPath && (
                    <button
                      onClick={async () => {
                        const { openPath } = await import('../../lib/utils');
                        const separator = outputPath.includes('\\') ? '\\' : '/';
                        const dir = outputPath.substring(0, outputPath.lastIndexOf(separator));
                        openPath(dir);
                      }}
                      className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-10 text-lg font-bold flex-1"
                    >
                      فتح المجلد
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SPLIT MODE */}
        {mode === 'split' && (
          <div className="space-y-8 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Scissors size={48} className="mx-auto text-amber-500 mb-4" />
              <h3 className="text-xl font-bold text-primary">التقسيم الآلي حسب الفصول</h3>
              <p className="text-secondary text-sm">يقوم هذا الخيار بتقسيم الملف الضخم إلى ملفات صغيرة بناءً على الفهرس الموجود مسبقاً</p>
            </div>

            <div className="space-y-6">
              <FileInput
                value={inputPath}
                onChange={handleInputChange}
                label="1. اختر ملف PDF"
                placeholder="أدخل المسار الكامل..."
                accept=".pdf"
              />

              <FileInput
                value={outputDir}
                onChange={setOutputDir}
                label="2. مجلد الإخراج"
                placeholder="مكان حفظ الملفات الناتجة..."
                isDirectory
              />

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col gap-3">
                <div className="mt-1 text-amber-600">
                  <Scissors size={20} />
                </div>
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={splitLevel1Only}
                    onChange={(e) => setSplitLevel1Only(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">تقسيم حسب العناوين الرئيسية فقط (Level 1)</span>
                    <p className="text-secondary text-xs">تجاهل العناوين الفرعية عند التقسيم</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                  <input
                    type="checkbox"
                    checked={ignoreHierarchy}
                    onChange={(e) => setIgnoreHierarchy(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">تسطيح الهيكل (Ignore Hierarchy)</span>
                    <p className="text-secondary text-xs">تحويل جميع العناوين لمستوى واحد لتجنب أخطاء التسلسل</p>
                  </div>
                </label>

                {/* Level Selection UI */}
                {(availableLevels.length > 1 || (availableLevels.length === 1 && availableLevels[0] !== 1)) && !ignoreHierarchy && (
                  <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed">
                    <span className="block font-bold text-blue-900 mb-4 text-center">اختر مستوى التقسيم</span>
                    <div className="flex justify-center gap-4 flex-wrap">
                      {availableLevels.map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => {
                            setTargetLevel(lvl);
                            // Level 1 means splitLevel1Only=true, others=false
                            setSplitLevel1Only(lvl === 1);
                          }}
                          className={`px-6 py-2.5 rounded-xl font-bold transition-all ${targetLevel === lvl
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                            : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                            }`}
                        >
                          المستوى {lvl}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-blue-400 mt-4 text-center">
                      سيتم تقسيم الملف بناءً على عناوين المستوى المختارة فقط
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSplit}
                disabled={loading || !inputPath || !outputDir}
                className="btn-enhanced w-full py-5 text-xl font-bold mt-8 shadow-xl shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? 'جاري التقسيم...' : (
                  <span className="flex items-center justify-center gap-3">
                    بدء عملية التقسيم الآن
                    <ArrowRight size={24} className="rtl:rotate-180" />
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {status.message && insertStep !== 4 && (
          <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 p-4 px-6 rounded-2xl flex items-center gap-3 text-sm font-bold animate-slide-up shadow-2xl z-50 ${status.type === 'success' ? 'bg-emerald-600 text-white' :
            status.type === 'error' ? 'bg-red-600 text-white' :
              'bg-zinc-800 text-white'
            }`}>
            {status.type === 'success' ? <CheckCircle size={20} /> : null}
            {status.type === 'error' ? <AlertCircle size={20} /> : null}
            {!status.type ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {status.message}
            <button onClick={() => setStatus({ type: '', message: '' })} className="ml-2 opacity-50 hover:opacity-100">✕</button>
          </div>
        )}
      </div>
    </div>
  );
};
