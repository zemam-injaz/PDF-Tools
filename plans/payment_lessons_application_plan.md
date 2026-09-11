# Warraq — خطة تطبيق دروس طرق الدفع (Payment Lessons Application Plan) — v2

> **المصدر**: دروس المعرفة المضافة مؤخراً في DevEx:
> `product.payment_methods_strategy`, `product.saas_payment_methods`, `product.pricing_payment_methods`, `product.marketing_payment_methods`
>
> **المبدأ**: لا ننشئ دروساً جديدة ولا نعيد صياغة الموجود — نستخرج **الاستراتيجيات** المذكورة ونطبقها على تطبيق سطح المكتب Warraq (Tauri v2 + React 19 + Python FastAPI + Supabase + PayMob).

---

## 0. التقييم والهدف الأساسي

**تقييم الخطة السابقة (v1):**

| المحور | الدرجة |
|--------|--------|
| Architecture | 9/10 |
| Security | 8/10 |
| Launch readiness | 6/10 |
| Complexity | 7/10 — أعلى مما تحتاجه مرحلة Warraq الحالية |

**الهدف الأساسي لـ v2** — أعيد ترتيب الخطة حول هدف واحد:

> **أطلق نسخة مجانية أولاً، لكن ابنِ من البداية نظام Trial/Entitlement يسمح لك بتحويل التطبيق إلى مدفوع لاحقاً بدون إعادة بناء.**

### لا تجعل "Free for one year" = Trial تقني

لا نسمّي فترة الإطلاق داخلياً `trial` بالشكل التقليدي. الأفضل نموذج `FREE_LAUNCH`:

```text
FREE_LAUNCH
    ↓
Everyone gets full access
    ↓
Launch period ends
    ↓
Paid plans become active
```

عند انتهاء فترة الإطلاق يقرر **السيرفر** فقط أي مسار يتخذ الجميع:

```text
Entitlement
 ├── launch_free
 ├── trial
 ├── subscription
 ├── lifetime
 └── expired
```

مثال: `Launch ends: 2027-03-01` → بعدها يتحول الجميع تلقائياً إلى `FREE/LIMITED` أو `TRIAL` أو يُطلب منهم الاشتراك — **دون إصدار نسخة جديدة من التطبيق ودون تعديل قاعدة البيانات يدوياً**.

### لماذا رُفضت أجزاء من v1؟

- **Device fingerprint** — حُذف كلياً (إعادة تثبيت/تحديث ويندوز/VM/برامج خصوصية/حسابات متعددة تجعله مزعجاً أكثر من نافع). الحساب (`Supabase Auth → user_id`) هو الأساس و `device_id` عامل مساعد فقط.
- **Dunning كامل** — مؤجل. يكفي: `payment_failed → سجّل الحدث → لا تفعّل الاشتراك`.
- **Analytics كامل** — مؤجل. جدول `payment_events` وحده يكفي (`started / success / failed`).
- **SQLite كـ source of truth على السيرفر** — يُستبدل بـ Supabase؛ FastAPI يصبح Business Logic / API فقط.

---

## 1. المرحلة A — Launch Foundation (الأولوية القصوى)

> الدرس: `product.saas_payment_methods` — «افصل الأنظمة الثلاثة، اجعل الخادم مصدر الحقيقة، واسمح بالاستخدام حتى انتهاء فترة السماح المحلية».

### 1.1 مفهومان منفصلان في الـ Domain Model

لا نجعل أحدهما نسخة محسوبة من الآخر:

**1) Access entitlement** — متى تنتهي صلاحية المستخدم:

```text
access_until
```

**2) Offline verification** — إلى متى نثق بآخر إجابة من السيرفر:

```text
last_verified_at
offline_grace_until   # محسوبة: last_verified_at + GRACE_DAYS
```

قرار الوصول:

```text
Server says:      access_until = 2027-01-01
Client verified:  2026-12-20
Offline grace:    7 days

Today 2026-12-23  →  ALLOW
Today 2026-12-30  →  BLOCK   # حتى مع access_until = 2027-01-01
                          # لأن العميل لم يتصل بالسيرفر منذ فترة طويلة
```

### 1.2 Backend — `models/subscription.py` + `services/subscription_service.py`

- أضف للحقل `Subscription`:
  - `access_until: Optional[datetime]` — نهاية الوصول الفعلية
  - `last_verified_at: Optional[datetime]` — آخر تحقق ناجح من الخادم
- **لا نخزّن `grace_until` في قاعدة البيانات** — تُحسب: `last_verified_at + GRACE_DAYS`.
- ثابت `GRACE_DAYS = 7` في configuration وليس hard-coded.
- حدّث `last_verified_at = now()` عند كل طلب ناجح.
- **Expiry logic سليمة**: مصدر الحقيقة = الخادم، لا وقت الجهاز — أبقها.

### 1.3 Backend — نقطة تحقق جديدة

`api/subscription_routes.py` — `POST /api/subscription/verify`:
- يعيد بيانات الـ entitlement الكاملة ويحدّث `last_verified_at`.
- المبدأ: «التحقق = اتصال واحد ناجح يجدّد فترة السماح».

### 1.4 Backend — سرعة فترة الإطلاق Server-controlled

في config (Supabase/Environment):

```text
launch_access_enabled = true
launch_access_until   = 2027-03-01    # LAUNCH_END_DATE وليس TRIAL_DAYS = 365
```

استجابة الـ entitlement:

```json
{
  "entitlement": "launch_free",
  "access_until": "2027-03-01",
  "features": ["all"]
}
```

عند انتهاء التاريخ يتحول `launch_free → expired` **بدون نسخة جديدة وبدون migration وبدون تعديل يدوي**.

### 1.5 Frontend — `src/contexts/SubscriptionContext.tsx`

المشكلة الحالية: `checkAccess` يقرر فقط من آخر استجابة للخادم؛ عند عدم الاتصال `data === null` → يرفض حتى للمشتركين (السطر ~88).

الحل (كاش محلي + فترة سماح):
- خزّن الكاش في **مسار تخزين محلي دائم لـ Tauri** (مجلد `~/.pdf-tools/` بجانب قاعدة البيانات) — **وليس localStorage**، لأنه سهل التعديل نسبياً.
- **القاعدة**: *Client cache لا يمنح صلاحية؛ هو فقط يسمح باستخدام آخر entitlement موثوق به أثناء Offline.* كل ما على جهاز العميل قابل للتعديل — الحماية الحقيقية في السيرفر.
- محتوى الكاش: `{ entitlement, access_until, last_verified_at, features_enabled, plan_type, cached_at }`.
- عند بدء التشغيل: اقرأ الكاش **فوراً** (لا شاشة قفل)، ثم أعد التحقق في الخلفية.
- `effectiveAccessUntil = min(access_until, last_verified_at + GRACE_DAYS)`.
- `checkAccess(feature)`:
  1. `VITE_DEV_MODE` → true (مستمر)
  2. إن كانت الميزة ضمن الكاش **و** `now < effectiveAccessUntil` → true (يعمل Offline)
  3. إلا → استخدم نتيجة آخر تحقق من الخادم
- عند نجاح `refreshSubscription`: اكتب الكاش الجديد.

**النتيجة**: مستخدم اشتراك نشط أو تجربة سارية يعمل بكامل الميزات حتى لو انقطع الإنترنت حتى 7 أيام بعد آخر تحقق — دون فتح باب التلاعب (لا يمكن تجاوز `access_until`).

### 1.6 Supabase كـ source of truth

ننقل `subscriptions` و `payment_events` من SQLite إلى Supabase. FastAPI يصبح:

```text
Business Logic / API
```

وليس:

```text
Business Logic + Database + Auth
```

**جدول `subscriptions`:**

```text
id
user_id
plan_id
status
started_at
access_until
provider
provider_customer_id
provider_subscription_id
created_at
updated_at
```

**جدول `payment_events`:**

```text
id
provider
provider_event_id
event_type
user_id
transaction_id
payload_hash
created_at
processed_at
```

مع:

```text
UNIQUE(provider, provider_event_id)
UNIQUE(provider, transaction_id)
```

> `transaction_id` = `provider_transaction_id` — لا نجعل `event_id` الوسيلة الوحيدة للـ idempotency: نمنع معالجة **نفس webhook مرتين** و**نفس معاملة Paymob عبر شكلين مختلفين من الـ webhook**.

### 1.7 الحساب أساس، والجهاز مساعد

```text
user_id = 123
device_id = ABC        # عامل مساعد فقط
```

وليس:

```text
device_id = ABC  →  owns trial
```

`device_id` يُخزَّن في ملف دائم داخل `~/.pdf-tools/` (ينجو من إعادة تثبيت التطبيق).

**ملاحظة صريحة**: إمكانية `email1 → 6 أشهر / email2 → 6 أشهر ...` ليست خطأ تقنياً. في مرحلة أول 100–1000 مستخدم، **لا نبنِ anti-abuse معقداً** — التركيز على:

```text
Product → Users → Usage → Conversion
```

ثم عالج abuse حقيقياً إذا ظهر.

---

## 2. المرحلة B — Payment (Webhook آمن + Idempotent)

> الدرس: `product.saas_payment_methods` — «التحقق من التوقيع قبل المعالجة، والمعالج Idempotent: نفس الحدث لا يحدّث الصلاحية مرتين».

### 2.1 Backend — `services/payment_service.py`

مسار المعالجة:

```text
Webhook
   ↓
Verify signature (HMAC)
   ↓
Check event_id  +  transaction_id
   ↓
Already processed?
   ├── YES → 200 OK
   └── NO
        ↓
    Process payment
        ↓
    Update entitlement
        ↓
    Record event
```

- استخرج `event_id` و `transaction_id` (`obj.id` / `order.id` / `txn.id` — لا تعتمد على حقل غائب).
- استخدم **قيود UNIQUE في Supabase** (وليس `INSERT OR IGNORE` فقط) لمنع التكرار عبر كل المسارات.
- عند التحديث الناجح: سجّل الحدث + حدّث `last_verified_at`.
- لا تحذف الحدث بعد المعالجة — جدول `payment_events` أرشيف للتتبع.

### 2.2 Backend — `api/payment_routes.py`

- الـ HMAC موجود — أبقِه **إلزامياً في الإنتاج** (لا «mock mode» بلا تحقق عند غياب `PAYMOB_HMAC_SECRET`).
- مرّر `event_id` + `transaction_id` للخدمة؛ حسّن رسائل «already processed».
- Mock Gateway: أضف `event_id` و `transaction_id` فريدين لكل عملية حتى تعمل الـ idempotency في الاختبار.

### 2.3 Entitlement عند نجاح الدفع

```text
Paymob → Webhook → Verify → Payment event → Subscription → Entitlement
```

عند `payment_failed`: **سجّل الحدث فقط ولا تفعّل الاشتراك** — دون نظام retry/حملات استرداد. لا تُسقط الاشتراك الحالي فوراً عند فشل تجديد؛ خفّض إلى Free بعد مهلة فقط (البنية الجاهزة في `_get_features` تسمح بذلك).

---

## 3. المرحلة C — الإطلاق (Launch)

**انشر التطبيق الآن.** لا تنتظر:

- Dunning
- Device fingerprint
- Analytics متطور
- Marketing متقدم
- تحسينات الدفع

تكفي المعايير أدناه للانطلاق.

---

## 4. المرحلة D — قبل انتهاء فترة الإطلاق

بعد أن يكون عندك مستخدمون حقيقيون (وقبل انتهاء `launch_access_until` بشهر تقريباً):

```text
Pricing
↓
Annual vs Monthly
↓
Paymob
↓
Conversion
↓
Failed payments
↓
Dunning
```

هنا تبدأ تحسينات Monetization.

### 4.1 التسعير أثناء فترة الإطلاق

لا نجعل صفحة التسعير محور المنتج الآن. الأفضل:

```text
Warraq
Free during launch period

🚀 All features included

Launch offer:
Free until [date]
```

وفي مكان صغير: `Paid plans will be introduced later.`

ثم قبل انتهاء الفترة بشهر تقريباً:

```text
Your free access ends in 27 days.

Annual  299 EGP
Monthly  49 EGP
```

بهذا تختبر willingness to pay قبل الدفع الفعلي.

### 4.2 عند تفعيل التسعير

- **شارات ثقة**: صف أسفل الأزرار — `Visa · Mastercard · Meeza · InstaPay · Vodafone Cash` + سطر «دفع آمن ومشفّر عبر PayMob». لا تعرض طريقة لا تدعمها فعلياً.
- **السنوي أولاً بصياغة دقيقة**: بدل «خصم 40%»، اكتب «وفّر 50%» (12 × 49 = 588 ↔ 299) مع «≈ 24.9 ج.م شهرياً».
- كل خطة تُظهر الميزات الحقيقية (حالياً مكررة بشكل عام) — ارتبط بقائمة `features_enabled` الفعلية.
- أضف **التحويل كميزة** لخطة مدى الحياة: «دفعة واحدة + ترخيص دائم».
- **رسوم الدفع داخل السعر**: أضف حاسبة رسوم تقديرية (PayMob ~2-3% + ضريبة 14% مصر) وتأكد أن 49/299/899 تحافظ على الهامش — **لا Surcharging**.

---

## 5. اختيار مدة الإطلاق: 6 أشهر أم 12؟

الميل إلى **6 أشهر**:

```text
Month 1  Launch
Month 2  Fix bugs
Month 3  Improve UX
Month 4  Understand usage
Month 5  Introduce pricing
Month 6  Convert users
```

سنة كاملة مجانية قد تؤجل أهم سؤال: *هل الناس مستعدة للدفع مقابل Warraq؟*

لكن لو المنتج ما زال يحتاج وقتاً للوصول لمستوى ممتاز → اجعلها **12 شهراً server-configurable** عبر:

```text
LAUNCH_END_DATE
```

وليس:

```text
TRIAL_DAYS = 365
```

---

## 6. أولويات وترتيب التنفيذ (النسخة الموصى بها)

| الأولوية | ماذا؟ | الملفات | الأثر | الجهد |
| -------- | ----- | ------- | ----- | ----- |
| 🔴 P0 | Server-controlled Entitlement | `models/subscription.py`, `services/subscription_service.py`, `api/subscription_routes.py` | قرار الصلاحية كله من السيرفر + إطلاق مجاني قابل للانتهاء | ~1 يوم |
| 🔴 P0 | Launch Free 6/12 شهر | `subscription_service.py` + config | مجانية للجميع تنتهي تلقائياً | ~نصف يوم |
| 🔴 P0 | Offline grace 7 أيام | `SubscriptionContext.tsx` + كاش Tauri دائم | لا قفل فجائي عند الانقطاع | ~1 يوم |
| 🔴 P0 | Paymob HMAC | `api/payment_routes.py` | أمان الدفع إلزامياً | ~نصف يوم |
| 🔴 P0 | Webhook idempotency | `payment_service.py`, `payment_routes.py` | يمنع تفعيلاً مزدوجاً ويمنح أرشيفاً | ~نصف يوم |
| 🟠 P1 | Supabase subscriptions | Supabase schema + ترحيل البيانات | source of truth موحد قابل للتوسع | ~1 يوم |
| 🟠 P1 | Payment events | جدول `payment_events` + ربط الـ webhook | تتبع أساسي (started/success/failed) | ~نصف يوم |
| 🟠 P1 | Permanent local device state | تخزين `device_id`/كاش في `~/.pdf-tools/` بدل localStorage | ينجو من إعادة التثبيت + كاش أصلب | ~نصف يوم |
| 🟢 P2 | Pricing page (شارات + خصم دقيق) | `PricingPage.tsx`, `TrialBanner.tsx` | رفع التحويل عند نهاية الإطلاق | ~نصف يوم |
| 🟢 P3 | Dunning | `payment_service.py` + إشعار داخل التطبيق | استرداد الدفع الفاشل | مؤجل |
| 🟢 P3 | Advanced anti-abuse | — | مؤجل حتى ظهور abuse حقيقي | مؤجل |
| 🟢 P3 | Advanced analytics | — | مؤجل؛ `payment_events` يكفي | مؤجل |

> **لا تجعل نظام الدفع سبب تأخير إطلاق Warraq.** ابنِ نواة Monetization صحيحة وصغيرة الآن، ثم اجعل السوق يحدد ما يستحق التعقيد لاحقاً.

---

## 7. معايير القبول (Definition of Done)

- [ ] `launch_free` يُمنح لكل مستخدم فوراً حتى `launch_access_until`، ويتحول تلقائياً عند انتهائه دون نسخة جديدة.
- [ ] قرار الصلاحية الحقيقي من السيرفر فقط؛ الكاش المحلي لا يمنح صلاحية بل يسمح باستخدام آخر entitlement موثوق به.
- [ ] مستخدم اشتراك/تجربة يعمل بكل ميزاته لمدّة 7 أيام بعد آخر تحقق ناجح دون اتصال.
- [ ] عند فشل التحقق بعد انتهاء الفترة: تظهر شاشة ترقية فقط — لا قفل فجائي.
- [ ] إرسال نفس Webhook مرتين **أو نفس transaction** عبر شكلين لا يمدّد الاشتراك ولا يكرر السجل (بفضل `UNIQUE(provider, event_id)` و `UNIQUE(provider, transaction_id)`).
- [ ] إعادة تثبيت التطبيق لا تمنح تجربة جديدة (مع الاحتفاظ بمجلد البيانات).
- [ ] لا يوجد Device Fingerprint في أي مكان في الكود.
- [ ] `payment_failed` يسجّل الحدث فقط ولا يفعل الاشتراك ولا يشغّل نظام Dunning.
- [ ] جدولا `subscriptions` و `payment_events` في Supabase وليسا في SQLite داخل FastAPI.

---

## 8. ملاحظات

- **لا تغيير في نموذج الدفع**: PayMob على سطح المكتب عبر الويب هو الخيار الصحيح وفق درس `payment_methods_strategy` (عمولة أقل + تحكم كامل بالترخيص من الخادم) — لا نضيف IAP.
- لا نعتمد أبداً على وقت الجهاز في الحكم على الصلاحية.
- الأسعار الحالية (49/299/899 ج.م) تتوافق مع قاعدة العملة المحلية — نراجعها فقط لحساب الرسوم والهامش عند تفعيل التسعير (المرحلة D).
- بنية v2:

```text
        WARRAQ DESKTOP
                │ Login
                ↓
         Supabase Auth
                │
                ↓
          FastAPI Server
                │
      ┌─────────┴─────────┐
      ↓                   ↓
 Entitlement          Paymob
      │                   │
      │              Webhook
      │                   ↓
      │             Payment Event
      │                   │
      └─────────┬─────────┘
                ↓
          Subscription
                │
                ↓
          Entitlement
                │
                ↓
    Desktop App Cache (~/.pdf-tools/)
                │
                ↓
          Offline ≤ 7d
```