
import { getApiBaseUrl } from '../lib/api';

export interface Bookmark {
  level: number;
  title: string;
  page: number;
  end_page: number;
  page_count: number;
}

export interface BookmarkExtractResponse {
  bookmarks: Bookmark[];
  formatted_text: string;
  count: number;
  total_pages: number;
  has_bookmarks: boolean;
}

export const bookmarkApi = {
  /**
   * Extract bookmarks from a PDF file with page counts and hierarchy
   */
  async extractBookmarks(pdfPath: string): Promise<BookmarkExtractResponse> {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/bookmarks/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: pdfPath }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to extract bookmarks');
    }

    return data.data;
  }
};
