import { ScrollReveal } from "@/components/ScrollReveal";
import { Button } from "@/components/Button";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import { Home, FileQuestion } from "lucide-react";

export default function NotFound() {
  const { isRtl } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <ScrollReveal>
        <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--mg-surface-2)] border border-[var(--mg-border-hairline)] flex items-center justify-center mb-8 text-[var(--mg-fg-3)]">
          <FileQuestion className="w-10 h-10" />
        </div>
        <h1 className="text-6xl font-bold mg-gradient-text mb-4">404</h1>
        <p className="text-xl text-[var(--mg-fg-3)] mb-8">
          {isRtl ? "الصفحة غير موجودة" : "Page not found"}
        </p>
        <Link href="/">
          <Button size="lg" icon={Home} className="px-8 text-base">
            {isRtl ? "العودة للرئيسية" : "Back to Home"}
          </Button>
        </Link>
      </ScrollReveal>
    </div>
  );
}
