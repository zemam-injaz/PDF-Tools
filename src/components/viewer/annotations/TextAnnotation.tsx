import React from 'react';

interface TextAnnotationProps {
  x: number;
  y: number;
  text: string;
  language?: 'ar' | 'en';
  scale: number;
}

export const TextAnnotation: React.FC<TextAnnotationProps> = ({ x, y, text, language = 'en', scale }) => {
  const isArabic = language === 'ar';
  
  return (
    <foreignObject 
      x={`${x * 100}%`} 
      y={`${y * 100}%`} 
      width={200 * scale} 
      height={100 * scale}
      style={{ overflow: 'visible' }}
    >
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className={`p-2 rounded shadow-lg border text-sm max-w-xs break-words pointer-events-auto transition-transform hover:scale-105 cursor-default ${
          isArabic ? 'font-arabic' : 'font-sans'
        }`}
        style={{
          background: 'rgba(254, 249, 195, 0.95)', // Light yellow sticky note
          borderColor: '#fde047',
          color: '#854d0e',
          fontSize: `${12 * scale}px`,
          transform: `translate(-50%, -50%)`, // Center on the click point
        }}
      >
        {text}
      </div>
    </foreignObject>
  );
};
