import React from 'react';

export interface LibraryMetric {
  id: string;
  label: string;
  value: number | string;
}

interface MetricsStripProps {
  metrics: LibraryMetric[];
  className?: string;
}

export const MetricsStrip: React.FC<MetricsStripProps> = ({ metrics, className }) => {
  return (
    <div
      className={[
        'flex flex-wrap items-center gap-y-2',
        className ?? '',
      ].join(' ')}
      aria-label="Library summary"
    >
      {metrics.map((m, i) => (
        <div
          key={m.id}
          className={[
            'flex items-baseline gap-2 pr-5',
            i > 0 ? 'border-l border-slate-200/60 pl-5 dark:border-slate-700/80' : '',
          ].join(' ')}
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {m.label}
          </span>
          <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
          </span>
        </div>
      ))}
    </div>
  );
};
