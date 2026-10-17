import React from 'react';
import { type AnnotationData } from '../../../api/annotationApi';

interface PassageAnnotationProps {
  type: 'highlight' | 'underline' | 'note';
  data: AnnotationData;
  x: number;
  y: number;
  scale: number;
  emphasized?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Renders a passage-based annotation from its normalized `rects`.
 * When `rects` are missing (legacy/partial records) highlight/underline fall
 * back to a small marker at the stored `x/y` point so nothing disappears.
 */
export const PassageAnnotation: React.FC<PassageAnnotationProps> = ({
  type,
  data,
  x,
  y,
  scale,
  emphasized,
  onClick
}) => {
  const color = data.colorHex || (type === 'highlight' ? '#facc15' : '#38bdf8');
  const rects = data.rects && data.rects.length > 0 ? data.rects : null;

  if (type === 'note') {
    const size = 18 * scale;
    return (
      <g onClick={onClick} style={{ pointerEvents: 'auto' }}>
        <foreignObject
          x={`${x * 100}%`}
          y={`${y * 100}%`}
          width={size * 2}
          height={size * 2}
          style={{ overflow: 'visible' }}
        >
          <div
            className={`flex items-center justify-center rounded-md border shadow-md cursor-pointer transition-transform hover:scale-110 ${
              emphasized ? 'ring-4 ring-emerald-400 animate-pulse' : ''
            }`}
            style={{
              width: size,
              height: size,
              background: 'rgba(16,185,129,0.92)',
              borderColor: '#065f46',
              color: 'white',
              fontSize: `${10 * scale}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            ✎
          </div>
        </foreignObject>
      </g>
    );
  }

  if (!rects) {
    const size = 12 * scale;
    return (
      <g onClick={onClick} style={{ pointerEvents: 'auto' }}>
        <circle
          cx={`${x * 100}%`}
          cy={`${y * 100}%`}
          r={size / 2}
          fill={color}
          fillOpacity={0.6}
          stroke={color}
          strokeWidth={1}
          className={emphasized ? 'animate-pulse' : ''}
        />
      </g>
    );
  }

  return (
    <g onClick={onClick} style={{ pointerEvents: 'auto' }}>
      {rects.map((r, i) =>
        type === 'highlight' ? (
          <rect
            key={i}
            x={`${r.x * 100}%`}
            y={`${r.y * 100}%`}
            width={`${r.w * 100}%`}
            height={`${r.h * 100}%`}
            fill={color}
            fillOpacity={emphasized ? 0.55 : 0.32}
            className={emphasized ? 'animate-pulse' : ''}
          />
        ) : (
          <line
            key={i}
            x1={`${r.x * 100}%`}
            y1={`${(r.y + r.h) * 100}%`}
            x2={`${(r.x + r.w) * 100}%`}
            y2={`${(r.y + r.h) * 100}%`}
            stroke={color}
            strokeWidth={Math.max(1.5, 2 * scale)}
            strokeLinecap="round"
          />
        )
      )}
    </g>
  );
};
