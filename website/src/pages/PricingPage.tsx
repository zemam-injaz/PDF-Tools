import { ScrollReveal, StaggerGrid, StaggerItem } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { CheckCircle2, Download, Shield, Zap, Headphones, Infinity } from "lucide-react";

const planIcons = [Shield, Zap, Infinity];

const faqItems = [
  { qKey: "q0", aKey: "a0" },
  { qKey: "q1", aKey: "a1" },
  { qKey: "q2", aKey: "a2" },
  { qKey: "q3", aKey: "a3" },
];

export default function PricingPage() {
  const { t, isRtl } = useLanguage();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-violet absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <h1 className="mg-h1 mb-4">{t.pricing.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.pricing.subtitle}</p>
        </ScrollReveal>
      </section>

      {/* Plans */}
      <section className="pb-20 max-w-5xl mx-auto px-6">
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.pricing.plans.map((plan, idx) => {
            const Icon = planIcons[idx];
            return (
              <StaggerItem key={plan.name}>
                <div className={`relative p-8 rounded-2xl ${plan.popular ? "bg-[var(--mg-surface-2)] border-2 border-[var(--mg-border-orange)] shadow-[var(--mg-shadow-glow-orange)]" : "bg-[var(--mg-surface-1)] border border-[var(--mg-border-hairline)]"} h-full flex flex-col`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-8 -translate-y-1/2 px-4 py-1.5 bg-[var(--mg-orange-500)] text-[#000] text-xs font-bold rounded-full">
                      {t.pricing.popular}
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${plan.popular ? "bg-[var(--mg-orange-500)] text-[#06070D]" : "bg-[var(--mg-surface-3)] text-[var(--mg-fg-2)]"}`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-xl font-bold text-[var(--mg-fg-1)] mb-1">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold mg-gradient-text">{plan.price}</span>
                    <span className="text-[var(--mg-fg-4)] ml-2">/ {plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-[var(--mg-fg-2)]">
                        <CheckCircle2 className={`w-5 h-5 mt-0.5 shrink-0 ${plan.popular ? "text-[var(--mg-orange-400)]" : "text-green-400"}`} />
                        <span className={isRtl ? "text-right flex-1" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.popular ? "primary" : "secondary"}
                    full
                    size="lg"
                    className="mt-auto"
                    onClick={() => document.getElementById("download")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {plan.name === t.pricing.plans[0].name ? t.pricing.startTrial : `${isRtl ? "اشترك الآن" : "Subscribe Now"}`}
                  </Button>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      {/* Feature Comparison */}
      <section className="py-20 border-y border-[var(--mg-border-soft)] bg-[var(--mg-surface-0)]">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal className="text-center mb-12">
            <h2 className="mg-h2 mb-4">{isRtl ? "مقارنة الميزات" : "Feature Comparison"}</h2>
          </ScrollReveal>

          <ScrollReveal>
            <div className="overflow-hidden rounded-2xl border border-[var(--mg-border-hairline)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--mg-surface-2)] border-b border-[var(--mg-border-hairline)]">
                    <th className="text-left px-6 py-4 text-[var(--mg-fg-1)] font-bold">{isRtl ? "الميزة" : "Feature"}</th>
                    <th className="text-center px-6 py-4 text-[var(--mg-fg-1)] font-bold">{t.pricing.plans[0].name}</th>
                    <th className="text-center px-6 py-4 text-[var(--mg-orange-400)] font-bold">{t.pricing.plans[1].name}</th>
                    <th className="text-center px-6 py-4 text-[var(--mg-fg-1)] font-bold">{t.pricing.plans[2].name}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: isRtl ? "جميع أدوات PDF" : "All PDF Tools", trial: true, monthly: true, lifetime: true },
                    { feature: isRtl ? "التعرف الضوئي (OCR)" : "OCR (Tahweel)", trial: true, monthly: true, lifetime: true },
                    { feature: isRtl ? "علامة مائية" : "Watermark", trial: true, monthly: true, lifetime: true },
                    { feature: isRtl ? "إزالة الأمان" : "Remove Security", trial: true, monthly: true, lifetime: true },
                    { feature: isRtl ? "قارئ سريع" : "Speed Reader", trial: true, monthly: true, lifetime: true },
                    { feature: isRtl ? "دعم ذو أولوية" : "Priority Support", trial: false, monthly: true, lifetime: true },
                    { feature: isRtl ? "تحديثات مستقبلية" : "Future Updates", trial: false, monthly: false, lifetime: true },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-[var(--mg-border-soft)] last:border-0 hover:bg-[var(--mg-surface-1)]">
                      <td className="px-6 py-4 text-[var(--mg-fg-2)]">{row.feature}</td>
                      <td className="text-center px-6 py-4">{row.trial ? <CheckCircle2 className="w-5 h-5 text-green-400 inline" /> : <span className="text-[var(--mg-fg-4)]">—</span>}</td>
                      <td className="text-center px-6 py-4">{row.monthly ? <CheckCircle2 className="w-5 h-5 text-[var(--mg-orange-400)] inline" /> : <span className="text-[var(--mg-fg-4)]">—</span>}</td>
                      <td className="text-center px-6 py-4">{row.lifetime ? <CheckCircle2 className="w-5 h-5 text-green-400 inline" /> : <span className="text-[var(--mg-fg-4)]">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 max-w-3xl mx-auto px-6">
        <ScrollReveal>
          <h2 className="mg-h2 text-center mb-12">{t.faq.title}</h2>
          <div className="space-y-4">
            {[0, 1, 2, 3].map((idx) => (
              <details key={idx} className="group">
                <summary className="mg-card list-none p-5 hover:border-[var(--mg-border-medium)] transition-colors cursor-pointer [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-base font-bold text-[var(--mg-fg-1)]">{t.faq.items[idx].q}</h4>
                    <svg className="w-5 h-5 text-[var(--mg-fg-4)] shrink-0 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  <div className="mt-3 text-[var(--mg-fg-3)] text-sm leading-relaxed">{t.faq.items[idx].a}</div>
                </summary>
              </details>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section id="download" className="py-20 text-center border-t border-[var(--mg-border-soft)]">
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--mg-fg-1)] mb-6">{t.cta.title}</h2>
          <p className="text-lg text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">{t.cta.subtitle}</p>
          <Button size="lg" icon={Download} className="px-8 text-base">{t.cta.primary}</Button>
        </ScrollReveal>
      </section>
    </div>
  );
}
