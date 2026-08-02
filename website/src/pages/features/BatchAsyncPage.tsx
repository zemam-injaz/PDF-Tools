import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { Zap, Download, Layers, ListChecks, Activity, Cog, AlertCircle, Cpu, Users } from "lucide-react";

const benefitIcons = [Layers, ListChecks, Activity, Cog, AlertCircle, Cpu];

export default function BatchAsyncPage() {
  const { t, isRtl } = useLanguage();
  const feat = t.features.details[2];

  return (
    <div className="flex flex-col">
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-teal absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 text-teal-400">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="mg-h1 mb-4">{feat.heroTitle}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-2xl mx-auto text-lg">{feat.heroDesc}</p>
        </ScrollReveal>
      </section>

      <section className="pb-20 max-w-5xl mx-auto px-6">
        <ScrollReveal className="mb-16">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--mg-border-orange)] bg-gradient-to-br from-[rgba(77,219,168,0.08)] to-[rgba(123,110,255,0.04)] p-10 md:p-14">
            <div className="mg-orb mg-orb-teal absolute w-80 h-80 -bottom-32 -right-32 opacity-20" />
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-4">{feat.whyTitle}</h2>
              <p className="text-[var(--mg-fg-3)] leading-relaxed">{feat.whyDesc}</p>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="mb-10">
          <h2 className="text-2xl font-bold text-[var(--mg-fg-1)] mb-2">{feat.benefitsTitle}</h2>
          <div className="h-px bg-[var(--mg-border-soft)]" />
        </ScrollReveal>

        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-20">
          {feat.benefits.map((benefit, idx) => {
            const Icon = benefitIcons[idx];
            const colors = ["text-teal-400", "text-orange-400", "text-violet-400", "text-blue-400", "text-green-400", "text-indigo-400"];
            const bgs = ["bg-teal-500/10 border-teal-500/20", "bg-orange-500/10 border-orange-500/20", "bg-violet-500/10 border-violet-500/20", "bg-blue-500/10 border-blue-500/20", "bg-green-500/10 border-green-500/20", "bg-indigo-500/10 border-indigo-500/20"];
            return (
              <StaggerItem key={benefit.title}>
                <GlassCard padding={20} hoverable className="flex gap-4 items-start">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${bgs[idx]} ${colors[idx]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--mg-fg-1)] mb-1">{benefit.title}</h3>
                    <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{benefit.desc}</p>
                  </div>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>

        <ScrollReveal>
          <GlassCard padding={24}>
            <h3 className="text-lg font-bold text-[var(--mg-fg-1)] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-400" />
              {feat.useCasesTitle}
            </h3>
            <ul className="space-y-3">
              {feat.useCases.map((uc, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-[var(--mg-fg-2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </ScrollReveal>
      </section>

      <section className="py-16 text-center border-t border-[var(--mg-border-soft)]">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-[var(--mg-fg-1)] mb-4">{t.cta.title}</h2>
          <p className="text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">{t.cta.subtitle}</p>
          <Link href="/#download">
            <Button size="lg" icon={Download} className="px-8 text-base">{t.cta.primary}</Button>
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
