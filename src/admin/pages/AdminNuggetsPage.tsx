
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminNugget } from '../types/admin';
import { adminNuggetsService } from '../services/adminNuggetsService';
import { AlertTriangle, Trash2, EyeOff, Globe, Lock, Video, Image as ImageIcon, Link as LinkIcon, StickyNote, CheckCircle2, FileText, PlusCircle, Edit2, Layout } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { AdminDrawer } from '../components/AdminDrawer';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { useAdminHeader } from '../layout/AdminLayout';
import { useSearchParams } from 'react-router-dom';
import { CreateNuggetModal } from '@/components/CreateNuggetModal';
import { storageService } from '@/services/storageService';
import { Article } from '@/types';

export const AdminNuggetsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [nuggets, setNuggets] = useState<AdminNugget[]>([]);
  const [stats, setStats] = useState({ total: 0, flagged: 0, createdToday: 0, public: 0, private: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden' | 'flagged'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Sorting
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection & UI
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'title', 'author', 'visibility', 'status', 'createdDate', 'createdTime', 'actions'
  ]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Actions
  const [selectedNugget, setSelectedNugget] = useState<AdminNugget | null>(null);
  const [itemToDelete, setItemToDelete] = useState<AdminNugget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nugget: AdminNugget; timeoutId: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [articleToEdit, setArticleToEdit] = useState<Article | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [articleLoadError, setArticleLoadError] = useState<string | null>(null);

  const toast = useToast();
  const { can } = useAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setPageHeader("Content Management", "Review, moderate, and manage nuggets.");
  }, []);

  // Initialize filters from URL
  useEffect(() => {
    const q = searchParams.get('q');
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    if (q) setSearchQuery(q);
    if (status === 'active' || status === 'hidden' || status === 'flagged') setStatusFilter(status);
    if (date) setDateFilter(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (dateFilter) params.date = dateFilter;
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, dateFilter, setSearchParams]);

  // Memoize loadData to prevent recreation on every render
  // This prevents infinite loops in useEffect dependencies
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [nuggetsData, statsData] = await Promise.all([
        adminNuggetsService.listNuggets(statusFilter === 'all' ? undefined : statusFilter as any),
        adminNuggetsService.getStats()
      ]);
      
      // Validate data before setting state
      if (!Array.isArray(nuggetsData)) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Invalid nuggets data:', nuggetsData);
        }
        setErrorMessage("Invalid data received from server. Please retry.");
        return;
      }
      
      if (!statsData || typeof statsData !== 'object') {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Invalid stats data:', statsData);
        }
        setErrorMessage("Invalid stats data received from server. Please retry.");
        return;
      }
      
      setNuggets(nuggetsData);
      setStats(statsData);
      setErrorMessage(null);
    } catch (e: any) {
      if (e.message !== 'Request cancelled') {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Error loading data:', e);
        }
        setErrorMessage(`Could not load nuggets: ${e.message || 'Unknown error'}. Please retry.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]); // Only recreate when statusFilter changes

  // Load data when statusFilter changes, with debounce
  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]); // Now safe to include loadData since it's memoized

  // Derived state
  const processedNuggets = useMemo(() => {
    let result = [...nuggets];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n => 
        n.title.toLowerCase().includes(q) || 
        n.author.name.toLowerCase().includes(q)
      );
    }

    // Filter Date
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      result = result.filter(n => new Date(n.createdAt).toDateString() === filterDate);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof AdminNugget] || '';
      let valB: any = b[sortKey as keyof AdminNugget] || '';

      if (sortKey === 'author.name') {
        valA = a.author.name.toLowerCase();
        valB = b.author.name.toLowerCase();
      } else if (sortKey === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [nuggets, searchQuery, dateFilter, sortKey, sortDirection]);

  // Fetch full article data when entering edit mode
  useEffect(() => {
    const fetchArticleForEdit = async () => {
      if (selectedNugget && editMode) {
        setIsLoadingArticle(true);
        setArticleLoadError(null);
        try {
          const article = await storageService.getArticleById(selectedNugget.id);
          if (article) {
            setArticleToEdit(article);
            setArticleLoadError(null);
          } else {
            setArticleLoadError('Article not found');
            setArticleToEdit(null);
          }
        } catch (error: any) {
          // Don't show error for cancelled requests (they're expected during cleanup)
          if (error?.message !== 'Request cancelled') {
            console.error('[AdminNuggetsPage] Error fetching article:', error);
            setArticleLoadError(error?.message || 'Failed to load nugget data for editing');
            setArticleToEdit(null);
          } else {
            // Request was cancelled - clear error state
            setArticleLoadError(null);
            setArticleToEdit(null);
          }
        } finally {
          setIsLoadingArticle(false);
        }
      } else {
        setArticleToEdit(null);
        setArticleLoadError(null);
      }
    };

    fetchArticleForEdit();
  }, [selectedNugget, editMode]);

  const handleStatusChange = async (nugget: AdminNugget, newStatus: 'active' | 'hidden') => {
    try {
      await adminNuggetsService.updateNuggetStatus(nugget.id, newStatus);
      setNuggets(prev => prev.map(n => n.id === nugget.id ? { ...n, status: newStatus } : n));
      const newStats = await adminNuggetsService.getStats();
      setStats(newStats);
      toast.success(newStatus === 'active' ? 'Nugget Approved' : 'Nugget Hidden');
    } catch (e) {
      toast.error("Action failed");
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const nugget = itemToDelete;
    // Optimistic remove; commit after 5s unless undone
    setNuggets(prev => prev.filter(n => n.id !== nugget.id));
    setItemToDelete(null);
    const timeoutId = window.setTimeout(async () => {
      try {
        await adminNuggetsService.deleteNugget(nugget.id);
        const newStats = await adminNuggetsService.getStats();
        setStats(newStats);
        setPendingDelete(null);
        toast.success("Nugget deleted");
      } catch (e) {
        // rollback on failure
        setNuggets(prev => [...prev, nugget]);
        setPendingDelete(null);
        toast.error("Delete failed. Changes reverted.");
      }
    }, 5000);
    setPendingDelete({ nugget, timeoutId });
  };

  // Memoize handleBulkAction to prevent recreation on every render
  const handleBulkAction = useCallback((action: string) => {
      toast.info(`${action} ${selectedIds.length} items (Not implemented)`);
      setSelectedIds([]);
  }, [selectedIds.length, toast]);

  // Memoize getTypeIcon to prevent recreation on every render
  const getTypeIcon = useCallback((type: string) => {
    switch(type) {
        case 'video': return <Video size={14} />;
        case 'image': return <ImageIcon size={14} />;
        case 'link': return <LinkIcon size={14} />;
        default: return <StickyNote size={14} />;
    }
  }, []);

  // Memoize columns array to prevent AdminTable re-renders
  // Columns are stable and don't depend on component state
  const allColumns: Column<AdminNugget>[] = useMemo(() => [
    {
      key: 'id',
      header: 'ID',
      width: 'w-20',
      minWidth: '80px',
      render: (n) => <span className="text-[10px] font-mono text-slate-400">#{n.id.split('-')[1]}</span>
    },
    {
      key: 'title',
      header: 'Title & Snippet',
      width: 'w-72',
      minWidth: '280px',
      sortable: true,
      sticky: 'left',
      render: (n) => (
        <div className="flex gap-3 py-1">
          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${n.status === 'flagged' ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {getTypeIcon(n.type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400 truncate group-hover:text-indigo-500 transition-colors">
              {n.title || 'Untitled'}
            </div>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{n.excerpt || 'No description'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'author',
      header: 'Author',
      width: 'w-40',
      minWidth: '150px',
      sortable: true,
      sortKey: 'author.name',
      render: (n) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{n.author.name}</span>
      )
    },
    {
      key: 'visibility',
      header: 'Visibility',
      width: 'w-28',
      minWidth: '100px',
      sortable: true,
      render: (n) => (
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
            {n.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
            {n.visibility}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      render: (n) => (
        <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold capitalize border ${n.status === 'flagged' ? 'bg-red-50 text-red-700 border-red-200' : n.status === 'hidden' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {n.status === 'flagged' && <AlertTriangle size={8} />}
                {n.status}
            </span>
            {n.reports > 0 && (
                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 rounded-full">{n.reports} reports</span>
            )}
        </div>
      )
    },
    {
      key: 'createdDate',
      header: 'Created Date',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      sortKey: 'createdAt',
      render: (n) => <span className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
    },
    {
      key: 'createdTime',
      header: 'Time',
      width: 'w-24',
      minWidth: '100px',
      render: (n) => <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-32',
      minWidth: '130px',
      sticky: 'right',
      render: (n) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => { 
              setSelectedNugget(n); 
              setEditMode(true); 
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 rounded-md text-[10px] font-bold transition-colors"
            title="Edit Nugget"
          >
            <Edit2 size={14} />
            <span className="hidden md:inline">Edit</span>
          </button>
          
          {can('admin.nuggets.hide') && (
            <button 
              onClick={() => handleStatusChange(n, n.status === 'active' ? 'hidden' : 'active')} 
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold border transition-colors ${n.status === 'active' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-green-50 border-green-100 text-green-700 hover:bg-green-100'}`}
              title={n.status === 'active' ? "Hide Content" : "Approve Content"}
            >
              {n.status === 'active' ? <EyeOff size={14} /> : <CheckCircle2 size={14} />}
            </button>
          )}
          {can('admin.nuggets.delete') && (
            <button 
              onClick={() => setItemToDelete(n)} 
              className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-md text-[10px] font-bold transition-colors"
              title="Delete Permanently"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ], [getTypeIcon, can]); // Memoize columns - only recreate if getTypeIcon or can changes

  const activeColumns = useMemo(() => 
    allColumns.filter(c => visibleColumns.includes(c.key)), 
    [allColumns, visibleColumns]
  );

  // Memoize Filters JSX to prevent re-renders
  const Filters = useMemo(() => (
    <div className="flex items-center gap-2">
      <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="text-[10px] bg-transparent font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer px-2 py-1">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="flagged">Flagged</option>
        </select>
      </div>

      <div className="relative flex items-center">
        <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-3 pr-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="relative">
        <button 
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            aria-label="Toggle column visibility"
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
            <Layout size={12} /> Columns
        </button>
        {showColumnMenu && (
            <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {allColumns.filter(c => c.key !== 'title' && c.key !== 'actions').map(col => (
                        <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={visibleColumns.includes(col.key)}
                                onChange={(e) => {
                                    if (e.target.checked) setVisibleColumns([...visibleColumns, col.key]);
                                    else setVisibleColumns(visibleColumns.filter(k => k !== col.key));
                                }}
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{col.header}</span>
                        </label>
                    ))}
                </div>
            </>
        )}
      </div>
    </div>
  ), [statusFilter, dateFilter, showColumnMenu, visibleColumns, allColumns]);

  // Memoize BulkActions to prevent re-renders
  const BulkActions = useMemo(() => selectedIds.length > 0 ? (
      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-xs font-bold text-slate-500">{selectedIds.length} selected</span>
          <button onClick={() => handleBulkAction('approve')} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[10px] font-bold transition-colors">Approve</button>
          <button onClick={() => handleBulkAction('hide')} className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition-colors">Hide</button>
          <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors">Delete</button>
      </div>
  ) : null, [selectedIds.length, handleBulkAction]);

  return (
    <div className="space-y-4">
      {pendingDelete && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Deleted "{pendingDelete.nugget.title || 'nugget'}". Undo?</span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                clearTimeout(pendingDelete.timeoutId);
                setNuggets(prev => [pendingDelete.nugget, ...prev]);
                setPendingDelete(null);
              }}
              className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
            >
              Undo
            </button>
            <span className="text-[10px] text-slate-500">5s</span>
          </div>
        </div>
      )}
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

      <AdminSummaryBar 
        items={[
          { label: 'Total Nuggets', value: stats.total, icon: <FileText size={18} /> },
          { label: 'Public', value: stats.public, icon: <Globe size={18} /> },
          { label: 'Private', value: stats.private, icon: <Lock size={18} /> },
          { label: 'Created Today', value: stats.createdToday, icon: <PlusCircle size={18} />, hint: 'New content velocity' },
        ]}
        isLoading={isLoading}
      />

      <AdminTable 
        columns={activeColumns} 
        data={processedNuggets} 
        isLoading={isLoading} 
        filters={Filters} 
        actions={BulkActions}
        onSearch={setSearchQuery} 
        virtualized
        emptyState={
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No nuggets match the current filters.</p>
            <p className="text-xs text-slate-400">Try clearing search, status, or date filters.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setDateFilter(''); loadData(); }}
                className="px-3 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Clear filters
              </button>
              <button
                onClick={loadData}
                className="px-3 py-1 text-xs font-bold rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        }
        
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}

        onRowClick={(n) => { setEditMode(false); setSelectedNugget(n); }}
        selection={{
            enabled: true,
            selectedIds: selectedIds,
            onSelect: setSelectedIds
        }}
      />
      
      {/* View-only drawer - only show when NOT in edit mode */}
      <AdminDrawer 
        isOpen={!!selectedNugget && !editMode && !isLoadingArticle} 
        onClose={() => { setSelectedNugget(null); setEditMode(false); setArticleToEdit(null); }} 
        title="Nugget Details" 
        width="lg"
      >
        {selectedNugget && (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-2">{selectedNugget.title || ''}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Posted by {selectedNugget.author.name}</span>
                        <span>•</span>
                        <span>{new Date(selectedNugget.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <div>
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">{selectedNugget.excerpt}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-slate-400 font-bold uppercase mb-1">Status</span>
                        <span className="font-medium capitalize">{selectedNugget.status}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-slate-400 font-bold uppercase mb-1">Reports</span>
                        <span className="font-medium">{selectedNugget.reports}</span>
                    </div>
                </div>
            </div>
        )}
      </AdminDrawer>

      {/* Full-featured Edit Modal */}
      {/* Only show modal when article is loaded AND not loading */}
      {!isLoadingArticle && (
        <CreateNuggetModal
          isOpen={editMode && !!articleToEdit}
          onClose={async () => {
            // Refresh admin list after edit modal closes (handles both save and cancel)
            // The modal already invalidates query cache, but admin page uses direct service calls
            try {
              await loadData();
            } catch (error) {
              console.error('[AdminNuggetsPage] Error refreshing after edit:', error);
            }
            setEditMode(false);
            setSelectedNugget(null);
            setArticleToEdit(null);
          }}
          mode="edit"
          initialData={articleToEdit || undefined}
        />
      )}
      
      {/* Show loading/error state while fetching article */}
      {editMode && (isLoadingArticle || articleLoadError) && (
        <AdminDrawer
          isOpen={true}
          onClose={() => {
            setEditMode(false);
            setSelectedNugget(null);
            setArticleToEdit(null);
            setArticleLoadError(null);
          }}
          title={articleLoadError ? "Error" : "Loading..."}
          width="lg"
        >
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              {articleLoadError ? (
                <>
                  <div className="text-red-500 mb-4">
                    <AlertTriangle size={48} className="mx-auto" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Failed to load nugget</p>
                  <p className="text-xs text-slate-500 mb-4">{articleLoadError}</p>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setSelectedNugget(null);
                      setArticleToEdit(null);
                      setArticleLoadError(null);
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-sm text-slate-500">Loading nugget data for editing...</p>
                </>
              )}
            </div>
          </div>
        </AdminDrawer>
      )}

      <ConfirmActionModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDelete} title="Delete Nugget?" description="Permanently remove this content." actionLabel="Delete" isDestructive />
    </div>
  );
};
