import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, Folder, Loader2 } from 'lucide-react';
import {
  useBookmarkCollections,
  useCreateBookmarkCollection,
  useAssignBookmarkToCollections
} from '@/hooks/useBookmarks';
import { useToast } from '@/hooks/useToast';
import { twMerge } from 'tailwind-merge';
import { getHeaderHeight } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import { getOverlayHost } from '@/utils/overlayHosts';
import { normalizeFolderIdsForAssign } from '@/utils/bookmarkFolderSelection';
import type { BookmarkCollection } from '@/services/bookmarkService';

/**
 * Private bookmark folder picker (BookmarkCollection /api/bookmark-collections).
 * Not related to public editorial collections (/api/collections).
 */

function setsEqualStrings(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

interface CollectionSelectorProps {
  bookmarkId: string;
  itemId: string;
  /** Folder membership when the dialog opened */
  initialCollectionIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onCollectionChange?: (folderIds: string[]) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function CollectionSelector({
  bookmarkId,
  itemId: _itemId,
  initialCollectionIds = [],
  isOpen,
  onClose,
  onCollectionChange,
  anchorRef
}: CollectionSelectorProps) {
  const getCollectionErrorMessage = useCallback((_error: unknown, fallback: string) => {
    return fallback;
  }, []);

  // Note: itemId is kept for potential future use (e.g., syncing with localStorage)
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialCollectionIds)
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const [positionReady, setPositionReady] = useState(false);
  const wasOpenRef = useRef(false);

  // Queries and mutations
  const { data: collections = [], isLoading } = useBookmarkCollections();
  const createMutation = useCreateBookmarkCollection();
  const assignMutation = useAssignBookmarkToCollections();

  // Sync when parent passes fresh membership (e.g. after refetch)
  useEffect(() => {
    setSelectedIds(new Set(initialCollectionIds));
  }, [initialCollectionIds]);

  // Dismiss without persisting (explicit Done saves)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const toggleCollection = useCallback((collectionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusedIndex((prev) =>
          prev < collections.length - 1 ? prev + 1 : prev
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (event.key === 'Enter' && focusedIndex >= 0) {
        event.preventDefault();
        const focusedCollection = collections[focusedIndex];
        if (focusedCollection) {
          toggleCollection(focusedCollection.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, collections, focusedIndex, onClose, toggleCollection]);

  const handleSave = useCallback(async () => {
    const defaultFolder = collections.find((c) => c.isDefault);
    const normalized = normalizeFolderIdsForAssign(
      Array.from(selectedIds),
      defaultFolder?.id
    );
    if (normalized.error === 'missing_default') {
      toast.error('Your Saved folder is not available. Please try again.');
      onClose();
      return;
    }
    const collectionIds = normalized.folderIds;
    if (normalized.normalizedFromEmpty) {
      toast.info(
        'Bookmarks stay in Saved. Use Remove bookmark on the card to unsave completely.'
      );
    }

    const nextSet = new Set(collectionIds);
    const prevSet = new Set(initialCollectionIds);
    const hasChanges = !setsEqualStrings(nextSet, prevSet);

    if (hasChanges) {
      try {
        await assignMutation.mutateAsync({ bookmarkId, collectionIds });
        onCollectionChange?.(collectionIds);
        toast.success('Folders updated');
      } catch (error) {
        toast.error(getCollectionErrorMessage(error, 'Failed to update folders'));
      }
    }

    onClose();
  }, [
    selectedIds,
    initialCollectionIds,
    collections,
    bookmarkId,
    assignMutation,
    onCollectionChange,
    onClose,
    toast,
    getCollectionErrorMessage
  ]);

  const handleCreateCollection = useCallback(async () => {
    const name = newCollectionName.trim();
    if (!name) return;

    try {
      const newCollection = await createMutation.mutateAsync({
        name,
        description: ''
      });

      // Add to selected
      setSelectedIds((prev) => {
        return new Set([...prev, newCollection.id]);
      });

      // Reset form
      setNewCollectionName('');
      setIsCreating(false);

      toast.success(`Created "${name}"`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already exists')) {
        toast.error('A folder with this name already exists');
      } else {
        toast.error(getCollectionErrorMessage(error, 'Failed to create folder'));
      }
    }
  }, [newCollectionName, createMutation, toast, getCollectionErrorMessage]);

  const recomputePanelPosition = useCallback(() => {
    const modalWidth = 288;
    const edge = 8;
    const gap = 8;
    const headerHeight = getHeaderHeight();
    const measuredH = containerRef.current?.getBoundingClientRect().height ?? 0;
    const h = measuredH > 0 ? measuredH : 320;

    if (!anchorRef?.current) {
      setPanelPos({ top: edge + headerHeight, left: edge });
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    let left = rect.right - modalWidth;
    left = Math.max(edge, Math.min(left, window.innerWidth - modalWidth - edge));

    let top = rect.bottom + gap;
    const minTop = headerHeight + edge;
    const maxTop = window.innerHeight - h - edge;
    if (top > maxTop) {
      const aboveTop = rect.top - h - gap;
      if (aboveTop >= minTop) {
        top = aboveTop;
      } else {
        top = Math.max(minTop, maxTop);
      }
    }
    top = Math.max(minTop, Math.min(top, maxTop));

    setPanelPos({ top, left });
  }, [anchorRef]);

  /* eslint-disable react-hooks/set-state-in-effect -- panel coords follow anchor + measured dialog */
  useLayoutEffect(() => {
    if (!isOpen) {
      setPositionReady(false);
      return;
    }
    recomputePanelPosition();
    setPositionReady(true);
  }, [isOpen, recomputePanelPosition, collections.length, isLoading, isCreating]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!isOpen) return;

    const handle = () => {
      recomputePanelPosition();
    };
    const scrollOpts = { passive: true, capture: true } as const;
    window.addEventListener('scroll', handle, scrollOpts);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, scrollOpts);
      window.removeEventListener('resize', handle);
    };
  }, [isOpen, recomputePanelPosition]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen && anchorRef?.current) {
      const el = anchorRef.current;
      if (typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;
  if (!positionReady) return null;

  /* Host: #modal-root — stacks at MODAL band so card/grid overflow cannot clip this UI */
  return createPortal(
    <>
      <div
        data-testid="bookmark-folder-backdrop"
        className="fixed inset-0 bg-black/20 pointer-events-auto"
        style={{ zIndex: Z_INDEX.MODAL }}
        onClick={() => onClose()}
        aria-hidden="true"
      />

      <div
        ref={containerRef}
        data-testid="bookmark-folder-dialog"
        className={twMerge(
          'fixed pointer-events-auto w-72 max-h-[calc(100vh-16px)] overflow-y-auto',
          'bg-white dark:bg-gray-900 rounded-lg shadow-xl',
          'border border-gray-200 dark:border-gray-700',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        style={{
          top: panelPos.top,
          left: panelPos.left,
          zIndex: Z_INDEX.MODAL + 1
        }}
        role="dialog"
        aria-label="Select folders"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Folders
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Private folders only — not public collections
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Folders list */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : collections.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            No folders yet. Create one below.
          </div>
        ) : (
          <ul className="py-2" role="listbox" aria-multiselectable="true">
            {collections.map((collection, index) => (
              <CollectionItem
                key={collection.id}
                collection={collection}
                isSelected={selectedIds.has(collection.id)}
                isFocused={focusedIndex === index}
                onToggle={() => toggleCollection(collection.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Create new folder */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        {isCreating ? (
          <div className="p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCollection();
                  } else if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewCollectionName('');
                  }
                }}
                placeholder="Folder name"
                className={twMerge(
                  'flex-1 px-3 py-1.5 text-sm rounded-md',
                  'border border-gray-300 dark:border-gray-600',
                  'bg-white dark:bg-gray-800',
                  'text-gray-900 dark:text-gray-100',
                  'placeholder-gray-400 dark:placeholder-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
                autoFocus
                maxLength={100}
              />
              <button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim() || createMutation.isPending}
                className={twMerge(
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  'bg-blue-500 text-white',
                  'hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsCreating(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className={twMerge(
              'w-full flex items-center gap-2 px-4 py-3',
              'text-sm text-gray-600 dark:text-gray-300',
              'hover:bg-gray-50 dark:hover:bg-gray-800',
              'transition-colors'
            )}
          >
            <Plus className="w-4 h-4" />
            Create new folder
          </button>
        )}
      </div>

      {/* Footer with save button */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={assignMutation.isPending}
          className={twMerge(
            'w-full py-2 text-sm font-medium rounded-md',
            'bg-blue-500 text-white',
            'hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        >
          {assignMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : (
            'Done'
          )}
        </button>
      </div>
      </div>
    </>,
    getOverlayHost('modal'),
  );
}

/**
 * Individual folder item in the list.
 */
interface CollectionItemProps {
  collection: BookmarkCollection;
  isSelected: boolean;
  isFocused: boolean;
  onToggle: () => void;
}

function CollectionItem({
  collection,
  isSelected,
  isFocused,
  onToggle
}: CollectionItemProps) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      onClick={onToggle}
      className={twMerge(
        'flex items-center gap-3 px-4 py-2.5 cursor-pointer',
        'hover:bg-gray-50 dark:hover:bg-gray-800',
        'transition-colors',
        isFocused && 'bg-gray-50 dark:bg-gray-800'
      )}
    >
      {/* Checkbox */}
      <div
        className={twMerge(
          'w-5 h-5 rounded border-2 flex items-center justify-center',
          'transition-colors',
          isSelected
            ? 'bg-blue-500 border-blue-500'
            : 'border-gray-300 dark:border-gray-600'
        )}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Folder info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {collection.name}
          </span>
          {collection.isDefault && (
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
              Saved
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {collection.bookmarkCount} item{collection.bookmarkCount !== 1 && 's'}
        </p>
      </div>
    </li>
  );
}

export default CollectionSelector;
