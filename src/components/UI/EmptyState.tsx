import React from 'react';

interface EmptyStateProps {
  icon: React.ReactElement<any>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  action, 
  className = '' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in duration-500 ${className}`}>
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm text-slate-400 dark:text-slate-500">
        {React.cloneElement(icon, { size: 40 })}
      </div>
      
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      
      <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};


