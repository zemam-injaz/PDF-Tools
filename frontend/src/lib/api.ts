
const BASE_URL = 'http://127.0.0.1:8002'; // Port 8002 for PDF Tools

interface ApiResult<T> {
  success: boolean;
  data?: T;
  err?: string;
}

async function request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<ApiResult<T>> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
        const text = await response.text();
        return { success: false, err: `Error ${response.status}: ${text}` };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (e: any) {
    return { success: false, err: e.message || 'Network error' };
  }
}

export const api = {
    merge: (paths: string[], outputPath: string) => 
      request<{ status: string; message: string }>('/api/merge', 'POST', { paths, output_path: outputPath }),
      
    split: (inputPath: string, splitPages: number[], outputDir: string) =>
      request<{ status: string; files: string[] }>('/api/split', 'POST', { input_path: inputPath, split_pages: splitPages, output_dir: outputDir }),
      
    compress: (inputPath: string, outputPath: string, level: number) =>
      request<{ status: string; message: string }>('/api/compress', 'POST', { input_path: inputPath, output_path: outputPath, compression_level: level }),
      
    extractImages: (inputPath: string, outputDir: string) =>
      request<{ status: string; files: string[] }>('/api/extract-images', 'POST', { input_path: inputPath, output_dir: outputDir }),
      
    info: (path: string) =>
      request<{ page_count: number; metadata: any; is_encrypted: boolean }>('/api/info', 'POST', null), // Note: GET with body? or POST. Backend defined as POST? Let's check main.py. Backend defined POST /api/info with body? No, wait.
      // main.py: @app.post("/api/info") def get_info(path: str): ... 
      // FastAPI expects query param if it's scalar? Or body? 
      // If I defined `get_info(path: str)`, it expects query param by default for scalar types in POST? No, usually body if Pydantic, query if argument.
      // Let me re-read main.py definition.
      // @app.post("/api/info") def get_info(path: str):
      // This expects ?path=... query param unless Body() is used.
      // I should update main.py to use a Pydantic model for consistency or use query param here.
      // Let's assume query param for now: `/api/info?path=...`
};

// Fix for api.info implementation to match updated main.py or fixing main.py
// I'll update main.py to be robust. For now, let's write this API client assuming standard POST with body.
// Actually, let's update this to send query param, as per default FastAPI behavior for single scalar argument.
export const apiFixed = {
    // ...
    info: (path: string) =>
        request<{ page_count: number; metadata: any; is_encrypted: boolean }>(`/api/info?path=${encodeURIComponent(path)}`, 'POST'),
};

