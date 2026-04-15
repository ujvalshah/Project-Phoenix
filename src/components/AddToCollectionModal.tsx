import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Check, Folder, Search, Globe, Loader2 } from 'lucide-react';
import { storageService } from '@/services/storageService';
import { Collection } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ModalShell } from '@/components/UI/ModalShell';

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleIds: string[];
  title?: string;
  /** When true, clicking a collection that already contains all items is a no-op (no toggle-off). Use for move/copy flows. */
  addOnly?: boolean;
  onComplete?: (targetCollectionId: string, targetCollectionName: string) => void;
  /** When set, enables YouTube-style multi-select: current collection pinned at top, no auto-close, "Done" button. */
  currentCollectionId?: string;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  isOpen,
  onClose,
  articleIds,
  title,
  addOnly = false,
  onComplete,
  currentCollectionId,
}) => {
  const isMultiSelectMode = Boolean(currentCollectionId);
  // Full unfiltered list fetched once on open
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { currentUserId, isAuthenticated } = useAuth();
  const toast = useToast();
  const { withAuth } = useRequireAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  // Single effect: fetch all collections once when modal opens, reset on close
  useEffect(() => {
    if (isOpen) {
      fetchCollections();
      // Focus search input after mount
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setSearchQuery('');
      setIsCreating(false);
      setNewCollectionName('');
      setProcessingId(null);
    }
  }, [isOpen]);

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      // Fetch public collections (limit=100 covers typical admin scale) + featured in parallel
      const [publicResult, featuredResult] = await Promise.all([
        storageService.getCollections({
          type: 'public',
          includeCount: true,
          sortField: 'name',
          sortDirection: 'asc',
          limit: 100,
        }),
        storageService.getFeaturedCollections().catch(() => []),
      ]);

      // Normalize results — RestAdapter may return array or { data, count }
      const publicCollections = normalizeResult(publicResult);
      const featuredCollections = featuredResult ?? [];

      // Merge: featured FIRST, then public OVERWRITES — this preserves `entries` data
      // (the featured endpoint omits entries for performance; the public endpoint includes them)
      const merged = new Map<string, Collection>();
      for (const c of featuredCollections) merged.set(c.id, c);
      for (const c of publicCollections) merged.set(c.id, c);

      const sorted = Array.from(merged.values())
        .filter((c) => c.type === 'public')
        .sort((a, b) => getName(a).localeCompare(getName(b)));

      setAllCollections(sorted);
    } catch {
      toast.error('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helpers ---

  const normalizeResult = (result: unknown): Collection[] => {
    if (Array.isArray(result)) return result;
    if (result && typeof result === 'object' && 'data' in result) {
      const r = result as { data: unknown };
      if (Array.isArray(r.data)) return r.data as Collection[];
    }
    return [];
  };

  const getName = (c: Collection): string => c.name || '';

  const collectionNameById = useMemo(
    () => new Map(allCollections.map((collection) => [collection.id, getName(collection)])),
    [allCollections]
  );

  const getDisplayName = (collection: Collection): string => {
    const name = getName(collection);
    if (!collection.parentId) return name;
    const parentName = collectionNameById.get(collection.parentId) || `Parent ${collection.parentId.slice(0, 6)}`;
    return `${name} (${parentName})`;
  };

  // Client-side search — instant, no API calls
  // In multi-select mode, pin current collection at top
  const filteredCollections = allCollections
    .filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      // Always show current collection even when searching
      if (isMultiSelectMode && c.id === currentCollectionId) return true;
      return getName(c).toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (isMultiSelectMode) {
        if (a.id === currentCollectionId) return -1;
        if (b.id === currentCollectionId) return 1;
      }
      return getName(a).localeCompare(getName(b));
    });

  const isAllInCollection = (collection: Collection) => {
    const ids = new Set(collection.entries?.map((e) => e.articleId) ?? []);
    return articleIds.every((id) => ids.has(id));
  };

  // --- Actions ---

  const toggleCollection = async (collectionId: string, isInCollection: boolean, colName: string) => {
    if (!isAuthenticated) { withAuth(() => {})(); return; }

    // In addOnly mode (non-multi-select), skip if all items already in target
    if (addOnly && !isMultiSelectMode && isInCollection) {
      toast.info(`Already in "${colName}"`);
      return;
    }

    setProcessingId(collectionId);
    const targetCollection = allCollections.find((collection) => collection.id === collectionId);
    const parentId = targetCollection?.parentId ?? null;

    // Optimistic update
    setAllCollections((prev) =>
      prev.map((c) => {
        const shouldUpdateTarget = c.id === collectionId;
        const shouldUpdateParent = !isInCollection && Boolean(parentId) && c.id === parentId;
        if (!shouldUpdateTarget && !shouldUpdateParent) {
          return c;
        }
        if (isInCollection && shouldUpdateTarget) {
          return { ...c, entries: (c.entries ?? []).filter((e) => !articleIds.includes(e.articleId)) };
        }
        const existing = new Set((c.entries ?? []).map((e) => e.articleId));
        const newEntries = articleIds
          .filter((id) => !existing.has(id))
          .map((id) => ({ articleId: id, addedByUserId: currentUserId, addedAt: new Date().toISOString(), flaggedBy: [] as string[] }));
        return { ...c, entries: [...(c.entries ?? []), ...newEntries] };
      })
    );

    try {
      if (isInCollection) {
        for (const id of articleIds) await storageService.removeArticleFromCollection(collectionId, id, currentUserId);
        toast.info(`Removed from "${colName}"`);
      } else {
        for (const id of articleIds) await storageService.addArticleToCollection(collectionId, id, currentUserId);
        toast.success(`Added to "${colName}"`);
        // In multi-select mode, don't auto-close — user clicks "Done" when finished
        if (!isMultiSelectMode) {
          onComplete?.(collectionId, colName);
        }
      }
    } catch {
      toast.error('Failed to update');
      fetchCollections(); // revert
    } finally {
      setProcessingId(null);
    }
  };

  const createCollection = async () => {
    if (!isAuthenticated) { withAuth(() => {})(); return; }
    if (!newCollectionName.trim() || isCreating) return;
    setIsCreating(true);
    const folderName = newCollectionName.trim();
    setNewCollectionName('');

    try {
      const newCol = await storageService.createCollection(folderName, '', currentUserId, 'public');
      for (const id of articleIds) await storageService.addArticleToCollection(newCol.id, id, currentUserId);
      await fetchCollections();
      toast.success('Created Community Collection and added nuggets');
      if (!isMultiSelectMode) {
        onComplete?.(newCol.id, folderName);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create';
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} wrapperClassName="p-4 sm:p-6">
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title || 'Add to Community Collection'}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" aria-label="Close">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Search — client-side only, instant filtering */}
        <div className="mb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>

        {/* Collections List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {searchQuery ? 'No collections match your search' : 'No community collections yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCollections.map((col) => {
                const inCollection = isAllInCollection(col);
                const isProcessing = processingId === col.id;
                const count = col.validEntriesCount ?? col.entries?.length ?? 0;
                const isCurrent = isMultiSelectMode && col.id === currentCollectionId;

                return (
                  <button
                    key={col.id}
                    onClick={() => !isProcessing && toggleCollection(col.id, inCollection, getDisplayName(col))}
                    disabled={isProcessing}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      inCollection
                        ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                      inCollection
                        ? 'bg-primary-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                    }`}>
                      {isProcessing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : inCollection ? (
                        <Check size={14} strokeWidth={3} />
                      ) : (
                        <Folder size={14} />
                      )}
                    </div>
                    <span className={`text-sm font-medium truncate flex-1 ${
                      inCollection ? 'text-primary-700 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {getDisplayName(col)}
                      {isCurrent && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">(current)</span>
                      )}
                    </span>
                    {count > 0 && (
                      <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500 shrink-0">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Create New + Done */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 shrink-0 space-y-2">
          {isCreating ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white placeholder-slate-400"
                placeholder="Collection name..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createCollection();
                  else if (e.key === 'Escape') { setIsCreating(false); setNewCollectionName(''); }
                }}
              />
              <button
                onClick={createCollection}
                disabled={isCreating && !newCollectionName.trim()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Check size={16} /> Create
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewCollectionName(''); }}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 transition-colors"
            >
              <Plus size={16} />
              <span>Create New Collection</span>
            </button>
          )}

          {/* Done button — only in multi-select (YouTube-style) mode */}
          {isMultiSelectMode && (
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-bold hover:bg-primary-600 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
