import { getApiBaseUrl } from '../lib/api';

export interface AnnotationData {
  text?: string;
  language?: 'ar' | 'en';
  color?: 'red' | 'black';
  timestamp?: string;
  reading_count?: number;
}

export interface Annotation {
  id: string;
  book_id: string;
  page: number;
  type: 'text' | 'dot' | 'timestamp';
  x: number;
  y: number;
  data: AnnotationData;
  created_at: string;
}

export const annotationApi = {
  getAnnotations: async (bookId: string): Promise<Annotation[]> => {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/annotations/book/${bookId}`);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.detail || 'Failed to fetch annotations');
  },

  addAnnotation: async (annotation: Omit<Annotation, 'id' | 'created_at'> & { id?: string }): Promise<Annotation> => {
    const API_BASE = await getApiBaseUrl();
    console.log(`[AnnotationAPI] Posting to /api/annotations/save`, annotation);
    const response = await fetch(`${API_BASE}/api/annotations/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    });
    const data = await response.json();
    console.log(`[AnnotationAPI] Response:`, data);
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.detail || 'Failed to add annotation');
  },

  deleteAnnotation: async (annotationId: string): Promise<void> => {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/annotations/${annotationId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to delete annotation');
    }
  },

  updateAnnotation: async (annotationId: string, data: AnnotationData): Promise<void> => {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const resData = await response.json();
    if (resData.status !== 'success') {
      throw new Error(resData.detail || 'Failed to update annotation');
    }
  },

  burnAnnotations: async (pdfPath: string, outputPath: string, annotations: any[]): Promise<void> => {
    const API_BASE = await getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/annotations/burn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf_path: pdfPath,
        output_path: outputPath,
        annotations
      }),
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to burn annotations');
    }
  }
};
