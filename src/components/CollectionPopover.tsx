import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, Folder, Lock, Globe, X, Search } from 'lucide-react';
import { storageService } from '@/services/storageService';
import { Collection } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getOverlayHost } from '@/utils/overlayHosts';

/** Top inset the popover should avoid (fixed header region). Keep in sync with header height. */
const HEADER_SAFE_INSET = 72;

interface CollectionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
  mode: 'public' | 'private';
  anchorRect?: DOMRect | null;
}

export const CollectionPopover: React.FC<CollectionPopoverProps> = ({
  isOpen,
  onClose,
  articleId,
  mode,
  anchorRect
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { currentUserId, isAuthenticated } = useAuth();
  const { withAuth } = useRequireAuth();

  // Fetch collections once when popover opens
  useEffect(() => {
    if (isOpen) {
      loadCollections();
      setSearchQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen, mode]);

  // Dismiss on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        void handleCloseInternal();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); void handleCloseInternal(); }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, mode, collections, articleId, currentUserId, onClose]);

  // Reposition on scroll/resize
  const [viewportTick, setViewportTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const update = () => setViewportTick((t) => t + 1);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  // Measure actual popover size after render for accurate placement
  const [measured, setMeasured] = useState<{ h: number } | null>(null);
  useLayoutEffect(() => {
    if (!isOpen) { setMeasured(null); return; }
    const el = modalRef.current;
    if (!el) return;
    setMeasured({ h: el.offsetHeight });
  }, [isOpen, collections.length, isCreating, searchQuery, viewportTick]);

  const style = useMemo<React.CSSProperties>(() => {
    if (!anchorRect) return {};
    const width = 260;
    const margin = 8;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxAvailableH = Math.max(160, vh - HEADER_SAFE_INSET - margin * 2);
    const estimatedHeight = Math.min(measured?.h ?? 360, maxAvailableH);

    let left = anchorRect.left + anchorRect.width / 2 - width / 2;
    if (left < margin) left = margin;
    if (left + width > vw - margin) left = vw - width - margin;

    const spaceBelow = vh - anchorRect.bottom - margin;
    const spaceAbove = anchorRect.top - HEADER_SAFE_INSET - margin;
    const placeBelow = spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove;

    let top: number;
    if (placeBelow) {
      top = anchorRect.bottom + margin;
    } else {
      top = anchorRect.top - margin - estimatedHeight;
    }
    // Final clamp: never under the header, never off the bottom.
    top = Math.min(Math.max(top, HEADER_SAFE_INSET + margin), vh - estimatedHeight - margin);

    return {
      left,
      top,
      width,
      maxHeight: maxAvailableH,
      transformOrigin: placeBelow ? 'top center' : 'bottom center',
    };
  }, [anchorRect, viewportTick, measured]);

  // --- Data ---

  const loadCollections = async () => {
    try {
      if (mode === 'public') {
        const [publicResult, featuredResult] = await Promise.all([
          storageService.getCollections({ type: 'public', includeCount: true, sortField: 'name', sortDirection: 'asc', limit: 100 }),
          storageService.getFeaturedCollections().catch(() => []),
        ]);

        const publicCols = normalizeResult(publicResult);
        const featuredCols = featuredResult ?? [];

        // Merge: featured FIRST, public OVERWRITES — preserves entries data
        const merged = new Map<string, Collection>();
        for (const c of featuredCols) merged.set(c.id, c);
        for (const c of publicCols) merged.set(c.id, c);

        setCollections(
          Array.from(merged.values())
            .filter((c) => c.type === 'public')
            .sort((a, b) => getName(a).localeCompare(getName(b)))
        );
      } else {
        const result = await storageService.getCollections({ type: 'private', includeCount: true, sortField: 'name', sortDirection: 'asc', limit: 100 });
        const cols = normalizeResult(result);
        setCollections(cols.filter((c) => c.creatorId === currentUserId && c.type === mode));
      }
    } catch {
      setCollections([]);
      toast.error('Failed to load collections');
    }
  };

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
    () => new Map(collections.map((collection) => [collection.id, getName(collection)])),
    [collections]
  );

  const getDisplayName = (collection: Collection): string => {
    const name = getName(collection);
    if (!collection.parentId) return name;
    const parentName = collectionNameById.get(collection.parentId) || `Parent ${collection.parentId.slice(0, 6)}`;
    return `${name} (${parentName})`;
  };

  // Client-side search filter
  const filteredCollections = collections.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return getName(c).toLowerCase().includes(q);
  });

  const handleCloseInternal = async () => {
    onClose();

    // Fallback: ensure private-mode nugget is in General collection
    if (mode === 'private' && collections.length > 0) {
      const inAny = collections.some((c) => c.entries?.some((e) => e.articleId === articleId));
      if (!inAny) {
        const general = collections.find((c) => c.name === 'General' || c.name === 'General Bookmarks');
        if (general) {
          try {
            await storageService.addArticleToCollection(general.id, articleId, currentUserId);
            toast.success(`Saved to ${general.name}`);
          } catch {
            // silent fallback failure
          }
        }
      }
    }
  };

  // --- Actions ---

  const toggleCollection = async (collectionId: string, isInCollection: boolean, colName: string) => {
    if (!isAuthenticated) { withAuth(() => {})(); return; }
    const targetCollection = collections.find((collection) => collection.id === collectionId);
    const parentId = targetCollection?.parentId ?? null;

    setCollections((prev) =>
      prev.map((c) => {
        const shouldUpdateTarget = c.id === collectionId;
        const shouldUpdateParent = !isInCollection && Boolean(parentId) && c.id === parentId;
        if (!shouldUpdateTarget && !shouldUpdateParent) return c;
        if (isInCollection && shouldUpdateTarget) {
          return { ...c, entries: (c.entries ?? []).filter((e) => e.articleId !== articleId) };
        }
        return {
          ...c,
          entries: [...(c.entries ?? []), { articleId, addedByUserId: currentUserId, addedAt: new Date().toISOString(), flaggedBy: [] as string[] }]
        };
      })
    );

    try {
      if (isInCollection) {
        await storageService.removeArticleFromCollection(collectionId, articleId, currentUserId);
        toast.info(`Removed from "${colName}"`);
      } else {
        await storageService.addArticleToCollection(collectionId, articleId, currentUserId);
        toast.success(`Added to "${colName}"`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update collection';
      toast.error(msg);
      loadCollections();
    }
  };

  const createCollection = async () => {
    if (!isAuthenticated) { withAuth(() => {})(); return; }
    if (!newCollectionName.trim()) return;
    try {
      const newCol = await storageService.createCollection(newCollectionName, '', currentUserId, mode);
      await storageService.addArticleToCollection(newCol.id, articleId, currentUserId);
      toast.success(`Created "${newCollectionName}"`);
      setNewCollectionName('');
      setIsCreating(false);
      loadCollections();
    } catch {
      toast.error('Failed to create');
    }
  };

  if (!isOpen || !anchorRect) return null;

  const headerText = mode === 'private' ? 'Save to Collection' : 'Add to Collection';

  return createPortal(
    <div
      ref={modalRef}
      role="dialog"
      aria-label={headerText}
      className="fixed pointer-events-auto bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
      style={{ ...style, pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          {mode === 'private' ? <Lock size={10} /> : <Globe size={10} />}
          {headerText}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); handleCloseInternal(); }}
          className="p-1 -mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Search — client-side, instant */}
      {collections.length > 6 && (
        <div className="px-2 pt-2 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
        {filteredCollections.length === 0 ? (
          <div className="text-center py-4 px-2">
            <p className="text-xs text-slate-400">
              {searchQuery ? 'No matches' : 'No collections yet.'}
            </p>
          </div>
        ) : (
          filteredCollections.map((col) => {
            const isIn = col.entries?.some((e) => e.articleId === articleId) ?? false;
            const count = col.validEntriesCount ?? col.entries?.length ?? 0;
            return (
              <button
                key={col.id}
                onClick={() => toggleCollection(col.id, isIn, getDisplayName(col))}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors group ${
                  isIn ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                  isIn ? 'text-primary-600 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'
                }`}>
                  {isIn ? <Check size={13} strokeWidth={3} /> : <Folder size={13} />}
                </div>
                <span className={`text-xs font-medium truncate flex-1 ${
                  isIn ? 'text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300'
                }`}>
                  {getDisplayName(col)}
                </span>
                {count > 0 && (
                  <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">{count}</span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Inline Create */}
      <div className="p-1 border-t border-slate-100 dark:border-slate-800 shrink-0">
        {isCreating ? (
          <div className="flex items-center gap-1 px-1 py-1">
            <input
              autoFocus
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary-500 dark:text-white placeholder-slate-400"
              placeholder="Name..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createCollection()}
            />
            <button onClick={createCollection} className="p-1 bg-primary-500 text-slate-900 rounded-md hover:bg-primary-400 transition-colors">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Plus size={14} />
            <span>New {mode === 'private' ? 'collection' : 'collection'}</span>
          </button>
        )}
      </div>
    </div>,
    getOverlayHost('popover'),
  );
};
