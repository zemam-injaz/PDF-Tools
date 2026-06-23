# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical_flows.spec.ts >> Warraq PDF Tools - Critical Flows >> Subscription Gate Flow - displays premium lock screen if user lacks access
- Location: e2e\critical_flows.spec.ts:325:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("ترقية الحساب")')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button:has-text("ترقية الحساب")')

```

```yaml
- complementary:
  - text: Warraq وراق Professional Edition
  - navigation:
    - button "مكتبة الكتب"
    - button "إدارة الفهرس"
    - button "التعليقات"
    - button "وزن الفصول"
    - button "سرعة القراءة"
    - text: File Tools
    - button "Tahweel (OCR)"
    - button "دمج ملفات"
    - button "تقسيم ملف"
    - button "ضغط ملف"
    - button "استخراج الصور"
    - button "استخراج النص"
    - button "عمليات الصفحات"
    - button "علامة مائية"
    - button "إزالة الحماية"
    - button "صور إلى PDF"
    - button "PDF إلى صور"
    - button "تعديل الوصف"
  - text: خطة الاشتراك نسخة مجانية
  - button "ترقية للنسخة الاحترافية"
  - button "تصغير القائمة"
  - button "سياسة الخصوصية"
  - button "شروط الاستخدام"
  - text: v1.0.0 • Professional Edition
- main:
  - text: الجمعة، ٢٢ مايو
  - button "Refresh"
  - text: مجاني F
  - button "العودة للرئيسية"
  - heading "خاصية مدفوعة" [level=2]
  - paragraph: إضافة وإزالة العلامة المائية متاحة في النسخة الكاملة فقط.
  - button "ترقية للنسخة الكاملة"
```

# Test source

```ts
  255 |       // Simulate OAuth redirect triggering
  256 |       authenticated = true; // next status check will return true (simulating completion)
  257 |       await route.fulfill({
  258 |         status: 200,
  259 |         contentType: 'application/json',
  260 |         body: JSON.stringify({
  261 |           status: 'success',
  262 |           message: 'تم فتح نافذة تسجيل الدخول'
  263 |         })
  264 |       });
  265 |     });
  266 | 
  267 |     // Intercept device check
  268 |     await page.route('**/api/subscription/auth/device', async (route) => {
  269 |       await route.fulfill({
  270 |         status: 200,
  271 |         contentType: 'application/json',
  272 |         body: JSON.stringify({
  273 |           status: 'success',
  274 |           data: {
  275 |             user: { user_id: 'test-user-id' },
  276 |             subscription: {
  277 |               subscription_id: 'sub_123',
  278 |               plan_type: 'lifetime',
  279 |               status: 'active',
  280 |               trial_ends_at: null,
  281 |               features_enabled: ['watermark_edit', 'tahweel']
  282 |             }
  283 |           }
  284 |         })
  285 |       });
  286 |     });
  287 | 
  288 |     // Intercept conversion request
  289 |     await page.route('**/api/tahweel/convert', async (route) => {
  290 |       await route.fulfill({
  291 |         status: 200,
  292 |         contentType: 'application/json',
  293 |         body: JSON.stringify({
  294 |           status: 'success',
  295 |           task_id: 'task_tahweel_123'
  296 |         })
  297 |       });
  298 |     });
  299 | 
  300 |     await page.goto('/');
  301 |     await page.click('text=Tahweel (OCR)');
  302 | 
  303 |     // Should see "مطلوب تسجيل الدخول"
  304 |     await expect(page.locator('text=مطلوب تسجيل الدخول')).toBeVisible();
  305 | 
  306 |     // Click Google Sign In
  307 |     await page.click('button:has-text("تسجيل الدخول بـ Google")');
  308 | 
  309 |     // Wait for auth polling to complete and user info to appear
  310 |     await expect(page.locator('text=زيد بن علي')).toBeVisible();
  311 | 
  312 |     // Upload target file
  313 |     const fileInput = page.locator('input[type="file"]');
  314 |     await fileInput.setInputFiles({ name: 'scanned.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });
  315 | 
  316 |     // Click conversion button
  317 |     const convertBtn = page.locator('button:has-text("بدء التحويل الاحترافي")');
  318 |     await expect(convertBtn).toBeEnabled();
  319 |     await convertBtn.click();
  320 | 
  321 |     // Expect success message
  322 |     await expect(page.locator('text=تم بدء المهمة بنجاح')).toBeVisible();
  323 |   });
  324 | 
  325 |   test('Subscription Gate Flow - displays premium lock screen if user lacks access', async ({ page }) => {
  326 |     // Intercept auth returning free plan with NO features enabled
  327 |     await page.route('**/api/subscription/auth/device', async (route) => {
  328 |       await route.fulfill({
  329 |         status: 200,
  330 |         contentType: 'application/json',
  331 |         body: JSON.stringify({
  332 |           status: 'success',
  333 |           data: {
  334 |             user: { user_id: 'test-user-id' },
  335 |             subscription: {
  336 |               subscription_id: 'sub_free_123',
  337 |               plan_type: 'free',
  338 |               status: 'active',
  339 |               trial_ends_at: null,
  340 |               features_enabled: [] // No premium features!
  341 |             }
  342 |           }
  343 |         })
  344 |       });
  345 |     });
  346 | 
  347 |     await page.goto('/');
  348 | 
  349 |     // Click Watermark tool
  350 |     await page.click('text=علامة مائية');
  351 | 
  352 |     // Expect the payment gate lock screen to be displayed
  353 |     await expect(page.locator('text=خاصية مدفوعة')).toBeVisible();
  354 |     await expect(page.locator('text=إضافة وإزالة العلامة المائية متاحة في النسخة الكاملة فقط')).toBeVisible();
> 355 |     await expect(page.locator('button:has-text("ترقية الحساب")')).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  356 |   });
  357 | });
  358 | 
```