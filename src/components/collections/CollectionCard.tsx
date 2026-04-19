import React, { useState, useEffect } from 'react';
import { Collection } from '@/types';
import { Folder, Lock, Check, Plus, Layers, Users, ArrowRight, Clock3 } from 'lucide-react';
import { ShareMenu } from '../shared/ShareMenu';
import { useAuth } from '@/hooks/useAuth';
import { storageService } from '@/services/storageService';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/utils/formatters';

// PHASE 5: Import getCollectionById for refetch after optimistic update

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
  // Selection Props
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  // Optional callback to update collection in parent state
  onCollectionUpdate?: (updatedCollection: Collection) => void;
  taxonomyLabel?: string;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
    collection,
    onClick,
    selectionMode,
    isSelected,
    onSelect,
    onCollectionUpdate,
    taxonomyLabel,
}) => {
  const { currentUserId } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Derive isFollowing from backend data (collection.followers array)
  const isFollowing = currentUserId ? (collection.followers || []).includes(currentUserId) : false;

  const isPrivate = collection.type === 'private';
  const isSubCollection = Boolean(collection.parentId);

  const handleFollow = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentUserId || isLoading) return;

      const wasFollowing = isFollowing;
      const previousFollowersCount = collection.followersCount;
      
      // Optimistic update
      const optimisticCollection: Collection = {
          ...collection,
          followers: wasFollowing 
              ? (collection.followers || []).filter(id => id !== currentUserId)
              : [...(collection.followers || []), currentUserId],
          followersCount: wasFollowing 
              ? Math.max(0, previousFollowersCount - 1)
              : previousFollowersCount + 1
      };
      
      if (onCollectionUpdate) {
          onCollectionUpdate(optimisticCollection);
      }

      setIsLoading(true);
      
      try {
          if (wasFollowing) {
              await storageService.unfollowCollection(collection.id);
          } else {
              await storageService.followCollection(collection.id);
              window.dispatchEvent(new CustomEvent('nugget:collection-follow'));
          }
          
          // PHASE 5: Refetch collection from backend to ensure state is accurate
          // This prevents desync between optimistic update and backend reality
          try {
              const updatedCollection = await storageService.getCollectionById(collection.id);
              if (updatedCollection && onCollectionUpdate) {
                  onCollectionUpdate(updatedCollection);
              }
          } catch (refetchError) {
              // If refetch fails, optimistic update is still better than nothing
              console.warn('Failed to refetch collection after follow/unfollow:', refetchError);
          }
      } catch (error: any) {
          // PHASE 5: Rollback on error with proper error message
          if (onCollectionUpdate) {
              onCollectionUpdate(collection);
          }
          const errorMessage = error?.requestId 
            ? `Failed to ${wasFollowing ? 'unfollow' : 'follow'} collection (Request ID: ${error.requestId})`
            : `Failed to ${wasFollowing ? 'unfollow' : 'follow'} collection`;
          toast.error(errorMessage);
      } finally {
          setIsLoading(false);
      }
  };

  const handleCardClick = (e: React.MouseEvent) => {
      if (selectionMode && onSelect) {
          e.stopPropagation();
          onSelect(collection.id);
      } else {
          onClick();
      }
  };
  
  return (
    <div 
        onClick={handleCardClick}
        className={`
            group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out
            ${selectionMode ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_16px_rgba(15,23,42,0.07)] dark:hover:border-slate-700'}
            ${isSelected ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-200 dark:border-slate-800'}
        `}
    >
        {/* Selection Overlay */}
        {selectionMode && (
            <div className="absolute top-4 right-4 z-20">
                <div className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 shadow-sm
                    ${isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-600 hover:border-primary-400'}
                `}>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                </div>
            </div>
        )}

        <div className="flex flex-1 flex-col p-4">
            <div className="mb-2.5 flex items-start justify-between">
                {/* Icon Logic: Lock = private, Layers = parent/standalone, Folder = sub-collection */}
                <div className={`rounded-md border p-1.5 ${isPrivate || isSubCollection ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800' : 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/60 dark:bg-primary-900/20 dark:text-primary-300'}`}>
                    {isPrivate
                      ? <Lock size={18} strokeWidth={2} />
                      : isSubCollection
                        ? <Folder size={18} strokeWidth={2} />
                        : <Layers size={18} strokeWidth={2} />}
                </div>

                {/* Follow Button - Hide in selection mode & Hide for private folders (can't follow private) */}
                {!selectionMode && !isPrivate && currentUserId && (
                    <button 
                        onClick={handleFollow}
                        disabled={isLoading}
                        className={`
                            flex h-7.5 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium motion-safe:transition-all motion-safe:duration-150
                            ${isFollowing 
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }
                            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        {isFollowing ? (
                            <>
                                <Check size={14} strokeWidth={2.5} />
                                Following
                            </>
                        ) : (
                            <>
                                <Plus size={14} strokeWidth={2.5} />
                                Follow
                            </>
                        )}
                    </button>
                )}
                
                {/* Label for Private Folders */}
                {isPrivate && (
                    <span className="rounded bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-800">
                        Folder
                    </span>
                )}
            </div>

            {taxonomyLabel && (
              <div className="mb-1.5 truncate text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
                {taxonomyLabel}
              </div>
            )}

            <h3 className="mb-1 truncate text-[15px] font-semibold leading-5 text-slate-900 motion-safe:transition-colors motion-safe:duration-150 group-hover:text-slate-700 dark:text-white dark:group-hover:text-slate-100">
                {collection.name}
            </h3>
            
            <div className="relative mb-3.5 flex-1" title={collection.description}>
                <p className="line-clamp-2 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                    {collection.description || 'No description provided.'}
                </p>
            </div>

            <div className={`mt-auto border-t border-slate-100 pt-2.5 dark:border-slate-800 ${selectionMode ? 'opacity-50' : ''}`}>
                <div className="mb-2 flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5" title="Nuggets">
                        <Folder size={12.5} className="text-slate-400 dark:text-slate-500" /> 
                        {collection.validEntriesCount ?? collection.entries?.length ?? 0}
                    </span>
                    {!isPrivate && (
                        <span className="flex items-center gap-1.5" title="Followers">
                            <Users size={12.5} className="text-slate-400 dark:text-slate-500" /> 
                            {collection.followersCount ?? 0}
                        </span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <Clock3 size={12} />
                      {formatDate(collection.updatedAt || collection.createdAt, false)}
                    </span>
                </div>
                
                <div className="flex items-center justify-end gap-1.5">
                    {/* Only show share if public */}
                    {!isPrivate && (
                        <ShareMenu 
                            data={{
                                type: 'collection',
                                id: collection.id,
                                title: collection.name,
                                shareUrl: `${window.location.origin}/collections/${collection.id}`
                            }}
                            meta={{
                                text: collection.description
                            }}
                            className="rounded-md text-slate-400 motion-safe:transition-all motion-safe:duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            iconSize={16}
                        />
                    )}
                    <span className="ml-1 flex -translate-x-2 items-center gap-1 text-xs font-medium text-slate-500 opacity-0 motion-safe:transition-all motion-safe:duration-200 group-hover:translate-x-0 group-hover:opacity-100 dark:text-slate-300">
                        Open <ArrowRight size={14} />
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};
