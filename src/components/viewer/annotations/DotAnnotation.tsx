import React from 'react';

interface DotAnnotationProps {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  color: 'red' | 'black';
  scale: number;
}

export const DotAnnotation: React.FC<DotAnnotationProps> = ({ x, y, color, scale }) => {
  const size = 12 * scale;
  return (
    <circle
      cx={`${x * 100}%`}
      cy={`${y * 100}%`}
      r={size / 2}
      fill={color === 'red' ? '#ef4444' : '#1f2937'}
      className="drop-shadow-sm transition-transform hover:scale-125 cursor-pointer"
    />
  );
};
