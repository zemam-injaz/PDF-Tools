import { useState } from "react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Mail, MessageSquare, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const { t, isRtl } = useLanguage();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-12 pb-16 text-center overflow-hidden">
        <div className="mg-orb mg-orb-orange absolute w-[400px] h-[400px] -top-32 left-1/2 -translate-x-1/2 opacity-20" />
        <ScrollReveal>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-medium)] flex items-center justify-center mb-6 text-[var(--mg-orange-400)]">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h1 className="mg-h1 mb-4">{t.contact.title}</h1>
          <p className="text-[var(--mg-fg-3)] max-w-xl mx-auto">{t.contact.subtitle}</p>
        </ScrollReveal>
      </section>

      {/* Contact Form + Info */}
      <section className="pb-20 max-w-4xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Form */}
          <div className="md:col-span-3">
            <ScrollReveal>
              <GlassCard padding={28}>
                {submitted ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-[var(--mg-fg-1)] mb-2">{t.contact.form.success}</h3>
                    <Button variant="secondary" onClick={() => setSubmitted(false)} className="mt-6">
                      {isRtl ? "إرسال رسالة أخرى" : "Send Another Message"}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-[var(--mg-fg-2)] mb-2">{t.contact.form.name}</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)] text-[var(--mg-fg-1)] placeholder:text-[var(--mg-fg-4)] focus:outline-none focus:border-[var(--mg-border-orange)] transition-colors"
                        placeholder={isRtl ? "اسمك" : "John Doe"}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--mg-fg-2)] mb-2">{t.contact.form.email}</label>
                      <input
                        type="email"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)] text-[var(--mg-fg-1)] placeholder:text-[var(--mg-fg-4)] focus:outline-none focus:border-[var(--mg-border-orange)] transition-colors"
                        placeholder="hello@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--mg-fg-2)] mb-2">{t.contact.form.message}</label>
                      <textarea
                        required
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)] text-[var(--mg-fg-1)] placeholder:text-[var(--mg-fg-4)] focus:outline-none focus:border-[var(--mg-border-orange)] transition-colors resize-none"
                        placeholder={isRtl ? "رسالتك..." : "Your message..."}
                      />
                    </div>
                    <Button type="submit" size="lg" icon={Send} full>
                      {t.contact.form.submit}
                    </Button>
                  </form>
                )}
              </GlassCard>
            </ScrollReveal>
          </div>

          {/* Info */}
          <div className="md:col-span-2">
            <ScrollReveal direction={isRtl ? "left" : "right"}>
              <GlassCard padding={28} className="mb-6">
                <div className="w-10 h-10 rounded-xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)] flex items-center justify-center mb-4 text-[var(--mg-orange-400)]">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[var(--mg-fg-1)] mb-2">{t.contact.email}</h3>
                <a href={`mailto:${t.contact.emailValue}`} className="text-[var(--mg-orange-400)] hover:underline text-sm">{t.contact.emailValue}</a>
                <p className="text-[var(--mg-fg-4)] text-sm mt-4">{t.contact.response}</p>
              </GlassCard>

              <GlassCard padding={28}>
                <h3 className="text-base font-bold text-[var(--mg-fg-1)] mb-3">
                  {isRtl ? "تابعنا" : "Follow Us"}
                </h3>
                <p className="text-[var(--mg-fg-3)] text-sm leading-relaxed">
                  {isRtl ? "تابع وراق على وسائل التواصل الاجتماعي لآخر التحديثات والأخبار." : "Follow Warraq on social media for the latest updates and news."}
                </p>
              </GlassCard>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
}
