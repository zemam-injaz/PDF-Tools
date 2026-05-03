import React from 'react';
import { type AnnotationData } from '../../../api/annotationApi';

interface TimestampAnnotationProps {
  id: string;
  x: number;
  y: number;
  timestamp: string;
  readingCount: number;
  scale: number;
  onUpdate: (data: AnnotationData) => void;
}

export const TimestampAnnotation: React.FC<TimestampAnnotationProps> = ({ 
  id, x, y, timestamp, readingCount, scale, onUpdate 
}) => {
  const dateObj = new Date(timestamp);
  const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdate({
      timestamp,
      reading_count: readingCount + 1
    });
  };

  return (
    <foreignObject 
      x={`${x * 100}%`} 
      y={`${y * 100}%`} 
      width={180 * scale} 
      height={30 * scale}
      style={{ overflow: 'visible' }}
    >
      <div 
        className="flex items-center gap-2 px-2 py-1 bg-gray-900/85 backdrop-blur-sm text-white rounded-full shadow-md whitespace-nowrap border border-white/20 transition-transform hover:scale-105 cursor-default pointer-events-auto"
        style={{ 
          fontSize: `${10 * scale}px`,
          transform: `translate(-50%, -50%)`
        }}
      >
        <span className="font-medium">{formattedDate} · {formattedTime}</span>
        <button 
          onClick={handleIncrement}
          title="انقر لزيادة عداد القراءة"
          className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/50 rounded-full text-indigo-100 border border-indigo-400/30 hover:bg-indigo-400/60 transition-colors cursor-pointer"
        >
          📖 ×{readingCount}
        </button>
      </div>
    </foreignObject>
  );
};
