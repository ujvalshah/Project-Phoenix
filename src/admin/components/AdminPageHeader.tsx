
import React from 'react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({ title, description, action }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};
