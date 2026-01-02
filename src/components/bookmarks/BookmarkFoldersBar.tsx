/**
 * BookmarkFoldersBar Component
 * 
 * Horizontal folder selector bar matching the Public/Private toggle bar layout.
 * Implements "Priority+" navigation pattern: first 4 folders visible, rest in "More" dropdown.
 * 
 * Features:
 * - Fixed sub-header layout matching Public/Private toggle bar (bg-gray-100 dark:bg-slate-800 p-1 rounded-xl)
 * - Pill button styling with primary yellow active state (bg-white dark:bg-slate-700 when active)
 * - Folder overflow: first 4 folders visible, rest in "More" dropdown
 * - Search folders input in dropdown when >10 folders
 * - Management actions on the right with ghost-button style
 * - Clean typography and spacing consistent with My Nuggets
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Folder, Plus, Settings, ChevronDown, Search } from 'lucide-react';
import { BookmarkFolder } from '@/services/bookmarkFoldersService';

interface BookmarkFoldersBarProps {
  folders: BookmarkFolder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder?: () => void;
  onManageFolders?: () => void; // Opens manage folders modal
  isLoading?: boolean;
  folderCounts?: Map<string, number>; // Bookmark counts per folder
  bookmarkCount?: number; // Total bookmark count for heading
}

export const BookmarkFoldersBar: React.FC<BookmarkFoldersBarProps> = ({
  folders,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onManageFolders,
  isLoading = false,
  folderCounts = new Map(),
  bookmarkCount,
}) => {
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [moreSearchQuery, setMoreSearchQuery] = useState('');
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setShowMoreDropdown(false);
        setMoreSearchQuery('');
      }
    };

    if (showMoreDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreDropdown]);

  // Sort folders: pinned first, then unpinned (General always first in unpinned)
  const sortedFolders = useMemo(() => {
    if (folders.length === 0) return [];

    const pinned: BookmarkFolder[] = [];
    const unpinned: BookmarkFolder[] = [];

    folders.forEach((folder) => {
      if (folder.pinned === true) {
        pinned.push(folder);
      } else {
        unpinned.push(folder);
      }
    });

    // Sort function: uses sortOrder if available, falls back to order
    const sortByOrder = (a: BookmarkFolder, b: BookmarkFolder): number => {
      const aOrder = a.sortOrder !== undefined && a.sortOrder !== null ? a.sortOrder : a.order;
      const bOrder = b.sortOrder !== undefined && b.sortOrder !== null ? b.sortOrder : b.order;
      return aOrder - bOrder;
    };

    // Sort pinned group
    pinned.sort(sortByOrder);

    // Sort unpinned group (General first, then by order)
    unpinned.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return sortByOrder(a, b);
    });

    return [...pinned, ...unpinned];
  }, [folders]);

  // Priority+ navigation: first 4 folders visible, rest in "More" dropdown
  const visibleFolders = useMemo(() => {
    return sortedFolders.slice(0, 4);
  }, [sortedFolders]);

  const moreFolders = useMemo(() => {
    return sortedFolders.slice(4);
  }, [sortedFolders]);

  // Filter more folders by search query
  const filteredMoreFolders = useMemo(() => {
    if (!moreSearchQuery.trim()) return moreFolders;
    const query = moreSearchQuery.toLowerCase();
    return moreFolders.filter(folder => 
      folder.name.toLowerCase().includes(query)
    );
  }, [moreFolders, moreSearchQuery]);

  // Loading skeleton
  if (isLoading && folders.length === 0) {
    return (
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shrink-0">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 w-20 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Left side: Bookmarks heading + Folder navigation bar matching Public/Private toggle style */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Bookmarks heading with count - positioned before folder bar */}
        {bookmarkCount !== undefined && (
          <span className="text-sm font-bold text-gray-900 dark:text-white shrink-0">
            Bookmarks <span className="opacity-60 font-normal text-xs">({bookmarkCount})</span>
          </span>
        )}

        {/* Folder pills container - matching Public/Private toggle bar layout exactly */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shrink-0 gap-1">
          {/* Visible folders (first 4) */}
          {visibleFolders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const count = folderCounts.get(folder.id) ?? 0;
            
            return (
              <button
                key={folder.id}
                onClick={() => onFolderSelect(folder.id)}
                className={`
                  px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shrink-0
                  ${isSelected
                    ? 'bg-primary-400 dark:bg-primary-500 text-gray-900 dark:text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'
                  }
                `}
                aria-label={`View folder ${folder.name}`}
                aria-pressed={isSelected}
              >
                <span>{folder.name}</span>
                {count > 0 && (
                  <span className="opacity-60 text-[10px]">{count}</span>
                )}
              </button>
            );
          })}

          {/* "More" dropdown button if there are more than 4 folders */}
          {moreFolders.length > 0 && (
            <div className="relative" ref={moreDropdownRef}>
              <button
                onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                className={`
                  px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shrink-0
                  ${showMoreDropdown
                    ? 'bg-primary-400 dark:bg-primary-500 text-gray-900 dark:text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'
                  }
                `}
                aria-label="Show more folders"
                aria-expanded={showMoreDropdown}
              >
                <span>More</span>
                <ChevronDown size={12} className={`transition-transform ${showMoreDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {showMoreDropdown && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 max-h-96 overflow-hidden flex flex-col">
                  {/* Search input if >10 folders */}
                  {sortedFolders.length > 10 && (
                    <div className="p-3 border-b border-gray-200 dark:border-slate-700">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search folders..."
                          value={moreSearchQuery}
                          onChange={(e) => setMoreSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                          autoFocus
                        />
                      </div>
                    </div>
                  )}

                  {/* Folder list */}
                  <div className="overflow-y-auto p-1">
                    {filteredMoreFolders.length > 0 ? (
                      filteredMoreFolders.map((folder) => {
                        const isSelected = selectedFolderId === folder.id;
                        const count = folderCounts.get(folder.id) ?? 0;
                        
                        return (
                          <button
                            key={folder.id}
                            onClick={() => {
                              onFolderSelect(folder.id);
                              setShowMoreDropdown(false);
                              setMoreSearchQuery('');
                            }}
                            className={`
                              w-full px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-between transition-colors
                              ${isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                                : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder size={14} className="shrink-0" />
                              <span className="truncate">{folder.name}</span>
                            </div>
                            {count > 0 && (
                              <span className={`text-[10px] shrink-0 ml-2 ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-slate-400'}`}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                        No folders found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Management actions with ghost-button style */}
      <div className="flex items-center gap-2 shrink-0">
        {onCreateFolder && (
          <button
            onClick={onCreateFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Create new folder"
          >
            <Plus size={14} className="shrink-0" />
            <span>New Folder</span>
          </button>
        )}
        {onManageFolders && folders.length > 0 && (
          <button
            onClick={onManageFolders}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Manage folders"
          >
            <Settings size={14} className="shrink-0" />
            <span>Manage Folders</span>
          </button>
        )}
      </div>
    </div>
  );
};
