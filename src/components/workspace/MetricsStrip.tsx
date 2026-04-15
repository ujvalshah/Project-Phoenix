import React from 'react';

export interface LibraryMetric {
  id: string;
  label: string;
  value: number | string;
}

interface MetricsStripProps {
  metrics: LibraryMetric[];
}

export const MetricsStrip: React.FC<MetricsStripProps> = ({ metrics }) => {
  return (
    <div
      className="flex flex-wrap items-baseline gap-y-2 border-b border-slate-200/50 py-3 dark:border-slate-800/60"
      aria-label="Library summary"
    >
      {metrics.map((m, i) => (
        <div
          key={m.id}
          className={[
            'flex items-baseline gap-2 pr-6',
            i > 0 ? 'border-l border-slate-200/60 pl-6 dark:border-slate-700/80' : '',
          ].join(' ')}
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {m.label}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
          </span>
        </div>
      ))}
    </div>
  );
};
