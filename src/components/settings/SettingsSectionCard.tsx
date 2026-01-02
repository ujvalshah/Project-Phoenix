
import React from 'react';

interface SettingsSectionCardProps {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const SettingsSectionCard: React.FC<SettingsSectionCardProps> = ({
  id,
  title,
  description,
  children,
  rightAction,
  icon,
  className = ''
}) => {
  return (
    <section 
      id={id}
      className={`
        relative overflow-hidden
        bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl
        border border-slate-200/60 dark:border-slate-800/60
        rounded-2xl shadow-sm
        transition-all duration-300
        ${className}
      `}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex gap-4">
            {icon && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 h-fit">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {title}
              </h2>
              {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                  {description}
                </p>
              )}
            </div>
          </div>
          {rightAction && (
            <div className="shrink-0 ml-4">
              {rightAction}
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </section>
  );
};
