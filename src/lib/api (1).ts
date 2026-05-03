// Dynamic port management - fetched from Tauri backend
let BASE_URL = 'http://127.0.0.1:8002'; // Default fallback
let portInitialized = false;

// Initialize the API with the correct port from Tauri
async function initializeBackendPort(): Promise<void> {
  if (portInitialized) return;

  // Check for Docker override
  if (import.meta.env.VITE_USE_DOCKER_BACKEND === 'true') {
    BASE_URL = 'http://127.0.0.1:8002';
    console.log('[API] Using Docker Backend override: 8002');
    portInitialized = true;
    return;
  }

  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const port = await invoke<number>('get_backend_port');
      BASE_URL = `http://127.0.0.1:${port}`;
      console.log(`[API] Backend port initialized: ${port}`);
    } catch (e) {
      console.warn('[API] Could not get backend port from Tauri, using default:', e);
    }
  }
  portInitialized = true;
}

// Initialize on module load
initializeBackendPort();

/**
 * Get the current API base URL. Ensures port is initialized.
 * Use this in components that make direct fetch calls.
 */
export async function getApiBaseUrl(): Promise<string> {
  await initializeBackendPort();
  return BASE_URL;
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`[API Request] ${method} ${url}`, body);

  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    console.log(`[API Response] ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[API Error Body]`, text);

      let errorMessage = text;
      try {
        const jsonError = JSON.parse(text);
        if (jsonError.detail) {
          errorMessage = jsonError.detail;
        } else if (jsonError.error) {
          errorMessage = jsonError.error;
        }
      } catch (e) {
        // Not JSON, use plain text
      }

      return { success: false, error: errorMessage };
    }
    const data = await response.json();
    console.log(`[API Data]`, data);
    return { success: true, data };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error occurred';
    console.error(`[API Exception]`, e);

    // Check for common fetch errors
    if (message === 'Failed to fetch') {
      return {
        success: false,
        error: 'تعذر الاتصال بالخادم. تأكد من أن التطبيق يعمل بشكل صحيح. (Failed to fetch)'
      };
    }

    return { success: false, error: message };
  }
}

export const api = {
  // Health
  health: () => 
    request<{ status: string }>('/health'),
    
  // Core PDF Operations
  merge: (paths: string[], outputPath: string) => 
    request<{ status: string; message: string }>('/api/merge', 'POST', { paths, output_path: outputPath }),
    
  split: (inputPath: string, splitPages: number[], outputDir: string) =>
    request<{ status: string; files: string[] }>('/api/split', 'POST', { input_path: inputPath, split_pages: splitPages, output_dir: outputDir }),
    
  compress: (inputPath: string, outputPath: string, level: number) =>
    request<{ status: string; message: string }>('/api/compress', 'POST', { input_path: inputPath, output_path: outputPath, compression_level: level }),
    
  extractImages: (inputPath: string, outputDir: string) =>
    request<{ status: string; files: string[] }>('/api/extract-images', 'POST', { input_path: inputPath, output_dir: outputDir }),
    
  info: (path: string) =>
    request<{ page_count: number; metadata: Record<string, unknown>; is_encrypted: boolean }>('/api/info', 'POST', { path }),

  // Text Extraction
  extractText: (pdfPath: string, pageRange: string = 'all') =>
    request<{ status: string; data: { text: string; pages_extracted: number; word_count: number } }>('/api/text/extract', 'POST', { pdf_path: pdfPath, page_range: pageRange }),

  extractTextToFile: (pdfPath: string, outputPath: string, pageRange: string = 'all', format: string = 'txt', mergeLines: boolean = false, fontFamily: string = 'Calibri', fontSize: number = 11) =>
    request<{ status: string; data: { output_path: string; format: string; duration_seconds?: number; word_count?: number; pages_extracted?: number; total_pages?: number } }>('/api/text/extract-to-file', 'POST', { pdf_path: pdfPath, output_path: outputPath, page_range: pageRange, format, merge_lines: mergeLines, font_family: fontFamily, font_size: fontSize }),

  // Bookmark Operations
  extractBookmarks: (pdfPath: string) =>
    request<{ status: string; data: { bookmarks: { level: number; title: string; page: number }[]; formatted_text: string; count: number } }>('/api/bookmarks/extract', 'POST', { pdf_path: pdfPath }),

  saveBookmarks: (text: string, outputPath: string) =>
    request<{ status: string; message: string }>('/api/bookmarks/save', 'POST', { text, output_path: outputPath }),

  splitByBookmarks: (pdfPath: string, outputDir: string, level1Only: boolean, preserveBookmarks: boolean, selectedIndices?: number[], ignoreHierarchy: boolean = false, targetLevel?: number) =>
    request<{ status: string; data: any }>('/api/bookmarks/split', 'POST', {
      pdf_path: pdfPath,
      output_dir: outputDir,
      level_1_only: level1Only,
      preserve_bookmarks: preserveBookmarks,
      selected_indices: selectedIndices,
      ignore_hierarchy: ignoreHierarchy,
      target_level: targetLevel
    }),

  getBookmarkLevels: (pdfPath: string) =>
    request<{ status: string; data: { levels: Record<string, number>, total: number, max_level: number } }>('/api/bookmarks/levels', 'POST', { pdf_path: pdfPath }),

  parseBookmarks: (text: string, considerLevels: boolean = true) =>
    request<{ status: string; data: Array<{ title: string, page: number, level: number }> }>('/api/bookmarks/parse-text', 'POST', { text, consider_levels: considerLevels }),

  insertBookmarks: (pdfPath: string, bookmarks: Array<{title: string, page: number, level: number}>, outputPath: string, pageOffset: number = 0) =>
    request<{ status: string; data: { inserted: number; skipped: number; output_path: string } }>('/api/bookmarks/insert', 'POST', { pdf_path: pdfPath, bookmarks, output_path: outputPath, page_offset: pageOffset }),

  transferBookmarks: (sourcePath: string, targetPath: string, outputPath: string) =>
    request<{ status: string; data: { count: number; output_path: string } }>('/api/bookmarks/transfer', 'POST', { source_path: sourcePath, target_path: targetPath, output_path: outputPath }),

  // Page Operations
  rotatePages: (pdfPath: string, outputPath: string, pages: string, rotation: number = 90) =>
    request<{ status: string; data: { pages_rotated: number } }>('/api/pages/rotate', 'POST', { pdf_path: pdfPath, output_path: outputPath, pages, rotation }),

  deletePages: (pdfPath: string, outputPath: string, pages: string) =>
    request<{ status: string; data: { pages_deleted: number } }>('/api/pages/delete', 'POST', { pdf_path: pdfPath, output_path: outputPath, pages }),

  extractPages: (pdfPath: string, outputPath: string, pages: string) =>
    request<{ status: string; data: { pages_extracted: number } }>('/api/pages/extract', 'POST', { pdf_path: pdfPath, output_path: outputPath, pages }),

  // Watermark Operations
  addTextWatermark: (pdfPath: string, outputPath: string, text: string, options: { position?: string; opacity?: number; fontSize?: number; color?: string; rotation?: number } = {}) =>
    request<{ status: string; data: { pages_watermarked: number } }>('/api/watermark/text', 'POST', { 
      pdf_path: pdfPath, output_path: outputPath, text,
      position: options.position || 'center', opacity: options.opacity || 0.5, 
      font_size: options.fontSize || 50, color: options.color || '#808080',
      rotation: options.rotation || 45
    }),

  removeWatermark: (pdfPath: string, outputPath: string, aggressive: boolean = false) =>
    request<{ status: string; data: { items_removed: number } }>('/api/watermark/remove', 'POST', { pdf_path: pdfPath, output_path: outputPath, aggressive }),

  // Security Operations
  checkSecurity: (pdfPath: string) =>
    request<{ status: string; data: { is_encrypted: boolean; needs_password: boolean; restrictions: Record<string, boolean> } }>('/api/security/check', 'POST', { pdf_path: pdfPath }),

  removeSecurity: (pdfPath: string, outputPath: string, password?: string) =>
    request<{ status: string; data: { was_encrypted: boolean; security_removed: boolean } }>('/api/security/remove', 'POST', { pdf_path: pdfPath, output_path: outputPath, password }),

  // New Tools
  createFromImages: (imagePaths: string[], outputPath: string) =>
    request<{ status: string; message: string }>('/api/create/from-images', 'POST', { image_paths: imagePaths, output_path: outputPath }),

  convertToImages: (pdfPath: string, outputDir: string, format: string = 'png', dpi: number = 150) =>
    request<{ status: string; files: string[] }>('/api/convert/to-images', 'POST', { pdf_path: pdfPath, output_dir: outputDir, format, dpi }),

  updateMetadata: (pdfPath: string, outputPath: string, metadata: Record<string, string>) =>
    request<{ status: string; message: string }>('/api/metadata/update', 'POST', { pdf_path: pdfPath, output_path: outputPath, metadata }),
  // Rendering
  renderPage: (pdfPath: string, page: number = 1, dpi: number = 150) =>
    request<{ status: string; data: { image: string; page: number; total_pages: number; width: number; height: number } }>('/api/pdf/render-page', 'POST', { pdf_path: pdfPath, page, dpi }),
  // System
  openUrl: (url: string) =>
    request<{ status: string }>('/api/system/open-url', 'POST', { file_path: url }),

  // Subscription
  subscription: {
    authDevice: (deviceId: string) =>
      request<{ status: string; data: { user: any; subscription: any } }>('/api/subscription/auth/device', 'POST', { device_id: deviceId }),
    getStatus: (deviceId: string) =>
      request<{ status: string; data: any }>('/api/subscription/status', 'GET', undefined, { 'X-Device-ID': deviceId }),
  },
  payment: {
    checkout: (userId: string, planId: string, amount: number, currency: string = "EGP") =>
      request<{ status: string; data: { payment_url: string } }>('/api/payment/checkout', 'POST', { user_id: userId, plan_id: planId, amount, currency }),
  }
};
