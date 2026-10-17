import React, { useRef } from 'react';
import { Page } from 'react-pdf';
import {
  type Annotation,
  type AnnotationData,
  type PassageRect,
  type PassageSelection
} from '../../api/annotationApi';
import { AnnotationOverlay } from './AnnotationOverlay';

interface PDFPageRendererProps {
  pageNumber: number;
  scale: number;
  annotations: Annotation[];
  capturePointer: boolean;
  passageToolActive: boolean;
  highlightedId?: string | null;
  onAddAnnotation: (x: number, y: number, page: number) => void;
  onUpdateAnnotation: (id: string, newData: AnnotationData) => void;
  onPassageSelected?: (selection: PassageSelection, page: number) => void;
  onPageSized?: (pageNumber: number, size: { width: number; height: number }) => void;
}

function extractContext(
  wrapper: HTMLElement,
  quote: string
): { context_before: string; context_after: string } {
  try {
    const textLayer = wrapper.querySelector('.react-pdf__Page__textContent') as HTMLElement | null;
    const full = textLayer?.innerText || '';
    const idx = full.indexOf(quote);
    if (idx >= 0) {
      return {
        context_before: full.slice(Math.max(0, idx - 60), idx).trim(),
        context_after: full.slice(idx + quote.length, idx + quote.length + 60).trim()
      };
    }
  } catch {
    // Best-effort only.
  }
  return { context_before: '', context_after: '' };
}

const PDFPageRendererInner: React.FC<PDFPageRendererProps> = ({
  pageNumber,
  scale,
  annotations,
  capturePointer,
  passageToolActive,
  highlightedId,
  onAddAnnotation,
  onUpdateAnnotation,
  onPassageSelected,
  onPageSized
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    if (!passageToolActive || !onPassageSelected) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const quote = selection.toString().trim();
    if (!quote) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    if (wrapperRect.width === 0 || wrapperRect.height === 0) return;

    const rects: PassageRect[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const clientRects = range.getClientRects();
      for (let j = 0; j < clientRects.length; j++) {
        const cr = clientRects[j];
        if (cr.width < 1 || cr.height < 1) continue;
        if (
          cr.right < wrapperRect.left ||
          cr.left > wrapperRect.right ||
          cr.bottom < wrapperRect.top ||
          cr.top > wrapperRect.bottom
        ) {
          continue;
        }
        rects.push({
          x: (cr.left - wrapperRect.left) / wrapperRect.width,
          y: (cr.top - wrapperRect.top) / wrapperRect.height,
          w: cr.width / wrapperRect.width,
          h: cr.height / wrapperRect.height
        });
      }
    }

    if (rects.length === 0) return;

    const context = extractContext(wrapper, quote);
    onPassageSelected({ quote, rects, ...context }, pageNumber);
    selection.removeAllRanges();
  };

  return (
    <div
      ref={wrapperRef}
      className="relative bg-white shadow-2xl ring-1 ring-black/5"
      style={{ width: 'fit-content' }}
      onMouseUp={handleMouseUp}
    >
      <AnnotationOverlay
        pageNumber={pageNumber}
        annotations={annotations}
        scale={scale}
        capturePointer={capturePointer}
        highlightedId={highlightedId}
        onAddAnnotation={(x, y) => onAddAnnotation(x, y, pageNumber)}
        onUpdateAnnotation={onUpdateAnnotation}
      />
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        className="shadow-xl"
        loading={null}
        onLoadSuccess={(page) => {
          try {
            const viewport = (page as any).getViewport({ scale: 1 });
            onPageSized?.(pageNumber, { width: viewport.width, height: viewport.height });
          } catch {
            // ignore sizing failures
          }
        }}
      />
    </div>
  );
};

export const PDFPageRenderer = React.memo(PDFPageRendererInner);
