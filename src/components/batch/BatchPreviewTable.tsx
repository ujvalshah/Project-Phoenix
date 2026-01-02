import React from 'react';
import { BatchRow } from '@/types/batch';
import { ExternalLink, Trash2, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

interface BatchPreviewTableProps {
  rows: BatchRow[];
  onUpdateRow: (id: string, updates: Partial<BatchRow>) => void;
  onRemoveRow: (id: string) => void;
  onRetryRow: (id: string) => void;
}

export const BatchPreviewTable: React.FC<BatchPreviewTableProps> = ({ 
  rows, 
  onUpdateRow, 
  onRemoveRow,
  onRetryRow
}) => {
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-auto custom-scrollbar max-h-[600px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500 font-bold tracking-wider sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                    type="checkbox" 
                    checked={rows.length > 0 && rows.every(r => r.selected)}
                    onChange={(e) => rows.forEach(r => onUpdateRow(r.id, { selected: e.target.checked }))}
                    className="rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                />
              </th>
              <th className="px-4 py-3 w-8">Status</th>
              <th className="px-4 py-3 min-w-[200px]">URL & Title</th>
              <th className="px-4 py-3 min-w-[200px]">Excerpt / Note</th>
              <th className="px-4 py-3 w-40">Categories</th>
              <th className="px-4 py-3 w-28">Visibility</th>
              <th className="px-4 py-3 w-12">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!row.selected ? 'opacity-50' : ''}`}>
                
                {/* Checkbox */}
                <td className="px-4 py-3 align-top pt-4">
                  <input 
                    type="checkbox" 
                    checked={row.selected}
                    onChange={(e) => onUpdateRow(row.id, { selected: e.target.checked })}
                    disabled={row.status === 'success'}
                    className="rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                  />
                </td>

                {/* Status Icon */}
                <td className="px-4 py-3 align-top pt-4">
                  {row.status === 'fetching' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                  {row.status === 'ready' && <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" title="Ready" />}
                  {row.status === 'success' && <CheckCircle2 size={18} className="text-green-500" />}
                  {row.status === 'error' && (
                    <div title={row.errorMessage}>
                      <AlertCircle size={18} className="text-red-500" aria-label={row.errorMessage} />
                    </div>
                  )}
                  {row.status === 'pending' && <div className="w-3 h-3 rounded-full border border-slate-300" />}
                </td>

                {/* URL & Title */}
                <td className="px-4 py-3 align-top space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 max-w-[250px]">
                    <a href={row.url} target="_blank" rel="noreferrer" className="truncate hover:underline" title={row.url}>{row.url}</a>
                    <ExternalLink size={10} className="shrink-0" />
                  </div>
                  <input 
                    type="text" 
                    value={row.title}
                    onChange={(e) => onUpdateRow(row.id, { title: e.target.value })}
                    placeholder="Enter title..."
                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none py-1 text-sm font-bold text-slate-900 dark:text-white transition-colors"
                  />
                  {row.status === 'error' && (
                      <p className="text-[10px] text-red-500">{row.errorMessage}</p>
                  )}
                </td>

                {/* Content */}
                <td className="px-4 py-3 align-top">
                    <textarea 
                        value={row.content}
                        onChange={(e) => onUpdateRow(row.id, { content: e.target.value })}
                        placeholder="Add a note or excerpt..."
                        rows={2}
                        className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary-500 rounded-lg p-1.5 text-xs focus:outline-none text-slate-600 dark:text-slate-300 resize-none transition-colors"
                    />
                </td>

                {/* Categories */}
                <td className="px-4 py-3 align-top">
                    <input 
                        type="text" 
                        value={row.categories.join(', ')}
                        onChange={(e) => onUpdateRow(row.id, { categories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="tech, news..."
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary-500 focus:outline-none py-1 text-xs text-slate-700 dark:text-slate-300 transition-colors"
                    />
                </td>

                {/* Visibility */}
                <td className="px-4 py-3 align-top pt-3">
                    <select 
                        value={row.visibility}
                        onChange={(e) => onUpdateRow(row.id, { visibility: e.target.value as 'public' | 'private' })}
                        className="bg-transparent text-xs font-medium text-slate-600 dark:text-slate-400 focus:outline-none cursor-pointer"
                    >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 align-top pt-3 text-right">
                    <div className="flex justify-end gap-2">
                        {row.status === 'error' && (
                            <button onClick={() => onRetryRow(row.id)} className="text-slate-400 hover:text-blue-500 transition-colors">
                                <RefreshCw size={16} />
                            </button>
                        )}
                        <button onClick={() => onRemoveRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
