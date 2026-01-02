import React, { useState, useEffect } from 'react';
import { Collection } from '@/types';
import { getCollectionTheme } from '@/constants/theme';
import { Folder, Lock, Check, Plus, Layers, Users, ArrowRight } from 'lucide-react';
import { ShareMenu } from '../shared/ShareMenu';
import { useAuth } from '@/hooks/useAuth';
import { storageService } from '@/services/storageService';
import { useToast } from '@/hooks/useToast';

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
  // Selection Props
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  // Optional callback to update collection in parent state
  onCollectionUpdate?: (updatedCollection: Collection) => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ 
    collection, 
    onClick,
    selectionMode,
    isSelected,
    onSelect,
    onCollectionUpdate
}) => {
  const theme = getCollectionTheme(collection.id);
  const { currentUserId } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Derive isFollowing from backend data (collection.followers array)
  const isFollowing = currentUserId ? (collection.followers || []).includes(currentUserId) : false;
  
  const isPrivate = collection.type === 'private';

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
          }
          
          // Success - optimistic update already applied
      } catch (error: any) {
          // Rollback on error
          if (onCollectionUpdate) {
              onCollectionUpdate(collection);
          }
          toast.error(`Failed to ${wasFollowing ? 'unfollow' : 'follow'} collection`);
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
            group relative bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full
            ${selectionMode ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : 'cursor-pointer hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-1'}
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

        {/* Top Accent Bar - Differentiate Private vs Public */}
        <div className={`h-1.5 w-full ${isPrivate ? 'bg-slate-200 dark:bg-slate-700' : theme.bg}`} />

        <div className="p-5 flex flex-col flex-1">
            <div className="flex justify-between items-start mb-4">
                {/* Icon Logic: Folder/Lock for Private, Colored Folder/Layers for Public */}
                <div className={`p-2.5 rounded-lg ${isPrivate ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : `${theme.light} ${theme.text} dark:bg-slate-800`}`}>
                    {isPrivate ? <Lock size={20} strokeWidth={2} /> : <Layers size={20} strokeWidth={2} />}
                </div>

                {/* Follow Button - Hide in selection mode & Hide for private folders (can't follow private) */}
                {!selectionMode && !isPrivate && currentUserId && (
                    <button 
                        onClick={handleFollow}
                        disabled={isLoading}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border
                            ${isFollowing 
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' 
                                : 'bg-white text-gray-500 border-gray-200 hover:border-yellow-300 hover:text-yellow-700 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                        Folder
                    </span>
                )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 truncate group-hover:text-primary-600 transition-colors">
                {collection.name}
            </h3>
            
            <div className="flex-1 mb-5 relative" title={collection.description}>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {collection.description || 'No description provided.'}
                </p>
            </div>

            <div className={`flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 ${selectionMode ? 'opacity-50' : ''}`}>
                <div className="flex gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5" title="Items">
                        <Folder size={14} className="text-slate-400 dark:text-slate-500" /> 
                        {collection.validEntriesCount ?? collection.entries?.length ?? 0}
                    </span>
                    {!isPrivate && (
                        <span className="flex items-center gap-1.5" title="Followers">
                            <Users size={14} className="text-slate-400 dark:text-slate-500" /> 
                            {collection.followersCount ?? 0}
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-1">
                    {/* Only show share if public */}
                    {!isPrivate && (
                        <ShareMenu 
                            data={{
                                type: 'collection',
                                id: collection.id,
                                title: collection.name,
                                shareUrl: `${window.location.origin}/#/collections/${collection.id}`
                            }}
                            meta={{
                                text: collection.description
                            }}
                            className="hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            iconSize={16}
                        />
                    )}
                    <span className="flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-1">
                        Open <ArrowRight size={14} />
                    </span>
                </div>
            </div>
        </div>
    </div>
  );
};
