import { useRef, useState } from 'react';
import { localApiFetch } from '../../lib/api';
import { FolderOpen, FileText, ArrowRight, CheckCircle, AlertCircle, X, FileImage, Settings, BookOpen, PanelTop, Palette, Lock } from 'lucide-react';
import { FileInput, MultiFileInput } from '../ui/FileInput';
import { openPath } from '../../lib/utils';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PricingPage } from '../pricing/PricingPage';
import { UpgradeButton } from '../pricing/UpgradeButton';

const PAGE_SIZES = [
  { value: 'A4', label: 'A4' },
  { value: 'Letter', label: 'Letter' },
  { value: 'A3', label: 'A3' },
  { value: 'A5', label: 'A5' },
  { value: 'Legal', label: 'Legal' },
];

const FONT_OPTIONS = [
  { value: 'Noto Naskh Arabic', label: 'Noto Naskh Arabic' },
  { value: 'Amiri', label: 'Amiri' },
  { value: 'Scheherazade New', label: 'Scheherazade New' },
  { value: 'Tajawal', label: 'Tajawal' },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic' },
];

const ALIGN_OPTIONS = [
  { value: 'left', label: 'يسار' },
  { value: 'center', label: 'وسط' },
  { value: 'right', label: 'يمين' },
];

const TABS = [
  { id: 'basic', label: 'أساسي', icon: Settings },
  { id: 'content', label: 'المحتوى', icon: BookOpen },
  { id: 'header', label: 'ترويسة/تذييل', icon: PanelTop },
  { id: 'colors', label: 'الألوان', icon: Palette },
];

const DEFAULT_COLORS = {
  primaryColor: '#111827',
  textColor: '#1a1a1a',
  linkColor: '#2563eb',
  accentColor: '#2563eb',
  codeBackground: '#1e1e2e',
  codeText: '#cdd6f4',
  blockquoteBorder: '#cbd5e1',
  blockquoteBackground: '#f8fafc',
  highlightColor: '#fef08a',
  headerColor: '#4b5563',
  footerColor: '#6b7280',
  pageNumberColor: '#6b7280',
  tocColor: '#374151',
};

const DEFAULT_BRIEFINGS_EXPORT_DIR = String.raw`F:\Broswer Extensions\nlm-data\backend\exports`;

export const MarkdownToPDFTool: React.FC = () => {
  const { checkAccess } = useSubscription();
  const [showPricing, setShowPricing] = useState(false);
  const hasAdvanced = checkAccess('md_to_pdf_advanced');
  const advancedEnabled = (v: boolean) => hasAdvanced && v;
  const gateToggle = (setter: (v: boolean) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasAdvanced) { setShowPricing(true); return; }
    setter(e.target.checked);
  };

  const [files, setFiles] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [briefingInputDir, setBriefingInputDir] = useState(DEFAULT_BRIEFINGS_EXPORT_DIR);
  const [briefingOutputDir, setBriefingOutputDir] = useState(`${DEFAULT_BRIEFINGS_EXPORT_DIR}\\PDF`);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingStatus, setBriefingStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [briefingResults, setBriefingResults] = useState<Array<{ title: string; status: string; output_path?: string; error?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastOutputPath, setLastOutputPath] = useState('');
  const suggestedTitleRef = useRef('');
  const suggestedOutputPathRef = useRef('');

  // Basic
  const [pageSize, setPageSize] = useState('A4');
  const [fontFamily, setFontFamily] = useState('IBM Plex Sans Arabic');
  const [bodySize, setBodySize] = useState(12);
  const [lineHeight, setLineHeight] = useState(2.0);
  const [direction, setDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [marginTop, setMarginTop] = useState(20);
  const [marginBottom, setMarginBottom] = useState(25);
  const [marginLeft, setMarginLeft] = useState(20);
  const [marginRight, setMarginRight] = useState(20);

  // Content
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subject, setSubject] = useState('');
  const [keywords, setKeywords] = useState('');
  const [publisher, setPublisher] = useState('');
  const [includeToc, setIncludeToc] = useState(false);
  const [coverPage, setCoverPage] = useState(true);
  const [brandPageEnabled, setBrandPageEnabled] = useState(true);
  const [chapterBreaks, setChapterBreaks] = useState(true);
  const [bookmarksEnabled, setBookmarksEnabled] = useState(true);

  // Header / Footer
  const [headerEnabled, setHeaderEnabled] = useState(true);
  const [headerText, setHeaderText] = useState('');
  const [headerAlign, setHeaderAlign] = useState('center');
  const [footerEnabled, setFooterEnabled] = useState(true);
  const [footerText, setFooterText] = useState('Matn PDF  •  zemamapps.com  •  manhaji.app');
  const [footerAlign, setFooterAlign] = useState('center');
  const [footerPageNumbers, setFooterPageNumbers] = useState(true);

  // Colors
  const [colors, setColors] = useState(DEFAULT_COLORS);

  // Cover styling
  const [coverBgType, setCoverBgType] = useState<'white' | 'solid' | 'gradient'>('gradient');
  const [coverBgColor, setCoverBgColor] = useState('#0f172a');
  const [coverGradientFrom, setCoverGradientFrom] = useState('#0f172a');
  const [coverGradientTo, setCoverGradientTo] = useState('#1e40af');
  const [coverAccentColor, setCoverAccentColor] = useState('#f5c518');
  const [coverTextColor, setCoverTextColor] = useState('#ffffff');

  const handleCoverBgTypeChange = (t: 'white' | 'solid' | 'gradient') => {
    setCoverBgType(t);
    if (t === 'white' && coverTextColor === '#ffffff') setCoverTextColor('#111827');
    if (t !== 'white' && coverTextColor === '#111827') setCoverTextColor('#ffffff');
  };

  const updateColor = (key: keyof typeof colors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const resetColors = () => setColors(DEFAULT_COLORS);

  const handleFilesChange = (selectedFiles: string[]) => {
    const uniqueFiles = Array.from(new Set(selectedFiles));
    setFiles(uniqueFiles);
    if (uniqueFiles.length === 0) return;

    const firstFile = uniqueFiles[0];
    const filename = firstFile.split(/[/\\]/).pop() || '';
    const titleSuggestion = filename.replace(/\.md$/i, '');
    const outputSuggestion = firstFile.replace(/\.md$/i, '.pdf');
    setTitle((current) => !current || current === suggestedTitleRef.current ? titleSuggestion : current);
    setOutputPath((current) => !current || current === suggestedOutputPathRef.current ? outputSuggestion : current);
    suggestedTitleRef.current = titleSuggestion;
    suggestedOutputPathRef.current = outputSuggestion;
  };

  const applyPreset = (preset: string) => {
    if (preset === 'arabic-reading') {
      setPageSize('A4'); setFontFamily('IBM Plex Sans Arabic'); setBodySize(12);
      setLineHeight(2); setDirection('rtl'); setMarginTop(20); setMarginBottom(25);
      setMarginLeft(20); setMarginRight(20);
    } else if (preset === 'compact') {
      setPageSize('A4'); setFontFamily('IBM Plex Sans Arabic'); setBodySize(10);
      setLineHeight(1.5); setDirection('rtl'); setMarginTop(15); setMarginBottom(15);
      setMarginLeft(15); setMarginRight(15);
    } else if (preset === 'english') {
      setPageSize('A4'); setFontFamily('Noto Naskh Arabic'); setBodySize(11);
      setLineHeight(1.6); setDirection('ltr'); setMarginTop(20); setMarginBottom(20);
      setMarginLeft(22); setMarginRight(22);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0 || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري تحويل الملفات إلى PDF...' });

    let finalPath = outputPath;
    if (!finalPath.toLowerCase().endsWith('.pdf')) {
      finalPath += '.pdf';
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 600000);
      const res = await localApiFetch('/api/markdown/to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown_files: files,
          output_path: finalPath,
          // Basic
          page_size: pageSize,
          font_family: fontFamily,
          body_size: bodySize,
          line_height: lineHeight,
          direction: direction,
          margin_top: marginTop,
          margin_bottom: marginBottom,
          margin_left: marginLeft,
          margin_right: marginRight,
          // Content
          title: title || undefined,
          subtitle: subtitle || undefined,
          author: author || undefined,
          subject: subject || undefined,
          keywords: keywords || undefined,
          publisher: publisher || undefined,
          lang: direction === 'rtl' ? 'ar' : 'en',
          include_toc: advancedEnabled(includeToc),
          cover_page: advancedEnabled(coverPage),
          brand_page_enabled: brandPageEnabled,
          cover_bg_type: coverBgType,
          cover_bg_color: coverBgColor,
          cover_gradient_from: coverGradientFrom,
          cover_gradient_to: coverGradientTo,
          cover_accent_color: coverAccentColor,
          cover_text_color: coverTextColor,
          chapter_breaks: chapterBreaks,
          bookmarks_enabled: advancedEnabled(bookmarksEnabled),
          // Header/Footer
          header_enabled: advancedEnabled(headerEnabled),
          header_text: headerText || (title ? `ملخص: ${title}` : 'مَتن PDF'),
          header_align: headerAlign,
          footer_enabled: advancedEnabled(footerEnabled),
          footer_text: footerText || undefined,
          footer_align: footerAlign,
          footer_page_numbers: footerPageNumbers,
          // Colors
          primary_color: colors.primaryColor,
          text_color: colors.textColor,
          link_color: colors.linkColor,
          accent_color: colors.accentColor,
          code_background: colors.codeBackground,
          code_text: colors.codeText,
          blockquote_border: colors.blockquoteBorder,
          blockquote_background: colors.blockquoteBackground,
          highlight_color: colors.highlightColor,
          header_color: colors.headerColor,
          footer_color: colors.footerColor,
          page_number_color: colors.pageNumberColor,
          toc_color: colors.tocColor,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        setLastOutputPath(finalPath);
        setStatus({ type: 'success', message: '✅ تم إنشاء ملف PDF بنجاح!' });
        setFiles([]);
        setOutputPath('');
      } else {
        let errMsg = 'حدث خطأ أثناء التحويل';
        try {
          const err = await res.json();
          if (err.detail) errMsg = err.detail;
        } catch {}
        setStatus({ type: 'error', message: errMsg });
      }
    } catch (e) {
      const msg = e instanceof Error && e.name === 'AbortError'
        ? 'تجاوز التحويل الحد الزمني (10 دقائق). جرّب ملفات أقل أو أعد المحاولة.'
        : 'تعذر الاتصال بالخادم';
      setStatus({ type: 'error', message: msg });
    } finally {
      if (timeout) clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleBriefingFolderChange = (path: string) => {
    setBriefingInputDir(path);
    if (path) {
      const separator = path.includes('\\') ? '\\' : '/';
      setBriefingOutputDir(`${path.replace(/[\\/]+$/, '')}${separator}PDF`);
    } else {
      setBriefingOutputDir('');
    }
    setBriefingResults([]);
    setBriefingStatus({ type: '', message: '' });
  };

  const handleBriefingsConvert = async () => {
    if (!briefingInputDir || !briefingOutputDir) return;
    setBriefingLoading(true);
    setBriefingResults([]);
    setBriefingStatus({ type: '', message: 'جاري فحص مجلدات التصدير وتحويل الملخصات...' });
    try {
      const response = await localApiFetch('/api/markdown/briefings-to-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_dir: briefingInputDir,
          output_dir: briefingOutputDir,
          page_size: pageSize,
          font_family: fontFamily,
          body_size: bodySize,
          line_height: lineHeight,
          include_toc: advancedEnabled(includeToc),
          cover_page: true,
          brand_page_enabled: brandPageEnabled,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'تعذر تحويل مجلدات الملخصات');

      setBriefingResults(result.results || []);
      const skippedCount = result.skipped?.length || 0;
      const message = `تم إنشاء ${result.converted_count} ملف PDF${result.failed_count ? `، وتعذر إنشاء ${result.failed_count}` : ''}${skippedCount ? `، وتخطي ${skippedCount} مجلدًا بلا ملفات Markdown` : ''}.`;
      setBriefingStatus({ type: result.failed_count ? 'error' : 'success', message });
    } catch (error) {
      setBriefingStatus({ type: 'error', message: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم' });
    } finally {
      setBriefingLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const inputBase = "w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500";

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-amber-50 text-amber-600 shadow-sm">
          <FileText size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">Markdown إلى PDF</h2>
          <p className="text-secondary mt-1">تحويل ملفات Markdown إلى PDF احترافي مع تنسيق كامل.</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white px-4 py-3 text-sm text-secondary">
        <span className="font-semibold text-primary">مَتن PDF</span>
        <span> · من أدوات </span>
        <a className="font-medium text-amber-700 hover:underline" href="https://zemamapps.com/" target="_blank" rel="noreferrer">Zemam Apps · zemamapps.com</a>
        <span> — </span>
        <a className="font-medium text-amber-700 hover:underline" href="https://manhaji.app/" target="_blank" rel="noreferrer">manhaji.app</a>
      </div>

      {!hasAdvanced && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3 text-sm text-amber-800">
            <Lock size={18} className="text-amber-500 shrink-0" />
            <span className="font-semibold">التحويل الأساسي مجاني. غلاف، فهرس، إشارات، وترويسة/تذييل متوفرة في النسخة الكاملة.</span>
          </div>
          <UpgradeButton onClick={() => setShowPricing(true)} className="shrink-0 px-4 py-2 text-sm" label="فتح المزايا المتقدمة" />
        </div>
      )}

      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <section className="shrink-0 rounded-xl border border-indigo-200 bg-gradient-to-l from-indigo-50/70 to-white p-4 space-y-4">
          <div>
            <h3 className="font-bold text-primary">تحويل دفاتر التصدير إلى ملفات PDF</h3>
            <p className="mt-1 text-xs text-secondary">يُنشأ PDF مستقل لكل مجلد Briefings يحتوي على ملفات Markdown. يُنظّف اسم المادة من الشرطات السفلية وتاريخ التصدير، ثم يُستخدم عنوانًا واسمًا للملف.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileInput
              value={briefingInputDir}
              onChange={handleBriefingFolderChange}
              label="مجلد exports"
              placeholder={'مثال: F:\\Broswer Extensions\\nlm-data\\backend\\exports'}
              isDirectory
            />
            <FileInput
              value={briefingOutputDir}
              onChange={setBriefingOutputDir}
              label="حفظ ملفات PDF في"
              placeholder="سيُستخدم مجلد PDF داخل مجلد exports"
              isDirectory
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleBriefingsConvert} disabled={!briefingInputDir || !briefingOutputDir || briefingLoading} className="btn btn-primary flex items-center gap-2 disabled:opacity-50">
              {briefingLoading ? <span className="animate-spin">◌</span> : <FileText size={16} />}
              تحويل كل مجلدات Briefings
            </button>
            {briefingStatus.message && <div className={`flex items-center gap-2 text-sm ${briefingStatus.type === 'error' ? 'text-red-600' : briefingStatus.type === 'success' ? 'text-green-700' : 'text-secondary'}`}>
              {briefingStatus.type === 'error' ? <AlertCircle size={16} /> : briefingStatus.type === 'success' ? <CheckCircle size={16} /> : null}
              {briefingStatus.message}
            </div>}
            {briefingResults.some((result) => result.status === 'success') && briefingOutputDir && <button onClick={() => openPath(briefingOutputDir)} className="text-sm font-semibold text-indigo-700 hover:underline">فتح مجلد النتائج</button>}
          </div>
          {briefingResults.length > 0 && <div className="max-h-28 overflow-y-auto rounded-lg bg-white/80 p-2 text-xs space-y-1">
            {briefingResults.map((result, index) => <div key={`${result.title}-${index}`} className="flex gap-2">
              <span className={result.status === 'success' ? 'text-green-700' : 'text-red-600'}>{result.status === 'success' ? '✓' : '!'}</span>
              <span className="font-medium">{result.title}</span>
              {result.error && <span className="text-red-600">— {result.error}</span>}
            </div>)}
          </div>}
        </section>

        <section className="space-y-4">
          <MultiFileInput
            values={files}
            onChange={handleFilesChange}
            label="1. اختر ملفات Markdown"
            placeholder="اسحب ملفات .md هنا أو انقر للاختيار"
            accept=".md"
            filterName="Markdown Files"
          />

          {files.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-primary">الملفات المحددة ({files.length})</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((file, index) => (
                  <div key={index + file} className="group relative bg-white border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
                    <div className="absolute top-2 left-2 z-10 flex gap-1">
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1.5 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50"
                        title="حذف"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg h-20 overflow-hidden">
                      <FileImage className="text-gray-300" size={28} />
                      <div className="absolute bottom-1 right-2 text-[10px] text-gray-500 bg-white/80 px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 truncate dir-ltr" title={file}>
                      {file.split(/[/\\]/).pop()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="2. مسار الملف الناتج"
            placeholder="تم اقتراح مسار بجانب أول ملف — اختر مكانًا آخر عند الحاجة"
            accept=".pdf"
            isSave
            filterName="PDF Files"
          />
        </section>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 border-b border-border mb-4 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-amber-500 text-amber-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-5 pb-4">
            {activeTab === 'basic' && (
              <>
                <div className="space-y-2 max-w-md">
                  <label className="block text-sm font-semibold text-primary">تهيئة سريعة</label>
                  <select onChange={(e) => applyPreset(e.target.value)} defaultValue="" className={inputBase}>
                    <option value="" disabled>اختر إعدادًا جاهزًا لتقليل التعديلات اليدوية</option>
                    <option value="arabic-reading">قراءة عربية مريحة</option>
                    <option value="compact">نسخة مختصرة موفرة للصفحات</option>
                    <option value="english">مستند باللغة الإنجليزية</option>
                  </select>
                  <p className="text-xs text-secondary">يمكنك تعديل أي خيار بعد اختيار التهيئة.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">حجم الصفحة</label>
                    <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className={inputBase}>
                      {PAGE_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">الخط</label>
                    <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className={inputBase}>
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">حجم الخط</label>
                    <select value={bodySize} onChange={(e) => setBodySize(Number(e.target.value))} className={inputBase}>
                      {[9, 10, 11, 12, 13, 14, 15, 16].map((s) => (
                        <option key={s} value={s}>{s}pt</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">تباعد الأسطر</label>
                    <select value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className={inputBase}>
                      {[1.5, 2.0, 2.4, 2.6, 2.8, 3.0, 3.2].map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">الاتجاه</label>
                    <select value={direction} onChange={(e) => setDirection(e.target.value as 'rtl' | 'ltr')} className={inputBase}>
                      <option value="rtl">RTL (عربي)</option>
                      <option value="ltr">LTR (إنجليزي)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">هامش أعلى (mm)</label>
                    <input type="number" min={10} max={50} value={marginTop} onChange={(e) => setMarginTop(Number(e.target.value))} className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">هامش أسفل (mm)</label>
                    <input type="number" min={10} max={50} value={marginBottom} onChange={(e) => setMarginBottom(Number(e.target.value))} className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">هامش يسار (mm)</label>
                    <input type="number" min={10} max={50} value={marginLeft} onChange={(e) => setMarginLeft(Number(e.target.value))} className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">هامش يمين (mm)</label>
                    <input type="number" min={10} max={50} value={marginRight} onChange={(e) => setMarginRight(Number(e.target.value))} className={inputBase} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'content' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">العنوان</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المستند" className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">العنوان الفرعي</label>
                    <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="عنوان فرعي" className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">المؤلف</label>
                    <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="اسم المؤلف" className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">الناشر</label>
                    <input type="text" value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="اسم الناشر" className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">الموضوع</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="وصف المستند" className={inputBase} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-primary">الكلمات المفتاحية</label>
                    <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="pdf, arabic, book" className={inputBase} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label
                    onClick={() => { if (!hasAdvanced) setShowPricing(true); }}
                    className={`flex items-center gap-3 bg-white border border-border rounded-lg p-3 ${!hasAdvanced ? 'opacity-60 cursor-pointer border-amber-200 bg-amber-50/30' : 'cursor-pointer'}`}
                  >
                    <input type="checkbox" checked={advancedEnabled(coverPage)} onChange={gateToggle(setCoverPage)} disabled={false} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
                      صفحة غلاف {!hasAdvanced && <Lock size={12} className="text-amber-500" />}
                    </span>
                  </label>
                  <label
                    onClick={() => { if (!hasAdvanced) setShowPricing(true); }}
                    className={`flex items-center gap-3 bg-white border border-border rounded-lg p-3 ${!hasAdvanced ? 'opacity-60 cursor-pointer border-amber-200 bg-amber-50/30' : 'cursor-pointer'}`}
                  >
                    <input type="checkbox" checked={advancedEnabled(includeToc)} onChange={gateToggle(setIncludeToc)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
                      فهرس المحتويات {!hasAdvanced && <Lock size={12} className="text-amber-500" />}
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white border border-border rounded-lg p-3">
                    <input type="checkbox" checked={chapterBreaks} onChange={(e) => setChapterBreaks(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm font-semibold text-primary">فصل كل ملف بصفحة</span>
                  </label>
                  <label
                    onClick={() => { if (!hasAdvanced) setShowPricing(true); }}
                    className={`flex items-center gap-3 bg-white border border-border rounded-lg p-3 ${!hasAdvanced ? 'opacity-60 cursor-pointer border-amber-200 bg-amber-50/30' : 'cursor-pointer'}`}
                  >
                    <input type="checkbox" checked={advancedEnabled(bookmarksEnabled)} onChange={gateToggle(setBookmarksEnabled)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
                      إنشاء إشارات للملفات {!hasAdvanced && <Lock size={12} className="text-amber-500" />}
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer bg-white border border-amber-200 rounded-lg p-3 md:col-span-2">
                    <input type="checkbox" checked={brandPageEnabled} onChange={(e) => setBrandPageEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    <span className="text-sm font-semibold text-primary">إضافة صفحة ختامية أنيقة بروابط مَتن PDF ومنهجي وتطبيقات زمام</span>
                  </label>
                </div>

                {advancedEnabled(coverPage) && (
                  <div className="border border-border rounded-xl p-4 space-y-4 bg-white">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-primary">تخصيص الغلاف</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-primary">نمط الخلفية</label>
                        <select value={coverBgType} onChange={(e) => handleCoverBgTypeChange(e.target.value as 'white' | 'solid' | 'gradient')} className={inputBase}>
                          <option value="white">أبيض</option>
                          <option value="solid">لون واحد</option>
                          <option value="gradient">تدرّج لوني</option>
                        </select>
                      </div>
                      {coverBgType === 'solid' && (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-primary">لون الخلفية</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={coverBgColor} onChange={(e) => setCoverBgColor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                            <input type="text" value={coverBgColor} onChange={(e) => setCoverBgColor(e.target.value)} className={`${inputBase} flex-1 font-mono`} />
                          </div>
                        </div>
                      )}
                      {coverBgType === 'gradient' && (
                        <>
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-primary">من لون</label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={coverGradientFrom} onChange={(e) => setCoverGradientFrom(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                              <input type="text" value={coverGradientFrom} onChange={(e) => setCoverGradientFrom(e.target.value)} className={`${inputBase} flex-1 font-mono`} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-primary">إلى لون</label>
                            <div className="flex items-center gap-2">
                              <input type="color" value={coverGradientTo} onChange={(e) => setCoverGradientTo(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                              <input type="text" value={coverGradientTo} onChange={(e) => setCoverGradientTo(e.target.value)} className={`${inputBase} flex-1 font-mono`} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-primary">لون الزخرفة (الشرائط والإطار)</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={coverAccentColor} onChange={(e) => setCoverAccentColor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                          <input type="text" value={coverAccentColor} onChange={(e) => setCoverAccentColor(e.target.value)} className={`${inputBase} flex-1 font-mono`} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-primary">لون النص</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={coverTextColor} onChange={(e) => setCoverTextColor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
                          <input type="text" value={coverTextColor} onChange={(e) => setCoverTextColor(e.target.value)} className={`${inputBase} flex-1 font-mono`} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'header' && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label
                      onClick={() => { if (!hasAdvanced) setShowPricing(true); }}
                      className={`flex items-center gap-3 cursor-pointer ${!hasAdvanced ? 'opacity-60' : ''}`}
                    >
                      <input type="checkbox" checked={advancedEnabled(headerEnabled)} onChange={gateToggle(setHeaderEnabled)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                      <span className="text-sm font-semibold text-primary flex items-center gap-1.5">إظهار الترويسة {!hasAdvanced && <Lock size={12} className="text-amber-500" />}</span>
                    </label>
                  </div>
                  {advancedEnabled(headerEnabled) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <label className="block text-sm font-semibold text-primary">نص الترويسة</label>
                        <input type="text" value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="اسم الكتاب أو الفصل" className={inputBase} />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-primary">المحاذاة</label>
                        <select value={headerAlign} onChange={(e) => setHeaderAlign(e.target.value)} className={inputBase}>
                          {ALIGN_OPTIONS.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <label
                      onClick={() => { if (!hasAdvanced) setShowPricing(true); }}
                      className={`flex items-center gap-3 cursor-pointer ${!hasAdvanced ? 'opacity-60' : ''}`}
                    >
                      <input type="checkbox" checked={advancedEnabled(footerEnabled)} onChange={gateToggle(setFooterEnabled)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                      <span className="text-sm font-semibold text-primary flex items-center gap-1.5">إظهار التذييل {!hasAdvanced && <Lock size={12} className="text-amber-500" />}</span>
                    </label>
                  </div>
                  {advancedEnabled(footerEnabled) && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-sm font-semibold text-primary">نص التذييل</label>
                          <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="نص التذييل" className={inputBase} />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-primary">المحاذاة</label>
                          <select value={footerAlign} onChange={(e) => setFooterAlign(e.target.value)} className={inputBase}>
                            {ALIGN_OPTIONS.map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={footerPageNumbers} onChange={(e) => setFooterPageNumbers(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-semibold text-primary">إظهار أرقام الصفحات</span>
                      </label>
                    </>
                  )}
                </div>
              </>
            )}

            {activeTab === 'colors' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-primary">نظام الألوان</h3>
                  <button onClick={resetColors} className="text-xs text-amber-600 hover:text-amber-700 font-medium">إعادة الافتراضي</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'primaryColor', label: 'العناوين' },
                    { key: 'textColor', label: 'النص' },
                    { key: 'linkColor', label: 'الروابط' },
                    { key: 'accentColor', label: 'التمييز' },
                    { key: 'codeBackground', label: 'خلفية الكود' },
                    { key: 'codeText', label: 'نص الكود' },
                    { key: 'blockquoteBorder', label: 'حد الاقتباس' },
                    { key: 'blockquoteBackground', label: 'خلفية الاقتباس' },
                    { key: 'highlightColor', label: 'التمييز بالأصفر' },
                    { key: 'headerColor', label: 'الترويسة' },
                    { key: 'footerColor', label: 'التذييل' },
                    { key: 'pageNumberColor', label: 'أرقام الصفحات' },
                    { key: 'tocColor', label: 'الفهرس' },
                  ].map((c) => (
                    <div key={c.key} className="space-y-2">
                      <label className="block text-sm font-semibold text-primary">{c.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={colors[c.key as keyof typeof colors]}
                          onChange={(e) => updateColor(c.key as keyof typeof colors, e.target.value)}
                          className="w-10 h-10 rounded border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors[c.key as keyof typeof colors]}
                          onChange={(e) => updateColor(c.key as keyof typeof colors, e.target.value)}
                          className={`${inputBase} flex-1 font-mono`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <section className="pt-2">
          {status.message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 text-sm font-medium animate-fade-in ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
              }`}>
              {status.type === 'success' ? <CheckCircle size={18} /> :
                status.type === 'error' ? <AlertCircle size={18} /> :
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {status.message}
              {status.type === 'success' && lastOutputPath && (
                <button
                  onClick={() => {
                    const dir = lastOutputPath.substring(0, lastOutputPath.lastIndexOf('\\'));
                    openPath(dir || lastOutputPath);
                  }}
                  className="mr-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <FolderOpen size={14} />
                  فتح المجلد
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleConvert}
            disabled={loading || files.length === 0 || !outputPath}
            className="btn btn-primary w-full py-4 text-lg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-amber-600 hover:bg-amber-700 border-transparent focus:ring-amber-500"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                تحويل إلى PDF
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
