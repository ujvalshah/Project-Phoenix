import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardContributorProps {
  contributorName: string;
  className?: string;
}

export const CardContributor: React.FC<CardContributorProps> = ({
  contributorName,
  className,
}) => {
  return (
    <div
      className={twMerge(
        '-mx-4 -mb-4 -mt-3 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl flex items-center',
        className
      )}
    >
      <span
        className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate flex-1 min-w-0"
        title={`Added by ${contributorName}`}
      >
        Added by <span className="text-slate-600 dark:text-slate-300">{contributorName}</span>
      </span>
    </div>
  );
};











