import { motion } from "framer-motion";
import { Link } from "wouter";
import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import {
  Merge, Split, FileArchive, Image, ScanText, Droplets,
  Shield, Bookmark, RotateCw, Trash2, FileOutput, Crop,
  Hash, SunMoon, EyeOff, Table, FileType, BookOpen,
  Library, Gauge, Sigma, Zap, Lock, Globe as GlobeIcon,
  ArrowRight, ArrowLeft, Download, CheckCircle2
} from "lucide-react";

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

const toolBgColors = [
  "bg-orange-500/10", "bg-violet-500/10", "bg-teal-500/10", "bg-blue-500/10",
  "bg-indigo-500/10", "bg-cyan-500/10", "bg-green-500/10", "bg-yellow-500/10",
  "bg-pink-500/10", "bg-red-500/10", "bg-orange-500/10", "bg-violet-500/10",
  "bg-teal-500/10", "bg-blue-500/10", "bg-red-500/10", "bg-indigo-500/10",
  "bg-cyan-500/10", "bg-yellow-500/10", "bg-green-500/10", "bg-pink-500/10",
  "bg-orange-500/10", "bg-violet-500/10",
];

const toolBorderColors = [
  "border-orange-500/20", "border-violet-500/20", "border-teal-500/20", "border-blue-500/20",
  "border-indigo-500/20", "border-cyan-500/20", "border-green-500/20", "border-yellow-500/20",
  "border-pink-500/20", "border-red-500/20", "border-orange-500/20", "border-violet-500/20",
  "border-teal-500/20", "border-blue-500/20", "border-red-500/20", "border-indigo-500/20",
  "border-cyan-500/20", "border-yellow-500/20", "border-green-500/20", "border-pink-500/20",
  "border-orange-500/20", "border-violet-500/20",
];

export default function Home() {
  const { t, isRtl } = useLanguage();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section id="home" className="relative pt-12 pb-24 text-center overflow-hidden">
        <div className="mg-orb mg-orb-orange absolute w-[500px] h-[500px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <div className="mg-orb mg-orb-violet absolute w-[400px] h-[400px] top-1/2 -left-20 opacity-20" />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] text-sm text-[var(--mg-fg-2)]">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[var(--mg-orange-500)] shadow-[0_0_8px_var(--mg-orange-500)]" />
              <span className="absolute inset-0 rounded-full bg-[var(--mg-orange-500)] animate-ping opacity-40" />
            </span>
            {t.hero.badge}
          </div>

          <h1 className="text-[clamp(42px,7vw,72px)] font-light tracking-[-0.02em] leading-[1.1] mb-6">
            <span className="text-[var(--mg-fg-1)]">{t.hero.title}</span>
            <br />
            <span className="mg-gradient-text font-bold">{t.hero.titleAccent}</span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--mg-fg-3)] max-w-2xl mx-auto leading-relaxed mb-8">
            {t.hero.subtitle}
          </p>

          <p className="text-sm text-[var(--mg-fg-4)] mb-10 font-medium" style={{ direction: "rtl" }}>
            {t.hero.arabicTagline}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Button size="lg" className="px-8 text-base" onClick={() => document.getElementById("download")?.scrollIntoView({ behavior: "smooth" })}>
              {t.hero.ctaPrimary}
            </Button>
            <Button variant="secondary" size="lg" className="px-8 text-base" onClick={() => document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" })}>
              {t.hero.ctaSecondary}
            </Button>
          </div>

          <div className="max-w-5xl mx-auto relative rounded-2xl overflow-hidden border border-[var(--mg-border-hairline)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
            <div className="aspect-[16/10] bg-gradient-to-br from-[var(--mg-midnight-700)] to-[var(--mg-midnight-900)] flex items-center justify-center p-8">
              <div className="relative w-full max-w-3xl">
                <div className="rounded-xl border border-[var(--mg-border-medium)] bg-[var(--mg-surface-1)] overflow-hidden shadow-2xl">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--mg-border-hairline)] bg-[var(--mg-surface-2)]">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    <span className={`text-xs text-[var(--mg-fg-4)] ${isRtl ? "mr-3" : "ml-3"}`}>Warraq — {t.brand.tagline}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 p-5">
                    {[Merge, Split, FileArchive, ScanText, Image, Droplets, Shield, Bookmark].map((Icon, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)]">
                        <Icon className="w-5 h-5 text-[var(--mg-orange-400)]" />
                        <span className="text-[10px] text-[var(--mg-fg-4)] font-medium">{isRtl ? `أداة ${i + 1}` : `Tool ${i + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
          </div>
        </motion.div>
      </section>

      {/* STATS */}
      <section className="py-12 border-y border-[var(--mg-border-soft)] bg-[var(--mg-surface-1)]">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-[var(--mg-fg-4)] font-medium mb-8 uppercase tracking-widest text-sm">{t.stats.title}</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            {t.stats.items.map((stat, i) => (
              <div key={stat.label}>
                <div className="text-4xl font-bold text-[var(--mg-fg-1)] mb-2 mg-stat" style={{ animationDelay: `${i * 100}ms` }}>
                  {stat.value}
                </div>
                <div className="text-[var(--mg-fg-3)] text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOOLS GRID */}
      <section id="tools" className="py-24">
        <ScrollReveal className="text-center mb-16">
          <h2 className="mg-h2 mb-4">{t.tools.title}</h2>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.tools.subtitle}</p>
        </ScrollReveal>

        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto px-6">
          {t.tools.list.map((tool, idx) => {
            const Icon = toolIcons[idx];
            return (
              <StaggerItem key={tool.name}>
                <GlassCard hoverable padding={18} className="h-full group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 border ${toolBgColors[idx]} ${toolColors[idx]} ${toolBorderColors[idx]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--mg-fg-1)] mb-2">{tool.name}</h3>
                  <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{tool.desc}</p>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-[var(--mg-surface-0)] border-y border-[var(--mg-border-soft)]">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="mg-h2 mb-4">{t.features.title}</h2>
            <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.features.subtitle}</p>
          </ScrollReveal>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.features.items.map((feature, idx) => {
              const featIcons = [Lock, GlobeIcon, Zap];
              const FeatIcon = featIcons[idx];
              const featColors = ["text-orange-400", "text-violet-400", "text-teal-400"];
              const featLinks = ["/features/local-processing", "/features/arabic-first", "/features/batch-async"];
              return (
                <StaggerItem key={feature.title}>
                  <Link href={featLinks[idx]} className="block group">
                    <div className="text-center p-6">
                      <div className={`w-16 h-16 mx-auto bg-[var(--mg-surface-2)] rounded-full flex items-center justify-center mb-6 shadow-[var(--mg-shadow-sm)] border border-[var(--mg-border-hairline)] ${featColors[idx]} group-hover:scale-110 transition-transform duration-300`}>
                        <FeatIcon className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-[var(--mg-fg-1)] mb-3">{feature.title}</h3>
                      <p className="text-[var(--mg-fg-3)] leading-relaxed text-sm">{feature.desc}</p>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* WHY IT MATTERS */}
      <section className="py-20 max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--mg-border-orange)] bg-gradient-to-br from-[rgba(255,107,0,0.1)] to-[rgba(123,110,255,0.05)] p-10 md:p-16 text-center">
            <div className="mg-orb mg-orb-orange absolute w-96 h-96 -bottom-32 -right-32 opacity-30" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 text-[var(--mg-orange-400)]">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--mg-fg-1)] mb-4">
                {t.why.title}
              </h2>
              <p className="text-[var(--mg-fg-3)] mb-4 text-lg">
                {t.why.subtitle}
              </p>
              <p className="text-sm text-[var(--mg-fg-4)]">
                {t.why.meta}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--mg-border-hairline)] bg-[var(--mg-surface-0)] p-10 md:p-16 text-center">
            <div className="mg-orb mg-orb-violet absolute w-80 h-80 -top-32 -left-32 opacity-20" />

            <div className="relative z-10 max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--mg-fg-1)] mb-4">{t.pricing.title}</h2>
              <p className="text-[var(--mg-fg-3)] mb-10 text-lg">{t.pricing.subtitle}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-10">
                {t.pricing.plans.map((plan) => (
                  <div key={plan.name} className={`p-6 rounded-2xl bg-[var(--mg-surface-2)] border ${plan.popular ? "border-[var(--mg-border-orange)]" : "border-[var(--mg-border-hairline)]"} relative`}>
                    {plan.popular && (
                      <div className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 bg-[var(--mg-orange-500)] text-[#000] text-xs font-bold rounded-full">
                        {t.pricing.popular}
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-[var(--mg-fg-1)] mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold mg-gradient-text">{plan.price}</span>
                      <span className="text-[var(--mg-fg-4)] ml-2">/ {plan.period}</span>
                    </div>
                    <ul className="space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-[var(--mg-fg-2)]">
                          <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? "text-[var(--mg-orange-400)]" : "text-green-400"}`} />
                          <span className={isRtl ? "text-right flex-1" : ""}>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <Button size="lg" className="px-10 text-base">
                {t.pricing.startTrial}
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 max-w-3xl mx-auto px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-center text-[var(--mg-fg-1)] mb-12">{t.faq.title}</h2>
          <div className="space-y-4">
            {t.faq.items.map((item, idx) => (
              <details key={idx} className="group">
                <summary className="mg-card list-none p-5 hover:border-[var(--mg-border-medium)] transition-colors cursor-pointer [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-base font-bold text-[var(--mg-fg-1)]">{item.q}</h4>
                    <svg className="w-5 h-5 text-[var(--mg-fg-4)] shrink-0 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  <div className="mt-3 text-[var(--mg-fg-3)] text-sm leading-relaxed">{item.a}</div>
                </summary>
              </details>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section id="download" className="py-24 text-center border-t border-[var(--mg-border-soft)]">
        <ScrollReveal>
          <h2 className="text-4xl md:text-5xl font-bold text-[var(--mg-fg-1)] mb-6">
            {t.cta.title}
          </h2>
          <p className="text-xl text-[var(--mg-fg-3)] mb-10 max-w-lg mx-auto">
            {t.cta.subtitle}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" icon={Download} className="px-8 text-base">
              {t.cta.primary}
            </Button>
            <Button variant="secondary" size="lg" icon={GlobeIcon} className="px-8 text-base">
              {t.cta.secondary}
            </Button>
          </div>
          <p className="text-sm text-[var(--mg-fg-4)] mt-6">{t.cta.note}</p>
        </ScrollReveal>
      </section>
    </div>
  );
}
