
import React, { useEffect, useState, useMemo } from 'react';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminCollection } from '../types/admin';
import { adminCollectionsService } from '../services/adminCollectionsService';
import { Eye, Trash2, Lock, Globe, EyeOff, Folder, Layers, Pencil, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { AdminDrawer } from '../components/AdminDrawer';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { useAdminHeader } from '../layout/AdminLayout';
import { useSearchParams } from 'react-router-dom';

export const AdminCollectionsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [stats, setStats] = useState({ totalCommunity: 0, totalNuggetsInCommunity: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<AdminCollection | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Sorting & Filtering
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toast = useToast();
  const { can } = useAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadData = async (q?: string) => {
    setIsLoading(true);
    try {
      const [colsData, statsData] = await Promise.all([
        adminCollectionsService.listCollections(q),
        adminCollectionsService.getStats()
      ]);
      setCollections(colsData);
      setStats(statsData);
      setErrorMessage(null);
    } catch (e: any) {
      if (e.message !== 'Request cancelled') {
        setErrorMessage("Could not load collections. Please retry.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPageHeader("Collections", "Review and manage user collections.");
    loadData();
  }, []);

  // Initialize filters from URL
  useEffect(() => {
    const q = searchParams.get('q');
    const date = searchParams.get('date');
    if (q) setSearchQuery(q);
    if (date) setDateFilter(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (dateFilter) params.date = dateFilter;
    setSearchParams(params, { replace: true });
  }, [searchQuery, dateFilter, setSearchParams]);

  // Derived state
  const processedCollections = useMemo(() => {
    let result = [...collections];
    
    // Date Filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      result = result.filter(c => new Date(c.createdAt).toDateString() === filterDate);
    }

    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof AdminCollection] || '';
      let valB: any = b[sortKey as keyof AdminCollection] || '';

      if (sortKey === 'creator') {
        valA = (a.creator?.name || '').toLowerCase();
        valB = (b.creator?.name || '').toLowerCase();
      } else if (sortKey === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [collections, dateFilter, sortKey, sortDirection]);

  const handleDelete = async () => {
    console.log('[AdminCollectionsPage] handleDelete called', { selectedCollection, isDeleting });
    
    if (!selectedCollection || isDeleting) {
      console.log('[AdminCollectionsPage] Early return - missing collection or already deleting');
      return;
    }
    
    const col = selectedCollection;
    const colId = col.id;
    console.log('[AdminCollectionsPage] Starting delete for collection:', colId);
    
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    
    // Optimistic update - remove from UI immediately
    setCollections(prev => prev.filter(c => c.id !== colId));
    const previousSelected = selectedCollection;
    setSelectedCollection(null);
    
    try {
      console.log('[AdminCollectionsPage] Calling deleteCollection API for:', colId);
      await adminCollectionsService.deleteCollection(colId);
      console.log('[AdminCollectionsPage] Delete successful for:', colId);
      
      // Refresh stats after successful delete
      const newStats = await adminCollectionsService.getStats();
      setStats(newStats);
      toast.success("Collection deleted successfully");
    } catch (e: any) {
      console.error('[AdminCollectionsPage] Delete failed:', {
        error: e,
        message: e?.message,
        status: e?.status,
        response: e?.response,
        requestId: e?.requestId,
        collectionId: colId
      });
      
      // Revert optimistic update on error
      setCollections(prev => {
        // Only add back if not already present
        if (prev.find(c => c.id === colId)) {
          return prev;
        }
        return [...prev, col];
      });
      setSelectedCollection(previousSelected);
      
      // Provide more detailed error message
      let errorMessage = "Delete failed. Please try again.";
      if (e?.status === 403) {
        errorMessage = "You do not have permission to delete this collection.";
      } else if (e?.status === 404) {
        errorMessage = "Collection not found. It may have already been deleted.";
      } else if (e?.status === 401) {
        errorMessage = "Authentication required. Please refresh the page and try again.";
      } else if (e?.message) {
        errorMessage = e.message;
      }
      
      toast.error(errorMessage, {
        description: e?.requestId ? `Request ID: ${e.requestId}` : e?.status ? `Status: ${e.status}` : undefined
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (col: AdminCollection) => {
    const newStatus = col.status === 'active' ? 'hidden' : 'active';
    try {
        await adminCollectionsService.updateCollectionStatus(col.id, newStatus);
        setCollections(prev => prev.map(c => c.id === col.id ? { ...c, status: newStatus } : c));
        toast.success(`Collection is now ${newStatus}`);
    } catch(e) {
        toast.error("Status update failed");
    }
  };

  const handleBulkAction = (action: string) => {
      toast.info(`${action} ${selectedIds.length} items (Not implemented)`);
      setSelectedIds([]);
  };

  const handleStartEdit = (col: AdminCollection) => {
    setEditName(col.name || '');
    setEditDescription(col.description || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = async () => {
    if (!selectedCollection || !editName.trim()) {
      toast.error('Collection name is required');
      return;
    }

    setIsSaving(true);
    try {
      await adminCollectionsService.updateCollection(selectedCollection.id, {
        name: editName.trim(),
        description: editDescription.trim()
      });

      // Update local state
      setCollections(prev => prev.map(c =>
        c.id === selectedCollection.id
          ? { ...c, name: editName.trim(), description: editDescription.trim() }
          : c
      ));
      setSelectedCollection(prev => prev ? { ...prev, name: editName.trim(), description: editDescription.trim() } : null);

      toast.success('Collection updated');
      setIsEditing(false);
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to update collection';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<AdminCollection>[] = [
    {
      key: 'name',
      header: 'Collection Name',
      width: 'w-72',
      minWidth: '250px',
      sortable: true,
      sticky: 'left',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500">
             <Folder size={16} />
          </div>
          <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">{c.name}</div>
              {c.status === 'hidden' && <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded font-bold uppercase">Hidden</span>}
          </div>
        </div>
      )
    },
    {
      key: 'creator',
      header: 'Owner',
      width: 'w-40',
      minWidth: '150px',
      sortable: true,
      sortKey: 'creator',
      render: (c) => <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{c.creator.name}</span>
    },
    {
      key: 'type',
      header: 'Visibility',
      width: 'w-24',
      minWidth: '100px',
      sortable: true,
      render: (c) => (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
            {c.type === 'private' ? <Lock size={12} /> : <Globe size={12} />}
            {c.type}
        </span>
      )
    },
    {
      key: 'followerCount',
      header: 'Followers',
      width: 'w-24',
      minWidth: '100px',
      sortable: true,
      align: 'center',
      render: (c) => <span className="text-xs font-bold">{c.followerCount}</span>
    },
    {
      key: 'itemCount',
      header: 'Nuggets',
      width: 'w-24',
      minWidth: '100px',
      sortable: true,
      align: 'center',
      render: (c) => <span className="text-xs font-bold">{c.itemCount}</span>
    },
    {
      key: 'createdDate',
      header: 'Date',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      sortKey: 'createdAt',
      render: (c) => <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
    },
    {
      key: 'createdTime',
      header: 'Time',
      width: 'w-24',
      minWidth: '100px',
      render: (c) => <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-24',
      minWidth: '100px',
      sticky: 'right',
      render: (c) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {can('admin.collections.view') && (
             <button
                onClick={() => setSelectedCollection(c)}
                className="flex items-center gap-1.5 px-2 py-1.5 md:px-3 md:py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
             >
                <Eye size={14} /> <span className="hidden md:inline">View</span>
             </button>
          )}
          {can('admin.collections.edit') && (
             <button
                onClick={() => { setSelectedCollection(c); handleStartEdit(c); }}
                className="flex items-center gap-1.5 px-2 py-1.5 md:px-3 md:py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title="Edit collection"
             >
                <Pencil size={14} /> <span className="hidden md:inline">Edit</span>
             </button>
          )}
        </div>
      )
    }
  ];

  const BulkActions = selectedIds.length > 0 ? (
      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-xs font-bold text-slate-500">{selectedIds.length} selected</span>
          <button onClick={() => handleBulkAction('hide')} className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition-colors">Hide</button>
          <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors">Delete</button>
      </div>
  ) : null;

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorMessage}</span>
          <button
            onClick={() => loadData(searchQuery)}
            className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <AdminSummaryBar 
        items={[
          { label: 'Community Collections', value: stats.totalCommunity, icon: <Layers size={18} /> },
          { label: 'Total Nuggets', value: stats.totalNuggetsInCommunity, icon: <Folder size={18} />, hint: 'In public collections' },
        ]}
        isLoading={isLoading}
      />

      <AdminTable 
        columns={columns} 
        data={processedCollections} 
        isLoading={isLoading} 
        actions={BulkActions}
        onSearch={(q) => loadData(q)} 
        virtualized
        placeholder="Search collections..."
        emptyState={
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No collections match the current filters.</p>
            <p className="text-xs text-slate-400">Try clearing search or date filters.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setSearchQuery(''); setDateFilter(''); loadData(); }}
                className="px-3 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Clear filters
              </button>
              <button
                onClick={() => loadData(searchQuery)}
                className="px-3 py-1 text-xs font-bold rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        }
        filters={
            <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="ml-2 pl-3 pr-2 py-1.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
        }
        
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
        
        onRowClick={(c) => setSelectedCollection(c)}
        selection={{
            enabled: true,
            selectedIds: selectedIds,
            onSelect: setSelectedIds
        }}
      />

      <AdminDrawer
        isOpen={!!selectedCollection}
        onClose={() => { setSelectedCollection(null); handleCancelEdit(); }}
        title={isEditing ? "Edit Collection" : "Collection Details"}
        width="lg"
        footer={
            <div className="flex justify-between w-full">
                {isEditing ? (
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveEdit}
                            disabled={isSaving || !editName.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-bold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Check size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X size={16} /> Cancel
                        </button>
                    </div>
                ) : (
                    <>
                        {can('admin.collections.edit') && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => selectedCollection && handleStartEdit(selectedCollection)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors"
                                >
                                    <Pencil size={16} /> Edit
                                </button>
                                <button
                                    onClick={() => {
                                      console.log('[AdminCollectionsPage] Delete button clicked', { selectedCollection });
                                      setShowDeleteConfirm(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-sm font-bold transition-colors"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        }
      >
        {selectedCollection && (
            <div className="space-y-6">
                <div className="flex gap-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
                        <Folder size={32} />
                    </div>
                    {isEditing ? (
                        <div className="flex-1 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Collection Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Collection name"
                                    className="w-full text-lg font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Description (optional)"
                                    rows={3}
                                    className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-1">{selectedCollection.name}</h2>
                            <p className="text-sm text-slate-500">{selectedCollection.description || 'No description provided.'}</p>
                        </div>
                    )}
                </div>
                {!isEditing && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Owner</label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedCollection.creator?.name || 'Unknown'}</span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Visibility</label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{selectedCollection.type}</span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nuggets</label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedCollection.itemCount}</span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Followers</label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedCollection.followerCount}</span>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Created</label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{new Date(selectedCollection.createdAt).toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>
        )}
      </AdminDrawer>

      <ConfirmActionModal 
        isOpen={showDeleteConfirm}
        onClose={() => {
          console.log('[AdminCollectionsPage] Modal onClose called', { isDeleting });
          if (!isDeleting) {
            setShowDeleteConfirm(false);
          }
        }}
        onConfirm={async () => {
          console.log('[AdminCollectionsPage] Modal onConfirm called - about to call handleDelete');
          try {
            await handleDelete();
            console.log('[AdminCollectionsPage] handleDelete completed successfully');
          } catch (error) {
            console.error('[AdminCollectionsPage] handleDelete threw error:', error);
            throw error;
          }
        }}
        title="Delete Collection?"
        description="This will permanently delete the collection. The nuggets inside will not be deleted."
        actionLabel="Delete"
        isDestructive
      />
    </div>
  );
};
