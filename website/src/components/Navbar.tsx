import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useState, useEffect } from "react";
import { Menu, X, Globe, Download } from "lucide-react";

const navItems = [
  { key: "home", href: "/" },
  { key: "tools", href: "/tools" },
  { key: "articles", href: "/articles" },
  { key: "pricing", href: "/pricing" },
  { key: "faq", href: "/faq" },
  { key: "about", href: "/about" },
] as const;

export function Navbar() {
  const [location] = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-[rgba(5,6,14,0.82)] backdrop-blur-[24px] border-b border-[var(--mg-border-soft)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
        : "bg-transparent border-b border-transparent"
    )}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-[9px] bg-[var(--mg-orange-500)] flex items-center justify-center shadow-[var(--mg-shadow-glow-orange)] transition-transform duration-200 group-hover:scale-105">
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
              <path d="M8 14 L16 9 L24 14 L16 19 L8 14 Z" stroke="#06070D" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M8 20 L16 25 L24 20" stroke="#06070D" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-[16px] text-[var(--mg-fg-1)] tracking-tight">{t.brand.name}</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-150",
                  active ? "text-[var(--mg-fg-1)]" : "text-[var(--mg-fg-3)] hover:text-[var(--mg-fg-1)]"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{t.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--mg-fg-3)] hover:text-[var(--mg-fg-1)] hover:bg-[var(--mg-surface-2)] transition-all duration-150 text-sm font-medium"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-[12px]">{language === "en" ? "العربية" : "English"}</span>
          </button>

          <Link
            href="/#download"
            className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--mg-orange-500)] text-[#06070D] font-semibold text-[13px] shadow-[var(--mg-shadow-glow-orange)] hover:bg-[var(--mg-orange-400)] transition-all duration-150 mg-shine-btn"
          >
            <Download className="w-3.5 h-3.5" />
            {t.nav.download}
          </Link>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--mg-surface-2)] text-[var(--mg-fg-2)] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-[var(--mg-border-soft)] bg-[rgba(5,6,14,0.95)] backdrop-blur-[24px] overflow-hidden"
          >
            <div className="max-w-[1280px] mx-auto px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "text-[var(--mg-fg-1)] bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)]"
                      : "text-[var(--mg-fg-3)] hover:text-[var(--mg-fg-1)] hover:bg-[var(--mg-surface-1)]"
                  )}
                >
                  {t.nav[item.key]}
                </Link>
              ))}
              <div className="pt-4 mt-2 border-t border-[var(--mg-border-soft)]">
                <Link
                  href="/#download"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[var(--mg-orange-500)] text-[#06070D] font-semibold text-sm"
                >
                  <Download className="w-4 h-4" />
                  {t.nav.download}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
