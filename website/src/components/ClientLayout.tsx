import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/context/LanguageContext";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isRtl } = useLanguage();

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl]);

  return (
    <div className="relative min-h-screen font-sans selection:bg-[rgba(255,107,0,0.25)] selection:text-white">
      <div className="mg-bg-main" />
      <div className="mg-bg-grid" />
      <div className="mg-bg-noise" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-10 pt-24 pb-12">
          {children}
        </main>
        <div className="w-full max-w-[1280px] mx-auto px-4 md:px-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
