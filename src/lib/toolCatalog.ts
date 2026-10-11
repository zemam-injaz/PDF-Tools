import {
  BookOpen,
  Contrast,
  Crop,
  EyeOff,
  FileOutput,
  FileText,
  Files,
  Hash,
  Image,
  Layers,
  Library,
  type LucideIcon,
  MessageSquare,
  Minimize2,
  RotateCw,
  Shield,
  Split,
  Stamp,
  Table2,
  Trash2,
  Type,
  Zap,
  BarChart3,
} from 'lucide-react';

export type Tool =
  | 'merge'
  | 'split'
  | 'compress'
  | 'extract'
  | 'text'
  | 'bookmark'
  | 'rotate'
  | 'delete'
  | 'extract-pages'
  | 'watermark'
  | 'security'
  | 'library'
  | 'comments'
  | 'chapter-weight'
  | 'reading-speed'
  | 'images-to-pdf'
  | 'pdf-to-images'
  | 'metadata'
  | 'tahweel'
  | 'clean-pdf'
  | 'invert-colors'
  | 'crop-pdf'
  | 'page-numbers'
  | 'redact-pdf'
  | 'extract-tables'
  | 'markdown-to-pdf'
  | 'privacy'
  | 'terms'
  | null;

export type ToolId = Exclude<Tool, 'privacy' | 'terms' | null>;
export type ToolCategory = 'organize' | 'convert' | 'improve' | 'protect' | 'inspect' | 'reading';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  description: string;
  icon: LucideIcon;
  category: ToolCategory;
  keywords: string[];
  quick?: boolean;
  acceptsInitialFile?: boolean;
}

export const TOOL_CATEGORIES: Array<{ id: ToolCategory; label: string }> = [
  { id: 'organize', label: 'تنظيم' },
  { id: 'convert', label: 'تحويل' },
  { id: 'improve', label: 'تحسين' },
  { id: 'protect', label: 'حماية' },
  { id: 'inspect', label: 'فحص واستخراج' },
  { id: 'reading', label: 'القراءة' },
];

export const TOOL_CATALOG: ToolDefinition[] = [
  { id: 'merge', label: 'دمج PDF', description: 'جمع ملفات متعددة في مستند واحد مرتب', icon: Files, category: 'organize', keywords: ['combine', 'join', 'جمع'], quick: true, acceptsInitialFile: true },
  { id: 'split', label: 'تقسيم المستند', description: 'فصل الصفحات أو استخراج نطاقات محددة', icon: Split, category: 'organize', keywords: ['pages', 'فصل'], quick: true, acceptsInitialFile: true },
  { id: 'extract-pages', label: 'استخراج صفحات', description: 'حفظ صفحات مختارة في ملف مستقل', icon: FileOutput, category: 'organize', keywords: ['pages', 'range'], acceptsInitialFile: true },
  { id: 'rotate', label: 'تدوير الصفحات', description: 'تصحيح اتجاه صفحات محددة', icon: RotateCw, category: 'organize', keywords: ['orientation'] },
  { id: 'delete', label: 'حذف صفحات', description: 'إزالة صفحات من المستند بأمان', icon: Trash2, category: 'organize', keywords: ['remove'] },
  { id: 'tahweel', label: 'التعرّف الضوئي OCR', description: 'تحويل المستندات المصورة إلى نص عربي قابل للبحث', icon: Zap, category: 'convert', keywords: ['tahweel', 'google', 'arabic'], quick: true, acceptsInitialFile: true },
  { id: 'text', label: 'استخراج النص', description: 'تصدير المحتوى إلى TXT أو DOCX أو Markdown', icon: Type, category: 'convert', keywords: ['docx', 'markdown', 'txt'], quick: true, acceptsInitialFile: true },
  { id: 'pdf-to-images', label: 'PDF إلى صور', description: 'تصدير الصفحات بصيغة PNG أو JPG', icon: Image, category: 'convert', keywords: ['png', 'jpg'], quick: true, acceptsInitialFile: true },
  { id: 'images-to-pdf', label: 'صور إلى PDF', description: 'إنشاء مستند PDF من مجموعة صور', icon: Image, category: 'convert', keywords: ['image', 'create'] },
  { id: 'markdown-to-pdf', label: 'Markdown إلى PDF', description: 'إنشاء مستند منسق من ملفات Markdown', icon: FileText, category: 'convert', keywords: ['md', 'document'] },
  { id: 'compress', label: 'ضغط الحجم الذكي', description: 'تقليل حجم الملف مع الحفاظ على وضوح المحتوى', icon: Minimize2, category: 'improve', keywords: ['size', 'optimize'], quick: true, acceptsInitialFile: true },
  { id: 'clean-pdf', label: 'تنظيف PDF', description: 'تسطيح المستند وإزالة العناصر غير المطلوبة', icon: Layers, category: 'improve', keywords: ['flatten', 'annotations'] },
  { id: 'crop-pdf', label: 'قص الصفحات', description: 'ضبط مساحة الصفحة وحدود المحتوى', icon: Crop, category: 'improve', keywords: ['trim'] },
  { id: 'invert-colors', label: 'عكس الألوان', description: 'إنشاء نسخة مناسبة للقراءة الليلية', icon: Contrast, category: 'improve', keywords: ['dark', 'night'] },
  { id: 'metadata', label: 'بيانات المستند', description: 'تعديل العنوان والمؤلف والبيانات الوصفية', icon: FileText, category: 'improve', keywords: ['metadata', 'author'] },
  { id: 'page-numbers', label: 'أرقام الصفحات', description: 'إضافة أرقام ورؤوس وتذييلات', icon: Hash, category: 'improve', keywords: ['footer', 'header'] },
  { id: 'watermark', label: 'علامة مائية', description: 'إضافة علامة نصية أو صورة إلى الصفحات', icon: Stamp, category: 'protect', keywords: ['stamp'] },
  { id: 'security', label: 'إزالة الحماية', description: 'فتح القيود من الملفات المصرّح لك بها', icon: Shield, category: 'protect', keywords: ['password', 'unlock'] },
  { id: 'redact-pdf', label: 'تعتيم المعلومات', description: 'إخفاء المحتوى الحساس بصورة دائمة', icon: EyeOff, category: 'protect', keywords: ['redact', 'privacy'] },
  { id: 'extract', label: 'استخراج الصور', description: 'حفظ الصور المضمنة داخل المستند', icon: Image, category: 'inspect', keywords: ['assets'] },
  { id: 'extract-tables', label: 'استخراج الجداول', description: 'تصدير الجداول إلى Excel أو CSV أو JSON', icon: Table2, category: 'inspect', keywords: ['excel', 'csv', 'json'] },
  { id: 'bookmark', label: 'إدارة الفهرس', description: 'استخراج الفهارس وإضافتها وتقسيمها', icon: BookOpen, category: 'inspect', keywords: ['toc', 'bookmarks'] },
  { id: 'comments', label: 'التعليقات', description: 'عرض التعليقات والتمييزات وتصديرها', icon: MessageSquare, category: 'inspect', keywords: ['annotations', 'notes'] },
  { id: 'library', label: 'مكتبة الكتب', description: 'إدارة الكتب ومتابعة تقدم القراءة', icon: Library, category: 'reading', keywords: ['books', 'progress'] },
  { id: 'chapter-weight', label: 'وزن الفصول', description: 'تحليل أحجام الفصول وبناء خطة قراءة', icon: BarChart3, category: 'reading', keywords: ['chapters', 'plan'] },
  { id: 'reading-speed', label: 'سرعة القراءة', description: 'جلسات تدريب مركزة لتحسين سرعة القراءة', icon: Zap, category: 'reading', keywords: ['trainer', 'rsvp'] },
];

export const QUICK_TOOL_IDS: ToolId[] = ['merge', 'split', 'compress', 'text', 'tahweel', 'pdf-to-images'];

export function getToolDefinition(id: Tool): ToolDefinition | undefined {
  return TOOL_CATALOG.find((tool) => tool.id === id);
}
