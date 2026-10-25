import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { localApiFetch } from '../lib/api';

export interface NativeReaderEvent {
  type: 'document_opened' | 'page_changed' | 'chapter_changed' | 'zoom_changed' | 'comments_visibility_changed' | 'annotation_created' | 'annotation_deleted' | 'document_saved' | 'open_cancelled' | 'closed';
  book_id?: string | null;
  requested_book_id?: string | null;
  path?: string;
  page?: number;
  page_count?: number;
  chapter_title?: string | null;
  zoom?: number;
  auto_fit?: boolean;
  saved?: boolean;
  annotation?: { kind?: string; text?: string; pdf_rects?: number[][]; pdf_xref?: number; db_id?: string };
  visible?: boolean;
}

export const nativeReaderApi = {
  launch(path: string, bookId: string): Promise<void> {
    return invoke('launch_reader', { path, bookId });
  },
  action(action: 'focus' | 'minimize' | 'close' | 'goto' | 'zoom' | 'comments' | 'filter_comments',
         options: { page?: number; zoom?: number; visible?: boolean; query?: string } = {}): Promise<void> {
    return invoke('reader_action', { action, ...options });
  },
  listen(handler: (event: NativeReaderEvent) => void): Promise<UnlistenFn> {
    return listen<NativeReaderEvent>('matn-reader', event => handler(event.payload));
  },
  async sync(bookId: string): Promise<number> {
    const response = await localApiFetch(`/api/reader/sync/${encodeURIComponent(bookId)}`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      throw new Error(result.detail || 'Could not sync reader annotations');
    }
    return result.data.count;
  },
};
