import { Crown, Database, FileText, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PricingPage } from '../pricing/PricingPage';

interface SettingsWorkspaceProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function SettingsWorkspace({ onOpenPrivacy, onOpenTerms }: SettingsWorkspaceProps) {
  const { plan, status, daysRemaining } = useSubscription();
  const [showPricing, setShowPricing] = useState(false);

  const planLabel = plan === 'trial' ? 'فترة تجريبية' : plan === 'free' ? 'الخطة المجانية' : plan === 'monthly' ? 'اشتراك شهري' : plan === 'yearly' ? 'اشتراك سنوي' : 'ترخيص مدى الحياة';

  return (
    <div className="workspace-page">
      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
      <div className="workspace-page-header">
        <div><p className="workspace-eyebrow">مَتن</p><h1>الخطة والإعدادات</h1><p>إدارة الترخيص والخصوصية وبيانات التطبيق المحلية.</p></div>
      </div>

      <div className="settings-grid">
        <section className="settings-section">
          <div className="settings-section-icon"><Crown size={20} /></div>
          <div className="flex-1"><h2>{planLabel}</h2><p>الحالة: {status === 'active' ? 'نشطة' : 'منتهية'}{daysRemaining !== null ? ` · ${daysRemaining} يوم متبقٍ` : ''}</p></div>
          <button type="button" className="workspace-primary-button" onClick={() => setShowPricing(true)}>عرض الخطط</button>
        </section>
        <section className="settings-section">
          <div className="settings-section-icon success"><ShieldCheck size={20} /></div>
          <div className="flex-1"><h2>الخصوصية المحلية</h2><p>تتم معالجة أدوات PDF الأساسية داخل جهازك. تستخدم ميزة OCR خدمات Google عند تشغيلها.</p></div>
          <button type="button" className="workspace-secondary-button" onClick={onOpenPrivacy}>السياسة</button>
        </section>
        <section className="settings-section">
          <div className="settings-section-icon"><Database size={20} /></div>
          <div className="flex-1"><h2>بيانات التطبيق</h2><p>سجل الملفات الحديثة وحالة الترخيص محفوظان في مجلد بيانات مَتن المحلي.</p></div>
        </section>
        <section className="settings-section">
          <div className="settings-section-icon"><FileText size={20} /></div>
          <div className="flex-1"><h2>الشروط والمعلومات القانونية</h2><p>راجع شروط الاستخدام ومعلومات الاشتراك والدفع.</p></div>
          <button type="button" className="workspace-secondary-button" onClick={onOpenTerms}>عرض الشروط</button>
        </section>
      </div>
    </div>
  );
}
