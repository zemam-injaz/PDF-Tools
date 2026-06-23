import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Minimal Tauri v2 environment mock for Playwright (browser context, no IPC)
// Without this, @tauri-apps/plugin-* packages may throw during module
// evaluation, causing net::ERR_ABORTED before the page even loads.
// ---------------------------------------------------------------------------
const TAURI_MOCK_SCRIPT = `
(function () {
  if (window.__TAURI_INTERNALS__) return; // already present (real Tauri)

  // Minimal IPC stub – invoke('get_backend_port') must return 8002 so api.ts
  // sets BASE_URL = 'http://127.0.0.1:8002', which Playwright can intercept.
  window.__TAURI_INTERNALS__ = {
    ipc: function() {},
    invoke: async function(cmd) {
      if (cmd === 'get_backend_port') return 8002;
      return {};
    },
    metadata: {
      currentWindow: { label: 'main' },
      windows: [{ label: 'main' }]
    },
    plugins: {}
  };
  window.__TAURI__ = {};
})();
`;

test.describe('Warraq PDF Tools - Critical Flows', () => {

  // Inject Tauri mock before every page navigation so Tauri modules
  // find a compatible environment during module evaluation.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({ content: TAURI_MOCK_SCRIPT });
  });

  // Give each test a generous timeout – Vite cold-start can be slow
  test.setTimeout(60_000);

  test('Merge Flow - uploads multiple files and merges them successfully', async ({ page }) => {
    // Intercept subscription request to grant full access
    await page.route('**/api/subscription/auth/device', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            user: { user_id: 'test-user-id' },
            subscription: {
              subscription_id: 'sub_123',
              plan_type: 'lifetime',
              status: 'active',
              trial_ends_at: null,
              features_enabled: ['watermark_edit', 'tahweel']
            }
          }
        })
      });
    });

    // Intercept merge request
    await page.route('**/api/merge', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'تم دمج الملفات بنجاح!'
        })
      });
    });

    await page.goto('/');

    // Verify main header
    await expect(page.locator('h1')).toContainText('Warraq وراق');

    // Open merge tool
    await page.click('text=دمج ملفات');

    // Add mock files
    const multiFileInput = page.locator('input[type="file"][multiple]');
    await multiFileInput.setInputFiles([
      { name: 'doc1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') },
      { name: 'doc2.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') }
    ]);

    // Choose output directory/file
    const fileInput = page.locator('input[type="file"]:not([multiple])');
    await fileInput.setInputFiles({ name: 'merged.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });

    // Verify merge button is enabled and click it
    const mergeBtn = page.locator('button:has-text("بدء عملية الدمج")');
    await expect(mergeBtn).toBeEnabled();
    await mergeBtn.click();

    // Verify success status
    await expect(page.locator('text=تم دمج الملفات بنجاح!')).toBeVisible();
  });

  test('Split Flow - splits pdf by pages successfully', async ({ page }) => {
    // Intercept auth
    await page.route('**/api/subscription/auth/device', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            user: { user_id: 'test-user-id' },
            subscription: {
              subscription_id: 'sub_123',
              plan_type: 'lifetime',
              status: 'active',
              trial_ends_at: null,
              features_enabled: ['watermark_edit', 'tahweel']
            }
          }
        })
      });
    });

    // Intercept info request
    await page.route('**/api/info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page_count: 10,
          metadata: {},
          is_encrypted: false
        })
      });
    });

    // Intercept split request
    await page.route('**/api/split', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          files: ['part1.pdf', 'part2.pdf']
        })
      });
    });

    await page.goto('/');
    await page.click('text=تقسيم ملف');

    // Input file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: 'input.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });

    // Wait for pdf info API call and state updates
    await expect(page.locator('text=تقسيم صفحات النطاق')).toBeVisible();

    // Fill split pages
    await page.fill('input[placeholder="أرقام الصفحات مفصولة بفواصل (مثال: 2, 5, 8)"]', '2, 5');

    // Fill output directory
    await page.fill('input[placeholder="اتركه فارغاً للحفظ بجانب الملف الأصلي"]', 'my_output_directory');

    // Click split
    const splitBtn = page.locator('button:has-text("بدء عملية التقسيم")');
    await expect(splitBtn).toBeEnabled();
    await splitBtn.click();

    // Assert split completion
    await expect(page.locator('text=تم تقسيم الملف بنجاح!')).toBeVisible();
  });

  test('Bookmark Insert Flow - adds manual bookmarks', async ({ page }) => {
    // Intercept auth
    await page.route('**/api/subscription/auth/device', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            user: { user_id: 'test-user-id' },
            subscription: {
              subscription_id: 'sub_123',
              plan_type: 'lifetime',
              status: 'active',
              trial_ends_at: null,
              features_enabled: ['watermark_edit', 'tahweel']
            }
          }
        })
      });
    });

    // Intercept api.info
    await page.route('**/api/info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page_count: 5,
          metadata: {},
          is_encrypted: false
        })
      });
    });

    // Intercept parseBookmarks
    await page.route('**/api/bookmarks/parse-text', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { title: 'الفصل الأول', page: 1, level: 1 },
            { title: 'الفصل الثاني', page: 3, level: 1 }
          ]
        })
      });
    });

    // Intercept insertBookmarks
    await page.route('**/api/bookmarks/insert', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            inserted: 2,
            skipped: 0,
            output_path: 'output_bookmarked.pdf'
          }
        })
      });
    });

    await page.goto('/');
    await page.click('text=إدارة الفهرس');

    // Click "إدراج فهرس" mode tab
    await page.click('text=إدراج فهرس');

    // Choose PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: 'raw_book.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });

    // Click Next
    await page.click('button:has-text("التالي")');

    // Fill textarea
    await page.fill('textarea[placeholder*="مقدمة الكتاب"]', 'الفصل الأول - 1\nالفصل الثاني - 3');

    // Click Analyze & Review
    await page.click('button:has-text("تحليل العناوين للمراجعة")');

    // Expect to be on Step 3 (Review & Final Settings)
    await expect(page.locator('text=المراجعة النهائية والتأكيد')).toBeVisible();
    await expect(page.locator('input[value="الفصل الأول"]')).toBeVisible();

    // Fill output directory
    const outputDirInput = page.locator('input[type="file"]');
    await outputDirInput.setInputFiles({ name: 'output_folder', mimeType: 'application/pdf', buffer: Buffer.from('') });

    // Click final insert
    await page.click('button:has-text("تأكيد وإدراج الفهرس")');

    // Verify success
    await expect(page.locator('text=تم إدراج 2 إشارة مرجعية بنجاح')).toBeVisible();
  });

  test('Tahweel OCR Flow - tests Google Auth signin polling and conversion', async ({ page }) => {
    // Intercept auth status (Initially unauthenticated)
    let authenticated = false;
    await page.route('**/api/tahweel/auth/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated,
          user: authenticated ? { displayName: 'زيد بن علي', emailAddress: 'zaid@warraq.app', photoLink: '' } : undefined
        })
      });
    });

    // Intercept signin (OAuth start)
    await page.route('**/api/tahweel/auth/signin', async (route) => {
      // Simulate OAuth redirect triggering
      authenticated = true; // next status check will return true (simulating completion)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'تم فتح نافذة تسجيل الدخول'
        })
      });
    });

    // Intercept device check
    await page.route('**/api/subscription/auth/device', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            user: { user_id: 'test-user-id' },
            subscription: {
              subscription_id: 'sub_123',
              plan_type: 'lifetime',
              status: 'active',
              trial_ends_at: null,
              features_enabled: ['watermark_edit', 'tahweel']
            }
          }
        })
      });
    });

    // Intercept conversion request
    await page.route('**/api/tahweel/convert', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          task_id: 'task_tahweel_123'
        })
      });
    });

    await page.goto('/');
    await page.click('text=Tahweel (OCR)');

    // Should see "مطلوب تسجيل الدخول"
    await expect(page.locator('text=مطلوب تسجيل الدخول')).toBeVisible();

    // Click Google Sign In
    await page.click('button:has-text("تسجيل الدخول بـ Google")');

    // Wait for auth polling to complete and user info to appear
    await expect(page.locator('text=زيد بن علي')).toBeVisible();

    // Upload target file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: 'scanned.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ...') });

    // Click conversion button
    const convertBtn = page.locator('button:has-text("بدء التحويل الاحترافي")');
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    // Expect success message
    await expect(page.locator('text=تم بدء المهمة بنجاح')).toBeVisible();
  });

  test('Subscription Gate Flow - displays premium lock screen if user lacks access', async ({ page }) => {
    // Intercept auth returning free plan with NO features enabled
    await page.route('**/api/subscription/auth/device', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            user: { user_id: 'test-user-id' },
            subscription: {
              subscription_id: 'sub_free_123',
              plan_type: 'free',
              status: 'active',
              trial_ends_at: null,
              features_enabled: [] // No premium features!
            }
          }
        })
      });
    });

    await page.goto('/');

    // Click Watermark tool
    await page.click('text=علامة مائية');

    // Expect the payment gate lock screen to be displayed
    await expect(page.locator('text=خاصية مدفوعة')).toBeVisible();
    await expect(page.locator('text=إضافة وإزالة العلامة المائية متاحة في النسخة الكاملة فقط')).toBeVisible();
    await expect(page.locator('button:has-text("ترقية الحساب")')).toBeVisible();
  });
});
