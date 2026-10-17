import React, { useEffect, useMemo, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { Bookmark, Image as ImageIcon, Loader2, ChevronDown, ChevronLeft } from 'lucide-react';
import { type BookmarkItem } from '../../api/bookLibraryApi';

interface ReaderSidebarProps {
  assetUrl: string;
  numPages: number;
  currentPage: number;
  bookmarks: BookmarkItem[];
  hasBookmarks: boolean;
  loadingBookmarks: boolean;
  onNavigate: (page: number) => void;
}

type SidebarTab = 'thumbnails' | 'bookmarks';

const THUMB_WINDOW = 8;

export const ReaderSidebar: React.FC<ReaderSidebarProps> = ({
  assetUrl,
  numPages,
  currentPage,
  bookmarks,
  hasBookmarks,
  loadingBookmarks,
  onNavigate
}) => {
  const [tab, setTab] = useState<SidebarTab>('thumbnails');
  const [thumbScale, setThumbScale] = useState(0.18);

  useEffect(() => {
    if (!hasBookmarks && tab === 'bookmarks') setTab('thumbnails');
  }, [hasBookmarks, tab]);

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  const windowStart = Math.max(1, currentPage - THUMB_WINDOW);
  const windowEnd = Math.min(numPages, currentPage + THUMB_WINDOW);

  return (
    <aside className="w-64 flex-shrink-0 h-full flex flex-col bg-gray-900 text-gray-200 border-l border-gray-800" dir="rtl">
      <div className="flex items-center p-2 gap-1 bg-gray-950/60">
        <button
          onClick={() => setTab('thumbnails')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'thumbnails' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'
          }`}
        >
          <ImageIcon size={15} /> مصغّرات
        </button>
        <button
          onClick={() => setTab('bookmarks')}
          disabled={!hasBookmarks && !loadingBookmarks}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
            tab === 'bookmarks' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800'
          }`}
        >
          <Bookmark size={15} /> الفهرس
        </button>
      </div>

      {tab === 'thumbnails' && (
        <div className="flex-1 overflow-auto p-3 custom-scrollbar">
          <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
            <span>الصفحة {currentPage} / {numPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setThumbScale((s) => Math.max(0.1, +(s - 0.03).toFixed(2)))}
                className="w-6 h-6 rounded hover:bg-gray-800 flex items-center justify-center"
                title="تصغير المصغّرات"
              >
                −
              </button>
              <button
                onClick={() => setThumbScale((s) => Math.min(0.4, +(s + 0.03).toFixed(2)))}
                className="w-6 h-6 rounded hover:bg-gray-800 flex items-center justify-center"
                title="تكبير المصغّرات"
              >
                +
              </button>
            </div>
          </div>

          <Document file={assetUrl} loading={<div className="text-center text-xs text-gray-500">...</div>} error={null}>
            <div className="flex flex-col items-center gap-3">
              {pages.map((pageNumber) => {
                const inWindow = pageNumber >= windowStart && pageNumber <= windowEnd;
                const active = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    onClick={() => onNavigate(pageNumber)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all [content-visibility:auto] ${
                      active ? 'border-indigo-500 shadow-lg shadow-indigo-900/40' : 'border-transparent hover:border-gray-600'
                    }`}
                    title={`الصفحة ${pageNumber}`}
                  >
                    {inWindow ? (
                      <Page pageNumber={pageNumber} scale={thumbScale} renderTextLayer={false} renderAnnotationLayer={false} loading={null} />
                    ) : (
                      <div
                        className="bg-gray-800 flex items-center justify-center text-gray-600"
                        style={{ width: 120 * (thumbScale / 0.18), height: 160 * (thumbScale / 0.18) }}
                      >
                        {pageNumber}
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {pageNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </Document>
        </div>
      )}

      {tab === 'bookmarks' && (
        <div className="flex-1 overflow-auto p-3 custom-scrollbar">
          {loadingBookmarks ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center text-xs text-gray-500 py-8">
              لا يحتوي هذا المستند على فهرس. استخدم المصغّرات أو رقم الصفحة للتنقّل.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {bookmarks.map((bm, idx) => {
                const active = currentPage >= bm.page && currentPage <= (bm.end_page || bm.page);
                return (
                  <li key={`${bm.page}-${idx}`}>
                    <button
                      onClick={() => onNavigate(bm.page)}
                      style={{ paddingRight: `${(bm.level - 1) * 14 + 8}px` }}
                      className={`w-full text-right flex items-center gap-1.5 py-1.5 pl-2 rounded-md text-sm transition-colors ${
                        active ? 'bg-indigo-600/20 text-indigo-200' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                      title={`${bm.title} — صفحة ${bm.page}`}
                    >
                      {bm.level > 1 ? <ChevronLeft size={12} className="opacity-50" /> : <ChevronDown size={12} className="opacity-40" />}
                      <span className="truncate flex-1">{bm.title || '(بدون عنوان)'}</span>
                      <span className="text-[10px] text-gray-500">{bm.page}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
};
