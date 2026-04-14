import React from 'react';
import { ChevronRight, Folder, Layers } from 'lucide-react';
import { Collection } from '@/types';
import { formatDate } from '@/utils/formatters';

interface CollectionTableProps {
  collections: Collection[];
  taxonomyLabelById: Record<string, string>;
  onClick: (id: string) => void;
}

export const CollectionTable: React.FC<CollectionTableProps> = ({
  collections,
  taxonomyLabelById,
  onClick,
}) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-[calc(100vh-170px)] min-h-[420px] overflow-auto">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[48%]" />
            <col className="w-[26%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <tr className="text-[10.5px] uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400">
              <th className="px-4 py-2.5 font-semibold">Collection</th>
              <th className="px-4 py-2.5 font-semibold">Taxonomy</th>
              <th className="px-3 py-2.5 text-right font-semibold">Nuggets</th>
              <th className="px-4 py-2.5 font-semibold">Updated</th>
              <th className="px-2 py-2.5" aria-label="Open" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {collections.map((collection) => {
              const isChild = Boolean(collection.parentId);
              const taxonomy = taxonomyLabelById[collection.id];
              const nuggetCount = collection.validEntriesCount ?? collection.entries?.length ?? 0;
              return (
                <tr
                  key={collection.id}
                  onClick={() => onClick(collection.id)}
                  className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          isChild
                            ? 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                            : 'border-primary-100 bg-primary-50 text-primary-600 group-hover:border-primary-200 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300'
                        }`}
                      >
                        {isChild ? <Folder size={14} /> : <Layers size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-5 text-slate-900 dark:text-slate-100">
                          {collection.name}
                        </p>
                        <p className="truncate text-[12px] leading-4 text-slate-500 dark:text-slate-400">
                          {collection.description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {taxonomy ? (
                      <span
                        className="inline-flex max-w-full items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        title={taxonomy}
                      >
                        <span className="truncate">{taxonomy}</span>
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <span className="text-[12.5px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {nuggetCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-[12.5px] text-slate-500 dark:text-slate-400">
                    {formatDate(collection.updatedAt || collection.createdAt, false)}
                  </td>
                  <td className="px-2 py-3 text-right align-middle">
                    <ChevronRight
                      size={16}
                      className="ml-auto text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-700 dark:text-slate-600 dark:group-hover:text-slate-200"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
