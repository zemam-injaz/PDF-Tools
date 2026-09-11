# Warraq — تقرير نظام الدفع والاشتراكات (Monetization System)

> **التاريخ**: 2026-09-02
> **الحالة**: نواة Monetization جاهزة للـ Staging — ليست بعد للدفع Production الكامل
> **المشروع**: Warraq (Tauri v2 + React 19 + Python FastAPI + Supabase/SQLite + PayMob)

---

## 1. ملخص تنفيذي

تم بناء **نواة Monetization صحيحة وصغيرة** وفق فلسفة: «أطلق مجانيًا أولًا، لكن ابنِ من البداية نظام Trial/Entitlement يسمح بالتحويل إلى مدفوع لاحقًا بدون إعادة بناء».

| المحور | التقييم | الحالة |
|--------|---------|--------|
| Server-controlled Entitlement | 🟢 9/10 | مكتمل + مختبر |
| Launch Free (server-configurable) | 🟢 9/10 | مكتمل + مختبر |
| Offline Grace (7 أيام) | 🟢 8.5/10 | مكتمل + مختبر |
| Entitlement Signing (Ed25519) | 🟢 9/10 | مكتمل + مختبر (منع تزوير الـ cache) |
| Webhook Idempotency (dual-key) | 🟢 9/10 | مكتمل + مختبر |
| PayMob HMAC (fail-closed) | 🟢 9/10 | مكتمل + مختبر |
| Supabase integration | 🟡 6/10 | **schema فقط — لم يُدمج بعد** |
| Testing | 🟢 8/10 | 61 Backend + 12 Frontend + 12/12 سلوكي حي |

---

## 2. ما تم إنجازه بالكامل (Implemented)

### 2.1 نموذج الـ Entitlement الجديد
الملف: `python-server/models/subscription.py`

نظام الصلاحية أصبح **5 حالات** بدل النموذج التقليدي (Trial فقط):

```text
Entitlement
 ├── launch_free      ← فترة الإطلاق: الجميع يحصل على كل شيء
 ├── trial            ← تجربة حقيقية (لاحقًا بعد الإطلاق)
 ├── subscription     ← اشتراك شهري/سنوي
 ├── lifetime         ← دفعة واحدة + ترخيص دائم
 └── expired          ← منتهي / محدود (الميزات الأساسية فقط)
```

### 2.2 السيرفر هو مصدر الحقيقة (Server-controlled)
الملف: `python-server/services/subscription_service.py`

- **فترة الإطلاق تُدار من السيرفر وليس من التطبيق** — بتغيير Environment Variables فقط:
  - `LAUNCH_ACCESS_ENABLED=true` — تفعيل فترة الإطلاق
  - `LAUNCH_ACCESS_UNTIL=2027-03-01T00:00:00` — تاريخ نهايتها (استخدم `LAUNCH_END_DATE` وليس `TRIAL_DAYS=365`)
- عند انتهاء التاريخ، يتحول كل المستخدمين تلقائيًا من `launch_free` إلى حالة أخرى **دون نسخة جديدة من التطبيق ودون تعديل قاعدة البيانات يدويًا** — تم إثبات ذلك في الاختبار الحيّ: غيّرنا `LAUNCH_ACCESS_UNTIL` في وقت التشغيل وتغيرت النتيجة فورًا.

**فصل مفهومين مختلفين في الـ Domain Model:**

```text
1) Access entitlement    access_until        ← متى تنتهي صلاحية المستخدم؟
2) Offline verification  last_verified_at    ← إلى متى نثق بآخر إجابة من السيرفر؟
                         grace_until = last_verified_at + OFFLINE_GRACE_DAYS (7)
```

القرار النهائي على الجهاز:
```text
effectiveAccessUntil = min(access_until, grace_until)
```

### 2.3 الـ Cache موقّع (يمنع التزوير)
- **السيرفر** يوقّع كل entitlement بـ **Ed25519** (`services/entitlement_signing.py`) ويُضيف حقل `signature`.
- **التطبيق** يتحقق من التوقيع بقوة عامة مدمجة (`src/lib/entitlement.ts`) قبل أن يثق بأي cache محلي.
- **أي تعديل** على `entitlement` أو `features` أو `access_until` أو `last_verified_at` → التوقيع يفشل → يُتجاهل الـ cache → لا صلاحية.
- القاعدة الحاكمة: **Client cache لا يمنح صلاحية؛ هو فقط يسمح باستخدام آخر entitlement موثوق (موقّع) أثناء Offline**.

### 2.4 `last_verified_at` يتجدد فقط عند تحقق حقيقي
أُصلح: التجديد يتم حصريًا عبر `verify_access` (تستدعيه المسارات الثلاثة `/auth/device` و`/status` و`/verify`). أي طلب API عادي (دمج/تقسيم PDF مثلًا) **لا** يمدد فترة السماح.

### 2.5 Webhook Idempotency (dual-key)
الملف: `python-server/services/payment_service.py` + جدول `payment_events`

```text
Webhook
   ↓
Verify HMAC-SHA512 (إلزامي في production)
   ↓
استخراج event_id + transaction_id
   ↓
record_payment_event  ← UNIQUE(provider, event_id) + UNIQUE(provider, transaction_id)
   ↓
موجود مسبقًا؟  ──YES──→ 200 OK (duplicate) — لا إعادة تفعيل
   ↓ NO
Process payment → تحديث الاشتراك → تسجيل الحدث
```

- نفس الـ webhook مرتين → **تفعيل واحد فقط**.
- نفس معاملة PayMob عبر شكلين مختلفين من الـ webhook → **duplicate** (جمال الـ UNIQUE المزدوج).
- `payment_failed` → **يُسجَّل فقط ولا يفعّل الاشتراك** (بلا Dunning الآن).

### 2.6 PayMob Security — Fail Closed
الملف: `python-server/api/payment_routes.py`

```text
ENVIRONMENT=production  و  PAYMOB_HMAC_SECRET مفقود
        ↓
403 — يرفض كل webhook — لا يوجد mock/bypass في الإنتاج
```

- في غير production: mock mode للاختبار فقط.
- التوقيع: HMAC-SHA512 على الـ raw body مقارنة بـ `HTTP_HMAC` header (طريقة PayMob).

### 2.7 تخزين محلي دائم
- `device_id` و `entitlement_cache` في **مجلد بيانات التطبيق** (يمر عبر أوامر Tauri `read_app_file`/`write_app_file` في `src-tauri/src/main.rs`).
- النتيجة: إعادة تثبيت التطبيق **لا** تمنح تجربة جديدة (طالما احتفظ المجلد). مع ملاحظة صريحة: سلوك الـ installer على Windows يحتاج اختبارًا فعليًا.

### 2.8 الاختبارات
- **61 اختبار Backend** يمر (pytest) — منها 13 جديدة تغطي: entitlement، idempotency، التوقيع، fail-closed، سلوك `last_verified_at`.
- **12 اختبار Frontend** يمر (vitest) — تزوير الـ cache + سيناريوهات فترة السماح.
- **12/12 Matrix سلوكي حي** على سيرفر حقيقي (T1–T5).
- **Cross-language proof**: payload موقّع من Python يتحقق بنجاح تحت WebCrypto JS بالقوة المدمجة.

> ملاحظة: توجد 13 فشل اختبار سابقة في وحدات `reader/` (Tokenizer/TimingEngine) — **غير مرتبطة** بنظام الدفع وكانت موجودة قبل العمل عليه.

---

## 3. كيف يعمل نظام الدفع (مشروح بالكامل)

### 3.1 البنية العامة

```text
        WARRAQ DESKTOP (Tauri + React)
                │
                │ 1. POST /api/subscription/auth/device
                │    (device_id)
                ↓
          FastAPI Server (Hostinger VPS)
                │
      ┌─────────┴───────────────┐
      ↓                         ↓
 Entitlement Engine        PayMob (بوابة الدفع)
 (SQLite الآن، Supabase لاحقًا)
      │                         │
      │               2. webhook ← 3. يعالج المستخدم الدفع في PayMob
      │                         ↓
      │                   /api/payment/webhook
      │                         ↓
      │               HMAC + idempotency + fulfill
      │                         │
      └────────────┬────────────┘
                   ↓
            تحديث الاشتراك
                   ↓
            entitlement جديد (موقّع)
                   ↓
            desktop cache (خلال 7 أيام سماح)
```

### 3.2 المسار التفصيلي خطوة بخطوة

**أ. عند فتح التطبيق (Entitlement Flow):**
```text
1. يقرأ التطبيق الـ cache المحلي فورًا (لا شاشة قفل)
   → يتحقق من توقيعه Ed25519
   → إن صالحًا وضمن فترة السماح: يعمل المستخدم فورًا حتى بدون إنترنت
2. في الخلفية: POST /api/subscription/verify → يجدد last_verified_at
   → السيرفر يحسب الـ entitlement (launch_free / trial / subscription / ...)
   → يوقّع النتيجة → يخزّنها التطبيق في الـ cache
3. checkAccess(feature) يعيد true فقط إذا:
   now < min(access_until, grace_until)  و  feature ∈ features_enabled
```

**ب. عند الشراء (Payment Flow):**
```text
1. POST /api/payment/checkout {user_id, plan_id, amount} → payment_url
2. يفتح التطبيق payment_url (PayMob iframe / link — حاليًا mock في التطوير)
3. المستخدم يدفع على PayMob (Visa/Mastercard/Meeza/InstaPay/Vodafone Cash)
4. PayMob يرسل Webhook → POST /api/payment/webhook (HMAC-SHA512 في header)
5. السيرفر:
   a) يتحقق HMAC (في production: مفقود → 403 فورًا)
   b) يستخرج event_id + transaction_id
   c) record_payment_event → duplicate؟ → 200 بدون إعادة تفعيل
   d) نجاح → _fulfill_order → يحدّث subscriptions (plan_type, paid_until, access_until, status=active)
   e) فشل → يسجّل الحدث فقط (payment_failed) — لا يفعّل
6. آخر entitlement (موقّع) يتوفر عبر /verify بعدها
```

### 3.3 نموذج البيانات

**`subscriptions` (SQLite الآن، وSupabase لاحقًا):**
```text
subscription_id  user_id  plan_type  trial_started_at  trial_ends_at
paid_until  status  access_until  last_verified_at  updated_at
```

**`payment_events` (الأرشيف + الـ idempotency):**
```text
id  provider  provider_event_id  event_type  user_id
transaction_id  payload_hash  created_at  processed_at
+ UNIQUE(provider, provider_event_id)
+ UNIQUE(provider, transaction_id)
```

**نموذج Supabase الجاهز:** `python-server/supabase_schema.sql`
(يشمل `subscriptions` و`payment_events` بنفس القيود + `app_settings` لفترة الإطلاق).

### 3.4 متغيرات البيئة (Config)

| المتغير | الافتراضي | المعنى |
|---------|-----------|--------|
| `LAUNCH_ACCESS_ENABLED` | `true` | تفعيل فترة الإطلاق المجانية |
| `LAUNCH_ACCESS_UNTIL` | `2027-03-01T00:00:00` | نهاية فترة الإطلاق |
| `OFFLINE_GRACE_DAYS` | `7` | أيام السماح بعد آخر تحقق |
| `ENVIRONMENT` | — | `production` → يرفض webhook بدون HMAC secret |
| `PAYMOB_HMAC_SECRET` | — | سر HMAC للتحقق من webhooks |
| `ENTITLEMENT_PRIVATE_KEY` | ملف محلي | المفتاح الخاص لتوقيع entitlements |

### 3.5 نموذج الأمان

```text
السيرفر = مصدر الحقيقة الوحيد (لا وقت جهاز، لا device-side decisions)
العميل = يحمل فقط آخر entitlement موقّع
التوقيع يمنع:  تعديل الميزات / تزوير access_until / تزوير last_verified_at
السماح مقيّد بـ:  min(access_until, grace_until) محسوبة من قيم موقّعة
```

---

## 4. ما يجب فعله لاحقًا (Next Steps — عند استلام مفاتيح PayMob)

### 4.1 أولًا: استلام مفاتيح PayMob وتفعيل الإنتاج 🔴
سأحتاج منك (حين تجهزها):
```env
ENVIRONMENT=production
PAYMOB_HMAC_SECRET=...       # سر توقيع الـ webhook من PayMob Dashboard
PAYMOB_API_KEY=...           # مفتاح API (إن لزم للـ iframe/checkout)
PAYMOB_INTEGRATION_ID_EGYPT=...
PAYMOB_INTEGRATION_ID_SA=...
```
ثم ننفذ:
1. **استبدال mock gateway بالـ iframe الحقيقي** — `create_checkout_session` حاليًا يرجع رابط mock. التطبيق الحقيقي يحتاج:
   - Auth Token من PayMob
   - تسجيل Order
   - إنشاء Payment Key (payment_key)
   - إعادة `iframe_url` إلى الواجهة
2. **ربط webhook إنتاجي**: PayMob يرسل `obj.id` (transaction) و`obj.order.id` (order) — الكود جاهز لاستخراجها.
3. **الـ HMAC إلزامي** — مضمون بـ `ENVIRONMENT=production` (فشل مغلق).
4. **Metadata**: التأكد أن PayMob يرسل `user_id` و`plan_id` عبر `extra_step_company_id` أو metadata، وإلا نربط عبر `order.id → transaction` كمرجع.

### 4.2 دمج Supabase (تصبح مصدر الحقيقة) 🟠
- تطبيق `supabase_schema.sql` على مشروع Supabase.
- ربط FastAPI بـ Postgres (بدل SQLite) في `subscription_service` و`payment_service`.
- نقل `users` → `auth.users`، و`subscriptions` و`payment_events` إلى Supabase.
- **ميزة مؤجلة**: Supabase Auth → **الحساب أساس** والـ entitlement لكل `user_id` (يعمل على عدة أجهزة)، و`device_id` يصبح عاملًا مساعدًا فقط.

### 4.3 اختبارات إلزامية قبل الإطلاق
1. **اختبار دفع حقيقي** (مبلغ رمزي 1 EGP) عبر PayMob في وضع Testing.
2. **اختبار webhook مكرر** و**معاملة مكررة** في إنتاج PayMob.
3. **اختبار Installer حقيقي على Windows**: هل `device_id` ينجو من uninstall/reinstall.
4. **اختبارات تعدد الأجهزة** بعد ربط Supabase Auth.
5. مراجعة **إشعار `payment_failed`** داخل التطبيق.

### 4.4 المرحلة D — التسعير والتحويل (بعد انتهاء فترة الإطلاق)
- صفحة تسعير: «وفّر 50% على السنوي» (12×49=588 ↔ 299) + «≈ 24.9 ج.م شهريًا» + شارات الثقة (`Visa · Mastercard · Meeza · InstaPay · Vodafone Cash`) + «دفع آمن ومشفّر عبر PayMob».
- اختبار الاستعداد للدفع قبل نهاية الإطلاق بشهر («Your free access ends in 27 days»).
- احتساب هامش الرسوم (PayMob 2-3% + ضريبة 14%) داخل السعر — بلا Surcharging.

### 4.5 مؤجل عمدًا (P3) — لا تبنِه الآن
- **Dunning** (استرداد الدفع الفاشل): يكفي `payment_failed → سجل → لا تفعّل`؛ النظام الكامل لاحقًا.
- **Anti-abuse متقدم** (multi-account عبر إيميلات متعددة): لا تبني قبل أول 100–1000 مستخدم وظهور abuse حقيقي.
- **Analytics متطور**: جدول `payment_events` (started/success/failed) يكفي حاليًا.

---

## 5. الخطوات المقترحة فور استلام مفاتيح PayMob

```text
1. [أنا] أضع المفاتيح في بيئة الاختبار (لن تُطبع في السجلات)
2. [أنا] أستبدل mock checkout بـ PayMob iframe الحقيقي
3. [أنا] أضيف صفحة تسعير «Free during launch» + رسالة نهاية الإطلاق
4. [نحن] اختبار دفع حقيقي 1 EGP + webhook حقيقي
5. [نحن] اختبار idempotency مع webhook إنتاجي
6. [نحن] نشر Staging ثم Release
```

> عند جاهزية المفاتيح، أرسلها وسأكمل الخطوة 2 مباشرة.

---

## 6. الملفات المعنية (Files)

| الملف | الدور |
|------|-------|
| `python-server/services/subscription_service.py` | محرك الـ entitlement + SQLite + فترة الإطلاق |
| `python-server/services/payment_service.py` | معالجة webhook + idempotency + fulfill |
| `python-server/services/entitlement_signing.py` | توقيع Ed25519 للـ entitlements |
| `python-server/api/subscription_routes.py` | /auth/device, /status, /verify, /public-key |
| `python-server/api/payment_routes.py` | /checkout, /webhook (HMAC fail-closed), mock-gateway |
| `python-server/models/subscription.py` | PlanType, Status, EntitlementType |
| `python-server/supabase_schema.sql` | schema Supabase (جاهز للتطبيق) |
| `src/contexts/SubscriptionContext.tsx` | cache موقّع + checkAccess + فترة السماح |
| `src/lib/entitlement.ts` | التحقق WebCrypto من التوقيع |
| `src/lib/appStorage.ts` | تخزين دائم (Tauri file + fallback) |
| `src-tauri/src/main.rs` | أوامر read/write_app_file |

## 7. التقييم النهائي

> **النواة جاهزة ومختبرة (8/10).** المتبقي قبل دفع Production حقيقي: مفاتيح PayMob + دمج Supabase. نظام الدفع كامل من ناحية الـ Architecture والـ Security، والتفعيل الفعلي هو الخطوة التالية فقط.