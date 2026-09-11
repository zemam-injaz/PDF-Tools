// Dynamic port management - fetched from Tauri backend
let BASE_URL = 'http://127.0.0.1:8002'; // Default fallback
let portInitialized = false;

// Remote base for subscription/payment/entitlement — configured at build time
// via VITE_REMOTE_API_BASE_URL. Never falls back to localhost (see remoteRequest).
const REMOTE_BASE_URL = (import.meta.env.VITE_REMOTE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

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
 * Get the current API base URL (local PDF/python server). Ensures port is initialized.
 * Use this in components that make direct fetch calls.
 */
export async function getApiBaseUrl(): Promise<string> {
  await initializeBackendPort();
  return BASE_URL;
}

/**
 * Get the configured REMOTE API base URL (subscription/payment/entitlement).
 * Returns an empty string when VITE_REMOTE_API_BASE_URL is not configured —
 * remote calls are then rejected by remoteRequest (never routed to localhost).
 */
export function getRemoteApiBaseUrl(): string {
  return REMOTE_BASE_URL;
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  // Ensure port is initialized before every request (no-op if already done)
  await initializeBackendPort();
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

// Remote request for subscription/payment/entitlement. Uses REMOTE_API_BASE_URL
// only — it refuses to run when the remote base is not configured and never
// falls back to the local PDF backend (localhost).
async function remoteRequest<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
  if (!REMOTE_BASE_URL) {
    const message = 'Remote API (VITE_REMOTE_API_BASE_URL) is not configured';
    console.error(`[Remote API] ${message} — refusing ${method} ${endpoint}`);
    return { success: false, error: message };
  }
  const url = `${REMOTE_BASE_URL}${endpoint}`;
  console.log(`[Remote API Request] ${method} ${url}`, body);

  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    console.log(`[Remote API Response] ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Remote API Error Body]`, text);

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
    console.log(`[Remote API Data]`, data);
    return { success: true, data };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error occurred';
    console.error(`[Remote API Exception]`, e);
    if (message === 'Failed to fetch') {
      return {
        success: false,
        error: 'تعذر الاتصال بخادم الاشتراكات. تأكد من اتصالك بالإنترنت. (Failed to fetch)'
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
  merge: (paths: string[], outputPath: string, isAsync: boolean = false) => 
    request<{ status: string; message: string; task_id?: string }>('/api/merge', 'POST', { paths, output_path: outputPath, is_async: isAsync }),
    
  split: (inputPath: string, splitPages: number[], outputDir: string, isAsync: boolean = false) =>
    request<{ status: string; files?: string[]; task_id?: string }>('/api/split', 'POST', { input_path: inputPath, split_pages: splitPages, output_dir: outputDir, is_async: isAsync }),
    
  compress: (inputPath: string, outputPath: string, level: number, isAsync: boolean = false) =>
    request<{ status: string; message: string; task_id?: string }>('/api/compress', 'POST', { input_path: inputPath, output_path: outputPath, compression_level: level, is_async: isAsync }),
    
  extractImages: (inputPath: string, outputDir: string, isAsync: boolean = false) =>
    request<{ status: string; files?: string[]; task_id?: string }>('/api/extract-images', 'POST', { input_path: inputPath, output_dir: outputDir, is_async: isAsync }),
    
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
    request<{ status: string; data: { is_encrypted: boolean; needs_password: boolean; permissions: Record<string, boolean>; restrictions: string[] } }>('/api/security/check', 'POST', { pdf_path: pdfPath }),

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

  // Subscription (remote)
  subscription: {
    authDevice: (deviceId: string) =>
      remoteRequest<{ status: string; data: { user: any; subscription: any } }>('/api/subscription/auth/device', 'POST', { device_id: deviceId }),
    getStatus: (deviceId: string) =>
      remoteRequest<{ status: string; data: any }>('/api/subscription/status', 'GET', undefined, { 'X-Device-ID': deviceId }),
    verify: (deviceId: string) =>
      remoteRequest<{ status: string; data: any }>('/api/subscription/verify', 'POST', undefined, { 'X-Device-ID': deviceId }),
  },
  // Payment (remote) — Gumroad license flow
  payment: {
    gumroad: {
      start: (userId: string, planId: string) =>
        remoteRequest<{ status: string; data: { plan_id: string; product_permalink: string; payment_url: string } }>('/api/payment/gumroad/start', 'POST', { user_id: userId, plan_id: planId }),
      activate: (userId: string, licenseKey: string, planId?: string, email?: string) =>
        remoteRequest<{ status: string; data: { activated: boolean; plan_id: string; sale_id: string } }>('/api/payment/gumroad/activate', 'POST', { user_id: userId, license_key: licenseKey, plan_id: planId, email }),
    },
  },
  // Tahweel (Google OCR)
  tahweel: {
    getAuthStatus: () =>
      request<{ authenticated: boolean }>('/api/tahweel/auth/status'),
    signIn: () =>
      request<{ status: string; message: string }>('/api/tahweel/auth/signin', 'POST'),
    signOut: () =>
      request<{ status: string }>('/api/tahweel/auth/signout', 'POST'),
    convert: (pdfPath: string, outputDir: string, removeNewlines: boolean = true, isAsync: boolean = false, convertToPdf: boolean = true) =>
      request<{ status: string; docx_path?: string; txt_path?: string; txt_content?: string; word_count?: number; task_id?: string }>('/api/tahweel/convert', 'POST', { pdf_path: pdfPath, output_dir: outputDir, remove_newlines: removeNewlines, is_async: isAsync, convert_to_pdf: convertToPdf }),
    index: (pdfPath: string, useOcr: boolean = false, isAsync: boolean = false) =>
      request<{ status: string; data?: any[]; task_id?: string }>('/api/tahweel/index', 'POST', { pdf_path: pdfPath, use_ocr: useOcr, is_async: isAsync }),
  },
  // Warraq Wave 1: PDF Tools
  flattenPDF: (pdfPath: string, outputPath: string, mode: string = 'smart') =>
    request<{ status: string; message: string }>('/api/pdf/flatten', 'POST', { pdf_path: pdfPath, output_path: outputPath, mode }),

  removeAnnotations: (pdfPath: string, outputPath: string, types?: string[]) =>
    request<{ status: string; data: { removed_count: number } }>('/api/pdf/remove-annotations', 'POST', { pdf_path: pdfPath, output_path: outputPath, types }),

  invertColors: (pdfPath: string, outputPath: string, pages?: number[], mode: string = 'full') =>
    request<{ status: string; message: string }>('/api/pdf/invert-colors', 'POST', { pdf_path: pdfPath, output_path: outputPath, pages, mode }),

  cropPDF: (pdfPath: string, outputPath: string, x0: number, y0: number, x1: number, y1: number, pages?: number[]) =>
    request<{ status: string; message: string }>('/api/pdf/crop', 'POST', { pdf_path: pdfPath, output_path: outputPath, x0, y0, x1, y1, pages }),

  addPageNumbers: (pdfPath: string, outputPath: string, options: {
    position?: string; format?: string; font?: string; size?: number;
    color?: number[]; start_from?: number; rtl?: boolean
  }) =>
    request<{ status: string; message: string }>('/api/pdf/add-page-numbers', 'POST', {
      pdf_path: pdfPath, output_path: outputPath, ...options
    }),

  redactPDF: (pdfPath: string, outputPath: string, options: {
    search_terms?: string[]; manual_rects?: Array<{ page: number; x0: number; y0: number; x1: number; y1: number }>;
    fill_color?: number[]
  }) =>
    request<{ status: string; message: string }>('/api/pdf/redact', 'POST', {
      pdf_path: pdfPath, output_path: outputPath, ...options
    }),

  extractTables: (pdfPath: string, outputPath: string, format: string = 'xlsx', pages?: number[]) =>
    request<{ status: string; data: { table_count: number; output_path: string | null } }>('/api/pdf/extract-tables', 'POST', {
      pdf_path: pdfPath, output_path: outputPath, format, pages
    }),

  // Background Tasks
  tasks: {
    list: () =>
      request<{ status: string; data: Array<TaskInfo> }>('/api/tasks/'),
    getStatus: (taskId: string) =>
      request<{ status: string; data: TaskInfo }>(`/api/tasks/${taskId}`),
  }
};

export interface TaskInfo {
  task_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  result: any;
  error: string | null;
  created_at: string;
  updated_at: string;
}

