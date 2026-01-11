import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface CardErrorProps {
  error?: Error | null;
  onRetry?: () => void;
  variant?: 'grid' | 'feed' | 'masonry';
  className?: string;
}

/**
 * CardError: Error state component for failed card loads
 *
 * Features:
 * - Displays appropriate error message and icon
 * - Retry button for recoverable errors
 * - Matches card layout structure
 * - Accessible with ARIA labels
 * - Supports all view modes
 *
 * Error Types:
 * - Network errors (offline, timeout)
 * - Server errors (5xx)
 * - Validation errors (4xx)
 * - Unknown errors
 */
export const CardError: React.FC<CardErrorProps> = ({
  error,
  onRetry,
  variant = 'grid',
  className,
}) => {
  // Determine error type and appropriate message/icon
  const getErrorDetails = () => {
    if (!error) {
      return {
        icon: AlertTriangle,
        title: 'Failed to load',
        message: 'Something went wrong',
        color: 'red',
      };
    }

    const errorMessage = error.message?.toLowerCase() || '';

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        icon: WifiOff,
        title: 'Network error',
        message: 'Check your internet connection',
        color: 'orange',
      };
    }

    // Server errors
    if (errorMessage.includes('server') || errorMessage.includes('500')) {
      return {
        icon: ServerCrash,
        title: 'Server error',
        message: 'The server encountered an error',
        color: 'red',
      };
    }

    // Validation/client errors
    if (errorMessage.includes('400') || errorMessage.includes('invalid')) {
      return {
        icon: AlertTriangle,
        title: 'Invalid data',
        message: 'This content could not be displayed',
        color: 'amber',
      };
    }

    // Generic error
    return {
      icon: AlertTriangle,
      title: 'Failed to load',
      message: errorMessage || 'Something went wrong',
      color: 'red',
    };
  };

  const { icon: Icon, title, message, color } = getErrorDetails();

  // Color classes based on error type
  const colorClasses = {
    red: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-600 dark:text-red-400',
      icon: 'text-red-500 dark:text-red-400',
      button: 'bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-600 dark:text-orange-400',
      icon: 'text-orange-500 dark:text-orange-400',
      button: 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-600 dark:text-amber-400',
      icon: 'text-amber-500 dark:text-amber-400',
      button: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    },
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.red;

  // Variant-specific container styles
  const containerClasses = twMerge(
    'flex flex-col items-center justify-center text-center p-6',
    'border rounded-xl',
    colors.bg,
    colors.border,
    variant === 'feed' ? 'min-h-[300px]' : 'min-h-[400px]',
    className
  );

  return (
    <div
      className={containerClasses}
      role="alert"
      aria-live="polite"
      aria-label={`Error: ${title}. ${message}`}
    >
      {/* Error Icon */}
      <Icon
        className={twMerge('mb-3', colors.icon)}
        size={variant === 'feed' ? 32 : 40}
        aria-hidden="true"
      />

      {/* Error Title */}
      <h3 className={twMerge('text-sm font-semibold mb-1', colors.text)}>
        {title}
      </h3>

      {/* Error Message */}
      <p className={twMerge('text-xs mb-4 max-w-[200px]', colors.text)}>
        {message}
      </p>

      {/* Retry Button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className={twMerge(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-xs font-medium transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            colors.button,
            color === 'red' && 'focus:ring-red-500',
            color === 'orange' && 'focus:ring-orange-500',
            color === 'amber' && 'focus:ring-amber-500'
          )}
          aria-label="Retry loading"
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Try again</span>
        </button>
      )}

      {/* Additional help text for network errors */}
      {color === 'orange' && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3">
          Check your connection and try again
        </p>
      )}
    </div>
  );
};
