import { Shield, ArrowRight } from 'lucide-react';

export const PrivacyPolicy = ({ onBack }: { onBack?: () => void }) => {
  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-4 mb-8 border-b pb-6">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
          <Shield size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">سياسة الخصوصية</h1>
          <p className="text-gray-500 mt-1">آخر تحديث: 22 أبريل 2026</p>
        </div>
      </div>

      <div className="space-y-8 text-gray-700 leading-loose">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. المعلومات التي نجمعها</h2>
          <p>
            نحن في "وراق" نولي أهمية قصوى لخصوصيتك. التطبيق يعمل بشكل أساسي على جهازك المحلي.
            المعلومات التي قد يتم جمعها تشمل:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 pr-4">
            <li>معرف الجهاز الفريد (Device ID) لربط اشتراكك بالجهاز.</li>
            <li>البريد الإلكتروني (في حال اخترت تسجيل الدخول أو الاشتراك).</li>
            <li>بيانات الاستخدام مجهولة المصدر لتحسين أداء الأدوات.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. معالجة الملفات</h2>
          <p>
            <strong>جميع ملفات PDF التي تقوم بمعالجتها تبقى على جهازك الشخصي.</strong>
            لا نقوم برفع ملفاتك إلى خوادمنا إلا في حال استخدام ميزة Tahweel (Google OCR)، حيث يتم رفع الملف مؤقتاً إلى حساب Google Drive الخاص بك وتحت إشرافك المباشر، ويتم حذفه فور انتهاء العملية.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. أمن البيانات</h2>
          <p>
            نحن نستخدم بروتوكولات تشفير متقدمة لحماية معلومات اشتراكك. بيانات الدفع يتم معالجتها بالكامل عبر بوابات دفع معتمدة (مثل PayMob أو Stripe) ولا نقوم بتخزين أي بيانات لبطاقات الائتمان على خوادمنا.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. حقوقك</h2>
          <p>
            لديك الحق في الوصول إلى بياناتك المخزنة لدينا، تصحيحها، أو طلب حذفها في أي وقت عبر مراسلتنا.
          </p>
        </section>
      </div>

      {onBack && (
        <button 
          onClick={onBack}
          className="mt-12 flex items-center gap-2 text-indigo-600 font-bold hover:gap-3 transition-all"
        >
          <ArrowRight size={20} /> العودة للتطبيق
        </button>
      )}
    </div>
  );
};
