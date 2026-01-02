import React from 'react';
import { X } from 'lucide-react';

type BadgeVariant = 'primary' | 'outline' | 'success' | 'danger' | 'neutral' | 'purple' | 'orange' | 'category';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onRemove?: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ 
  label, 
  variant = 'neutral', 
  className = '', 
  onClick,
  onRemove,
  icon
}) => {
  
  const variants = {
    primary: 'bg-primary-100 text-primary-900 border border-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-100',
    category: 'bg-primary-50 text-primary-600 border border-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-400',
    outline: 'bg-transparent border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400 hover:border-slate-300',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
    success: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
    danger: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300',
  };

  // Support rounded-full override from className (for feed sidebar tags)
  const roundedClass = className?.includes('rounded-full') ? 'rounded-full' : 'rounded-md';
  const baseStyles = `
    inline-flex items-center px-2.5 py-1 ${roundedClass} text-xs font-bold transition-all duration-200
    ${variants[variant]}
    ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
    ${className}
  `;

  return (
    <span 
      className={baseStyles}
      onClick={onClick}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {label}
      {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="ml-1 p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
};


