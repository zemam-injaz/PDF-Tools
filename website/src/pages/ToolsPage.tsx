import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import {
  Merge, Split, FileArchive, Image, ScanText, Droplets,
  Shield, Bookmark, RotateCw, Trash2, FileOutput, Crop,
  Hash, SunMoon, EyeOff, FileType, Table, BookOpen,
  Library, Gauge, Sigma, Zap, Download, ChevronRight
} from "lucide-react";

const toolIcons = [
  Merge, Split, FileArchive, Image, ScanText, Droplets,
  Shield, Bookmark, RotateCw, Trash2, FileOutput, Crop,
  Hash, SunMoon, EyeOff, FileType, Table, BookOpen,
  Library, Gauge, Sigma, Zap,
];

const categories = [
  {
    name: "Core Operations",
    nameAr: "العمليات الأساسية",
    color: "text-orange-400",
    range: [0, 4],
  },
  {
    name: "Security & Protection",
    nameAr: "الأمان والحماية",
    color: "text-green-400",
    range: [5, 7],
  },
  {
    name: "Page Editing",
    nameAr: "تحرير الصفحات",
    color: "text-blue-400",
    range: [8, 14],
  },
  {
    name: "Conversion & Extraction",
    nameAr: "التحويل والاستخراج",
    color: "text-violet-400",
    range: [15, 17],
  },
  {
    name: "Reading & Library",
    nameAr: "القراءة والمكتبة",
    color: "text-teal-400",
    range: [18, 21],
  },
];

export default function ToolsPage() {
  const { t, isRtl } = useLanguage();
  const ArrowIcon = isRtl ? ChevronRight : ChevronRight;

  const toolSlugs = [
    "merge-pdf", "split-pdf", "compress", "extract-images", "ocr-tahweel",
    "watermark", "security", "bookmarks", "rotate-pages", "delete-pages",
    "extract-pages", "crop-pdf", "page-numbers", "invert-colors", "redact-pdf",
    "text-extraction", "table-extraction", "markdown-to-pdf", "book-library",
    "speed-reader", "chapter-analyzer", "clean-pdf",
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-orange absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <h1 className="mg-h1 mb-4">{t.tools.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto mb-8">{t.tools.subtitle}</p>
        </ScrollReveal>
      </section>

      {/* Tools by Category */}
      {categories.map((cat) => {
        const tools = t.tools.list.slice(cat.range[0], cat.range[1] + 1);
        return (
          <section key={cat.name} className="pb-16">
            <ScrollReveal className="mb-8">
              <h2 className={`text-xl font-bold ${cat.color} mb-2`}>{isRtl ? cat.nameAr : cat.name}</h2>
              <div className="h-px bg-[var(--mg-border-soft)]" />
            </ScrollReveal>

            <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tools.map((tool, idx) => {
                const realIdx = cat.range[0] + idx;
                const Icon = toolIcons[realIdx];
                const colors = [
                  "text-orange-400 bg-orange-500/10 border-orange-500/20",
                  "text-violet-400 bg-violet-500/10 border-violet-500/20",
                  "text-teal-400 bg-teal-500/10 border-teal-500/20",
                  "text-blue-400 bg-blue-500/10 border-blue-500/20",
                  "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
                  "text-green-400 bg-green-500/10 border-green-500/20",
                  "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
                  "text-pink-400 bg-pink-500/10 border-pink-500/20",
                  "text-red-400 bg-red-500/10 border-red-500/20",
                  "text-orange-400 bg-orange-500/10 border-orange-500/20",
                  "text-violet-400 bg-violet-500/10 border-violet-500/20",
                  "text-teal-400 bg-teal-500/10 border-teal-500/20",
                  "text-blue-400 bg-blue-500/10 border-blue-500/20",
                  "text-red-400 bg-red-500/10 border-red-500/20",
                  "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
                  "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
                  "text-green-400 bg-green-500/10 border-green-500/20",
                  "text-pink-400 bg-pink-500/10 border-pink-500/20",
                  "text-orange-400 bg-orange-500/10 border-orange-500/20",
                  "text-violet-400 bg-violet-500/10 border-violet-500/20",
                ];
                return (
                  <StaggerItem key={tool.name}>
                    <Link href={`/tools/${toolSlugs[realIdx]}`} className="block">
                      <GlassCard hoverable padding={18} className="h-full group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 border ${colors[realIdx]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-bold text-[var(--mg-fg-1)] mb-2">{tool.name}</h3>
                        <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{tool.desc}</p>
                      </GlassCard>
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </section>
        );
      })}

      {/* CTA */}
      <section className="py-16 text-center">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-[var(--mg-fg-1)] mb-4">{t.cta.title}</h2>
          <p className="text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">{t.cta.subtitle}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/#download">
              <Button size="lg" icon={Download} className="px-8 text-base">{t.cta.primary}</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" size="lg" className="px-8 text-base">{t.nav.pricing}</Button>
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
