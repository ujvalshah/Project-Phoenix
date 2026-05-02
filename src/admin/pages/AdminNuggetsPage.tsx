
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { DropdownPortal } from '@/components/UI/DropdownPortal';
import { AdminTable, Column } from '../components/AdminTable';
import { AdminSummaryBar } from '../components/AdminSummaryBar';
import { AdminCollection, AdminNugget } from '../types/admin';
import { adminNuggetsService } from '../services/adminNuggetsService';
import { AlertTriangle, Trash2, EyeOff, Globe, Lock, Video, Image as ImageIcon, Link as LinkIcon, StickyNote, CheckCircle2, FileText, PlusCircle, Edit2, Layout, LayoutGrid, Rows3, Search, Copy } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '../hooks/useAdminPermissions';
import { AdminDrawer } from '../components/AdminDrawer';
import { ConfirmActionModal } from '@/components/settings/ConfirmActionModal';
import { useAdminHeader } from '../layout/AdminLayout';
import { useSearchParams } from 'react-router-dom';
import { CreateNuggetModalLoadable } from '@/components/CreateNuggetModalLoadable';
import { storageService } from '@/services/storageService';
import { Article } from '@/types';
import { adminCollectionsService } from '../services/adminCollectionsService';
import { buildFeedImageResponsiveProps } from '@/utils/feedImageResponsive';
import { WORKSPACE_GRID_CARD_IMAGE_SIZES } from '@/constants/feedImageLayout';
import { getPriorityThumbnailCount } from '@/constants/aboveFoldPriority';

const NUGGETS_VIEW_MODE_STORAGE_KEY = 'admin_nuggets_view_mode';
const ADMIN_BATCH_ADD_CAP = 200;
/** Card grid uses `md:grid-cols-2 xl:grid-cols-3` — match feed priority budget. */
const ADMIN_CARD_GRID_COLUMNS = 3;

function getYouTubeThumbnail(url?: string): string | undefined {
  if (!url) return undefined;
  const idMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/
  );
  if (!idMatch?.[1]) return undefined;
  return `https://img.youtube.com/vi/${idMatch[1]}/hqdefault.jpg`;
}

export const AdminNuggetsPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const [nuggets, setNuggets] = useState<AdminNugget[]>([]);
  const [stats, setStats] = useState({ total: 0, flagged: 0, createdToday: 0, public: 0, private: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden' | 'flagged'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'link' | 'video' | 'document' | 'twitter'>('all');
  const [youtubeFilter, setYoutubeFilter] = useState<'all' | 'youtube' | 'non-youtube'>('all');
  const [streamFilter, setStreamFilter] = useState<'all' | 'standard' | 'pulse' | 'both'>('all');

  // Sorting
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection & UI
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [collectionOptions, setCollectionOptions] = useState<AdminCollection[]>([]);
  const [targetCollectionId, setTargetCollectionId] = useState('');
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [newCollectionParentId, setNewCollectionParentId] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'title', 'author', 'visibility', 'status', 'createdDate', 'createdTime', 'actions'
  ]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const collectionDropdownAnchorRef = useRef<HTMLButtonElement>(null);
  const [failedPreviewById, setFailedPreviewById] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window === 'undefined') return 'table';
    const saved = window.localStorage.getItem(NUGGETS_VIEW_MODE_STORAGE_KEY);
    return saved === 'cards' ? 'cards' : 'table';
  });

  // Actions
  const [selectedNugget, setSelectedNugget] = useState<AdminNugget | null>(null);
  const [itemToDelete, setItemToDelete] = useState<AdminNugget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ nugget: AdminNugget; timeoutId: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [articleToEdit, setArticleToEdit] = useState<Article | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [articleLoadError, setArticleLoadError] = useState<string | null>(null);

  const toast = useToast();
  const { can } = useAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const adminCardPreviewPriorityCount = useMemo(
    () => getPriorityThumbnailCount(ADMIN_CARD_GRID_COLUMNS),
    [],
  );

  useEffect(() => {
    setPageHeader("Content Management", "Review, moderate, and manage nuggets.");
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NUGGETS_VIEW_MODE_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Initialize filters from URL
  useEffect(() => {
    const q = searchParams.get('q');
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const tag = searchParams.get('tag');
    const source = searchParams.get('source');
    const youtube = searchParams.get('youtube');
    if (q) setSearchQuery(q);
    if (status === 'active' || status === 'hidden' || status === 'flagged') setStatusFilter(status);
    if (date) setDateFilter(date);
    if (tag) setTagFilter(tag);
    if (source === 'all' || source === 'link' || source === 'video' || source === 'document' || source === 'twitter') {
      setSourceTypeFilter(source);
    }
    if (youtube === 'all' || youtube === 'youtube' || youtube === 'non-youtube') {
      setYoutubeFilter(youtube);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (dateFilter) params.date = dateFilter;
    if (tagFilter) params.tag = tagFilter;
    if (sourceTypeFilter !== 'all') params.source = sourceTypeFilter;
    if (youtubeFilter !== 'all') params.youtube = youtubeFilter;
    if (streamFilter !== 'all') params.stream = streamFilter;
    setSearchParams(params, { replace: true });
  }, [searchQuery, statusFilter, dateFilter, tagFilter, sourceTypeFilter, youtubeFilter, streamFilter, setSearchParams]);

  // Memoize loadData to prevent recreation on every render
  // This prevents infinite loops in useEffect dependencies
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [nuggetsData, statsData] = await Promise.all([
        adminNuggetsService.listNuggets({
          status: statusFilter,
          query: searchQuery,
          tag: tagFilter,
          sourceType: sourceTypeFilter,
          youtubeMode: youtubeFilter,
          contentStream: streamFilter,
          page: currentPage,
          limit: pageSize,
        }),
        adminNuggetsService.getStats()
      ]);
      
      // Validate data before setting state
      if (!Array.isArray(nuggetsData.data)) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Invalid nuggets data:', nuggetsData);
        }
        setErrorMessage("Invalid data received from server. Please retry.");
        return;
      }
      
      if (!statsData || typeof statsData !== 'object') {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Invalid stats data:', statsData);
        }
        setErrorMessage("Invalid stats data received from server. Please retry.");
        return;
      }
      
      setNuggets(nuggetsData.data);
      setFilteredTotal(nuggetsData.total);
      setTotalPages(Math.max(1, Math.ceil(nuggetsData.total / nuggetsData.limit)));
      setStats(statsData);
      setErrorMessage(null);
    } catch (e: any) {
      if (e.message !== 'Request cancelled') {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Error loading data:', e);
        }
        setErrorMessage(`Could not load nuggets: ${e.message || 'Unknown error'}. Please retry.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery, tagFilter, sourceTypeFilter, youtubeFilter, streamFilter, currentPage, pageSize]);

  // Load data when statusFilter changes, with debounce
  useEffect(() => {
    const timer = setTimeout(loadData, 300);
    return () => clearTimeout(timer);
  }, [loadData]); // Now safe to include loadData since it's memoized

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, tagFilter, sourceTypeFilter, youtubeFilter]);

  useEffect(() => {
    const loadCollections = async () => {
      try {
        const data = await adminCollectionsService.listCollections();
        setCollectionOptions(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AdminNuggetsPage] Failed to load collection options', error);
        }
      }
    };
    loadCollections();
  }, []);

  useEffect(() => {
    setFailedPreviewById({});
  }, [nuggets, currentPage, viewMode]);

  useEffect(() => {
    if (!showCollectionDropdown) {
      setCollectionSearchQuery('');
    }
  }, [showCollectionDropdown]);

  // Derived state
  const processedNuggets = useMemo(() => {
    let result = [...nuggets];

    // Filter Date
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      result = result.filter(n => new Date(n.createdAt).toDateString() === filterDate);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortKey as keyof AdminNugget] || '';
      let valB: any = b[sortKey as keyof AdminNugget] || '';

      if (sortKey === 'author.name') {
        valA = (a.author?.name || '').toLowerCase();
        valB = (b.author?.name || '').toLowerCase();
      } else if (sortKey === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [nuggets, dateFilter, sortKey, sortDirection]);

  const collectionNameById = useMemo(
    () => new Map(collectionOptions.map((collection) => [collection.id, collection.name])),
    [collectionOptions]
  );

  const formatCollectionOptionLabel = useCallback((collection: AdminCollection) => {
    if (!collection.parentId) {
      return collection.name;
    }
    const parentName = collectionNameById.get(collection.parentId) || `Parent ${collection.parentId.slice(0, 6)}`;
    return `${collection.name} (${parentName})`;
  }, [collectionNameById]);

  const selectedCollectionLabel = useMemo(() => {
    if (!targetCollectionId) return 'Select collection';
    const selectedCollection = collectionOptions.find((collection) => collection.id === targetCollectionId);
    return selectedCollection ? formatCollectionOptionLabel(selectedCollection) : 'Select collection';
  }, [targetCollectionId, collectionOptions, formatCollectionOptionLabel]);

  const filteredCollectionOptions = useMemo(() => {
    const normalizedQuery = collectionSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return collectionOptions;
    return collectionOptions.filter((collection) =>
      formatCollectionOptionLabel(collection).toLowerCase().includes(normalizedQuery)
    );
  }, [collectionOptions, collectionSearchQuery, formatCollectionOptionLabel]);

  // Fetch full article data when entering edit mode
  useEffect(() => {
    const fetchArticleForEdit = async () => {
      if (selectedNugget && (editMode || duplicateMode)) {
        setIsLoadingArticle(true);
        setArticleLoadError(null);
        try {
          const article = await storageService.getArticleById(selectedNugget.id);
          if (article) {
            setArticleToEdit(article);
            setArticleLoadError(null);
          } else {
            setArticleLoadError('Article not found');
            setArticleToEdit(null);
          }
        } catch (error: any) {
          // Don't show error for cancelled requests (they're expected during cleanup)
          if (error?.message !== 'Request cancelled') {
            console.error('[AdminNuggetsPage] Error fetching article:', error);
            setArticleLoadError(error?.message || 'Failed to load nugget data for editing');
            setArticleToEdit(null);
          } else {
            // Request was cancelled - clear error state
            setArticleLoadError(null);
            setArticleToEdit(null);
          }
        } finally {
          setIsLoadingArticle(false);
        }
      } else {
        setArticleToEdit(null);
        setArticleLoadError(null);
      }
    };

    fetchArticleForEdit();
  }, [selectedNugget, editMode, duplicateMode]);

  const handleStatusChange = async (nugget: AdminNugget, newStatus: 'active' | 'hidden') => {
    try {
      await adminNuggetsService.updateNuggetStatus(nugget.id, newStatus);
      setNuggets(prev => prev.map(n => n.id === nugget.id ? { ...n, status: newStatus } : n));
      const newStats = await adminNuggetsService.getStats();
      setStats(newStats);
      toast.success(newStatus === 'active' ? 'Nugget Approved' : 'Nugget Hidden');
    } catch (e) {
      toast.error("Action failed");
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const nugget = itemToDelete;
    // Optimistic remove; commit after 5s unless undone
    setNuggets(prev => prev.filter(n => n.id !== nugget.id));
    setItemToDelete(null);
    const timeoutId = window.setTimeout(async () => {
      try {
        await adminNuggetsService.deleteNugget(nugget.id);
        const newStats = await adminNuggetsService.getStats();
        setStats(newStats);
        setPendingDelete(null);
        toast.success("Nugget deleted");
      } catch (e) {
        // rollback on failure
        setNuggets(prev => [...prev, nugget]);
        setPendingDelete(null);
        toast.error("Delete failed. Changes reverted.");
      }
    }, 5000);
    setPendingDelete({ nugget, timeoutId });
  };

  const handleCreateCollection = useCallback(async () => {
    const trimmedName = newCollectionName.trim();
    if (!trimmedName) {
      toast.error('Collection name is required');
      return;
    }
    setIsCreatingCollection(true);
    try {
      const created = await adminCollectionsService.createCollection({
        name: trimmedName,
        description: newCollectionDescription.trim(),
        type: 'public',
        parentId: newCollectionParentId || null,
      });
      setCollectionOptions((prev) => [created, ...prev]);
      setTargetCollectionId(created.id);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setNewCollectionParentId('');
      toast.success('Collection created');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create collection');
    } finally {
      setIsCreatingCollection(false);
    }
  }, [newCollectionName, newCollectionDescription, newCollectionParentId, toast]);

  const handleBulkAction = useCallback(async () => {
    if (!targetCollectionId) {
      toast.error('Select a target collection first');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one nugget');
      return;
    }
    if (selectedIds.length > ADMIN_BATCH_ADD_CAP) {
      toast.error(`You can add up to ${ADMIN_BATCH_ADD_CAP} nuggets at once. Reduce your selection and try again.`);
      return;
    }
    setIsAssigning(true);
    try {
      await adminCollectionsService.addNuggetsToCollection(targetCollectionId, selectedIds);
      setSelectedIds([]);
      toast.success(`Added ${selectedIds.length} nugget(s) to collection`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add nuggets to collection');
    } finally {
      setIsAssigning(false);
    }
  }, [selectedIds, targetCollectionId, toast]);

  // Memoize getTypeIcon to prevent recreation on every render
  const getTypeIcon = useCallback((type: string) => {
    switch(type) {
        case 'video': return <Video size={14} />;
        case 'image': return <ImageIcon size={14} />;
        case 'link': return <LinkIcon size={14} />;
        default: return <StickyNote size={14} />;
    }
  }, []);

  // Memoize columns array to prevent AdminTable re-renders
  // Columns are stable and don't depend on component state
  const allColumns: Column<AdminNugget>[] = useMemo(() => [
    {
      key: 'serial',
      header: '#',
      width: 'w-16',
      minWidth: '64px',
      align: 'center',
      render: (_n, index) => (
        <span className="text-[11px] font-semibold text-slate-500">
          {(currentPage - 1) * pageSize + index + 1}
        </span>
      )
    },
    {
      key: 'id',
      header: 'ID',
      width: 'w-20',
      minWidth: '80px',
      render: (n) => <span className="text-[10px] font-mono text-slate-400">#{n.id.split('-')[1]}</span>
    },
    {
      key: 'title',
      header: 'Title & Snippet',
      width: 'w-72',
      minWidth: '280px',
      sortable: true,
      sticky: 'left',
      render: (n) => (
        <div className="flex gap-3 py-1">
          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${n.status === 'flagged' ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {getTypeIcon(n.type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400 truncate group-hover:text-indigo-500 transition-colors">
              {n.title || 'Untitled'}
            </div>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{n.excerpt || 'No description'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'author',
      header: 'Author',
      width: 'w-40',
      minWidth: '150px',
      sortable: true,
      sortKey: 'author.name',
      render: (n) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{n.author.name}</span>
      )
    },
    {
      key: 'visibility',
      header: 'Visibility',
      width: 'w-28',
      minWidth: '100px',
      sortable: true,
      render: (n) => (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
            {n.visibility === 'public' ? <Globe size={12} /> : <Lock size={12} />}
            {n.visibility}
          </span>
          <span className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
            n.lifecycleStatus === 'draft'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}>
            {n.lifecycleStatus === 'draft' ? 'Draft' : 'Published'}
          </span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      render: (n) => (
        <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold capitalize border ${n.status === 'flagged' ? 'bg-red-50 text-red-700 border-red-200' : n.status === 'hidden' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {n.status === 'flagged' && <AlertTriangle size={8} />}
                {n.status}
            </span>
            {n.reports > 0 && (
                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 rounded-full">{n.reports} reports</span>
            )}
        </div>
      )
    },
    {
      key: 'createdDate',
      header: 'Created Date',
      width: 'w-32',
      minWidth: '120px',
      sortable: true,
      sortKey: 'createdAt',
      render: (n) => <span className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
    },
    {
      key: 'createdTime',
      header: 'Time',
      width: 'w-24',
      minWidth: '100px',
      render: (n) => <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-32',
      minWidth: '130px',
      sticky: 'right',
      render: (n) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => { 
              setSelectedNugget(n); 
              setDuplicateMode(false);
              setEditMode(true); 
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 rounded-md text-[10px] font-bold transition-colors"
            title="Edit Nugget"
          >
            <Edit2 size={14} />
            <span className="hidden md:inline">Edit</span>
          </button>
          <button
            onClick={() => {
              setSelectedNugget(n);
              setEditMode(false);
              setDuplicateMode(true);
              toast.info(`Duplicating "${n.title?.trim() || 'Untitled'}"`);
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 rounded-md text-[10px] font-bold transition-colors"
            title="Duplicate Nugget"
          >
            <Copy size={14} />
            <span className="hidden md:inline">Duplicate</span>
          </button>
          
          {can('admin.nuggets.hide') && (
            <button 
              onClick={() => handleStatusChange(n, n.status === 'active' ? 'hidden' : 'active')} 
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold border transition-colors ${n.status === 'active' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-green-50 border-green-100 text-green-700 hover:bg-green-100'}`}
              title={n.status === 'active' ? "Hide Content" : "Approve Content"}
            >
              {n.status === 'active' ? <EyeOff size={14} /> : <CheckCircle2 size={14} />}
            </button>
          )}
          {can('admin.nuggets.delete') && (
            <button 
              onClick={() => setItemToDelete(n)} 
              className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-md text-[10px] font-bold transition-colors"
              title="Delete Permanently"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ], [getTypeIcon, can, currentPage, pageSize]); // Memoize columns - only recreate if dependencies change

  const activeColumns = useMemo(() => 
    allColumns.filter(c => visibleColumns.includes(c.key)), 
    [allColumns, visibleColumns]
  );

  // Memoize Filters JSX to prevent re-renders
  const Filters = useMemo(() => (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
        <button
          onClick={() => setViewMode('table')}
          className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
            viewMode === 'table'
              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100'
              : 'text-slate-500 dark:text-slate-300'
          }`}
          title="Table view"
        >
          <Rows3 size={12} />
          Table
        </button>
        <button
          onClick={() => setViewMode('cards')}
          className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
            viewMode === 'cards'
              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100'
              : 'text-slate-500 dark:text-slate-300'
          }`}
          title="Card view"
        >
          <LayoutGrid size={12} />
          Cards
        </button>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="text-[10px] bg-transparent font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer px-2 py-1">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="flagged">Flagged</option>
        </select>
      </div>

      <div className="relative flex items-center">
        <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Tag"
            className="pl-3 pr-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 w-28"
        />
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
        <select value={sourceTypeFilter} onChange={(e) => setSourceTypeFilter(e.target.value as any)} className="text-[10px] bg-transparent font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer px-2 py-1">
            <option value="all">All Sources</option>
            <option value="link">Link</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
            <option value="twitter">Twitter</option>
        </select>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
        <select value={youtubeFilter} onChange={(e) => setYoutubeFilter(e.target.value as any)} className="text-[10px] bg-transparent font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer px-2 py-1">
            <option value="all">All Media</option>
            <option value="youtube">YouTube Only</option>
            <option value="non-youtube">Non-YouTube</option>
        </select>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
        <select value={streamFilter} onChange={(e) => setStreamFilter(e.target.value as any)} className="text-[10px] bg-transparent font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer px-2 py-1">
            <option value="all">All Streams</option>
            <option value="standard">Standard</option>
            <option value="pulse">Pulse</option>
            <option value="both">Both</option>
        </select>
      </div>

      <div className="relative flex items-center">
        <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-3 pr-2 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {viewMode === 'table' && (
      <div className="relative inline-flex">
        <button
            ref={columnMenuAnchorRef}
            type="button"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            aria-label="Toggle column visibility"
            aria-expanded={showColumnMenu}
            aria-haspopup="menu"
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
            <Layout size={12} /> Columns
        </button>
        <DropdownPortal
            isOpen={showColumnMenu}
            anchorRef={columnMenuAnchorRef}
            align="right"
            host="dropdown"
            offsetY={8}
            onClickOutside={() => setShowColumnMenu(false)}
            className="w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2 max-h-64 overflow-y-auto custom-scrollbar"
        >
            {allColumns.filter(c => c.key !== 'title' && c.key !== 'actions').map(col => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={visibleColumns.includes(col.key)}
                        onChange={(e) => {
                            if (e.target.checked) setVisibleColumns([...visibleColumns, col.key]);
                            else setVisibleColumns(visibleColumns.filter(k => k !== col.key));
                        }}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{col.header}</span>
                </label>
            ))}
        </DropdownPortal>
      </div>
      )}
    </div>
  ), [statusFilter, dateFilter, tagFilter, sourceTypeFilter, youtubeFilter, streamFilter, showColumnMenu, visibleColumns, allColumns, viewMode]);

  // Memoize BulkActions to prevent re-renders
  const BulkActions = useMemo(() => selectedIds.length > 0 ? (
      <div className="flex min-w-0 w-full max-w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:max-w-[min(100%,36rem)] animate-in fade-in slide-in-from-right-2 duration-200 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-2 py-1.5">
          <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{selectedIds.length} selected</span>
          {selectedIds.length > ADMIN_BATCH_ADD_CAP && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300 whitespace-nowrap">
              <AlertTriangle size={12} />
              Max {ADMIN_BATCH_ADD_CAP} per add
            </span>
          )}
          <div className="relative min-w-0 w-full max-w-full flex-1 basis-[10rem] sm:w-auto sm:min-w-[11rem] sm:max-w-[14rem] md:max-w-[18rem]">
            <button
              ref={collectionDropdownAnchorRef}
              type="button"
              onClick={() => setShowCollectionDropdown((prev) => !prev)}
              aria-label="Target collection for bulk add"
              aria-haspopup="listbox"
              aria-expanded={showCollectionDropdown}
              className="box-border flex w-full min-w-0 max-w-full items-center justify-between gap-2 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            >
              <span className="truncate">{selectedCollectionLabel}</span>
              <span className="text-slate-400">▾</span>
            </button>
            <DropdownPortal
              isOpen={showCollectionDropdown}
              anchorRef={collectionDropdownAnchorRef}
              align="left"
              host="dropdown"
              offsetY={8}
              onClickOutside={() => setShowCollectionDropdown(false)}
              className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2"
            >
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  value={collectionSearchQuery}
                  onChange={(e) => setCollectionSearchQuery(e.target.value)}
                  placeholder="Search collections..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-7 pr-2 text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="max-h-56 overflow-y-auto custom-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setTargetCollectionId('');
                    setShowCollectionDropdown(false);
                  }}
                  className="w-full text-left rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Select collection
                </button>
                {filteredCollectionOptions.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-slate-400">No collections found</div>
                ) : (
                  filteredCollectionOptions.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => {
                        setTargetCollectionId(collection.id);
                        setShowCollectionDropdown(false);
                      }}
                      className={`w-full text-left rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        targetCollectionId === collection.id
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {formatCollectionOptionLabel(collection)}
                    </button>
                  ))
                )}
              </div>
            </DropdownPortal>
          </div>
          <button
            onClick={handleBulkAction}
            disabled={isAssigning || !targetCollectionId || selectedIds.length > ADMIN_BATCH_ADD_CAP}
            className="shrink-0 px-3 py-1.5 bg-primary-500 text-white hover:bg-primary-600 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isAssigning ? 'Adding...' : 'Add to collection'}
          </button>
      </div>
  ) : null, [selectedIds.length, targetCollectionId, collectionOptions, formatCollectionOptionLabel, handleBulkAction, isAssigning, showCollectionDropdown, selectedCollectionLabel, filteredCollectionOptions, collectionSearchQuery]);

  const CardToolbar = useMemo(() => (
    <div
      className={`flex min-w-0 gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${
        BulkActions ? 'flex-col' : 'flex-col md:flex-row md:items-center md:justify-between'
      }`}
    >
      <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full min-w-[min(100%,12rem)] max-w-full sm:max-w-none md:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            aria-label="Search nuggets"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-48 lg:w-64"
          />
        </div>
        {Filters}
      </div>
      {BulkActions && (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800 md:border-t-0 md:pt-0">
          {BulkActions}
        </div>
      )}
    </div>
  ), [searchQuery, Filters, BulkActions]);

  return (
    <div className="space-y-4">
      {pendingDelete && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            Deleted &ldquo;{pendingDelete.nugget.title || 'nugget'}&rdquo;. Undo?
          </span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                clearTimeout(pendingDelete.timeoutId);
                setNuggets(prev => [pendingDelete.nugget, ...prev]);
                setPendingDelete(null);
              }}
              className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
            >
              Undo
            </button>
            <span className="text-[10px] text-slate-500">5s</span>
          </div>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorMessage}</span>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <AdminSummaryBar 
        items={[
          { label: 'Total Nuggets', value: stats.total, icon: <FileText size={18} /> },
          { label: 'Public', value: stats.public, icon: <Globe size={18} /> },
          { label: 'Private', value: stats.private, icon: <Lock size={18} /> },
          { label: 'Created Today', value: stats.createdToday, icon: <PlusCircle size={18} />, hint: 'New content velocity' },
        ]}
        isLoading={isLoading}
      />
      <div className="text-xs text-slate-500 px-1">
        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{processedNuggets.length}</span> on page {currentPage} of {totalPages}
        {' '}from <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredTotal}</span> filtered nuggets.
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
        <div className="text-xs font-bold text-slate-500 uppercase mb-2">Create Community Collection</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Collection name"
            className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg min-w-52"
          />
          <input
            type="text"
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            placeholder="Description (optional)"
            className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg min-w-52"
          />
          <select
            value={newCollectionParentId}
            onChange={(e) => setNewCollectionParentId(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg min-w-44"
          >
            <option value="">Root collection</option>
            {collectionOptions
              .filter((collection) => !collection.parentId)
              .map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
          </select>
          <button
            onClick={handleCreateCollection}
            disabled={isCreatingCollection}
            className="px-3 py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreatingCollection ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <AdminTable
          columns={activeColumns}
          data={processedNuggets}
          isLoading={isLoading}
          filters={Filters}
          actions={BulkActions}
          onSearch={setSearchQuery}
          virtualized
          pagination={{
            page: currentPage,
            totalPages,
            onPageChange: setCurrentPage,
          }}
          showTopPagination
          emptyState={
            <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
              <p className="text-sm font-semibold">No nuggets match the current filters.</p>
              <p className="text-xs text-slate-400">Try clearing search, status, or date filters.</p>
              <p className="text-xs text-slate-400">Showing page {currentPage} of {totalPages}.</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDateFilter('');
                    setTagFilter('');
                    setSourceTypeFilter('all');
                    setYoutubeFilter('all');
                    loadData();
                  }}
                  className="px-3 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Clear filters
                </button>
                <button
                  onClick={loadData}
                  className="px-3 py-1 text-xs font-bold rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          }
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(k, d) => { setSortKey(k); setSortDirection(d); }}
          onRowClick={(n) => { setEditMode(false); setDuplicateMode(false); setSelectedNugget(n); }}
          selection={{
            enabled: true,
            selectedIds: selectedIds,
            onSelect: setSelectedIds
          }}
        />
      ) : (
        <div className="space-y-3">
          {CardToolbar}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            {processedNuggets.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
                <p className="text-sm font-semibold">No nuggets match the current filters.</p>
                <p className="text-xs text-slate-400">Try clearing search, status, or date filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {processedNuggets.map((nugget, index) => {
                  const isSelected = selectedIds.includes(nugget.id);
                  const serial = (currentPage - 1) * pageSize + index + 1;
                  const mediaPreview = nugget.thumbnailUrl || (nugget.isYoutube ? getYouTubeThumbnail(nugget.sourceUrl) : undefined);
                  const canShowPreview = Boolean(mediaPreview) && !failedPreviewById[nugget.id];
                  const previewResponsive = mediaPreview
                    ? buildFeedImageResponsiveProps(mediaPreview)
                    : null;
                  const priorityPreview = index < adminCardPreviewPriorityCount;
                  return (
                    <article
                      key={nugget.id}
                      onClick={() => { setEditMode(false); setDuplicateMode(false); setSelectedNugget(nugget); }}
                      className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary-300 bg-primary-50/40 dark:bg-primary-900/10'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select nugget ${nugget.title || nugget.id}`}
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds((prev) => [...prev, nugget.id]);
                              else setSelectedIds((prev) => prev.filter((id) => id !== nugget.id));
                            }}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-[11px] font-semibold text-slate-500">#{serial}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{new Date(nugget.createdAt).toLocaleDateString()}</div>
                      </div>

                      <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 h-40">
                        {canShowPreview && previewResponsive ? (
                          <img
                            src={previewResponsive.src}
                            srcSet={previewResponsive.srcSet}
                            sizes={WORKSPACE_GRID_CARD_IMAGE_SIZES}
                            width={640}
                            height={360}
                            alt={nugget.title || 'Nugget preview'}
                            className="w-full h-full object-cover"
                            decoding="async"
                            loading={priorityPreview ? 'eager' : 'lazy'}
                            fetchPriority={priorityPreview ? 'high' : undefined}
                            onError={() => {
                              setFailedPreviewById((prev) => ({ ...prev, [nugget.id]: true }));
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            {nugget.isYoutube ? <Video size={28} /> : nugget.type === 'image' ? <ImageIcon size={28} /> : <StickyNote size={28} />}
                          </div>
                        )}
                        {nugget.sourceUrl && (
                          <a
                            href={nugget.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-2 right-2 px-2 py-1 text-[10px] font-bold bg-black/70 text-white rounded-md hover:bg-black/80"
                          >
                            Source
                          </a>
                        )}
                      </div>

                      <h3 className="mt-3 text-sm font-bold text-indigo-700 dark:text-indigo-300 line-clamp-2">
                        {nugget.title || 'Untitled'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-3">{nugget.excerpt || 'No description'}</p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">{nugget.author.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">{nugget.visibility}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          nugget.status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>{nugget.status}</span>
                        {nugget.isYoutube && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">YouTube</span>}
                      </div>

                      {Array.isArray(nugget.tags) && nugget.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {nugget.tags.slice(0, 3).map((tag) => (
                            <span key={`${nugget.id}-${tag}`} className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedNugget(nugget);
                            setDuplicateMode(false);
                            setEditMode(true);
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedNugget(nugget);
                            setEditMode(false);
                            setDuplicateMode(true);
                            toast.info(`Duplicating "${nugget.title?.trim() || 'Untitled'}"`);
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50"
                        >
                          Duplicate
                        </button>
                        {can('admin.nuggets.hide') && (
                          <button
                            onClick={() => handleStatusChange(nugget, nugget.status === 'active' ? 'hidden' : 'active')}
                            className="px-2 py-1 text-[10px] font-bold bg-white border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50"
                          >
                            {nugget.status === 'active' ? 'Hide' : 'Approve'}
                          </button>
                        )}
                        {can('admin.nuggets.delete') && (
                          <button
                            onClick={() => setItemToDelete(nugget)}
                            className="px-2 py-1 text-[10px] font-bold bg-red-50 border border-red-100 rounded-md text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 rounded-md border border-slate-200 text-xs disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 rounded-md border border-slate-200 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* View-only drawer - only show when NOT in edit mode */}
      <AdminDrawer 
        isOpen={!!selectedNugget && !editMode && !duplicateMode && !isLoadingArticle} 
        onClose={() => { setSelectedNugget(null); setEditMode(false); setDuplicateMode(false); setArticleToEdit(null); }} 
        title="Nugget Details" 
        width="lg"
      >
        {selectedNugget && (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-2">{selectedNugget.title || ''}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Posted by {selectedNugget.author.name}</span>
                        <span>•</span>
                        <span>{new Date(selectedNugget.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <div>
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">{selectedNugget.excerpt}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-slate-400 font-bold uppercase mb-1">Status</span>
                        <span className="font-medium capitalize">{selectedNugget.status}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-slate-400 font-bold uppercase mb-1">Reports</span>
                        <span className="font-medium">{selectedNugget.reports}</span>
                    </div>
                </div>
            </div>
        )}
      </AdminDrawer>

      {/* Full-featured Edit Modal */}
      {/* Only show modal when article is loaded AND not loading */}
      {!isLoadingArticle && editMode && articleToEdit && (
        <CreateNuggetModalLoadable
          isOpen
          onClose={async () => {
            // Refresh admin list after edit modal closes (handles both save and cancel)
            // The modal already invalidates query cache, but admin page uses direct service calls
            try {
              await loadData();
            } catch (error) {
              console.error('[AdminNuggetsPage] Error refreshing after edit:', error);
            }
            setEditMode(false);
            setDuplicateMode(false);
            setSelectedNugget(null);
            setArticleToEdit(null);
          }}
          mode="edit"
          initialData={articleToEdit}
        />
      )}
      {!isLoadingArticle && duplicateMode && articleToEdit && (
        <CreateNuggetModalLoadable
          isOpen
          onClose={async () => {
            try {
              await loadData();
            } catch (error) {
              console.error('[AdminNuggetsPage] Error refreshing after duplicate modal close:', error);
            }
            setEditMode(false);
            setDuplicateMode(false);
            setSelectedNugget(null);
            setArticleToEdit(null);
          }}
          mode="create"
          prefillData={articleToEdit}
        />
      )}
      
      {/* Show loading/error state while fetching article */}
      {(editMode || duplicateMode) && (isLoadingArticle || articleLoadError) && (
        <AdminDrawer
          isOpen={true}
          onClose={() => {
            setEditMode(false);
            setDuplicateMode(false);
            setSelectedNugget(null);
            setArticleToEdit(null);
            setArticleLoadError(null);
          }}
          title={articleLoadError ? "Error" : "Loading..."}
          width="lg"
        >
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              {articleLoadError ? (
                <>
                  <div className="text-red-500 mb-4">
                    <AlertTriangle size={48} className="mx-auto" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Failed to load nugget</p>
                  <p className="text-xs text-slate-500 mb-4">{articleLoadError}</p>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setDuplicateMode(false);
                      setSelectedNugget(null);
                      setArticleToEdit(null);
                      setArticleLoadError(null);
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-sm text-slate-500">Loading nugget data for editing...</p>
                </>
              )}
            </div>
          </div>
        </AdminDrawer>
      )}

      <ConfirmActionModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDelete} title="Delete Nugget?" description="Permanently remove this content." actionLabel="Delete" isDestructive />
    </div>
  );
};
