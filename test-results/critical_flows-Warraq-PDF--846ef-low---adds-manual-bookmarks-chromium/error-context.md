# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical_flows.spec.ts >> Warraq PDF Tools - Critical Flows >> Bookmark Insert Flow - adds manual bookmarks
- Location: e2e\critical_flows.spec.ts:175:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('text=إدراج فهرس')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "عذراً، حدث خطأ غير متوقع" [level=1] [ref=e9]
    - paragraph [ref=e10]: واجه وراق مشكلة أثناء تشغيل هذه الصفحة. يمكنك محاولة إعادة تحميل التطبيق لاستعادة الجلسة ومتابعة عملك.
    - button "إعادة تحميل التطبيق" [ref=e12] [cursor=pointer]:
      - img [ref=e13]
      - generic [ref=e16]: إعادة تحميل التطبيق
  - button "التفاصيل التقنية للخطأ ReferenceError" [ref=e18]:
    - generic [ref=e19]:
      - generic [ref=e20]: التفاصيل التقنية للخطأ
      - img [ref=e21]
    - generic [ref=e23]: ReferenceError
```

# Test source

```ts
  145 |           files: ['part1.pdf', 'part2.pdf']
  146 |         })
  147 |       });
  148 |     });
  149 | 
  150 |     await page.goto('/');
  151 |     await page.click('text=تقسيم ملف');
  152 | 
  153 |     // Input file
  154 |     const fileInput = page.locator('input[type="file"]');
  155 |     await fileInput.setInputFiles({ name: 'input.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });
  156 | 
  157 |     // Wait for pdf info API call and state updates
  158 |     await expect(page.locator('text=تقسيم صفحات النطاق')).toBeVisible();
  159 | 
  160 |     // Fill split pages
  161 |     await page.fill('input[placeholder="أرقام الصفحات مفصولة بفواصل (مثال: 2, 5, 8)"]', '2, 5');
  162 | 
  163 |     // Fill output directory
  164 |     await page.fill('input[placeholder="اتركه فارغاً للحفظ بجانب الملف الأصلي"]', 'my_output_directory');
  165 | 
  166 |     // Click split
  167 |     const splitBtn = page.locator('button:has-text("بدء عملية التقسيم")');
  168 |     await expect(splitBtn).toBeEnabled();
  169 |     await splitBtn.click();
  170 | 
  171 |     // Assert split completion
  172 |     await expect(page.locator('text=تم تقسيم الملف بنجاح!')).toBeVisible();
  173 |   });
  174 | 
  175 |   test('Bookmark Insert Flow - adds manual bookmarks', async ({ page }) => {
  176 |     // Intercept auth
  177 |     await page.route('**/api/subscription/auth/device', async (route) => {
  178 |       await route.fulfill({
  179 |         status: 200,
  180 |         contentType: 'application/json',
  181 |         body: JSON.stringify({
  182 |           status: 'success',
  183 |           data: {
  184 |             user: { user_id: 'test-user-id' },
  185 |             subscription: {
  186 |               subscription_id: 'sub_123',
  187 |               plan_type: 'lifetime',
  188 |               status: 'active',
  189 |               trial_ends_at: null,
  190 |               features_enabled: ['watermark_edit', 'tahweel']
  191 |             }
  192 |           }
  193 |         })
  194 |       });
  195 |     });
  196 | 
  197 |     // Intercept api.info
  198 |     await page.route('**/api/info', async (route) => {
  199 |       await route.fulfill({
  200 |         status: 200,
  201 |         contentType: 'application/json',
  202 |         body: JSON.stringify({
  203 |           page_count: 5,
  204 |           metadata: {},
  205 |           is_encrypted: false
  206 |         })
  207 |       });
  208 |     });
  209 | 
  210 |     // Intercept parseBookmarks
  211 |     await page.route('**/api/bookmarks/parse-text', async (route) => {
  212 |       await route.fulfill({
  213 |         status: 200,
  214 |         contentType: 'application/json',
  215 |         body: JSON.stringify({
  216 |           status: 'success',
  217 |           data: [
  218 |             { title: 'الفصل الأول', page: 1, level: 1 },
  219 |             { title: 'الفصل الثاني', page: 3, level: 1 }
  220 |           ]
  221 |         })
  222 |       });
  223 |     });
  224 | 
  225 |     // Intercept insertBookmarks
  226 |     await page.route('**/api/bookmarks/insert', async (route) => {
  227 |       await route.fulfill({
  228 |         status: 200,
  229 |         contentType: 'application/json',
  230 |         body: JSON.stringify({
  231 |           status: 'success',
  232 |           data: {
  233 |             inserted: 2,
  234 |             skipped: 0,
  235 |             output_path: 'output_bookmarked.pdf'
  236 |           }
  237 |         })
  238 |       });
  239 |     });
  240 | 
  241 |     await page.goto('/');
  242 |     await page.click('text=إدارة الفهرس');
  243 | 
  244 |     // Click "إدراج فهرس" mode tab
> 245 |     await page.click('text=إدراج فهرس');
      |                ^ Error: page.click: Test timeout of 60000ms exceeded.
  246 | 
  247 |     // Choose PDF
  248 |     const fileInput = page.locator('input[type="file"]');
  249 |     await fileInput.setInputFiles({ name: 'raw_book.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });
  250 | 
  251 |     // Click Next
  252 |     await page.click('button:has-text("التالي")');
  253 | 
  254 |     // Fill textarea
  255 |     await page.fill('textarea[placeholder*="مقدمة الكتاب"]', 'الفصل الأول - 1\nالفصل الثاني - 3');
  256 | 
  257 |     // Click Analyze & Review
  258 |     await page.click('button:has-text("تحليل العناوين للمراجعة")');
  259 | 
  260 |     // Expect to be on Step 3 (Review & Final Settings)
  261 |     await expect(page.locator('text=المراجعة النهائية والتأكيد')).toBeVisible();
  262 |     await expect(page.locator('input[value="الفصل الأول"]')).toBeVisible();
  263 | 
  264 |     // Fill output directory
  265 |     const outputDirInput = page.locator('input[type="file"]');
  266 |     await outputDirInput.setInputFiles({ name: 'output_folder', mimeType: 'application/pdf', buffer: Buffer.from('') });
  267 | 
  268 |     // Click final insert
  269 |     await page.click('button:has-text("تأكيد وإدراج الفهرس")');
  270 | 
  271 |     // Verify success
  272 |     await expect(page.locator('text=تم إدراج 2 إشارة مرجعية بنجاح')).toBeVisible();
  273 |   });
  274 | 
  275 |   test('Tahweel OCR Flow - tests Google Auth signin polling and conversion', async ({ page }) => {
  276 |     // Intercept auth status (Initially unauthenticated)
  277 |     let authenticated = false;
  278 |     await page.route('**/api/tahweel/auth/status', async (route) => {
  279 |       await route.fulfill({
  280 |         status: 200,
  281 |         contentType: 'application/json',
  282 |         body: JSON.stringify({
  283 |           authenticated,
  284 |           user: authenticated ? { displayName: 'زيد بن علي', emailAddress: 'zaid@warraq.app', photoLink: '' } : undefined
  285 |         })
  286 |       });
  287 |     });
  288 | 
  289 |     // Intercept signin (OAuth start)
  290 |     await page.route('**/api/tahweel/auth/signin', async (route) => {
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
```