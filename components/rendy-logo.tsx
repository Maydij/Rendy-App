import React from 'react';

export interface RendyLogoProps {
  variant?: 'full' | 'mark';
  theme?: 'dark' | 'light';
  className?: string;
}

/**
 * @name RendyLogo
 * @description [Business Logic]: Official Rendy brand logo component featuring
 * the obsidian dock isotype with stylized 'R' and optional wordmark.
 */
export function RendyLogo({
  variant = 'full',
  theme = 'dark',
  className = 'h-8 w-auto',
}: RendyLogoProps) {
  const isLight = theme === 'light';
  const textClass = isLight ? 'text-[#0B0E17]' : 'text-[#F8FAFC]';

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Isotipo Universal en Dock Obsidiana */}
      <svg
        viewBox="0 0 140 140"
        className="h-full w-auto aspect-square overflow-visible flex-shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="140" height="140" rx="36" fill="#0B0E17" stroke="#1B2234" strokeWidth="1.5" />
        <g transform="translate(-2, 5)">
          {/* Pilar Blanco */}
          <rect x="36" y="24" width="16" height="82" rx="8" fill="#F8FAFC" />
          {/* Bucle Verde Menta */}
          <path
            d="M 68 24 H 84 C 98 24, 108 34, 108 48 C 108 62, 98 72, 84 72 H 68 C 63.58 72, 60 68.42, 60 64 V 32 C 60 27.58, 63.58 24, 68 24 Z"
            fill="#00E599"
          />
          <circle cx="84" cy="48" r="11" fill="#0B0E17" />
          {/* Patica Cian */}
          <path
            d="M 79.4 80 H 92.6 Q 96.1 80, 98.3 82.8 L 106.3 93.1 A 8 8 0 0 1 93.7 102.9 L 78.0 82.8 Q 75.9 80, 79.4 80 Z"
            fill="#06B6D4"
          />
        </g>
      </svg>

      {/* Wordmark Oficial 'Rendy.' */}
      {variant === 'full' && (
        <span className={`text-2xl font-black tracking-tight leading-none ${textClass}`}>
          Rendy<span className="text-[#FBBF24]">.</span>
        </span>
      )}
    </div>
  );
}
