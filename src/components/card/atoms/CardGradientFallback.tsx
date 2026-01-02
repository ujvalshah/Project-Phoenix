import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardGradientFallbackProps {
  className?: string;
  title?: string;
}

/**
 * Gradient fallback for Hybrid cards without media.
 * Renders a strong, intentional gradient header block.
 * Gradient is NOT considered media and does NOT participate in truncation/expand logic.
 * 
 * Design: Strong, visible gradient with theme-aware colors.
 * Maintains professional appearance with intentional, non-decorative styling.
 * Includes hover effects matching media cards for interaction parity.
 */
export const CardGradientFallback: React.FC<CardGradientFallbackProps> = ({
  className,
  title,
}) => {
  return (
    <div
      className={twMerge(
        'w-full aspect-video rounded-xl overflow-hidden relative shrink-0 cursor-pointer',
        // Light theme: Strong, visible gradients
        'bg-gradient-to-br from-slate-50 to-indigo-50',
        'dark:from-slate-900 dark:to-slate-800',
        // Hover effects matching media cards: subtle scale, shadow, and brightness
        'transition-all duration-300',
        'hover:scale-105 hover:shadow-md hover:brightness-105',
        className
      )}
    >
      {/* Optional title text inside gradient */}
      {title && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center line-clamp-2">
            {title}
          </h3>
        </div>
      )}
    </div>
  );
};

