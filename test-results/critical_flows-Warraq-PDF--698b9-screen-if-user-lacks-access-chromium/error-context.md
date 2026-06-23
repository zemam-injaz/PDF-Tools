# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical_flows.spec.ts >> Warraq PDF Tools - Critical Flows >> Subscription Gate Flow - displays premium lock screen if user lacks access
- Location: e2e\critical_flows.spec.ts:361:3

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
  - text: السبت، ٢٣ مايو
  - button "Refresh"
  - text: مجاني F
  - button "العودة للرئيسية"
  - heading "خاصية مدفوعة" [level=2]
  - paragraph: إضافة وإزالة العلامة المائية متاحة في النسخة الكاملة فقط.
  - button "ترقية للنسخة الكاملة"
```

# Test source

```ts
  291 |       // Simulate OAuth redirect triggering
  292 |       authenticated = true; // next status check will return true (simulating completion)
  293 |       await route.fulfill({
  294 |         status: 200,
  295 |         contentType: 'application/json',
  296 |         body: JSON.stringify({
  297 |           status: 'success',
  298 |           message: 'تم فتح نافذة تسجيل الدخول'
  299 |         })
  300 |       });
  301 |     });
  302 | 
  303 |     // Intercept device check
  304 |     await page.route('**/api/subscription/auth/device', async (route) => {
  305 |       await route.fulfill({
  306 |         status: 200,
  307 |         contentType: 'application/json',
  308 |         body: JSON.stringify({
  309 |           status: 'success',
  310 |           data: {
  311 |             user: { user_id: 'test-user-id' },
  312 |             subscription: {
  313 |               subscription_id: 'sub_123',
  314 |               plan_type: 'lifetime',
  315 |               status: 'active',
  316 |               trial_ends_at: null,
  317 |               features_enabled: ['watermark_edit', 'tahweel']
  318 |             }
  319 |           }
  320 |         })
  321 |       });
  322 |     });
  323 | 
  324 |     // Intercept conversion request
  325 |     await page.route('**/api/tahweel/convert', async (route) => {
  326 |       await route.fulfill({
  327 |         status: 200,
  328 |         contentType: 'application/json',
  329 |         body: JSON.stringify({
  330 |           status: 'success',
  331 |           task_id: 'task_tahweel_123'
  332 |         })
  333 |       });
  334 |     });
  335 | 
  336 |     await page.goto('/');
  337 |     await page.click('text=Tahweel (OCR)');
  338 | 
  339 |     // Should see "مطلوب تسجيل الدخول"
  340 |     await expect(page.locator('text=مطلوب تسجيل الدخول')).toBeVisible();
  341 | 
  342 |     // Click Google Sign In
  343 |     await page.click('button:has-text("تسجيل الدخول بـ Google")');
  344 | 
  345 |     // Wait for auth polling to complete and user info to appear
  346 |     await expect(page.locator('text=زيد بن علي')).toBeVisible();
  347 | 
  348 |     // Upload target file
  349 |     const fileInput = page.locator('input[type="file"]');
  350 |     await fileInput.setInputFiles({ name: 'scanned.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });
  351 | 
  352 |     // Click conversion button
  353 |     const convertBtn = page.locator('button:has-text("بدء التحويل الاحترافي")');
  354 |     await expect(convertBtn).toBeEnabled();
  355 |     await convertBtn.click();
  356 | 
  357 |     // Expect success message
  358 |     await expect(page.locator('text=تم بدء المهمة بنجاح')).toBeVisible();
  359 |   });
  360 | 
  361 |   test('Subscription Gate Flow - displays premium lock screen if user lacks access', async ({ page }) => {
  362 |     // Intercept auth returning free plan with NO features enabled
  363 |     await page.route('**/api/subscription/auth/device', async (route) => {
  364 |       await route.fulfill({
  365 |         status: 200,
  366 |         contentType: 'application/json',
  367 |         body: JSON.stringify({
  368 |           status: 'success',
  369 |           data: {
  370 |             user: { user_id: 'test-user-id' },
  371 |             subscription: {
  372 |               subscription_id: 'sub_free_123',
  373 |               plan_type: 'free',
  374 |               status: 'active',
  375 |               trial_ends_at: null,
  376 |               features_enabled: [] // No premium features!
  377 |             }
  378 |           }
  379 |         })
  380 |       });
  381 |     });
  382 | 
  383 |     await page.goto('/');
  384 | 
  385 |     // Click Watermark tool
  386 |     await page.click('text=علامة مائية');
  387 | 
  388 |     // Expect the payment gate lock screen to be displayed
  389 |     await expect(page.locator('text=خاصية مدفوعة')).toBeVisible();
  390 |     await expect(page.locator('text=إضافة وإزالة العلامة المائية متاحة في النسخة الكاملة فقط')).toBeVisible();
> 391 |     await expect(page.locator('button:has-text("ترقية الحساب")')).toBeVisible();
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  392 |   });
  393 | });
  394 | 
```