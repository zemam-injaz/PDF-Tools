import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { BookOpen, Clock, ArrowLeft } from "lucide-react";

export default function ArticlesPage() {
  const { t, isRtl } = useLanguage();

  const articleSlugs = [
    "pdf-history", "epub-guide", "kindle-ecosystem", "digital-note-taking",
    "libreoffice", "microsoft-office", "latex-intro", "printing-history",
    "pdf-vs-epub", "reading-workflow",
  ];

  const articleColors = [
    "text-orange-400", "text-violet-400", "text-teal-400", "text-blue-400",
    "text-indigo-400", "text-cyan-400", "text-green-400", "text-yellow-400",
    "text-pink-400", "text-red-400",
  ];

  const articleBgs = [
    "bg-orange-500/10 border-orange-500/20", "bg-violet-500/10 border-violet-500/20",
    "bg-teal-500/10 border-teal-500/20", "bg-blue-500/10 border-blue-500/20",
    "bg-indigo-500/10 border-indigo-500/20", "bg-cyan-500/10 border-cyan-500/20",
    "bg-green-500/10 border-green-500/20", "bg-yellow-500/10 border-yellow-500/20",
    "bg-pink-500/10 border-pink-500/20", "bg-red-500/10 border-red-500/20",
  ];

  return (
    <div className="flex flex-col">
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-violet absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 text-violet-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="mg-h1 mb-4">{t.articles.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.articles.subtitle}</p>
        </ScrollReveal>
      </section>

      <section className="pb-20 max-w-5xl mx-auto px-6 w-full">
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {t.articles.list.map((article, idx) => (
            <StaggerItem key={article.title}>
              <Link href={`/articles/${articleSlugs[idx]}`} className="block h-full">
                <GlassCard hoverable padding={24} className="h-full group">
                  <div className="flex items-start gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${articleBgs[idx]} ${articleColors[idx]}`}>
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-[var(--mg-fg-4)] font-medium mt-1">
                      <Clock className="w-3 h-3" />
                      {article.readTime}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--mg-fg-1)] mb-2 leading-snug">{article.title}</h2>
                  <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{article.desc}</p>
                </GlassCard>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </section>
    </div>
  );
}
