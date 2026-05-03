import { FileText, ArrowRight } from 'lucide-react';

export const TermsOfService = ({ onBack }: { onBack?: () => void }) => {
  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-4 mb-8 border-b pb-6">
        <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">شروط الاستخدام</h1>
          <p className="text-gray-500 mt-1">آخر تحديث: 22 أبريل 2026</p>
        </div>
      </div>

      <div className="space-y-8 text-gray-700 leading-loose">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">1. قبول الشروط</h2>
          <p>
            باستخدامك لتطبيق "وراق" (Warraq)، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق على أي جزء منها، يرجى عدم استخدام التطبيق.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">2. تراخيص الاستخدام</h2>
          <p>
            نمنحك ترخيصاً شخصياً، غير حصري، وغير قابل للتحويل لاستخدام ميزات التطبيق وفقاً لخطة اشتراكك (مجانية أو احترافية).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">3. الاشتراكات والمدفوعات</h2>
          <ul className="list-disc list-inside mt-2 space-y-2 pr-4">
            <li>يتم تجديد الاشتراكات الشهرية والسنوية تلقائياً ما لم يتم الإلغاء.</li>
            <li>جميع المبيعات نهائية، ولكن يمكنك طلب استرداد الأموال خلال 7 أيام في حالات الخلل التقني المثبت.</li>
            <li>نحن نحتفظ بالحق في تغيير أسعار الخطط مع إشعار مسبق بفترة كافية.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">4. إخلاء المسؤولية</h2>
          <p>
            التطبيق يُقدم "كما هو". نحن نسعى لتقديم أعلى دقة في تحويل النصوص ومعالجة الملفات، ولكننا لا نضمن خلو النتائج من الأخطاء اللغوية أو التنسيقية الناتجة عن جودة الملف الأصلي.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">5. التعديلات</h2>
          <p>
            نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطار المستخدمين بأي تغييرات جوهرية عبر التطبيق أو الموقع الرسمي.
          </p>
        </section>
      </div>

      {onBack && (
        <button 
          onClick={onBack}
          className="mt-12 flex items-center gap-2 text-amber-600 font-bold hover:gap-3 transition-all"
        >
          <ArrowRight size={20} /> العودة للتطبيق
        </button>
      )}
    </div>
  );
};
