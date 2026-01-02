import React from 'react';

interface SummaryItem {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}

interface AdminSummaryBarProps {
  items: SummaryItem[];
  isLoading?: boolean;
}

export const AdminSummaryBar: React.FC<AdminSummaryBarProps> = ({ items, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
      {items.map((item, index) => (
        <div 
          key={index} 
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
            {item.icon && <div className="text-slate-400 dark:text-slate-500">{item.icon}</div>}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{item.value}</div>
            {item.hint && <div className="text-[10px] font-medium text-slate-400 mt-1">{item.hint}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};
