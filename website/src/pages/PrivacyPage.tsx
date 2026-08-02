import { ScrollReveal } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { useLanguage } from "@/context/LanguageContext";
import { Shield } from "lucide-react";

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-teal absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 text-green-400">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="mg-h1 mb-4">{t.privacy.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.privacy.subtitle}</p>
          <p className="text-[var(--mg-fg-4)] text-sm mt-4">{t.privacy.lastUpdated}</p>
        </ScrollReveal>
      </section>

      {/* Content */}
      <section className="pb-20 max-w-3xl mx-auto px-6 w-full">
        <div className="space-y-6">
          {t.privacy.sections.map((section, idx) => (
            <ScrollReveal key={section.title} delay={idx * 0.05}>
              <GlassCard padding={24}>
                <h2 className="text-lg font-bold text-[var(--mg-fg-1)] mb-3">{section.title}</h2>
                <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">{section.body}</p>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </div>
  );
}
