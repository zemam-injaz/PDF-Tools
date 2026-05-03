import React, { useRef } from 'react';
import { type Annotation, type AnnotationData } from '../../api/annotationApi';
import { DotAnnotation } from './annotations/DotAnnotation';
import { TextAnnotation } from './annotations/TextAnnotation';
import { TimestampAnnotation } from './annotations/TimestampAnnotation';
import { type Tool } from './toolbar/AnnotationToolbar';

interface AnnotationOverlayProps {
  pageNumber: number;
  annotations: Annotation[];
  scale: number;
  activeTool: Tool;
  onAddAnnotation: (x: number, y: number, page: number) => void;
  onUpdateAnnotation: (id: string, newData: AnnotationData) => void;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  pageNumber,
  annotations,
  scale,
  activeTool,
  onAddAnnotation,
  onUpdateAnnotation
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    console.log('AnnotationOverlay clicked, Tool:', activeTool);
    if (activeTool === 'none') return;
    
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    console.log(`Adding annotation at: x=${x.toFixed(4)}, y=${y.toFixed(4)}, page=${pageNumber}`);
    onAddAnnotation(x, y, pageNumber);
  };

  return (
    <svg
      ref={svgRef}
      className={`absolute top-0 left-0 w-full h-full pointer-events-auto ${
        activeTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onClick={handleClick}
      style={{ touchAction: 'none', zIndex: 10 }}
    >
      {/* Invisible background to capture clicks anywhere on the SVG */}
      <rect width="100%" height="100%" fill="transparent" pointerEvents="all" />
      {annotations.map((annot) => {
          const isCurrentPage = annot.page === pageNumber;
          if (!isCurrentPage) return null;

          return (
            <g 
              key={annot.id} 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // CRITICAL: Stop propagation to prevent adding a new annotation
              }}
            >
              {annot.type === 'dot' && (
                <DotAnnotation 
                  x={annot.x} 
                  y={annot.y} 
                  color={annot.data.color || 'black'} 
                  scale={scale} 
                />
              )}
              {annot.type === 'text' && (
                <TextAnnotation 
                  x={annot.x} 
                  y={annot.y} 
                  text={annot.data.text || ''} 
                  language={annot.data.language}
                  scale={scale} 
                />
              )}
              {annot.type === 'timestamp' && (
                <TimestampAnnotation 
                  id={annot.id}
                  x={annot.x} 
                  y={annot.y} 
                  timestamp={annot.data.timestamp || ''} 
                  readingCount={annot.data.reading_count || 1}
                  scale={scale}
                  onUpdate={(newData) => onUpdateAnnotation(annot.id, newData)}
                />
              )}
            </g>
          );
        })}
    </svg>
  );
};
