
import React, { useState, useEffect } from 'react';
import { Download, Save, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminHeader } from '../layout/AdminLayout';

export const AdminDownloadsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [entity, setEntity] = useState<'users' | 'nuggets'>('users');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    setPageHeader("Data Export", "Create custom reports and download data.");
  }, []);

  const userCols = ['id', 'name', 'email', 'role', 'status', 'joinedAt', 'nuggets_count'];
  const nuggetCols = ['id', 'title', 'author', 'visibility', 'createdAt', 'reports_count'];

  const handleDownload = () => {
      toast.success(`Downloading ${entity} report...`);
  };

  const toggleCol = (c: string) => {
      if (selectedColumns.includes(c)) setSelectedColumns(selectedColumns.filter(x => x !== c));
      else setSelectedColumns([...selectedColumns, c]);
  };

  return (
    <div>
      <div className="max-w-2xl bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Entity</label>
              <div className="flex gap-3">
                  <button onClick={() => { setEntity('users'); setSelectedColumns([]); }} className={`px-4 py-2 rounded-lg text-sm font-bold border ${entity === 'users' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-slate-200 text-slate-600'}`}>Users</button>
                  <button onClick={() => { setEntity('nuggets'); setSelectedColumns([]); }} className={`px-4 py-2 rounded-lg text-sm font-bold border ${entity === 'nuggets' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-slate-200 text-slate-600'}`}>Nuggets</button>
              </div>
          </div>

          <div className="mb-8">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Columns</label>
              <div className="grid grid-cols-3 gap-3">
                  {(entity === 'users' ? userCols : nuggetCols).map(col => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100">
                          <input type="checkbox" checked={selectedColumns.includes(col)} onChange={() => toggleCol(col)} className="rounded text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{col.replace('_', ' ')}</span>
                      </label>
                  ))}
              </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
              <button className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-slate-800">
                  <Save size={16} /> Save Template
              </button>
              <button onClick={handleDownload} disabled={selectedColumns.length === 0} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50">
                  <Download size={16} /> Download CSV
              </button>
          </div>
      </div>
    </div>
  );
};
