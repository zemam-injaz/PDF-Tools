import { useCallback, useEffect, useState } from 'react';
import { readAppFile, writeAppFile } from '../lib/appStorage';

const STORAGE_FILE = 'recent_files.json';
const MAX_RECENT_FILES = 8;

export interface RecentFile {
  path: string;
  name: string;
  lastAction: string;
  openedAt: string;
}

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    void readAppFile(STORAGE_FILE).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw) as RecentFile[];
        if (Array.isArray(parsed)) setRecentFiles(parsed.slice(0, MAX_RECENT_FILES));
      } catch {
        setRecentFiles([]);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const addRecentFile = useCallback((path: string, lastAction = 'تم اختياره') => {
    if (!path) return;
    setRecentFiles((current) => {
      const next: RecentFile[] = [
        { path, name: fileNameFromPath(path), lastAction, openedAt: new Date().toISOString() },
        ...current.filter((item) => item.path !== path),
      ].slice(0, MAX_RECENT_FILES);
      void writeAppFile(STORAGE_FILE, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
    void writeAppFile(STORAGE_FILE, '[]');
  }, []);

  return { recentFiles, addRecentFile, clearRecentFiles };
}
