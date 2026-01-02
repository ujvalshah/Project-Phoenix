
import React, { useEffect, useState, useMemo } from 'react';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminActivityEvent } from '../types/admin';
import { adminActivityService } from '../services/adminActivityService';
import { Activity, ShieldAlert, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Avatar } from '@/components/shared/Avatar';
import { formatDate } from '@/utils/formatters';
import { useAdminHeader } from '../layout/AdminLayout';

export const AdminActivityLogPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [logs, setLogs] = useState<AdminActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'info' | 'warning' | 'danger' | 'success'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toast = useToast();

  useEffect(() => {
    setPageHeader("Activity Log", "Audit trail of administrative actions.");
  }, []);

  useEffect(() => {
    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await adminActivityService.listActivityEvents();
            setLogs(data);
        } catch (e) {
            toast.error("Failed to load activity logs");
        } finally {
            setIsLoading(false);
        }
    };
    loadLogs();
  }, []);

  const processedLogs = useMemo(() => {
    let result = [...logs];

    // Filter
    if (typeFilter !== 'all') {
        result = result.filter(l => l.type === typeFilter);
    }
    if (dateFilter) {
      const d = new Date(dateFilter).toDateString();
      result = result.filter(l => new Date(l.timestamp).toDateString() === d);
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(l => 
            l.action.toLowerCase().includes(q) || 
            l.actor.name.toLowerCase().includes(q) ||
            (l.target && l.target.toLowerCase().includes(q))
        );
    }

    // Sort
    result.sort((a, b) => {
        let valA: any = a[sortKey as keyof AdminActivityEvent] || '';
        let valB: any = b[sortKey as keyof AdminActivityEvent] || '';

        if (sortKey === 'actor') {
            valA = a.actor.name.toLowerCase();
            valB = b.actor.name.toLowerCase();
        } else if (sortKey === 'timestamp') {
            valA = new Date(a.timestamp).getTime();
            valB = new Date(b.timestamp).getTime();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
  }, [logs, typeFilter, dateFilter, searchQuery, sortKey, sortDirection]);

  const columns: Column<AdminActivityEvent>[] = [
    {
        key: 'actor',
        header: 'Actor',
        width: 'w-48',
        minWidth: '200px',
        sticky: 'left',
        sortable: true,
        render: (l) => (
            <div className="flex items-center gap-3">
                <Avatar name={l.actor.name} size="xs" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{l.actor.name}</span>
            </div>
        )
    },
    {
        key: 'action',
        header: 'Action',
        width: 'w-48',
        minWidth: '200px',
        render: (l) => <span className="font-medium text-slate-900 dark:text-white capitalize">{l.action}</span>
    },
    {
        key: 'target',
        header: 'Target',
        width: 'w-40',
        minWidth: '150px',
        render: (l) => l.target ? (
            <span className="inline-flex px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
                {l.target}
            </span>
        ) : <span className="text-slate-300">-</span>
    },
    {
        key: 'type',
        header: 'Type',
        width: 'w-24',
        minWidth: '100px',
        render: (l) => {
            const config = {
                danger: { color: 'text-red-600 bg-red-50', icon: <ShieldAlert size={14} /> },
                warning: { color: 'text-amber-600 bg-amber-50', icon: <AlertTriangle size={14} /> },
                success: { color: 'text-green-600 bg-green-50', icon: <CheckCircle2 size={14} /> },
                info: { color: 'text-blue-600 bg-blue-50', icon: <Info size={14} /> },
            }[l.type];
            return (
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold capitalize ${config.color} dark:bg-opacity-20`}>
                    {config.icon} {l.type}
                </span>
            );
        }
    },
    {
        key: 'date',
        header: 'Date',
        width: 'w-32',
        minWidth: '120px',
        sortable: true,
        sortKey: 'timestamp',
        render: (l) => <span className="text-xs text-slate-500">{new Date(l.timestamp).toLocaleDateString()}</span>
    },
    {
        key: 'time',
        header: 'Time',
        width: 'w-24',
        minWidth: '100px',
        render: (l) => <span className="text-xs text-slate-400">{new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    }
  ];

  const Filters = (
      <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg gap-2">
          <div className="flex">
            {['all', 'info', 'warning', 'danger', 'success'].map(t => (
                <button
                    key={t}
                    onClick={() => setTypeFilter(t as any)}
                    className={`px-3 py-1.5 text-[10px] font-bold capitalize rounded-md transition-all ${typeFilter === t ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {t}
                </button>
            ))}
          </div>
          <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-3 pr-2 py-1.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
      </div>
  );

  return (
    <div>
      <AdminSummaryBar 
        items={[
            { label: 'Total Events', value: logs.length, icon: <Activity size={18} /> },
            { label: 'Critical Events', value: logs.filter(l => l.type === 'danger').length, icon: <ShieldAlert size={18} /> },
        ]}
        isLoading={isLoading}
      />

      <AdminTable 
        columns={columns}
        data={processedLogs}
        isLoading={isLoading}
        filters={Filters}
        onSearch={setSearchQuery}
        placeholder="Search logs..."
        
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
        
      />
    </div>
  );
};
