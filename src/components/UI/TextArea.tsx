import React, { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
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
      <textarea
        className={`
          block w-full px-4 py-3
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
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
};


