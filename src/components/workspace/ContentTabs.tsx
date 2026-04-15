import React from 'react';

export interface ContentTabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface ContentTabsProps {
  tabs: ContentTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

export const ContentTabs: React.FC<ContentTabsProps> = ({ tabs, activeId, onChange, ariaLabel }) => {
  return (
    <div
      className="inline-flex rounded border border-slate-200/70 bg-slate-100/50 p-px dark:border-slate-800 dark:bg-slate-900/40"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`library-panel-${tab.id}`}
            id={`library-tab-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={[
              'min-h-[40px] min-w-[44px] rounded-sm px-3.5 py-2 text-sm font-medium motion-safe:transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-200',
              selected
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
              tab.disabled ? 'cursor-not-allowed opacity-40' : '',
            ].join(' ')}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 tabular-nums text-xs font-normal ${
                  selected ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
