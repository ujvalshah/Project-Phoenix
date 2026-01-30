import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, Folder, Loader2 } from 'lucide-react';
import {
  useBookmarkCollections,
  useCreateBookmarkCollection,
  useAssignBookmarkToCollections
} from '@/hooks/useBookmarks';
import { useToast } from '@/hooks/useToast';
import { twMerge } from 'tailwind-merge';
import type { BookmarkCollection } from '@/services/bookmarkService';

/**
 * CollectionSelector Component
 *
 * Instagram/Pinterest style collection selector.
 * Features:
 * - Checkbox list of collections
 * - Create new collection inline
 * - Multi-collection support
 * - Keyboard navigation
 */

interface CollectionSelectorProps {
  bookmarkId: string;
  itemId: string;
  currentCollectionIds?: string[];
  isOpen: boolean;
  onClose: () => void;
  onCollectionChange?: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

export function CollectionSelector({
  bookmarkId,
  itemId,
  currentCollectionIds = [],
  isOpen,
  onClose,
  onCollectionChange,
  anchorRef
}: CollectionSelectorProps) {
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(currentCollectionIds)
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Queries and mutations
  const { data: collections = [], isLoading } = useBookmarkCollections();
  const createMutation = useCreateBookmarkCollection();
  const assignMutation = useAssignBookmarkToCollections();

  // Sync selected IDs when currentCollectionIds changes
  useEffect(() => {
    setSelectedIds(new Set(currentCollectionIds));
  }, [currentCollectionIds]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleSave();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectedIds]);

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
        toggleCollection(collections[focusedIndex].id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, collections, focusedIndex]);

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

  const handleSave = useCallback(async () => {
    const collectionIds = Array.from(selectedIds);

    // Only save if there are changes
    const currentSet = new Set(currentCollectionIds);
    const hasChanges =
      selectedIds.size !== currentSet.size ||
      [...selectedIds].some((id) => !currentSet.has(id));

    if (hasChanges && collectionIds.length > 0) {
      try {
        await assignMutation.mutateAsync({ bookmarkId, collectionIds });
        onCollectionChange?.();
        toast.success('Collections updated');
      } catch (error) {
        toast.error('Failed to update collections');
      }
    }

    onClose();
  }, [
    selectedIds,
    currentCollectionIds,
    bookmarkId,
    assignMutation,
    onCollectionChange,
    onClose,
    toast
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
      setSelectedIds((prev) => new Set([...prev, newCollection.id]));

      // Reset form
      setNewCollectionName('');
      setIsCreating(false);

      toast.success(`Created "${name}"`);
    } catch (error: any) {
      if (error?.message?.includes('already exists')) {
        toast.error('A collection with this name already exists');
      } else {
        toast.error('Failed to create collection');
      }
    }
  }, [newCollectionName, createMutation, toast]);

  // Calculate position based on anchor element
  const getPosition = useCallback(() => {
    if (!anchorRef?.current) {
      return { top: 100, left: 100 };
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const modalWidth = 288; // w-72 = 18rem = 288px

    // Position below the button, aligned to the right
    let left = rect.right - modalWidth;
    let top = rect.bottom + 8;

    // Ensure it doesn't go off-screen on the left
    if (left < 8) {
      left = 8;
    }

    // Ensure it doesn't go off-screen on the right
    if (left + modalWidth > window.innerWidth - 8) {
      left = window.innerWidth - modalWidth - 8;
    }

    // If not enough space below, position above
    const modalHeight = 400; // approximate max height
    if (top + modalHeight > window.innerHeight - 8) {
      top = rect.top - modalHeight - 8;
      if (top < 8) {
        top = 8;
      }
    }

    return { top, left };
  }, [anchorRef]);

  if (!isOpen) return null;

  const position = getPosition();

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => handleSave()}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={containerRef}
        className={twMerge(
          'fixed z-50 w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl',
          'border border-gray-200 dark:border-gray-700',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        style={{
          top: position.top,
          left: position.left
        }}
        role="dialog"
        aria-label="Select collections"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Save to collections
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Collections list */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : collections.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            No collections yet. Create one below.
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

      {/* Create new collection */}
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
                placeholder="Collection name"
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
            Create new collection
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
    document.body
  );
}

/**
 * Individual collection item in the list.
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

      {/* Collection info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {collection.name}
          </span>
          {collection.isDefault && (
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
              Default
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
