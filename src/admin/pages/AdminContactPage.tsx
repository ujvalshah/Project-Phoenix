
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminContactMessage } from '../types/admin';
import { adminContactService } from '@/admin/services/adminContactService';
import { Check, Archive, Reply, Mail } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminHeader } from '../layout/AdminLayout';

type ContactFilter = 'new' | 'read' | 'replied' | 'archived' | 'all';

export const AdminContactPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [messages, setMessages] = useState<AdminContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ContactFilter>('new');
  const [dateFilter, setDateFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setPageHeader(
      "Contact Messages",
      "Manage incoming contact form messages.",
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl items-center gap-2">
        <div className="flex">
          {(['new', 'read', 'replied', 'archived', 'all'] as ContactFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-bold capitalize rounded-lg transition-all ${filter === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              {s === 'all' ? 'All' : s}
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
  }, [filter, dateFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await adminContactService.listMessages(filter);

      let filtered = data;
      if (dateFilter) {
        const d = new Date(dateFilter).toDateString();
        filtered = data.filter(m => new Date(m.createdAt).toDateString() === d);
      }

      setMessages(filtered);
      setErrorMessage(null);
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'Request cancelled') {
        setErrorMessage("Could not load messages. Please retry.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter, dateFilter]);

  // Initialize filters from URL
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const date = searchParams.get('date');
    if (statusParam === 'new' || statusParam === 'read' || statusParam === 'replied' || statusParam === 'archived' || statusParam === 'all') {
      setFilter(statusParam as ContactFilter);
    }
    if (date) setDateFilter(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filter) params.status = filter;
    if (dateFilter) params.date = dateFilter;
    setSearchParams(params, { replace: true });
  }, [filter, dateFilter, setSearchParams]);

  const handleStatus = async (id: string, status: 'read' | 'replied' | 'archived') => {
    const item = messages.find(m => m.id === id);
    if (!item) return;

    const previousMessages = [...messages];

    // Optimistic update
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, status } : m
    ));

    try {
      await adminContactService.updateStatus(id, status);

      const label = status === 'read'
        ? 'Marked as read'
        : status === 'replied'
          ? 'Marked as replied'
          : 'Archived';

      // Undo for non-archive actions
      if (status !== 'archived') {
        toast.success(label, {
          duration: 5000,
          actionLabel: 'Undo',
          onAction: async () => {
            try {
              const previousStatus = item.status as 'new' | 'read' | 'replied' | 'archived';
              await adminContactService.updateStatus(id, previousStatus);
              setMessages(prev => prev.map(m =>
                m.id === id ? { ...m, status: previousStatus } : m
              ));
              toast.success('Changes reverted');
            } catch {
              toast.error('Failed to undo. Please refresh the page.');
            }
          }
        });
      } else {
        toast.success(label);
      }
    } catch {
      setMessages(previousMessages);
      toast.error("Update failed. Changes reverted.");
    }
  };

  const columns: Column<AdminContactMessage>[] = [
    {
      key: 'sender',
      header: 'Sender',
      width: 'w-48',
      render: (m) => (
        <div>
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400 shrink-0" />
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 pl-[22px]">{m.email}</p>
        </div>
      )
    },
    {
      key: 'subject',
      header: 'Subject',
      width: 'w-48',
      render: (m) => (
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate block">
          {m.subject}
        </span>
      )
    },
    {
      key: 'message',
      header: 'Message',
      render: (m) => (
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
          {m.message}
        </p>
      )
    },
    {
      key: 'date',
      header: 'Date',
      width: 'w-32',
      render: (m) => <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</span>
    },
    {
      key: 'time',
      header: 'Time',
      width: 'w-24',
      render: (m) => <span className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-32',
      render: (m) => (
        <div className="flex justify-end gap-2">
          {m.status === 'new' && (
            <button
              aria-label="Mark as read"
              onClick={() => handleStatus(m.id, 'read')}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              title="Mark Read"
            >
              <Check size={14} />
            </button>
          )}
          {m.status === 'read' && (
            <button
              aria-label="Mark as replied"
              onClick={() => handleStatus(m.id, 'replied')}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              title="Mark Replied"
            >
              <Reply size={14} />
            </button>
          )}
          {m.status !== 'archived' && (
            <button
              aria-label="Archive message"
              onClick={() => handleStatus(m.id, 'archived')}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              title="Archive"
            >
              <Archive size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorMessage}</span>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filter:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(['new', 'read', 'replied', 'archived', 'all'] as ContactFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold capitalize rounded-md transition-all ${
                  filter === s
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-2">
          <label htmlFor="contact-date-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Date:
          </label>
          <input
            id="contact-date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              title="Clear date filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <AdminTable columns={columns} data={messages} isLoading={isLoading} virtualized />
    </div>
  );
};
