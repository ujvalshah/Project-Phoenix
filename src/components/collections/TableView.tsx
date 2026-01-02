import React from 'react';
import { Collection } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Tooltip } from '../UI/Tooltip';
import { Info, Lock, Folder, ChevronRight } from 'lucide-react';

interface TableViewProps {
  collections: Collection[];
  onClick: (id: string) => void;
}

export const TableView: React.FC<TableViewProps> = ({ collections, onClick }) => {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 font-bold tracking-wider">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">#</th>
                            <th className="px-4 py-3">Collection Name</th>
                            <th className="px-4 py-3 w-32">Created</th>
                            <th className="px-4 py-3 w-32">
                                <div className="flex items-center gap-1">
                                    Last Updated
                                    <Tooltip content="Date when the last nugget was added.">
                                        <Info size={12} className="text-slate-400 cursor-help" />
                                    </Tooltip>
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center w-24">Nuggets</th>
                            <th className="px-4 py-3 text-center w-24">Followers</th>
                            <th className="px-4 py-3 text-right w-16">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {collections.map((col, index) => (
                            <tr key={col.id} onClick={() => onClick(col.id)} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{index + 1}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-md ${col.type === 'private' ? 'bg-slate-100 text-slate-500' : 'bg-primary-50 text-primary-600'} dark:bg-slate-800`}>
                                            {col.type === 'private' ? <Lock size={14} /> : <Folder size={14} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors text-sm">{col.name}</div>
                                            {col.description && <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[250px]">{col.description}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(col.createdAt, false)}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs font-medium">{col.updatedAt ? formatDate(col.updatedAt, false) : '—'}</td>
                                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-medium text-xs">
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                                        {col.validEntriesCount ?? col.entries?.length ?? 0}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-medium text-xs">
                                    {col.followersCount ?? 0}
                                </td>
                                <td className="px-4 py-3 text-right"><div className="flex justify-end text-slate-300 group-hover:text-primary-500 transition-colors"><ChevronRight size={16} /></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
