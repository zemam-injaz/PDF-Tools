/**
 * PDF Progress/Activity Tracking API Client
 * Handles scanning directories for PDFs and tracking reading activity
 */

import { getApiBaseUrl } from '../lib/api';

export interface ScannedPDF {
  id: number;
  file_path: string;
  file_name: string;
  page_count: number;
  total_annotations: number;
  reading_intensity_score: number;
  last_modified: string;
  last_scanned: string;
  file_size: number;
  annotations_by_type: Record<string, number>;
  estimated_reading_time: number;
}

export interface ScanResult {
  successful: string[];
  failed: Array<{ path: string; error: string }>;
  total_found: number;
  successful_count: number;
  failed_count: number;
}

export interface ProgressStatistics {
  total_pdfs: number;
  pdfs_with_annotations: number;
  total_annotations: number;
  average_intensity: number;
}

export const pdfProgressApi = {
  /**
   * Scan a directory for PDF files and analyze annotations
   */
  async scanDirectory(directory: string, recursive: boolean = true): Promise<ScanResult> {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/progress/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory, recursive }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to scan directory');
    }

    return data.data;
  },

  /**
   * Get list of scanned PDFs
   */
  async getPDFList(options?: {
    filterAnnotated?: boolean;
    sortBy?: string;
    order?: 'asc' | 'desc';
    search?: string;
  }): Promise<{ pdfs: ScannedPDF[]; total_count: number }> {
    const params = new URLSearchParams();
    
    if (options?.filterAnnotated) params.set('filter_annotated', 'true');
    if (options?.sortBy) params.set('sort_by', options.sortBy);
    if (options?.order) params.set('order', options.order);
    if (options?.search) params.set('search', options.search);

    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/progress/list?${params}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to get PDF list');
    }

    return data.data;
  },

  /**
   * Get reading statistics
   */
  async getStatistics(): Promise<ProgressStatistics> {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/progress/statistics`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to get statistics');
    }

    return data.data;
  },

  /**
   * Export annotations to markdown
   */
  async exportToMarkdown(pdfPath: string): Promise<string> {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/progress/export/markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_path: pdfPath }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to export annotations');
    }

    return data.data.markdown;
  },

  /**
   * Delete a PDF from the database (not file itself)
   */
  async deletePDF(pdfPath: string): Promise<void> {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/progress/pdf?pdf_path=${encodeURIComponent(pdfPath)}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to delete PDF record');
    }
  },

  /**
   * Clear all progress data
   */
  async clearAll(): Promise<number> {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/progress/clear`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to clear progress data');
    }

    // Extract count from message
    const match = data.message.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  },
};
