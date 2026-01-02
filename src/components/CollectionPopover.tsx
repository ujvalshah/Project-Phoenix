import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, Folder, Lock, Globe, X } from 'lucide-react';
import { storageService } from '@/services/storageService';
import { Collection } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';

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
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { currentUserId } = useAuth();

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen, mode]);

  const handleCloseInternal = async () => {
      // Fallback: If in private mode (collections), ensure the nugget is at least in a "General" collection
      // if it's not in any other private collection. This ensures users don't lose their saved items.
      if (mode === 'private' && collections.length > 0) {
          const inAny = collections.some(c => c.entries.some(e => e.articleId === articleId));
          if (!inAny) {
              const general = collections.find(c => c.name === 'General' || c.name === 'General Bookmarks');
              if (general) {
                  try {
                      await storageService.addArticleToCollection(general.id, articleId, currentUserId);
                      toast.success(`Saved to ${general.name}`);
                  } catch (e) {
                      console.error("Auto-save failed", e);
                  }
              }
          }
      }
      onClose();
  };

  // Handle clicking outside & scroll
  // PERFORMANCE FIX: Throttle scroll handler to prevent performance violations
  // Closing on scroll is intentional UX, but we throttle it to avoid blocking scroll
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            handleCloseInternal();
        }
    };
    
    if (isOpen) {
        let rafId: number | null = null;
        let isScheduled = false;

        // Throttled scroll handler - batches close action to next paint cycle
        const handleScrollThrottled = () => {
          if (isScheduled) return;
          
          isScheduled = true;
          rafId = requestAnimationFrame(() => {
            handleCloseInternal();
            isScheduled = false;
            rafId = null;
          });
        };

        // slight delay to prevent immediate close if the click that opened it bubbles
        setTimeout(() => {
            window.addEventListener('mousedown', handleClickOutside);
            // Mark as passive for better scroll performance
            window.addEventListener('scroll', handleScrollThrottled, { passive: true, capture: true });
            window.addEventListener('resize', handleCloseInternal);
        }, 100);
        
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScrollThrottled, true);
            window.removeEventListener('resize', handleCloseInternal);
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
        };
    }
  }, [isOpen, onClose, collections]); 

  const loadCollections = async () => {
    const cols = await storageService.getCollections();
    // For public collections, show all public collections (user can add to any)
    // For private collections, show only user's own collections
    if (mode === 'public') {
      setCollections(cols.filter(c => c.type === 'public'));
    } else {
      setCollections(cols.filter(c => c.creatorId === currentUserId && c.type === mode));
    }
  };

  const toggleCollection = async (collectionId: string, isInCollection: boolean, colName: string) => {
    // Optimistic update
    setCollections(prev => prev.map(c => {
      if (c.id === collectionId) {
        if (isInCollection) {
          return { ...c, entries: c.entries.filter(e => e.articleId !== articleId) };
        } else {
          return { ...c, entries: [...c.entries, { articleId, addedByUserId: currentUserId, addedAt: new Date().toISOString(), flaggedBy: [] }] };
        }
      }
      return c;
    }));

    try {
      if (isInCollection) {
        await storageService.removeArticleFromCollection(collectionId, articleId, currentUserId);
        toast.info(`Removed from "${colName}"`);
      } else {
        await storageService.addArticleToCollection(collectionId, articleId, currentUserId);
        toast.success(`Added to "${colName}"`);
      }
    } catch (e: any) {
      console.error('Failed to update collection:', e);
      const errorMessage = e?.response?.data?.message || e?.message || "Failed to update collection";
      toast.error(errorMessage);
      loadCollections(); // Revert on error
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const newCol = await storageService.createCollection(newCollectionName, '', currentUserId, mode);
      await storageService.addArticleToCollection(newCol.id, articleId, currentUserId);
      toast.success(`Created "${newCollectionName}"`);
      setNewCollectionName('');
      setIsCreating(false);
      loadCollections();
    } catch (e) {
      toast.error("Failed to create");
    }
  };

  if (!isOpen || !anchorRect) return null;

  // Positioning logic
  const width = 240;
  const margin = 12; 
  
  let left = anchorRect.left + window.scrollX - (width / 2) + (anchorRect.width / 2);
  if (left < 10) left = 10;
  if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;

  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const estimatedHeight = 280; 

  let style: React.CSSProperties = { left };
  
  if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      style.top = anchorRect.top + window.scrollY - margin;
      style.transform = 'translateY(-100%)'; 
      style.transformOrigin = 'bottom center';
  } else {
      style.top = anchorRect.bottom + window.scrollY + margin;
      style.transformOrigin = 'top center';
  }

  // Dynamic naming based on mode
  const headerText = mode === 'private' ? 'Save to Collection' : 'Add to Collection';
  const entityName = 'collection';

  return createPortal(
    <div 
      ref={modalRef}
      className={`absolute z-[60] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 w-[240px]`}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
        {/* Minimal Header */}
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

        {/* List */}
        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            {collections.length === 0 ? (
                <div className="text-center py-4 px-2">
                    <p className="text-xs text-slate-400">No {entityName}s yet.</p>
                </div>
            ) : (
                collections.map(col => {
                    const isInCollection = col.entries.some(e => e.articleId === articleId);
                    return (
                        <button
                            key={col.id}
                            onClick={() => toggleCollection(col.id, isInCollection, col.name)}
                            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors group ${isInCollection ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${isInCollection ? 'text-primary-600 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`}>
                                {isInCollection ? <Check size={14} strokeWidth={3} /> : <Folder size={14} />}
                            </div>
                            <span className={`text-xs font-medium truncate flex-1 ${isInCollection ? 'text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                {col.name}
                            </span>
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
                    <button 
                        onClick={createCollection} 
                        className="p-1 bg-primary-500 text-slate-900 rounded-md hover:bg-primary-400 transition-colors"
                    >
                        <Check size={12} />
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <Plus size={14} /> 
                    <span>New {entityName}</span>
                </button>
            )}
        </div>
    </div>,
    document.body
  );
};


