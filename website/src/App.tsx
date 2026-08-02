import { Switch, Route, Router } from "wouter";
import { LanguageProvider } from "@/context/LanguageContext";
import { ClientLayout } from "@/components/ClientLayout";
import Home from "@/pages/Home";
import ToolsPage from "@/pages/ToolsPage";
import PricingPage from "@/pages/PricingPage";
import FaqPage from "@/pages/FaqPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import LocalProcessingPage from "@/pages/features/LocalProcessingPage";
import ArabicFirstPage from "@/pages/features/ArabicFirstPage";
import BatchAsyncPage from "@/pages/features/BatchAsyncPage";
import ToolDetailPage from "@/pages/features/ToolDetailPage";
import ArticlesPage from "@/pages/ArticlesPage";
import ArticleDetailPage from "@/pages/features/ArticleDetailPage";
import NotFound from "@/pages/NotFound";

function AppRoutes() {
  return (
    <ClientLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tools" component={ToolsPage} />
        <Route path="/tools/:slug" component={ToolDetailPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/features/local-processing" component={LocalProcessingPage} />
        <Route path="/features/arabic-first" component={ArabicFirstPage} />
        <Route path="/features/batch-async" component={BatchAsyncPage} />
        <Route path="/articles" component={ArticlesPage} />
        <Route path="/articles/:slug" component={ArticleDetailPage} />
        <Route component={NotFound} />
      </Switch>
    </ClientLayout>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <AppRoutes />
      </Router>
    </LanguageProvider>
  );
}
