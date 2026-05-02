
import React, { useEffect, useState, useMemo } from 'react';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminCollection } from '../types/admin';
import { adminCollectionsService } from '../services/adminCollectionsService';
import { Eye, Trash2, Lock, Globe, Folder, Layers, Pencil, Check, X, Star } from 'lucide-react';
import { sortBy, filterByDate, type SortConfig } from '@/utils/sortAndFilter';
import { useToast } from '@/hooks/useToast';
import { AdminDrawer } from '../components/AdminDrawer';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { useAdminHeader } from '../layout/AdminLayout';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
export const AdminCollectionsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [stats, setStats] = useState({ totalCommunity: 0, totalNuggetsInCommunity: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<AdminCollection | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editParentId, setEditParentId] = useState<string | null>(null);
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
  const queryClient = useQueryClient();
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

  // Value extractor for AdminCollection sort keys
  const adminCollectionValue = (c: AdminCollection, key: string): unknown => {
    switch (key) {
      case 'creator': return c.creator?.name?.toLowerCase() ?? '';
      case 'createdAt': return new Date(c.createdAt).getTime();
      default: return c[key as keyof AdminCollection] ?? '';
    }
  };

  // Derived state — uses shared sort/filter utilities
  const processedCollections = useMemo(() => {
    const dateFiltered = filterByDate(collections, dateFilter, (c) => c.createdAt);
    const sorts: SortConfig[] = [{ key: sortKey, direction: sortDirection }];
    return sortBy(dateFiltered, sorts, adminCollectionValue);
  }, [collections, dateFilter, sortKey, sortDirection]);

  const collectionNameById = useMemo(
    () => new Map(collections.map((collection) => [collection.id, collection.name])),
    [collections]
  );

  const rootCollections = useMemo(
    () => collections.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [collections]
  );

  const handleDelete = async () => {
    if (!selectedCollection || isDeleting) {
      return;
    }
    
    const col = selectedCollection;
    const colId = col.id;
    
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    
    // Optimistic update - remove from UI immediately
    setCollections(prev => prev.filter(c => c.id !== colId));
    const previousSelected = selectedCollection;
    setSelectedCollection(null);
    
    try {
      await adminCollectionsService.deleteCollection(colId);
      
      // Refresh stats after successful delete
      const newStats = await adminCollectionsService.getStats();
      setStats(newStats);
      toast.success("Collection deleted successfully");
    } catch (e: any) {
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
        // Preserve backend 403 details (e.g. EMAIL_NOT_VERIFIED) instead of always showing permission denied
        errorMessage = e?.message || "You do not have permission to delete this collection.";
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

  const handleToggleFeatured = async (col: AdminCollection) => {
    const newFeatured = !col.isFeatured;
    // Optimistic update
    setCollections(prev => prev.map(c => c.id === col.id ? { ...c, isFeatured: newFeatured } : c));
    if (selectedCollection?.id === col.id) {
      setSelectedCollection(prev => prev ? { ...prev, isFeatured: newFeatured } : null);
    }
    try {
      await adminCollectionsService.setFeatured(col.id, newFeatured);
      // Invalidate the featured collections cache so the category toolbar updates immediately
      queryClient.invalidateQueries({ queryKey: ['collections', 'featured'] });
      toast.success(newFeatured ? 'Added to category toolbar' : 'Removed from category toolbar');
    } catch (e) {
      // Revert
      setCollections(prev => prev.map(c => c.id === col.id ? { ...c, isFeatured: col.isFeatured } : c));
      if (selectedCollection?.id === col.id) {
        setSelectedCollection(prev => prev ? { ...prev, isFeatured: col.isFeatured } : null);
      }
      toast.error('Failed to update featured status');
    }
  };

  // handleReorderFeatured and featuredCollections removed — toolbar now uses
  // dimension tags. See AdminTagsPage > ToolbarTagPlacement.

  const handleBulkAction = (action: string) => {
    if (action === 'delete') {
      if (!can('admin.collections.edit')) {
        toast.error('You do not have permission to delete collections.');
        return;
      }

      if (selectedIds.length === 0) return;

      // Capture ids at click-time so we don't lose them while the modal is open
      setBulkDeleteIds([...selectedIds]);
      setShowBulkDeleteConfirm(true);
      return;
    }

    toast.info(`${action} ${selectedIds.length} items (Not implemented)`);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteIds.length === 0 || isDeleting) return;

    setIsDeleting(true);
    setShowBulkDeleteConfirm(false);

    const idsToDelete = new Set(bulkDeleteIds);
    const toRestoreById = new Map(
      collections.filter((c) => idsToDelete.has(c.id)).map((c) => [c.id, c])
    );

    // Optimistic remove from UI
    setCollections((prev) => prev.filter((c) => !idsToDelete.has(c.id)));
    if (selectedCollection && idsToDelete.has(selectedCollection.id)) {
      setSelectedCollection(null);
    }
    setSelectedIds([]);

    try {
      const failures: Array<{ id: string; error: unknown }> = [];
      for (const id of bulkDeleteIds) {
        try {
          await adminCollectionsService.deleteCollection(id);
        } catch (error) {
          failures.push({ id, error });
        }
      }

      if (failures.length > 0) {
        // Re-add only collections that failed deletion
        const failedIds = new Set(failures.map((f) => f.id));
        setCollections((prev) => [
          ...prev,
          ...Array.from(failedIds)
            .map((id) => toRestoreById.get(id))
            .filter((c): c is AdminCollection => Boolean(c)),
        ]);

        const firstErr: any = failures[0]?.error;
        toast.error(firstErr?.message || 'Bulk delete failed.');
        return;
      }

      // Refresh stats after successful delete(s)
      const newStats = await adminCollectionsService.getStats();
      setStats(newStats);
      toast.success(`Deleted ${bulkDeleteIds.length} collections`);
    } finally {
      setIsDeleting(false);
      setBulkDeleteIds([]);
    }
  };

  const handleStartEdit = (col: AdminCollection) => {
    setEditName(col.name || '');
    setEditDescription(col.description || '');
    setEditParentId(col.parentId || null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
    setEditParentId(null);
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
        description: editDescription.trim(),
        parentId: editParentId,
      } as Partial<AdminCollection>);

      // Update local state
      setCollections(prev => prev.map(c =>
        c.id === selectedCollection.id
          ? { ...c, name: editName.trim(), description: editDescription.trim(), parentId: editParentId }
          : c
      ));
      setSelectedCollection(prev => prev ? { ...prev, name: editName.trim(), description: editDescription.trim(), parentId: editParentId } : null);

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
      key: 'parentCollection',
      header: 'Parent Collection',
      width: 'w-44',
      minWidth: '180px',
      render: (c) => {
        if (!c.parentId) {
          return <span className="text-xs text-slate-400">Root</span>;
        }
        const parentName = collectionNameById.get(c.parentId) || `Parent (${c.parentId.slice(0, 6)}...)`;
        return <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{parentName}</span>;
      }
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
      key: 'isFeatured',
      header: 'Featured',
      width: 'w-28',
      minWidth: '100px',
      sortable: true,
      align: 'center',
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <button
            onClick={() => handleToggleFeatured(c)}
            disabled={c.type === 'private'}
            title={c.type === 'private' ? 'Private collections cannot be featured' : c.isFeatured ? 'Remove from toolbar' : 'Add to toolbar'}
            className={`p-1.5 rounded-lg transition-colors ${
              c.isFeatured
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                : 'text-slate-300 dark:text-slate-600 hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            } ${c.type === 'private' ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Star size={14} fill={c.isFeatured ? 'currentColor' : 'none'} />
          </button>
        </div>
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
          {can('admin.collections.edit') && (
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors"
            >
              Delete
            </button>
          )}
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

      {/* Category Toolbar Order — hidden: toolbar now uses dimension tags instead of collections.
         See AdminTagsPage > ToolbarTagPlacement for the new toolbar ordering UI. */}

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
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Parent Collection</label>
                                <select
                                    value={editParentId || ''}
                                    onChange={(e) => setEditParentId(e.target.value || null)}
                                    className="w-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">None (Root)</option>
                                    {rootCollections
                                      .filter((c) => c.id !== selectedCollection?.id)
                                      .map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))
                                    }
                                </select>
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
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Parent Collection</label>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {selectedCollection.parentId
                                ? (collectionNameById.get(selectedCollection.parentId) || `Parent (${selectedCollection.parentId.slice(0, 6)}...)`)
                                : 'Root'}
                            </span>
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
                        {selectedCollection.type === 'public' && can('admin.collections.edit') && (
                            <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Category Toolbar</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleToggleFeatured(selectedCollection)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                                            selectedCollection.isFeatured
                                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <Star size={16} fill={selectedCollection.isFeatured ? 'currentColor' : 'none'} />
                                        {selectedCollection.isFeatured ? 'Featured in toolbar' : 'Add to toolbar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
      </AdminDrawer>

      <ConfirmActionModal 
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false);
          }
        }}
        onConfirm={async () => {
          await handleDelete();
        }}
        title="Delete Collection?"
        description="This will permanently delete the collection. The nuggets inside will not be deleted."
        actionLabel="Delete"
        isDestructive
      />

      <ConfirmActionModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => {
          if (!isDeleting) setShowBulkDeleteConfirm(false);
        }}
        onConfirm={async () => {
          await handleBulkDelete();
        }}
        title={`Delete ${bulkDeleteIds.length} Collection${bulkDeleteIds.length === 1 ? '' : 's'}?`}
        description="This will permanently delete the selected collections. The nuggets inside will not be deleted."
        actionLabel="Delete"
        isDestructive
      />
    </div>
  );
};
