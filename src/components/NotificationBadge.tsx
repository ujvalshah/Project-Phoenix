import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface NotificationBadgeProps {
  /** When true, renders an 8px unread indicator on the bell */
  visible: boolean;
  className?: string;
}

/**
 * High-signal unread indicator: small solid dot (no numeric count).
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  visible,
  className,
}) => {
  if (!visible) return null;
  return (
    <span
      className={twMerge(
        'pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-400 ring-2 ring-white dark:ring-slate-900',
        className,
      )}
      aria-hidden
    />
  );
};
