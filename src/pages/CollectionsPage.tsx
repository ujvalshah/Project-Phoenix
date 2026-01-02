import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Collection } from '@/types';
import { storageService } from '@/services/storageService';
import { Search, LayoutGrid, List, ArrowUp, ArrowDown, ChevronDown, Plus, X, Folder, CheckSquare } from 'lucide-react';
import { EmptyState } from '@/components/UI/EmptyState';
import { useNavigate } from 'react-router-dom';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { TableView } from '@/components/collections/TableView';
import { createPortal } from 'react-dom';
import { useToast } from '@/hooks/useToast';
import { Tooltip } from '@/components/UI/Tooltip';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';

type ViewMode = 'grid' | 'table';
type SortField = 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
type SortDirection = 'asc' | 'desc';

// -- Internal Instruction Modal --
const CreateCollectionInstructionModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in zoom-in-95">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X size={20} />
        </button>
        
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mb-4">
            <Folder size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">How to create a Collection</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Collections must start with at least one nugget. <br/>
            To create a new one, find any nugget in your feed, click the <strong>Folder Icon</strong>, and select <strong>"Create new public collection"</strong>.
          </p>
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0); // Backend-provided count
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showInstruction, setShowInstruction] = useState(false);

  // Selection State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    loadCollections();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    if (isActionMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionMenuOpen]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      // Request collections with type=public filter and includeCount=true
      // This ensures we get the backend count for public collections only
      const [collectionsResponse, allUsersResponse] = await Promise.all([
          storageService.getCollections({ type: 'public', includeCount: true }),
          storageService.getUsers()
      ]);

      // Ensure allUsers is an array
      const allUsers = Array.isArray(allUsersResponse) ? allUsersResponse : [];

      // Handle response: could be array (legacy) or object with data and count
      let collectionsData: Collection[] = [];
      let count = 0;
      
      if (Array.isArray(collectionsResponse)) {
        collectionsData = collectionsResponse;
        count = collectionsData.length; // Fallback to array length if count not provided
      } else if (collectionsResponse && typeof collectionsResponse === 'object' && 'data' in collectionsResponse) {
        collectionsData = collectionsResponse.data || [];
        count = collectionsResponse.count || collectionsData.length;
      }

      const hydrated = collectionsData.map(col => ({
          ...col,
          creator: allUsers.find(u => u.id === col.creatorId)
      }));

      setCollections(hydrated);
      setTotalCount(count); // Store backend-provided count
    } catch (error: any) {
      // Handle cancelled requests gracefully
      if (error?.message !== 'Request cancelled') {
        console.error('Error loading collections:', error);
      }
      setCollections([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const processedCollections = useMemo(() => {
    let result = [...collections];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)));
    }
    result.sort((a, b) => {
        let valA: any, valB: any;
        switch (sortField) {
            case 'created': valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
            case 'updated': valA = new Date(a.updatedAt || a.createdAt).getTime(); valB = new Date(b.updatedAt || b.createdAt).getTime(); break;
            case 'followers': valA = a.followersCount; valB = b.followersCount; break;
            case 'nuggets': valA = a.validEntriesCount ?? a.entries?.length ?? 0; valB = b.validEntriesCount ?? b.entries?.length ?? 0; break;
            case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
            default: return 0;
        }
        return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return result;
  }, [collections, searchQuery, sortField, sortDirection]);

  const toggleSelectionMode = () => {
      const newMode = !selectionMode;
      setSelectionMode(newMode);
      if (!newMode) setSelectedIds([]);
  };

  const handleSelect = (id: string) => {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkFollow = async (action: 'follow' | 'unfollow') => {
      if (selectedIds.length === 0) return;
      
      // Store previous state for rollback
      const previousCollections = [...collections];
      
      // Optimistic update
      setCollections(prev => prev.map(c => {
          if (selectedIds.includes(c.id)) {
              const change = action === 'follow' ? 1 : -1;
              const newFollowersCount = Math.max(0, c.followersCount + change);
              return { 
                  ...c, 
                  followersCount: newFollowersCount,
                  followers: action === 'follow' 
                      ? [...(c.followers || []), 'temp'] // Temporary, will be updated by backend
                      : (c.followers || []).slice(0, -1) // Remove last (optimistic)
              };
          }
          return c;
      }));

      try {
          // Parallel API calls
          await Promise.all(
              selectedIds.map(id => 
                  action === 'follow' 
                      ? storageService.followCollection(id)
                      : storageService.unfollowCollection(id)
              )
          );
          
          // Reload collections to get accurate state from backend
          await loadCollections();
          
          toast.success(`${action === 'follow' ? 'Followed' : 'Unfollowed'} ${selectedIds.length} collections`);
          setSelectionMode(false);
          setSelectedIds([]);
          setIsActionMenuOpen(false);
      } catch (error: any) {
          // Rollback on error
          setCollections(previousCollections);
          toast.error(`Failed to ${action} collections`);
      }
  };

  const handleCollectionUpdate = (updatedCollection: Collection) => {
      setCollections(prev => prev.map(c => 
          c.id === updatedCollection.id ? updatedCollection : c
      ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
        <HeaderSpacer />
        <div 
          className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR}`}
          style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
        >
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-64 animate-pulse" />
          </div>
        </div>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-2/3 mb-5" />
                <div className="flex gap-4 mt-auto pt-3 border-t border-gray-100 dark:border-slate-800">
                  <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-16" />
                  <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <HeaderSpacer />
      {/* Unified Light Theme Toolbar - matches Header aesthetic */}
      <div 
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR} transition-colors`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">Community Collections</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xl">Curated themes and topics shared across the Nuggets ecosystem.</p>
                    </div>
                    
                    <div className="flex gap-2 items-center self-end md:self-auto">
                        {/* Select Toggle */}
                        {collections.length > 0 && (
                            <>
                                {selectionMode ? (
                                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <span className="text-xs font-bold text-gray-600 dark:text-slate-300 ml-2">{selectedIds.length} Selected</span>
                                        
                                        <div className="relative" ref={actionMenuRef}>
                                            <button 
                                                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                                                disabled={selectedIds.length === 0}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-gray-900 rounded-lg text-xs font-bold hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Actions <ChevronDown size={14} />
                                            </button>
                                            
                                            {isActionMenuOpen && (
                                                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                                                    <button onClick={() => handleBulkFollow('follow')} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
                                                        <Plus size={14} /> Follow All
                                                    </button>
                                                    <div className="h-px bg-gray-100 dark:bg-slate-800" />
                                                    <button onClick={() => handleBulkFollow('unfollow')} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                                                        <X size={14} /> Unfollow All
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={toggleSelectionMode}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <Tooltip content="Select collections to follow/unfollow">
                                        <button 
                                            onClick={toggleSelectionMode}
                                            className="flex items-center gap-2 px-3 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-900/30 rounded-xl text-sm font-bold transition-all shadow-sm"
                                        >
                                            <CheckSquare size={16} /> Select
                                        </button>
                                    </Tooltip>
                                )}
                            </>
                        )}
                        
                        {!selectionMode && (
                            <button 
                                onClick={() => setShowInstruction(true)} 
                                className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-sm"
                            >
                                <Plus size={16} /> Create
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Row */}
                <div className={`flex flex-col md:flex-row gap-4 items-center justify-between w-full transition-opacity duration-300 ${selectionMode ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="relative w-full md:max-w-2xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Search collections..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-yellow-400 dark:focus:border-yellow-500 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 transition-all shadow-sm" />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-0.5 shadow-sm">
                            <div className="relative shrink-0 border-r border-gray-200 dark:border-slate-700 pr-1">
                                <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} className="appearance-none pl-3 pr-8 py-2 bg-transparent text-sm font-medium text-gray-700 dark:text-slate-200 focus:outline-none cursor-pointer w-[140px]">
                                    <option value="created">Created Date</option>
                                    <option value="updated">Last Updated</option>
                                    <option value="followers">Followers</option>
                                    <option value="nuggets">Nugget Count</option>
                                    <option value="name">Name (A-Z)</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            </div>
                            <button onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                                {sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                            </button>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shrink-0 shadow-sm">
                            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}><List size={18} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}><LayoutGrid size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {processedCollections.length === 0 ? (
            <EmptyState icon={<Search />} title="No collections found" description={searchQuery ? `We couldn't find anything matching "${searchQuery}".` : "Be the first to create a community collection!"} />
        ) : (
            <div className={`animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {processedCollections.map(col => (
                            <CollectionCard 
                                key={col.id} 
                                collection={col} 
                                onClick={() => selectionMode ? handleSelect(col.id) : navigate(`/collections/${col.id}`)} 
                                selectionMode={selectionMode}
                                isSelected={selectedIds.includes(col.id)}
                                onSelect={handleSelect}
                                onCollectionUpdate={handleCollectionUpdate}
                            />
                        ))}
                    </div>
                ) : (
                    <TableView collections={processedCollections} onClick={(id) => navigate(`/collections/${id}`)} />
                )}
            </div>
        )}
      </div>

      {showInstruction && <CreateCollectionInstructionModal isOpen={showInstruction} onClose={() => setShowInstruction(false)} />}
    </div>
  );
};
