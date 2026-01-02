import React from 'react';

interface TabOption {
  id: string;
  label: string;
  count?: number;
}

interface TabsBarProps {
  tabs: TabOption[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const TabsBar: React.FC<TabsBarProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="inline-flex items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 space-x-6 shadow-sm">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative text-sm font-medium transition-colors duration-200
              ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1.5 text-xs ${isActive ? 'text-gray-500 dark:text-slate-400' : 'text-gray-400 dark:text-slate-500'}`}>
                {tab.count}
              </span>
            )}
            
            {/* Active Indicator - Yellow accent to match brand */}
            {isActive && (
              <span className="absolute -bottom-[9px] left-0 right-0 h-[2px] bg-yellow-400 rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};
