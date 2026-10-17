// Per-book reader preferences and last-read page, persisted with the app's
// existing storage convention (Tauri app-data file first, localStorage fallback
// — see `src/lib/appStorage.ts`).

import { readAppFile, writeAppFile } from './appStorage';

export type ReaderLayout = 'continuous' | 'single' | 'two';
export type FitMode = 'width' | 'page' | 'custom';

export interface ReaderPrefs {
  layout: ReaderLayout;
  fitMode: FitMode;
  zoom: number;
  lastPage: number;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  layout: 'continuous',
  fitMode: 'width',
  zoom: 1.2,
  lastPage: 1,
};

function prefsKey(bookId: string): string {
  return `reader_prefs_${bookId}`;
}

function sanitize(raw: unknown): ReaderPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_READER_PREFS };
  const value = raw as Partial<ReaderPrefs>;
  const layout: ReaderLayout =
    value.layout === 'single' || value.layout === 'two' || value.layout === 'continuous'
      ? value.layout
      : DEFAULT_READER_PREFS.layout;
  const fitMode: FitMode =
    value.fitMode === 'width' || value.fitMode === 'page' || value.fitMode === 'custom'
      ? value.fitMode
      : DEFAULT_READER_PREFS.fitMode;
  const zoom = typeof value.zoom === 'number' && value.zoom > 0 ? value.zoom : DEFAULT_READER_PREFS.zoom;
  const lastPage =
    typeof value.lastPage === 'number' && value.lastPage >= 1 ? Math.floor(value.lastPage) : 1;
  return { layout, fitMode, zoom, lastPage };
}

export async function loadReaderPrefs(bookId: string): Promise<ReaderPrefs> {
  try {
    const raw = await readAppFile(prefsKey(bookId));
    if (!raw) return { ...DEFAULT_READER_PREFS };
    return sanitize(JSON.parse(raw));
  } catch (e) {
    console.warn('[ReaderPrefs] Failed to load preferences:', e);
    return { ...DEFAULT_READER_PREFS };
  }
}

export async function saveReaderPrefs(bookId: string, prefs: ReaderPrefs): Promise<void> {
  try {
    await writeAppFile(prefsKey(bookId), JSON.stringify(prefs));
  } catch (e) {
    console.warn('[ReaderPrefs] Failed to save preferences:', e);
  }
}
