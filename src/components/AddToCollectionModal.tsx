import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, Folder, Search, Lock, Globe, Loader2 } from 'lucide-react';
import { storageService } from '@/services/storageService';
import { Collection } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleIds: string[];
  mode?: 'public';
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({ 
  isOpen, 
  onClose, 
  articleIds,
  mode = 'public' 
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { currentUserId } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    } else {
      // Reset state when modal closes
      setIsCreating(false);
      setNewCollectionName('');
      setProcessingId(null);
    }
  }, [isOpen]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const cols = await storageService.getCollections();
      // For public collections, show all public collections (user can add to any)
      setCollections(cols.filter(c => c.type === 'public'));
    } catch (error) {
      console.error('Failed to load collections:', error);
      toast.error('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };


  const toggleCollection = async (collectionId: string, isInCollection: boolean, colName: string) => {
    setProcessingId(collectionId);
    
    // Handle public collections
      // Optimistic update for all articles
      setCollections(prev => prev.map(c => {
        if (c.id === collectionId) {
          if (isInCollection) {
            // Remove all articleIds from this collection
            return { 
              ...c, 
              entries: c.entries.filter(e => !articleIds.includes(e.articleId))
            };
          } else {
            // Add all articleIds to this collection
            const existingIds = new Set(c.entries.map(e => e.articleId));
            const newEntries = articleIds
              .filter(id => !existingIds.has(id))
              .map(id => ({
                articleId: id,
                addedByUserId: currentUserId,
                addedAt: new Date().toISOString(),
                flaggedBy: [] as string[]
              }));
            return { 
              ...c, 
              entries: [...c.entries, ...newEntries]
            };
          }
        }
        return c;
      }));

      try {
        if (isInCollection) {
          // Remove all articles from collection
          for (const articleId of articleIds) {
            await storageService.removeArticleFromCollection(collectionId, articleId, currentUserId);
          }
          toast.info(`Removed from "${colName}"`);
        } else {
          // Add all articles to collection
          for (const articleId of articleIds) {
            await storageService.addArticleToCollection(collectionId, articleId, currentUserId);
          }
          toast.success(`Added to "${colName}"`);
        }
      } catch (e) {
        toast.error("Failed to update");
        loadCollections(); // Revert on error
      } finally {
        setProcessingId(null);
      }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim() || isCreating) return; // Prevent double-clicks
    setIsCreating(true);
    const folderName = newCollectionName.trim();
    setNewCollectionName(''); // Clear input immediately
    
    try {
      // Create public collection
      const newCol = await storageService.createCollection(
        folderName, 
        '', 
        currentUserId, 
        'public'
      );
      // Add all articles to new collection immediately
      for (const id of articleIds) {
        await storageService.addArticleToCollection(newCol.id, id, currentUserId);
      }
      await loadCollections();
      toast.success('Created Community Collection and added nuggets');
    } catch (e: any) {
      console.error('Failed to create:', e);
      toast.error(e.message || "Failed to create");
    } finally {
      // Always reset creating state, even on error
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const filteredCollections = collections.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // Check if all articles are in a collection
  const isAllInCollection = (collection: Collection) => {
    const collectionArticleIds = new Set(collection.entries.map(e => e.articleId));
    return articleIds.every(id => collectionArticleIds.has(id));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add to Community Collection</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search community collections..."
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
                {searchQuery ? 'No community collections found' : 'No community collections yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCollections.map((col) => {
                  const isInCollection = isAllInCollection(col);
                  const isProcessing = processingId === col.id;
                  
                  return (
                    <button
                      key={col.id}
                      onClick={() => !isProcessing && toggleCollection(col.id, isInCollection, col.name)}
                      disabled={isProcessing}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isInCollection 
                          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                        isInCollection 
                          ? 'bg-primary-500 text-white' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                      }`}>
                        {isProcessing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isInCollection ? (
                          <Check size={14} strokeWidth={3} />
                        ) : (
                          <Folder size={14} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isInCollection 
                            ? 'text-primary-700 dark:text-primary-400' 
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {col.name}
                        </p>
                        {col.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {col.description}
                          </p>
                        )}
                      </div>
                      {(col.validEntriesCount ?? col.entries?.length ?? 0) > 0 && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                          {col.validEntriesCount ?? col.entries?.length ?? 0}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Create New */}
        {(
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 shrink-0">
            {isCreating ? (
              <div className="flex items-center gap-2">
                <input 
                  autoFocus
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white placeholder-slate-400"
                  placeholder="Collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      createCollection();
                    } else if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewCollectionName('');
                    }
                  }}
                  disabled={isCreating}
                />
                <button 
                  onClick={createCollection}
                  disabled={isCreating}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Create
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewCollectionName('');
                  }}
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
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
