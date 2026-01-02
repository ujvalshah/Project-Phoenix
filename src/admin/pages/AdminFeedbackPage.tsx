
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminFeedback } from '../types/admin';
import { adminFeedbackService } from '@/admin/services/adminFeedbackService';
import { MessageSquare, Check, Archive, Trash2, User } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/utils/formatters';
import { Avatar } from '@/components/shared/Avatar';
import { useAdminHeader } from '../layout/AdminLayout';

type FeedbackFilter = 'new' | 'read' | 'archived' | 'all';

export const AdminFeedbackPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [feedback, setFeedback] = useState<AdminFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FeedbackFilter>('new');
  const [dateFilter, setDateFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setPageHeader(
      "User Feedback", 
      "Listen to your users.",
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl items-center gap-2">
          <div className="flex">
              {(['new', 'read', 'archived', 'all'] as FeedbackFilter[]).map(s => (
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
      const data = await adminFeedbackService.listFeedback(filter);
      
      let filtered = data;
      if (dateFilter) {
          const d = new Date(dateFilter).toDateString();
          filtered = data.filter(f => new Date(f.createdAt).toDateString() === d);
      }

      setFeedback(filtered);
      setErrorMessage(null);
    } catch (e: any) {
      if (e.message !== 'Request cancelled') {
        setErrorMessage("Could not load feedback. Please retry.");
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
    if (statusParam === 'new' || statusParam === 'read' || statusParam === 'archived' || statusParam === 'all') {
      setFilter(statusParam as FeedbackFilter);
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

  const handleStatus = async (id: string, status: 'read' | 'archived') => {
      // Find the item being updated
      const item = feedback.find(f => f.id === id);
      if (!item) return;
      
      const previousStatus = item.status;
      const previousFeedback = [...feedback];
      
      // Optimistically update the item's status in state
      setFeedback(prev => prev.map(f => 
        f.id === id ? { ...f, status } : f
      ));
      
      try {
        await adminFeedbackService.updateStatus(id, status);
        
        // Show success message with appropriate text
        const message = status === 'read' 
          ? 'Feedback marked as resolved' 
          : 'Feedback archived';
        
        // Show toast with undo option (only for 'read' status, not archived)
        if (status === 'read') {
          toast.success(message, {
            duration: 5000,
            actionLabel: 'Undo',
            onAction: async () => {
              try {
                // Revert to 'new' status (since we're undoing a 'read' action)
                await adminFeedbackService.updateStatus(id, 'new');
                setFeedback(prev => prev.map(f => 
                  f.id === id ? { ...f, status: 'new' } : f
                ));
                toast.success('Changes reverted');
              } catch (e) {
                toast.error('Failed to undo. Please refresh the page.');
              }
            }
          });
        } else {
          toast.success(message);
        }
      } catch (e) {
        // Rollback on failure
        setFeedback(previousFeedback);
        toast.error("Update failed. Changes reverted.");
      }
  };

  const columns: Column<AdminFeedback>[] = [
    {
      key: 'type',
      header: 'Type',
      width: 'w-24',
      render: (f) => (
        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
            f.type === 'bug' ? 'bg-red-100 text-red-600' :
            f.type === 'feature' ? 'bg-purple-100 text-purple-600' :
            'bg-slate-100 text-slate-600'
        }`}>
            {f.type}
        </span>
      )
    },
    {
      key: 'content',
      header: 'Feedback',
      render: (f) => <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{f.content}</p>
    },
    {
      key: 'user',
      header: 'User',
      width: 'w-56',
      render: (f) => f.user ? (
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${f.user!.id}`); }}
          >
              <Avatar name={f.user.name} size="sm" src={f.user.avatar} />
              <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary-600 group-hover:underline">{f.user.fullName || f.user.name}</div>
                  <div className="text-[10px] text-slate-500">@{f.user.username}</div>
              </div>
          </div>
      ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
              <User size={14} /> Anonymous
          </div>
      )
    },
    {
      key: 'date',
      header: 'Date',
      width: 'w-32',
      render: (f) => <span className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString()}</span>
    },
    {
      key: 'time',
      header: 'Time',
      width: 'w-24',
      render: (f) => <span className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-32',
      render: (f) => (
          <div className="flex justify-end gap-2">
              {f.status === 'new' && (
                <button 
                  aria-label="Mark feedback as read"
                  onClick={() => handleStatus(f.id, 'read')} 
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2" 
                  title="Mark Read"
                >
                  <Check size={14} />
                </button>
              )}
              {f.status !== 'archived' && (
                <button 
                  aria-label="Archive feedback"
                  onClick={() => handleStatus(f.id, 'archived')} 
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
      
      {/* Filter controls - visible above table */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filter:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(['new', 'read', 'archived', 'all'] as FeedbackFilter[]).map(s => (
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
          <label htmlFor="date-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Date:
          </label>
          <input 
            id="date-filter"
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
      
      <AdminTable columns={columns} data={feedback} isLoading={isLoading} virtualized />
    </div>
  );
};
