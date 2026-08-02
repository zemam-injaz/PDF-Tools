import { ScrollReveal } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link, useParams } from "wouter";
import { BookOpen, Clock, User, ArrowRight, Download } from "lucide-react";

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

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const { t, isRtl } = useLanguage();

  const idx = articleSlugs.indexOf(slug || "");
  if (idx === -1 || !t.articles.details[idx]) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-[var(--mg-fg-3)]">{isRtl ? "المقال غير موجود" : "Article not found"}</p>
        <Link href="/articles" className="mt-4 text-[var(--mg-orange-400)] hover:underline">{isRtl ? "العودة للمقالات" : "Back to articles"}</Link>
      </div>
    );
  }

  const article = t.articles.list[idx];
  const detail = t.articles.details[idx];
  const color = articleColors[idx];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-10 text-center overflow-hidden">
        <div className={`mg-orb absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20 ${idx % 3 === 0 ? "mg-orb-orange" : idx % 3 === 1 ? "mg-orb-violet" : "mg-orb-teal"}`} />
        <ScrollReveal>
          <div className={`w-14 h-14 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-5 ${color}`}>
            <BookOpen className="w-7 h-7" />
          </div>
          <Link href="/articles" className="inline-flex items-center gap-1 text-sm text-[var(--mg-fg-4)] hover:text-[var(--mg-orange-400)] mb-4 transition-colors">
            <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? "rotate-180" : ""}`} />
            {isRtl ? "العودة للمقالات" : "Back to Articles"}
          </Link>
          <h1 className="mg-h1 mb-4 max-w-3xl mx-auto">{article.title}</h1>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--mg-fg-4)]">
            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{detail.author}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{article.readTime}</span>
            <span>{detail.date}</span>
          </div>
        </ScrollReveal>
      </section>

      {/* Content */}
      <section className="pb-16 max-w-3xl mx-auto px-6 w-full">
        <div className="space-y-8">
          {detail.sections.map((section: { heading: string; body: string }, sIdx: number) => (
            <ScrollReveal key={section.heading} delay={sIdx * 0.04}>
              <GlassCard padding={24}>
                <h2 className={`text-lg font-bold text-[var(--mg-fg-1)] mb-3 ${color}`}>{section.heading}</h2>
                <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{section.body}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>

        {/* Conclusion */}
        <ScrollReveal className="mt-8">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--mg-border-hairline)] bg-[var(--mg-surface-1)] p-8 text-center">
            <p className="text-[var(--mg-fg-2)] italic leading-relaxed text-lg">&ldquo;{detail.conclusion}&rdquo;</p>
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section className="py-16 text-center border-t border-[var(--mg-border-soft)]">
        <ScrollReveal>
          <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-4">{isRtl ? "استمر في التعلم" : "Keep Learning"}</h2>
          <p className="text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">{t.cta.subtitle}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/articles">
              <Button variant="secondary" size="lg" className="px-8 text-base">{isRtl ? "المزيد من المقالات" : "More Articles"}</Button>
            </Link>
            <Link href="/#download">
              <Button size="lg" icon={Download} className="px-8 text-base">{t.cta.primary}</Button>
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
