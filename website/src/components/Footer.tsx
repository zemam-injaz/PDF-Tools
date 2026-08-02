import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { Github, Monitor, Globe } from "lucide-react";

const toolLinks = [
  { label: "Merge PDF", href: "/tools" },
  { label: "Split PDF", href: "/tools" },
  { label: "Compress", href: "/tools" },
  { label: "Extract Images", href: "/tools" },
  { label: "OCR", href: "/tools" },
  { label: "Watermark", href: "/tools" },
];

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--mg-border-soft)] pt-16 pb-10 mt-20">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
        {/* Brand */}
        <div className="col-span-2">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
            <div className="w-10 h-10 rounded-[12px] bg-[var(--mg-orange-500)] flex items-center justify-center shadow-[var(--mg-shadow-glow-orange)] transition-transform group-hover:scale-105">
              <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
                <path d="M8 14 L16 9 L24 14 L16 19 L8 14 Z" stroke="#06070D" strokeWidth="2.5" strokeLinejoin="round"/>
                <path d="M8 20 L16 25 L24 20" stroke="#06070D" strokeWidth="2.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <span className="font-bold text-[var(--mg-fg-1)] text-[18px] block">{t.brand.name}</span>
              <span className="text-[12px] text-[var(--mg-fg-3)] font-medium tracking-wide uppercase">{t.brand.tagline}</span>
            </div>
          </Link>
          <p className="text-[14px] text-[var(--mg-fg-3)] leading-relaxed mb-6 max-w-[280px]">
            {t.footer.description}
          </p>
          <div className="flex gap-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--mg-surface-2)] flex items-center justify-center text-[var(--mg-fg-3)] hover:text-[var(--mg-fg-1)] transition-colors border border-[var(--mg-border-hairline)] cursor-pointer">
              <Monitor className="w-4 h-4" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--mg-surface-2)] flex items-center justify-center text-[var(--mg-fg-3)] hover:text-[var(--mg-fg-1)] transition-colors border border-[var(--mg-border-hairline)] cursor-pointer">
              <Globe className="w-4 h-4" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--mg-surface-2)] flex items-center justify-center text-[var(--mg-fg-3)] hover:text-[var(--mg-fg-1)] transition-colors border border-[var(--mg-border-hairline)] cursor-pointer">
              <Github className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Tools */}
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--mg-fg-4)] mb-5">{t.footer.tools}</h4>
          <ul className="space-y-3">
            {toolLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-[14px] text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] transition-colors">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Platform */}
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--mg-fg-4)] mb-5">{t.footer.platform}</h4>
          <ul className="space-y-3">
            {t.footer.platformItems.map((link) => (
              <li key={link}>
                <Link href="/#download" className="text-[14px] text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] transition-colors">{link}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--mg-fg-4)] mb-5">{t.footer.company}</h4>
          <ul className="space-y-3">
            <li><Link href="/about" className="text-[14px] text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] transition-colors">{t.footer.companyItems[0]}</Link></li>
            <li><Link href="/contact" className="text-[14px] text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] transition-colors">{t.footer.companyItems[1]}</Link></li>
            <li><Link href="/privacy" className="text-[14px] text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] transition-colors">{t.footer.companyItems[2]}</Link></li>
            <li><Link href="/terms" className="text-[14px] text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] transition-colors">{t.footer.companyItems[3]}</Link></li>
          </ul>
        </div>
      </div>

      <div className="pt-8 border-t border-[var(--mg-border-soft)] flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-[13px] text-[var(--mg-fg-4)]">(c) {year} {t.brand.name}. {t.footer.copyright}</p>
        <div className="flex items-center gap-4 text-[13px] text-[var(--mg-fg-4)]">
          <span>{t.footer.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
