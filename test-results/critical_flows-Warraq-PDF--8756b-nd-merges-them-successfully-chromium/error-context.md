# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical_flows.spec.ts >> Warraq PDF Tools - Critical Flows >> Merge Flow - uploads multiple files and merges them successfully
- Location: e2e\critical_flows.spec.ts:41:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.setInputFiles: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input[type="file"][multiple]')

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // ---------------------------------------------------------------------------
  4   | // Minimal Tauri v2 environment mock for Playwright (browser context, no IPC)
  5   | // Without this, @tauri-apps/plugin-* packages may throw during module
  6   | // evaluation, causing net::ERR_ABORTED before the page even loads.
  7   | // ---------------------------------------------------------------------------
  8   | const TAURI_MOCK_SCRIPT = `
  9   | (function () {
  10  |   if (window.__TAURI_INTERNALS__) return; // already present (real Tauri)
  11  | 
  12  |   // Minimal IPC stub – invoke('get_backend_port') must return 8002 so api.ts
  13  |   // sets BASE_URL = 'http://127.0.0.1:8002', which Playwright can intercept.
  14  |   window.__TAURI_INTERNALS__ = {
  15  |     ipc: function() {},
  16  |     invoke: async function(cmd) {
  17  |       if (cmd === 'get_backend_port') return 8002;
  18  |       return {};
  19  |     },
  20  |     metadata: {
  21  |       currentWindow: { label: 'main' },
  22  |       windows: [{ label: 'main' }]
  23  |     },
  24  |     plugins: {}
  25  |   };
  26  |   window.__TAURI__ = {};
  27  | })();
  28  | `;
  29  | 
  30  | test.describe('Warraq PDF Tools - Critical Flows', () => {
  31  | 
  32  |   // Inject Tauri mock before every page navigation so Tauri modules
  33  |   // find a compatible environment during module evaluation.
  34  |   test.beforeEach(async ({ page }) => {
  35  |     await page.addInitScript({ content: TAURI_MOCK_SCRIPT });
  36  |   });
  37  | 
  38  |   // Give each test a generous timeout – Vite cold-start can be slow
  39  |   test.setTimeout(60_000);
  40  | 
  41  |   test('Merge Flow - uploads multiple files and merges them successfully', async ({ page }) => {
  42  |     // Intercept subscription request to grant full access
  43  |     await page.route('**/api/subscription/auth/device', async (route) => {
  44  |       await route.fulfill({
  45  |         status: 200,
  46  |         contentType: 'application/json',
  47  |         body: JSON.stringify({
  48  |           status: 'success',
  49  |           data: {
  50  |             user: { user_id: 'test-user-id' },
  51  |             subscription: {
  52  |               subscription_id: 'sub_123',
  53  |               plan_type: 'lifetime',
  54  |               status: 'active',
  55  |               trial_ends_at: null,
  56  |               features_enabled: ['watermark_edit', 'tahweel']
  57  |             }
  58  |           }
  59  |         })
  60  |       });
  61  |     });
  62  | 
  63  |     // Intercept merge request
  64  |     await page.route('**/api/merge', async (route) => {
  65  |       await route.fulfill({
  66  |         status: 200,
  67  |         contentType: 'application/json',
  68  |         body: JSON.stringify({
  69  |           status: 'success',
  70  |           message: 'تم دمج الملفات بنجاح!'
  71  |         })
  72  |       });
  73  |     });
  74  | 
  75  |     await page.goto('/');
  76  | 
  77  |     // Verify main header
  78  |     await expect(page.locator('h1')).toContainText('Warraq وراق');
  79  | 
  80  |     // Open merge tool
  81  |     await page.click('text=دمج ملفات');
  82  | 
  83  |     // Add mock files
  84  |     const multiFileInput = page.locator('input[type="file"][multiple]');
> 85  |     await multiFileInput.setInputFiles([
      |     ^ Error: locator.setInputFiles: Test timeout of 60000ms exceeded.
  86  |       { name: 'doc1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') },
  87  |       { name: 'doc2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') }
  88  |     ]);
  89  | 
  90  |     // Choose output directory/file
  91  |     const fileInput = page.locator('input[type="file"]:not([multiple])');
  92  |     await fileInput.setInputFiles({ name: 'merged.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });
  93  | 
  94  |     // Verify merge button is enabled and click it
  95  |     const mergeBtn = page.locator('button:has-text("بدء عملية الدمج")');
  96  |     await expect(mergeBtn).toBeEnabled();
  97  |     await mergeBtn.click();
  98  | 
  99  |     // Verify success status
  100 |     await expect(page.locator('text=تم دمج الملفات بنجاح!')).toBeVisible();
  101 |   });
  102 | 
  103 |   test('Split Flow - splits pdf by pages successfully', async ({ page }) => {
  104 |     // Intercept auth
  105 |     await page.route('**/api/subscription/auth/device', async (route) => {
  106 |       await route.fulfill({
  107 |         status: 200,
  108 |         contentType: 'application/json',
  109 |         body: JSON.stringify({
  110 |           status: 'success',
  111 |           data: {
  112 |             user: { user_id: 'test-user-id' },
  113 |             subscription: {
  114 |               subscription_id: 'sub_123',
  115 |               plan_type: 'lifetime',
  116 |               status: 'active',
  117 |               trial_ends_at: null,
  118 |               features_enabled: ['watermark_edit', 'tahweel']
  119 |             }
  120 |           }
  121 |         })
  122 |       });
  123 |     });
  124 | 
  125 |     // Intercept info request
  126 |     await page.route('**/api/info', async (route) => {
  127 |       await route.fulfill({
  128 |         status: 200,
  129 |         contentType: 'application/json',
  130 |         body: JSON.stringify({
  131 |           page_count: 10,
  132 |           metadata: {},
  133 |           is_encrypted: false
  134 |         })
  135 |       });
  136 |     });
  137 | 
  138 |     // Intercept split request
  139 |     await page.route('**/api/split', async (route) => {
  140 |       await route.fulfill({
  141 |         status: 200,
  142 |         contentType: 'application/json',
  143 |         body: JSON.stringify({
  144 |           status: 'success',
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
```