import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Files, Split, Minimize2, Image, Type, BookOpen, Layers, Stamp, Shield,
  Library, MessageSquare, BarChart3, Zap, ArrowLeft, RotateCw, Trash2, FileOutput
} from 'lucide-react';
import { PDFMergeTool } from './components/tools/PDFMergeTool';
import { PDFSplitTool } from './components/tools/PDFSplitTool';
import { PDFCompressTool } from './components/tools/PDFCompressTool';
import { PDFExtractImagesTool } from './components/tools/PDFExtractImagesTool';
import { TextExtractTool } from './components/tools/TextExtractTool';
import { BookmarkTool } from './components/tools/BookmarkTool';
import { RotatePagesTool } from './components/tools/RotatePagesTool';
import { DeletePagesTool } from './components/tools/DeletePagesTool';
import { ExtractPagesTool } from './components/tools/ExtractPagesTool';
import { WatermarkTool } from './components/tools/WatermarkTool';
import { RemoveSecurityTool } from './components/tools/RemoveSecurityTool';
import { BookLibraryTool } from './components/tools/BookLibraryTool';
import { CommentsTool } from './components/tools/CommentsTool';
import { ChapterWeightTool } from './components/tools/ChapterWeightTool';
import { ReadingSpeedTool } from './components/tools/ReadingSpeedTool';
import { Sidebar, type Tool } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ImagesToPDFTool } from './components/tools/ImagesToPDFTool';
import { PDFToImagesTool } from './components/tools/PDFToImagesTool';
import { MetadataTool } from './components/tools/MetadataTool';
import { TahweelTool } from './components/tools/TahweelTool';
import { TrialBanner } from './components/subscription/TrialBanner';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsOfService } from './components/legal/TermsOfService';
import { TaskMonitor } from './components/layout/TaskMonitor';

function App() {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Tool cards for home with descriptions - separated into sections
  const pdfToolCards = [
    { id: 'tahweel' as Tool, label: 'Tahweel (OCR)', icon: Zap, desc: 'تحويل احترافي للعربية عبر Google' },
    { id: 'merge' as Tool, label: 'دمج ملفات', icon: Files, desc: 'دمج عدة ملفات PDF في ملف واحد' },
    { id: 'split' as Tool, label: 'تقسيم ملف', icon: Split, desc: 'تقسيم ملف PDF إلى عدة أجزاء' },
    { id: 'compress' as Tool, label: 'ضغط ملف', icon: Minimize2, desc: 'ضغط PDF لتقليل حجمه' },
    { id: 'extract' as Tool, label: 'استخراج الصور', icon: Image, desc: 'استخراج جميع الصور من PDF' },
    { id: 'text' as Tool, label: 'استخراج النص', icon: Type, desc: 'تحويل PDF إلى TXT/DOCX/MD' },
    { id: 'bookmark' as Tool, label: 'إدارة الفهرس', icon: BookOpen, desc: 'استخراج أو تقسيم حسب الفهرس' },
    { id: 'rotate' as Tool, label: 'تدوير الصفحات', icon: RotateCw, desc: 'تغيير اتجاه صفحات معينة' },
    { id: 'delete' as Tool, label: 'حذف صفحات', icon: Trash2, desc: 'حذف صفحات معينة من الملف' },
    { id: 'extract-pages' as Tool, label: 'استخراج صفحات', icon: FileOutput, desc: 'استخراج صفحات في ملف جديد' },
    { id: 'watermark' as Tool, label: 'علامة مائية', icon: Stamp, desc: 'إضافة أو إزالة علامة مائية' },
    { id: 'security' as Tool, label: 'إزالة الحماية', icon: Shield, desc: 'إزالة كلمة المرور والقيود' },
    { id: 'images-to-pdf' as Tool, label: 'صور إلى PDF', icon: Image, desc: 'تجميع صور في ملف PDF' },
    { id: 'pdf-to-images' as Tool, label: 'PDF إلى صور', icon: Image, desc: 'تحويل صفحات PDF إلى صور' },
    { id: 'metadata' as Tool, label: 'تعديل الوصف', icon: Files, desc: 'تعديل البيانات الوصفية' },
  ];

  const readingToolCards = [
    { id: 'library' as Tool, label: 'مكتبة الكتب', icon: Library, desc: 'إدارة ومتابعة كتبك وتقدم القراءة' },
    { id: 'comments' as Tool, label: 'التعليقات', icon: MessageSquare, desc: 'استخراج وتصدير التعليقات والتمييزات' },
    { id: 'chapter-weight' as Tool, label: 'وزن الفصول', icon: BarChart3, desc: 'تحليل أحجام الفصول وخطة القراءة' },
    { id: 'reading-speed' as Tool, label: 'سرعة القراءة', icon: Zap, desc: 'تدريب على القراءة السريعة' },
  ];

  const renderTool = () => {
    switch (activeTool) {
      case 'tahweel': return <TahweelTool />;
      case 'merge': return <PDFMergeTool />;
      case 'split': return <PDFSplitTool />;
      case 'compress': return <PDFCompressTool />;
      case 'extract': return <PDFExtractImagesTool />;
      case 'text': return <TextExtractTool />;
      case 'bookmark': return <BookmarkTool />;
      case 'rotate': return <RotatePagesTool />;
      case 'delete': return <DeletePagesTool />;
      case 'extract-pages': return <ExtractPagesTool />;
      case 'watermark': return <WatermarkTool />;
      case 'security': return <RemoveSecurityTool />;
      case 'library': return <BookLibraryTool />;
      case 'comments': return <CommentsTool />;
      case 'chapter-weight': return <ChapterWeightTool onNavigate={setActiveTool} />;
      case 'reading-speed': return <ReadingSpeedTool />;
      case 'images-to-pdf': return <ImagesToPDFTool />;
      case 'pdf-to-images': return <PDFToImagesTool />;
      case 'metadata': return <MetadataTool />;
      case 'privacy': return <PrivacyPolicy onBack={() => setActiveTool(null)} />;
      case 'terms': return <TermsOfService onBack={() => setActiveTool(null)} />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] overflow-hidden font-sans" dir="rtl">

      <Sidebar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header />
        <TrialBanner />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTool ? (
              <motion.div
                key={activeTool}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="h-full flex flex-col w-full relative z-0"
              >
                <div className="mb-6 flex items-center">
                  <button
                    onClick={() => setActiveTool(null)}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors py-2 px-3 rounded-lg hover:bg-white"
                  >
                    <ArrowLeft size={18} />
                    <span className="font-medium">العودة للرئيسية</span>
                  </button>
                </div>
                <div className="flex-1">
                  {renderTool()}
                </div>
              </motion.div>
            ) : (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="max-w-7xl mx-auto w-full pt-8 pb-20"
                >
                {/* Hero */}
                <header className="mb-14 text-center relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 text-white p-12 md:p-16 shadow-2xl border border-white/10">
                  {/* Glassmorphism decorative elements */}
                  <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-purple-500/30 blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-blue-500/30 blur-3xl"></div>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="relative z-10"
                  >
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-sm tracking-tight leading-tight">
                      مرحباً بك في <span className="text-transparent bg-clip-text bg-gradient-to-l from-purple-300 to-blue-300">Warraq وراق</span>
                    </h1>
                    <p className="text-indigo-100/90 max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed">
                      المنصة المتكاملة لإدارة وتحرير ملفات PDF بكل سهولة واحترافية، آمنة بالكامل محلياً على جهازك.
                    </p>
                  </motion.div>
                </header>

                {/* Reading & Library Tools Section */}
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-6 px-1">
                    <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">القراءة والمتابعة</h2>
                  </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {readingToolCards.map((tool, index) => (
                      <motion.button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className="card text-right group h-full flex flex-col hover:border-purple-200"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 rounded-lg bg-[var(--bg-app)] text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                            <tool.icon size={24} />
                          </div>
                        </div>
                        <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2 group-hover:text-purple-600 transition-colors">
                          {tool.label}
                        </h3>
                        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                          {tool.desc}
                        </p>
                      </motion.button>
                    ))}                  </div>
                </div>

                {/* PDF Tools Section */}
                <div>
                  <div className="flex items-center gap-3 mb-6 px-1">
                    <div className="w-1 h-6 bg-[var(--primary)] rounded-full"></div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">أدوات الملفات</h2>
                  </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {pdfToolCards.map((tool, index) => (
                      <motion.button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className="card text-right group h-full flex flex-col hover:border-[var(--primary-light)]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + index * 0.04, duration: 0.3 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 rounded-lg bg-[var(--bg-app)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors duration-300">
                            <tool.icon size={24} />
                          </div>
                        </div>
                        <h3 className="font-bold text-lg text-[var(--text-primary)] mb-2 group-hover:text-[var(--primary)] transition-colors">
                          {tool.label}
                        </h3>
                        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                          {tool.desc}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                </motion.div>
          )}
          </AnimatePresence>
        </div>
      </main>
      <TaskMonitor />
    </div>
  );
}

export default App;
