import React from 'react';
import { Page } from 'react-pdf';
import { type Annotation, type AnnotationData } from '../../api/annotationApi';
import { AnnotationOverlay } from './AnnotationOverlay';
import { type Tool } from './toolbar/AnnotationToolbar';

interface PDFPageRendererProps {
  pageNumber: number;
  width: number;
  scale: number;
  annotations: Annotation[];
  activeTool: Tool;
  onAddAnnotation: (x: number, y: number, page: number) => void;
  onUpdateAnnotation: (id: string, newData: AnnotationData) => void;
}

export const PDFPageRenderer: React.FC<PDFPageRendererProps> = ({
  pageNumber,
  width,
  scale,
  annotations,
  activeTool,
  onAddAnnotation,
  onUpdateAnnotation
}) => {
  return (
    <div 
      className="relative shadow-2xl mb-12 mx-auto bg-white transition-all duration-300 ring-1 ring-black/5"
      style={{ width: width * scale, minHeight: 100 * scale }}
    >
      <AnnotationOverlay
        pageNumber={pageNumber}
        annotations={annotations}
        scale={scale}
        activeTool={activeTool}
        onAddAnnotation={(x, y) => onAddAnnotation(x, y, pageNumber)}
        onUpdateAnnotation={onUpdateAnnotation}
      />
      <Page
        pageNumber={pageNumber}
        width={width}
        scale={scale}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        className="shadow-xl"
        loading={null}
      />
    </div>
  );
};
