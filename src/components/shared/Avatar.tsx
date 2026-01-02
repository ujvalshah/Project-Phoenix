import React from 'react';
import { getInitials } from '@/utils/formatters';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-24 h-24 text-3xl',
};

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className = '' }) => {
  const sizeClass = SIZE_CLASSES[size];

  if (src) {
    return (
      <img 
        src={src} 
        alt={name} 
        className={`rounded-full object-cover ${sizeClass} ${className}`} 
      />
    );
  }

  return (
    <div 
      className={`
        rounded-full flex items-center justify-center font-bold 
        bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300
        ${sizeClass} ${className}
      `}
    >
      {getInitials(name)}
    </div>
  );
};


