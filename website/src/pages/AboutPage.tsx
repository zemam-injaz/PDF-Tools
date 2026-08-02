import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { Download, Shield, Zap, Globe, Wrench, ArrowRight } from "lucide-react";

const valueIcons = [Shield, Zap, Globe, Wrench];

export default function AboutPage() {
  const { t, isRtl } = useLanguage();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-violet absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <h1 className="mg-h1 mb-4">{t.about.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.about.subtitle}</p>
        </ScrollReveal>
      </section>

      {/* Story */}
      <section className="pb-20 max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <ScrollReveal direction="left">
            <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-4">{t.about.storyTitle}</h2>
            <p className="text-[var(--mg-fg-3)] leading-relaxed">{t.about.story}</p>
          </ScrollReveal>
          <ScrollReveal direction="right">
            <div className="rounded-2xl border border-[var(--mg-border-hairline)] bg-[var(--mg-surface-1)] p-8">
              <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-4">{t.about.whyTitle}</h2>
              <p className="text-[var(--mg-fg-3)] leading-relaxed mb-6">{t.about.why}</p>
              <h3 className="text-lg font-bold text-[var(--mg-orange-400)] mb-3">{t.about.techTitle}</h3>
              <p className="text-[var(--mg-fg-3)] leading-relaxed">{t.about.tech}</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 border-y border-[var(--mg-border-soft)] bg-[var(--mg-surface-0)]">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal className="text-center mb-14">
            <h2 className="mg-h2 mb-4">{t.about.valuesTitle}</h2>
          </ScrollReveal>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {t.about.values.map((value, idx) => {
              const Icon = valueIcons[idx];
              const valColors = ["text-orange-400", "text-teal-400", "text-violet-400", "text-blue-400"];
              const valBgs = ["bg-orange-500/10 border-orange-500/20", "bg-teal-500/10 border-teal-500/20", "bg-violet-500/10 border-violet-500/20", "bg-blue-500/10 border-blue-500/20"];
              return (
                <StaggerItem key={value.title}>
                  <GlassCard padding={24} hoverable className="flex gap-5 items-start">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${valBgs[idx]} ${valColors[idx]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--mg-fg-1)] mb-2">{value.title}</h3>
                      <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{value.desc}</p>
                    </div>
                  </GlassCard>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--mg-fg-1)] mb-4">{t.about.cta}</h2>
          <p className="text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">{t.cta.subtitle}</p>
          <Link href="/#download">
            <Button size="lg" icon={Download} className="px-8 text-base">{t.cta.primary}</Button>
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
