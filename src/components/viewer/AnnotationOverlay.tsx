import React, { useRef } from 'react';
import { type Annotation, type AnnotationData } from '../../api/annotationApi';
import { DotAnnotation } from './annotations/DotAnnotation';
import { TextAnnotation } from './annotations/TextAnnotation';
import { TimestampAnnotation } from './annotations/TimestampAnnotation';
import { PassageAnnotation } from './annotations/PassageAnnotation';

interface AnnotationOverlayProps {
  pageNumber: number;
  annotations: Annotation[];
  scale: number;
  /**
   * When true the overlay captures clicks to place point annotations. When
   * false the overlay is transparent to the pointer so the text/native layers
   * can be selected and used for reading.
   */
  capturePointer: boolean;
  highlightedId?: string | null;
  onAddAnnotation: (x: number, y: number, page: number) => void;
  onUpdateAnnotation: (id: string, newData: AnnotationData) => void;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  pageNumber,
  annotations,
  scale,
  capturePointer,
  highlightedId,
  onAddAnnotation,
  onUpdateAnnotation
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    if (!capturePointer) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    onAddAnnotation(x, y, pageNumber);
  };

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className={`absolute top-0 left-0 w-full h-full ${
        capturePointer ? 'cursor-crosshair' : ''
      }`}
      // The SVG root never captures pointer input itself; only the cover rect
      // (when a point tool is active) or individual annotation nodes do. This
      // keeps text selection and native annotations usable in reading mode.
      style={{ touchAction: 'none', zIndex: 10, pointerEvents: 'none' }}
    >
      {capturePointer && (
        <rect
          width="100%"
          height="100%"
          fill="transparent"
          pointerEvents="all"
          onClick={handleClick}
        />
      )}

      {annotations.map((annot) => {
        if (annot.page !== pageNumber) return null;
        const emphasized = highlightedId === annot.id;

        return (
          <g
            key={annot.id}
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {annot.type === 'dot' && (
              <DotAnnotation
                x={annot.x}
                y={annot.y}
                color={annot.data.color === 'red' ? 'red' : 'black'}
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
            {(annot.type === 'highlight' || annot.type === 'underline' || annot.type === 'note') && (
              <PassageAnnotation
                type={annot.type}
                data={annot.data}
                x={annot.x}
                y={annot.y}
                scale={scale}
                emphasized={emphasized}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};
