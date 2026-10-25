import { nativeReaderApi } from '../api/nativeReaderApi';
import { bookLibraryApi } from '../api/bookLibraryApi';
import { DEFAULT_READER_PREFS, loadReaderPrefs, saveReaderPrefs, type ReaderPrefs } from './readerPrefs';

type Session = { key: string; prefs: ReaderPrefs; path: string; pagesRead: number };
const sessions = new Map<string, Session>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const progressTimers = new Map<string, ReturnType<typeof setTimeout>>();
let installed = false;
let activeBookId: string | null = null;
let openGeneration = 0;

export function getActiveNativeBookId(): string | null {
  return activeBookId;
}

function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
}

function scheduleSave(bookId: string, session: Session): void {
  const oldTimer = saveTimers.get(bookId);
  if (oldTimer) clearTimeout(oldTimer);
  saveTimers.set(bookId, setTimeout(() => {
    void saveReaderPrefs(session.key, session.prefs);
    saveTimers.delete(bookId);
  }, 500));
}

/** Owns persistence and PDF-to-SQLite sync even when the library tool is hidden. */
export async function installNativeReaderBridge(): Promise<void> {
  if (installed || !('__TAURI__' in window)) return;
  installed = true;
  try {
    await nativeReaderApi.listen(async event => {
      const bookId = event.book_id;
      if (event.type === 'closed' || (event.type === 'document_opened' && !bookId)) {
        activeBookId = null;
        openGeneration += 1;
      }
      if (!bookId) return;
      if (event.type === 'document_opened' && event.path) {
        const generation = ++openGeneration;
        try {
          const book = await bookLibraryApi.getBook(Number(bookId));
          if (generation !== openGeneration || !samePath(book.file_path, event.path)) return;
          const prior = sessions.get(bookId);
          const shouldRestore = activeBookId !== bookId;
          const key = book.document_uid || bookId;
          const prefs = prior?.prefs || await loadReaderPrefs(
            key, bookId, { ...DEFAULT_READER_PREFS, commentsOpen: false }
          );
          if (generation !== openGeneration) return;
          activeBookId = bookId;
          sessions.set(bookId, { key, prefs, path: book.file_path, pagesRead: book.pages_read });
          if (shouldRestore) {
            await nativeReaderApi.action('goto', { page: prefs.lastPage });
            if (prefs.fitMode === 'custom') await nativeReaderApi.action('zoom', { zoom: prefs.zoom });
            await nativeReaderApi.action('comments', { visible: prefs.commentsOpen });
          }
          await nativeReaderApi.sync(bookId);
        } catch (error) {
          console.warn('[NativeReader] Could not initialize book state:', error);
        }
        return;
      }
      const session = sessions.get(bookId);
      if (!session || activeBookId !== bookId) return;
      if (event.type === 'page_changed' && event.page && event.page >= 1) {
        session.prefs.lastPage = event.page;
        scheduleSave(bookId, session);
        if (event.page > session.pagesRead) {
          session.pagesRead = event.page;
          if (!progressTimers.has(bookId)) {
            progressTimers.set(bookId, setTimeout(() => {
              progressTimers.delete(bookId);
              void bookLibraryApi.updateBook(Number(bookId), { pages_read: session.pagesRead }).catch(error =>
                console.warn('[NativeReader] Could not update reading progress:', error));
            }, 1000));
          }
        }
      } else if (event.type === 'zoom_changed' && event.zoom && event.zoom > 0) {
        session.prefs.zoom = event.zoom;
        session.prefs.fitMode = event.auto_fit ? 'width' : 'custom';
        scheduleSave(bookId, session);
      } else if (event.type === 'comments_visibility_changed' && typeof event.visible === 'boolean') {
        session.prefs.commentsOpen = event.visible;
        scheduleSave(bookId, session);
      } else if (event.type === 'document_saved' && event.path && samePath(event.path, session.path)) {
        try { await nativeReaderApi.sync(bookId); }
        catch (error) { console.warn('[NativeReader] Could not sync saved annotations:', error); }
      }
    });
  } catch (error) {
    installed = false;
    console.warn('[NativeReader] Event bridge unavailable:', error);
  }
}
