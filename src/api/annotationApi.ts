import { localApiFetch } from '../lib/api';

export type AnnotationType =
  | 'text'
  | 'dot'
  | 'timestamp'
  | 'highlight'
  | 'underline'
  | 'note';

/** Normalized (0-1) rectangle relative to a page box, origin top-left. */
export interface PassageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnnotationReply {
  id: string;
  text: string;
  author?: string;
  created_at: string;
}

export interface AnnotationData {
  text?: string;
  language?: 'ar' | 'en';
  color?: 'red' | 'black';
  /** Hex color for passage annotations (highlight/underline/note). */
  colorHex?: string;
  timestamp?: string;
  reading_count?: number;

  // --- Passage-based fields (Phase 3/4). All optional and additive so that
  // legacy records (which only have x/y) keep loading unchanged. ---
  quote?: string;
  context_before?: string;
  context_after?: string;
  rects?: PassageRect[];
  parent_id?: string | null;
  resolved?: boolean;
  author?: string;
  source?: 'matn';
  replies?: AnnotationReply[];
}

export interface Annotation {
  id: string;
  book_id: string;
  page: number;
  type: AnnotationType;
  x: number;
  y: number;
  data: AnnotationData;
  created_at: string;
}

/** Selection payload produced by the page renderer for passage annotations. */
export interface PassageSelection {
  quote: string;
  rects: PassageRect[];
  context_before?: string;
  context_after?: string;
}

export type ExportMode = 'native' | 'flatten';

export const annotationApi = {
  getAnnotations: async (bookId: string): Promise<Annotation[]> => {
    const response = await localApiFetch(`/api/annotations/book/${bookId}`);
    const data = await response.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.detail || 'Failed to fetch annotations');
  },

  addAnnotation: async (annotation: Omit<Annotation, 'id' | 'created_at'> & { id?: string }): Promise<Annotation> => {
    const response = await localApiFetch('/api/annotations/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    });
    const data = await response.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.detail || 'Failed to add annotation');
  },

  deleteAnnotation: async (annotationId: string): Promise<void> => {
    const response = await localApiFetch(`/api/annotations/${annotationId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to delete annotation');
    }
  },

  updateAnnotation: async (annotationId: string, data: AnnotationData): Promise<void> => {
    const response = await localApiFetch(`/api/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const resData = await response.json();
    if (resData.status !== 'success') {
      throw new Error(resData.detail || 'Failed to update annotation');
    }
  },

  burnAnnotations: async (
    pdfPath: string,
    outputPath: string,
    annotations: any[],
    mode: ExportMode = 'native',
  ): Promise<void> => {
    const response = await localApiFetch('/api/annotations/burn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf_path: pdfPath,
        output_path: outputPath,
        annotations,
        mode,
      }),
    });
    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.detail || 'Failed to export annotations');
    }
  }
};
