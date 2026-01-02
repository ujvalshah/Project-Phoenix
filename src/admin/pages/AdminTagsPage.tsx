
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminTag } from '../types/admin';
import { adminTagsService } from '../services/adminTagsService';
import { Trash2, Plus, Edit2, Hash, Tag, Layers, GitMerge } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { AdminDrawer } from '../components/AdminDrawer';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { useAdminHeader } from '../layout/AdminLayout';
import { useSearchParams } from 'react-router-dom';
import { queryClient } from '@/queryClient';

// --- Merge Modal Component ---
const MergeModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: (name: string) => void; count: number }> = ({ isOpen, onClose, onConfirm, count }) => {
    const [targetName, setTargetName] = useState('');
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                <div className="mb-4">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-3">
                        <GitMerge size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Merge {count} Tags</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Merging will combine usage counts and remove the original tags. Enter the name for the final tag.
                    </p>
                </div>
                <input 
                    autoFocus
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    placeholder="e.g. Technology"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button 
                        onClick={() => onConfirm(targetName)}
                        disabled={!targetName.trim()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
                    >
                        Merge
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Rename Modal Component ---
const RenameModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: (name: string) => void; initialName: string }> = ({ isOpen, onClose, onConfirm, initialName }) => {
    const [newName, setNewName] = useState(initialName);
    useEffect(() => { if (isOpen) setNewName(initialName); }, [isOpen, initialName]);
    
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 animate-in zoom-in-95 border border-slate-200 dark:border-slate-800">
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rename Tag</h3>
                    <p className="text-sm text-slate-500 mt-1">This will update the tag across all existing nuggets.</p>
                </div>
                <input 
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 mb-6 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={() => onConfirm(newName)} disabled={!newName.trim() || newName === initialName} className="px-6 py-2 bg-primary-500 text-slate-900 rounded-lg font-bold hover:bg-primary-400 disabled:opacity-50">Save</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const AdminTagsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [tags, setTags] = useState<AdminTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ totalTags: 0, pending: 0, categories: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Table State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('usageCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Actions
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [tagNameInput, setTagNameInput] = useState(''); 
  
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AdminTag | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ tag: AdminTag; timeoutId: number } | null>(null);

  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const openCreate = () => {
      setTagNameInput('');
      setIsDrawerOpen(true);
  };

  useEffect(() => {
    setPageHeader(
      "Tags & Taxonomy", 
      "Manage global categories and review user-suggested tags.",
      <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-slate-900 rounded-lg text-sm font-bold hover:bg-primary-400 shadow-sm transition-colors">
          <Plus size={16} /> Create Tag
      </button>
    );
  }, []);

  // Initialize filters from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    setSearchParams(params, { replace: true });
  }, [searchQuery, setSearchParams]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [data, statsData] = await Promise.all([
          adminTagsService.listTags(searchQuery),
          adminTagsService.getStats()
      ]);
      setTags(data);
      setStats(statsData);
      setErrorMessage(null);
    } catch (e: any) {
      if (e.message !== 'Request cancelled') {
        setErrorMessage("Could not load tags. Please retry.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const processedTags = useMemo(() => {
    let result = [...tags];
    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof AdminTag] || '';
      let valB: any = b[sortKey as keyof AdminTag] || '';

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [tags, sortKey, sortDirection]);

  // -- Actions --

  const handleInlineUpdate = async (id: string, updates: Partial<AdminTag>) => {
      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      try {
          await adminTagsService.updateTag(id, updates);
          toast.success("Tag updated");
      } catch (e) {
          toast.error("Update failed");
          loadData();
      }
  };

  const handleRename = async (newName: string) => {
      if (!renameTarget) return;
      
      const oldName = renameTarget.name;
      const tagId = renameTarget.id;
      
      // Log rename attempt
      console.log('[AdminTagsPage.handleRename] Starting rename:', { 
        tagId, 
        oldName, 
        newName 
      });
      
      // Optimistic update: update UI immediately
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, name: newName } : t));
      
      try {
          // Call backend API to persist the rename
          const response = await adminTagsService.renameTag(tagId, newName);
          
          // Log successful response
          console.log('[AdminTagsPage.handleRename] Backend response:', response);
          
          // Verify the response contains the updated name
          if (response && response.name) {
              console.log('[AdminTagsPage.handleRename] Confirmed updated name in response:', response.name);
          }
          
          // Invalidate React Query cache for categories/tags to refresh homepage
          // This ensures the category bar shows the new tag name
          // Note: Homepage calculates categories from articles, so invalidating articles will refresh categories
          // Wait a brief moment to ensure backend article updates have completed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Invalidate all article-related queries (including infinite queries)
          // The query key structure is ['articles', 'infinite', ...] so invalidating ['articles'] will match all
          await queryClient.invalidateQueries({ 
              queryKey: ['articles'],
              refetchType: 'all',
              exact: false // Match all queries that start with ['articles']
          });
          
          // Also invalidate categories query if it exists
          await queryClient.invalidateQueries({ 
              queryKey: ['categories'],
              refetchType: 'all',
              exact: false
          });
          
          // Force refetch of active queries to ensure immediate update
          // This will refetch all active queries that match ['articles']
          await queryClient.refetchQueries({ 
              queryKey: ['articles'],
              type: 'active'
          });
          
          console.log('[AdminTagsPage.handleRename] Cache invalidated and queries refetched');
          
          // Also trigger a manual refetch after a short delay to ensure data is fresh
          setTimeout(() => {
              queryClient.refetchQueries({ 
                  queryKey: ['articles'],
                  type: 'active'
              });
          }, 1000);
          
          toast.success("Tag renamed successfully");
          setRenameTarget(null);
          
          // Reload tag list to ensure consistency
          await loadData();
      } catch (e: any) {
          // Rollback optimistic update on error
          console.error('[AdminTagsPage.handleRename] Rename failed, rolling back:', e);
          setTags(prev => prev.map(t => t.id === tagId ? { ...t, name: oldName } : t));
          
          // Show user-friendly error message
          const errorMessage = e?.response?.data?.message || e?.message || "Rename failed";
          toast.error(errorMessage);
      }
  };

  const handleMerge = async (targetName: string) => {
      setIsMergeOpen(false);
      try {
          await adminTagsService.mergeTags(selectedIds, targetName);
          toast.success(`Merged ${selectedIds.length} tags into "${targetName}"`);
          setSelectedIds([]);
          loadData();
      } catch (e) {
          toast.error("Merge failed");
      }
  };

  const handleDelete = async () => {
      if (!deleteId) return;
      const tag = tags.find(t => t.id === deleteId);
      if (!tag) return;
      setTags(prev => prev.filter(t => t.id !== deleteId));
      setDeleteId(null);
      const timeoutId = window.setTimeout(async () => {
          try {
              await adminTagsService.deleteTag(deleteId);
              setPendingDelete(null);
              toast.success("Tag deleted");
          } catch (e) {
              setTags(prev => [...prev, tag]);
              setPendingDelete(null);
              toast.error("Delete failed. Changes reverted.");
          }
      }, 5000);
      setPendingDelete({ tag, timeoutId });
  };

  const handleBulkDelete = async () => {
      if (!window.confirm(`Delete ${selectedIds.length} tags?`)) return;
      for (const id of selectedIds) {
          await adminTagsService.deleteTag(id);
      }
      toast.success("Tags deleted");
      setSelectedIds([]);
      loadData();
  };

  const saveDrawer = async () => {
      const newTag: AdminTag = {
          id: `t-${Date.now()}`,
          name: tagNameInput,
          type: 'tag',
          usageCount: 0,
          isOfficial: false,
          status: 'active'
      };
      setTags(prev => [newTag, ...prev]);
      toast.success("Tag created");
      setIsDrawerOpen(false);
  };

  // -- Columns --
  const columns: Column<AdminTag>[] = [
    {
      key: 'name',
      header: 'Tag Name',
      width: 'w-64',
      minWidth: '200px',
      sticky: 'left',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-2 group/name">
            <span className="text-slate-400 font-bold">#</span>
            <span className="font-bold text-slate-900 dark:text-white">{t.name || 'Unnamed Tag'}</span>
            <button 
                onClick={(e) => { e.stopPropagation(); setRenameTarget(t); }}
                className="opacity-0 group-hover/name:opacity-100 p-1 text-slate-400 hover:text-primary-600 transition-all"
            >
                <Edit2 size={12} />
            </button>
            {t.requestedBy && (
                <span className="ml-2 text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                    Request
                </span>
            )}
        </div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      width: 'w-40',
      minWidth: '150px',
      sortable: true,
      render: (t) => (
        <div className="relative w-32" onClick={e => e.stopPropagation()}>
            <select 
                value={t.type}
                onChange={(e) => handleInlineUpdate(t.id, { type: e.target.value as any })}
                className={`
                    appearance-none w-full pl-2 pr-6 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50
                    ${t.type === 'category' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }
                `}
            >
                <option value="tag">Tag</option>
                <option value="category">Category</option>
            </select>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-40',
      minWidth: '150px',
      sortable: true,
      render: (t) => (
        <div className="relative w-32" onClick={e => e.stopPropagation()}>
            <select 
                value={t.status}
                onChange={(e) => handleInlineUpdate(t.id, { status: e.target.value as any })}
                className={`
                    appearance-none w-full pl-2 pr-6 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/50
                    ${t.status === 'active' 
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
                        : t.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }
                `}
            >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="deprecated">Deprecated</option>
            </select>
        </div>
      )
    },
    {
      key: 'usageCount',
      header: 'Usage',
      width: 'w-32',
      minWidth: '100px',
      sortable: true,
      render: (t) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t.usageCount} items</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-24',
      minWidth: '100px',
      sticky: 'right',
      render: (t) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button 
                onClick={() => setDeleteId(t.id)} 
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
                <Trash2 size={14} />
            </button>
        </div>
      )
    }
  ];

  const BulkActions = selectedIds.length > 0 ? (
      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-xs font-bold text-slate-500">{selectedIds.length} selected</span>
          <button 
            onClick={() => setIsMergeOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[10px] font-bold transition-colors"
          >
              <GitMerge size={12} /> Merge
          </button>
          <button 
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors"
          >
              <Trash2 size={12} /> Delete
          </button>
      </div>
  ) : null;

  return (
    <div className="space-y-4">
      {pendingDelete && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Deleted “{pendingDelete.tag.name}”. Undo?</span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                clearTimeout(pendingDelete.timeoutId);
                setTags(prev => [pendingDelete.tag, ...prev]);
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
            { label: 'Total Tags', value: stats.totalTags, icon: <Hash size={18} /> },
            { label: 'Pending Requests', value: stats.pending, icon: <Tag size={18} /> },
            { label: 'Categories', value: stats.categories, icon: <Layers size={18} /> },
        ]}
        isLoading={isLoading}
      />

      <AdminTable 
        columns={columns} 
        data={processedTags} 
        isLoading={isLoading} 
        placeholder="Search tags..."
        actions={BulkActions}
        virtualized
        emptyState={
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No tags match the current filters.</p>
            <p className="text-xs text-slate-400">Try clearing search filters.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setSearchQuery(''); loadData(); }}
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
        
        selection={{
            enabled: true,
            selectedIds: selectedIds,
            onSelect: setSelectedIds
        }}
      />

      {/* CREATE DRAWER */}
      <AdminDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        title="Create New Tag"
        footer={
            <div className="flex justify-end gap-2 w-full">
                <button onClick={() => setIsDrawerOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200">Cancel</button>
                <button onClick={saveDrawer} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:opacity-90">Create</button>
            </div>
        }
      >
          <div className="space-y-4">
              <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Tag Name</label>
                  <input 
                    value={tagNameInput} 
                    onChange={e => setTagNameInput(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold" 
                    placeholder="e.g. Finance"
                  />
                  <p className="text-xs text-slate-400 mt-2">New tags are created as 'Active' standard tags by default. You can change the type in the table later.</p>
              </div>
          </div>
      </AdminDrawer>

      {/* MODALS */}
      <MergeModal 
        isOpen={isMergeOpen} 
        onClose={() => setIsMergeOpen(false)} 
        onConfirm={handleMerge}
        count={selectedIds.length}
      />

      <RenameModal 
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        initialName={renameTarget?.name || ''}
        onConfirm={handleRename}
      />

      <ConfirmActionModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Tag?"
        description="This will remove the tag from all nuggets that currently use it."
        actionLabel="Delete"
        isDestructive
      />
    </div>
  );
};
