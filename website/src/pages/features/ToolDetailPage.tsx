import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link, useParams } from "wouter";
import { Download, CheckCircle2, Users } from "lucide-react";
import {
  Merge, Split, FileArchive, Image, ScanText, Droplets,
  Shield, Bookmark, RotateCw, Trash2, FileOutput, Crop,
  Hash, SunMoon, EyeOff, FileType, Table, BookOpen,
  Library, Gauge, Sigma, Zap,
} from "lucide-react";

const toolSlugs = [
  "merge-pdf", "split-pdf", "compress", "extract-images", "ocr-tahweel",
  "watermark", "security", "bookmarks", "rotate-pages", "delete-pages",
  "extract-pages", "crop-pdf", "page-numbers", "invert-colors", "redact-pdf",
  "text-extraction", "table-extraction", "markdown-to-pdf", "book-library",
  "speed-reader", "chapter-analyzer", "clean-pdf",
];

const toolIcons = [
  Merge, Split, FileArchive, Image, ScanText, Droplets,
  Shield, Bookmark, RotateCw, Trash2, FileOutput, Crop,
  Hash, SunMoon, EyeOff, FileType, Table, BookOpen,
  Library, Gauge, Sigma, Zap,
];

const toolColors = [
  "text-orange-400", "text-violet-400", "text-teal-400", "text-blue-400",
  "text-indigo-400", "text-cyan-400", "text-green-400", "text-yellow-400",
  "text-pink-400", "text-red-400", "text-orange-400", "text-violet-400",
  "text-teal-400", "text-blue-400", "text-red-400", "text-indigo-400",
  "text-cyan-400", "text-yellow-400", "text-green-400", "text-pink-400",
  "text-orange-400", "text-violet-400",
];

const toolBgs = [
  "bg-orange-500/10 border-orange-500/20", "bg-violet-500/10 border-violet-500/20",
  "bg-teal-500/10 border-teal-500/20", "bg-blue-500/10 border-blue-500/20",
  "bg-indigo-500/10 border-indigo-500/20", "bg-cyan-500/10 border-cyan-500/20",
  "bg-green-500/10 border-green-500/20", "bg-yellow-500/10 border-yellow-500/20",
  "bg-pink-500/10 border-pink-500/20", "bg-red-500/10 border-red-500/20",
  "bg-orange-500/10 border-orange-500/20", "bg-violet-500/10 border-violet-500/20",
  "bg-teal-500/10 border-teal-500/20", "bg-blue-500/10 border-blue-500/20",
  "bg-red-500/10 border-red-500/20", "bg-indigo-500/10 border-indigo-500/20",
  "bg-cyan-500/10 border-cyan-500/20", "bg-yellow-500/10 border-yellow-500/20",
  "bg-green-500/10 border-green-500/20", "bg-pink-500/10 border-pink-500/20",
  "bg-orange-500/10 border-orange-500/20", "bg-violet-500/10 border-violet-500/20",
];

const useCaseBgColors = [
  "bg-orange-500/10 border-orange-500/20",
  "bg-violet-500/10 border-violet-500/20",
  "bg-teal-500/10 border-teal-500/20",
  "bg-blue-500/10 border-blue-500/20",
  "bg-indigo-500/10 border-indigo-500/20",
];

export default function ToolDetailPage() {
  const { slug } = useParams();
  const { t, isRtl } = useLanguage();

  const idx = toolSlugs.indexOf(slug || "");
  if (idx === -1 || !t.tools.details[idx]) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-[var(--mg-fg-3)]">{isRtl ? "الأداة غير موجودة" : "Tool not found"}</p>
        <Link href="/tools" className="mt-4 text-[var(--mg-orange-400)] hover:underline">{isRtl ? "العودة للأدوات" : "Back to tools"}</Link>
      </div>
    );
  }

  const Icon = toolIcons[idx];
  const color = toolColors[idx];
  const bg = toolBgs[idx];
  const detail = t.tools.details[idx];
  const tool = t.tools.list[idx];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className={`mg-orb absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20 ${idx % 3 === 0 ? "mg-orb-orange" : idx % 3 === 1 ? "mg-orb-violet" : "mg-orb-teal"}`} />
        <ScrollReveal>
          <div className={`w-16 h-16 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 ${color}`}>
            <Icon className="w-8 h-8" />
          </div>
          <h1 className="mg-h1 mb-4">{detail.heroTitle}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-2xl mx-auto text-lg">{detail.heroDesc}</p>
        </ScrollReveal>
      </section>

      <section className="pb-20 max-w-5xl mx-auto px-6">
        {/* How It Works */}
        <ScrollReveal className="mb-16">
          <div className={`relative overflow-hidden rounded-3xl border ${idx % 3 === 0 ? "border-[var(--mg-border-orange)]" : idx % 3 === 1 ? "border-[var(--mg-border-violet)]" : "border-[var(--mg-border-orange)]"} bg-gradient-to-br from-[rgba(255,107,0,0.06)] to-[rgba(123,110,255,0.03)] p-10 md:p-14`}>
            <div className="mg-orb mg-orb-orange absolute w-80 h-80 -bottom-32 -right-32 opacity-20" />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-4">
                {isRtl ? "كيف يعمل" : "How It Works"}
              </h2>
              <p className="text-[var(--mg-fg-3)] leading-relaxed text-lg">{detail.howItWorks}</p>
            </div>
          </div>
        </ScrollReveal>

        {/* Key Features */}
        <ScrollReveal className="mb-10">
          <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-2">
            {isRtl ? "المميزات الرئيسية" : "Key Features"}
          </h2>
          <div className="h-px bg-[var(--mg-border-soft)]" />
        </ScrollReveal>

        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {detail.features.map((feature: { title: string; desc: string }, fIdx: number) => {
            const featColors = ["text-orange-400", "text-violet-400", "text-teal-400", "text-blue-400", "text-indigo-400", "text-green-400"];
            const featBgs = ["bg-orange-500/10 border-orange-500/20", "bg-violet-500/10 border-violet-500/20", "bg-teal-500/10 border-teal-500/20", "bg-blue-500/10 border-blue-500/20", "bg-indigo-500/10 border-indigo-500/20", "bg-green-500/10 border-green-500/20"];
            return (
              <StaggerItem key={feature.title}>
                <GlassCard padding={20} hoverable className="flex gap-4 items-start">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${featBgs[fIdx % 6]} ${featColors[fIdx % 6]}`}>
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--mg-fg-1)] mb-1">{feature.title}</h3>
                    <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>

        {/* Why Matters */}
        <ScrollReveal className="mb-16">
          <GlassCard padding={28}>
            <h2 className="text-xl font-bold text-[var(--mg-fg-1)] mb-4">{detail.whyTitle}</h2>
            <p className="text-[var(--mg-fg-3)] leading-relaxed">{detail.whyDesc}</p>
          </GlassCard>
        </ScrollReveal>

        {/* Use Cases */}
        <ScrollReveal>
          <GlassCard padding={24}>
            <h3 className="text-lg font-bold text-[var(--mg-fg-1)] mb-4 flex items-center gap-2">
              <Users className={`w-5 h-5 ${color}`} />
              {detail.useCasesTitle || (isRtl ? "مناسب لـ" : "Perfect For")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {detail.useCases.map((uc: string, uIdx: number) => (
                <div key={uIdx} className={`flex items-start gap-3 p-3 rounded-xl ${useCaseBgColors[uIdx % 5]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${color} mt-2 shrink-0`} />
                  <span className="text-sm text-[var(--mg-fg-2)]">{uc}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section className="py-16 text-center border-t border-[var(--mg-border-soft)]">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-[var(--mg-fg-1)] mb-4">{isRtl ? "هل أنت مستعد لتجربة هذه الأداة؟" : "Ready to Try This Tool?"}</h2>
          <p className="text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">{t.cta.subtitle}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/#download">
              <Button size="lg" icon={Download} className="px-8 text-base">{t.cta.primary}</Button>
            </Link>
            <Link href="/tools">
              <Button variant="secondary" size="lg" className="px-8 text-base">{isRtl ? "كل الأدوات" : "All Tools"}</Button>
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
