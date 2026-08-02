import { ScrollReveal } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { Download, Mail } from "lucide-react";

const questionCategories = [
  { range: [0, 1], name: "General", nameAr: "عام" },
  { range: [2, 3], name: "Technical", nameAr: "تقني" },
  { range: [4, 5], name: "Business", nameAr: "تجاري" },
];

export default function FaqPage() {
  const { t, isRtl } = useLanguage();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-teal absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <h1 className="mg-h1 mb-4">{t.faq.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">
            {isRtl ? "كل ما تحتاج معرفته عن وراق" : "Everything you need to know about Warraq"}
          </p>
        </ScrollReveal>
      </section>

      {/* FAQ Categories */}
      {questionCategories.map((cat) => {
        const items = t.faq.items.slice(cat.range[0], cat.range[1] + 1);
        return (
          <section key={cat.name} className="pb-16 max-w-3xl mx-auto px-6 w-full">
            <ScrollReveal className="mb-6">
              <h2 className="text-lg font-bold text-[var(--mg-orange-400)] mb-2">{isRtl ? cat.nameAr : cat.name}</h2>
              <div className="h-px bg-[var(--mg-border-soft)]" />
            </ScrollReveal>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <ScrollReveal key={idx} delay={idx * 0.05}>
                  <details className="group">
                    <summary className="mg-card list-none p-5 hover:border-[var(--mg-border-medium)] transition-colors cursor-pointer [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-bold text-[var(--mg-fg-1)]">{item.q}</h3>
                        <svg className="w-5 h-5 text-[var(--mg-fg-4)] shrink-0 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                      <div className="mt-3 text-[var(--mg-fg-3)] text-sm leading-relaxed">{item.a}</div>
                    </summary>
                  </details>
                </ScrollReveal>
              ))}
            </div>
          </section>
        );
      })}

      {/* Still have questions */}
      <section className="py-16 max-w-3xl mx-auto px-6 w-full">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl border border-[var(--mg-border-violet)] bg-gradient-to-br from-[rgba(123,110,255,0.08)] to-[rgba(255,107,0,0.04)] p-10 md:p-14 text-center">
            <div className="mg-orb mg-orb-violet absolute w-64 h-64 -bottom-20 -left-20 opacity-20" />
            <div className="relative z-10">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 text-[var(--mg-violet-400)]">
                <Mail className="w-7 h-7" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-[var(--mg-fg-1)] mb-4">
                {isRtl ? "ما زلت بحاجة لمساعدة؟" : "Still Have Questions?"}
              </h2>
              <p className="text-[var(--mg-fg-3)] mb-8 max-w-md mx-auto">
                {isRtl ? "نحن هنا للمساعدة. تواصل معنا وسنرد عليك في أقرب وقت." : "We're here to help. Reach out and we'll get back to you as soon as possible."}
              </p>
              <Link href="/contact">
                <Button variant="primary" size="lg" icon={Mail} className="px-8 text-base">
                  {isRtl ? "اتصل بنا" : "Contact Us"}
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
