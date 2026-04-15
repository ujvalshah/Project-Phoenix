import React, { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onRightIconClick?: () => void;
  rightIconAriaLabel?: string;
  rightIconAriaPressed?: boolean;
  error?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  leftIcon,
  rightIcon,
  onRightIconClick,
  rightIconAriaLabel,
  rightIconAriaPressed,
  error,
  containerClassName = '',
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-200">
          {label}
        </label>
      )}
      <div className="relative group">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
            {leftIcon}
          </div>
        )}
        <input
          className={`
            block w-full py-2.5 
            ${leftIcon ? 'pl-10' : 'pl-4'} 
            ${rightIcon ? 'pr-10' : 'pr-4'} 
            bg-slate-50 dark:bg-slate-800 
            border rounded-xl 
            text-slate-900 dark:text-white 
            placeholder-slate-400 
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent 
            transition-all
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700'}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          onRightIconClick ? (
            <button
              type="button"
              aria-label={rightIconAriaLabel || 'Input action'}
              aria-pressed={rightIconAriaPressed}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              onClick={onRightIconClick}
            >
              {rightIcon}
            </button>
          ) : (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none">
              {rightIcon}
            </div>
          )
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};


