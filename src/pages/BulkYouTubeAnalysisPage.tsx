/**
 * Bulk YouTube Analysis Page
 * 
 * A dedicated page for batch processing YouTube videos through Gemini AI.
 * 
 * ARCHITECTURE:
 * - Sequential queue: Process one URL at a time (for...of loop)
 * - Map-based state: Track each row's status with Map<id, RowState>
 * - Draft persistence: Store draftId after each successful AI analysis
 * - Import Selected: Flip visibility to public for selected drafts
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { queryClient } from '@/queryClient';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { KeyStatusWidget } from '@/components/admin/KeyStatusWidget';
import { LayoutPreviewToggle, LayoutMode } from '@/components/admin/LayoutPreviewToggle';
import { NewsCard } from '@/components/NewsCard';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';
import type { Article } from '@/types';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Youtube, 
  Sparkles, 
  Trash2,
  Globe,
  Play,
  AlertCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get authentication token from localStorage
 * Returns the token string or empty string if not found
 */
function getAuthToken(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('nuggets_auth_data_v2');
      if (stored) {
        const { token } = JSON.parse(stored);
        return token || '';
      }
    }
  } catch (e) {
    console.warn('[Auth] Failed to parse auth token from storage', e);
  }
  return '';
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * NuggetIntelligence - Matches backend schema
 */
interface NuggetIntelligence {
  title: string;
  metadata: {
    source: string;
    speaker: string;
    category: 'Macro' | 'Economy' | 'Geopolitics' | 'Tech' | 'AI' | 'Finance';
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  };
  abstract: string;
  domainIntelligence: {
    primarySignal: string;
    impact: string;
    metric?: string;
  };
  dataVault: Array<{
    label: string;
    value: string;
    timestamp?: string;
  }>;
  visualAnchor: {
    anecdote: string;
    actionableTakeaway: string;
  };
  frictionPoint: string;
}

/**
 * Row status for the queue
 */
type RowStatus = 'pending' | 'analyzing' | 'analyzed' | 'error';

/**
 * Row state stored in the Map
 */
interface RowState {
  id: string;
  url: string;
  status: RowStatus;
  selected: boolean;
  intelligence?: NuggetIntelligence;
  draftId?: string; // Article ID after draft creation
  errorMessage?: string;
  cacheHit?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate unique row ID
 */
function generateId(): string {
  return `yt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com') {
      if (url.pathname === '/watch' && url.searchParams.has('v')) return true;
      if (url.pathname.startsWith('/embed/')) return true;
      if (url.pathname.startsWith('/v/')) return true;
    }
    
    if (hostname === 'youtu.be') {
      return url.pathname.length > 1;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname.includes('youtube.com') && url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
    if (hostname === 'youtu.be') {
      return url.pathname.slice(1).split('?')[0];
    }
    if (hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
      return url.pathname.slice(7).split('?')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse URLs from textarea input
 */
function parseUrls(text: string): string[] {
  const lines = text.split('\n').filter(line => line.trim());
  const urls: string[] = [];
  const seen = new Set<string>();
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Extract URL from line (may be embedded in text)
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const url = urlMatch[0];
      const videoId = extractVideoId(url);
      
      // Deduplicate by video ID
      if (videoId && !seen.has(videoId) && isValidYouTubeUrl(url)) {
        seen.add(videoId);
        urls.push(url);
      }
    }
  }
  
  return urls;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BulkYouTubeAnalysisPage: React.FC = () => {
  const { currentUserId, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isMountedRef = useRef(true);
  const authorName = currentUser?.name || 'User';

  // =========================================================================
  // STATE - Using Map for row tracking
  // =========================================================================
  
  const [step, setStep] = useState<'input' | 'queue'>('input');
  const [urlInput, setUrlInput] = useState('');
  
  // Map-based row state management
  const [rowMap, setRowMap] = useState<Map<string, RowState>>(new Map());
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  // Layout preview mode
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  
  // Expanded preview states (track which rows have expanded previews)
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // =========================================================================
  // DERIVED STATE
  // =========================================================================
  
  const rows = Array.from(rowMap.values());
  const pendingRows = rows.filter(r => r.status === 'pending');
  const analyzingRows = rows.filter(r => r.status === 'analyzing');
  const analyzedRows = rows.filter(r => r.status === 'analyzed');
  const errorRows = rows.filter(r => r.status === 'error');
  const selectedRows = rows.filter(r => r.selected && r.status === 'analyzed' && r.draftId);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Parse URLs and move to queue step
   */
  const handleParseUrls = useCallback(() => {
    if (!urlInput.trim()) return;
    if (!currentUserId) {
      toast.error("You must be logged in to use this feature");
      return;
    }

    const urls = parseUrls(urlInput);
    
    if (urls.length === 0) {
      toast.error("No valid YouTube URLs found. Please check your input.");
      return;
    }

    if (urls.length > 50) {
      toast.error("Maximum 50 URLs allowed per batch.");
      return;
    }

    // Create initial row state map
    const newMap = new Map<string, RowState>();
    for (const url of urls) {
      const id = generateId();
      newMap.set(id, {
        id,
        url,
        status: 'pending',
        selected: true,
      });
    }

    setRowMap(newMap);
    setStep('queue');
    toast.success(`Loaded ${urls.length} YouTube video${urls.length > 1 ? 's' : ''}`);
  }, [urlInput, currentUserId, toast]);

  /**
   * Start sequential AI analysis queue
   */
  const handleStartAnalysis = useCallback(async () => {
    if (!currentUserId) {
      toast.error("You must be logged in to use AI analysis");
      return;
    }

    const rowsToProcess = rows.filter(r => r.status === 'pending' || r.status === 'error');
    if (rowsToProcess.length === 0) {
      toast.info("No videos to analyze");
      return;
    }

    setIsProcessing(true);
    setTotalCount(rowsToProcess.length);
    setCurrentIndex(0);

    let successCount = 0;
    let errorCount = 0;
    let cacheHitCount = 0;

    // =========================================================================
    // SEQUENTIAL QUEUE - Process one at a time
    // =========================================================================
    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      
      if (!isMountedRef.current) break;

      setCurrentIndex(i + 1);

      // Update status to 'analyzing' using Map
      setRowMap(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(row.id);
        if (current) {
          newMap.set(row.id, { ...current, status: 'analyzing', errorMessage: undefined });
        }
        return newMap;
      });

      try {
        // Call extract-intelligence endpoint (with cache-first logic)
        const response = await fetch(`${API_BASE}/ai/extract-intelligence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: row.url }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Analysis failed' }));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (!isMountedRef.current) break;

        if (result.success && result.data) {
          const intelligence: NuggetIntelligence = result.data;
          const cacheHit = result.cacheHit === true;
          
          if (cacheHit) cacheHitCount++;

          // =====================================================================
          // PERSISTENCE: Create draft article immediately after AI analysis
          // =====================================================================
          let draftId: string | undefined;
          
          try {
            const createResponse = await fetch(`${API_BASE}/articles`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
              },
              body: JSON.stringify({
                title: intelligence.title,
                excerpt: intelligence.abstract,
                content: formatIntelligenceContent(intelligence),
                authorId: currentUserId,
                authorName,
                category: intelligence.metadata.category,
                categories: [intelligence.metadata.category],
                tags: [
                  intelligence.metadata.category.toLowerCase(),
                  intelligence.metadata.sentiment.toLowerCase(),
                ],
                visibility: 'private', // Create as draft (private)
                source_type: 'ai-draft',
                media: {
                  type: 'youtube',
                  url: row.url,
                  aspect_ratio: '16/9',
                  previewMetadata: {
                    url: row.url,
                    title: intelligence.title,
                    description: intelligence.abstract,
                    providerName: intelligence.metadata.source,
                    authorName: intelligence.metadata.speaker,
                  }
                }
              }),
            });

            if (createResponse.ok) {
              const created = await createResponse.json();
              draftId = created.id;
              console.log(`[AI] Draft created: ${draftId}`);
            } else {
              console.warn('[AI] Failed to create draft:', await createResponse.text());
            }
          } catch (draftError) {
            console.error('[AI] Draft creation error:', draftError);
          }

          // Update row with success status
          setRowMap(prev => {
            const newMap = new Map(prev);
            newMap.set(row.id, {
              ...row,
              status: 'analyzed',
              intelligence,
              draftId,
              cacheHit,
              errorMessage: undefined,
            });
            return newMap;
          });

          successCount++;

        } else {
          throw new Error(result.message || 'Invalid response from AI');
        }

      } catch (error: unknown) {
        if (!isMountedRef.current) break;

        const err = error as Error;
        const errorMessage = err.message || 'Analysis failed';
        console.error(`[AI] Error analyzing ${row.url}:`, errorMessage);

        // Update row with error status
        setRowMap(prev => {
          const newMap = new Map(prev);
          newMap.set(row.id, {
            ...row,
            status: 'error',
            errorMessage,
          });
          return newMap;
        });

        errorCount++;
      }

      // Small delay between requests (be nice to the API)
      if (i < rowsToProcess.length - 1 && isMountedRef.current) {
        await delay(1500);
      }
    }

    if (isMountedRef.current) {
      setIsProcessing(false);
      setCurrentIndex(0);
      setTotalCount(0);

      // Show completion toast
      if (successCount > 0) {
        let message = `✨ Analyzed ${successCount} video${successCount > 1 ? 's' : ''}`;
        if (cacheHitCount > 0) {
          message += ` (${cacheHitCount} from cache)`;
        }
        if (errorCount > 0) {
          message += `. ${errorCount} failed.`;
          toast.warning(message);
        } else {
          toast.success(message);
        }
      } else if (errorCount > 0) {
        toast.error(`Failed to analyze ${errorCount} video${errorCount > 1 ? 's' : ''}.`);
      }
    }
  }, [rows, currentUserId, authorName, toast]);

  /**
   * Import selected drafts (flip visibility to public)
   */
  const handleImportSelected = useCallback(async () => {
    if (!currentUserId) {
      toast.error("You must be logged in to import nuggets");
      return;
    }

    const toImport = selectedRows;
    if (toImport.length === 0) {
      toast.error("No analyzed videos selected for import");
      return;
    }

    const draftIds = toImport.map(r => r.draftId!).filter(Boolean);
    if (draftIds.length === 0) {
      toast.error("No drafts available to import");
      return;
    }

    setIsProcessing(true);

    try {
      // Call batch publish endpoint
      const response = await fetch(`${API_BASE}/batch/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ ids: draftIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to publish' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!isMountedRef.current) return;

      // Remove imported rows from the map
      setRowMap(prev => {
        const newMap = new Map(prev);
        for (const row of toImport) {
          newMap.delete(row.id);
        }
        return newMap;
      });

      toast.success(result.message || `Published ${result.updatedCount} nugget${result.updatedCount !== 1 ? 's' : ''}!`);

      // Invalidate queries to refresh feed
      await delay(500);
      await queryClient.invalidateQueries({ queryKey: ['articles'], refetchType: 'all' });
      await queryClient.refetchQueries({ queryKey: ['articles'], type: 'active' });

    } catch (error: unknown) {
      const err = error as Error;
      if (isMountedRef.current) {
        toast.error(err.message || "Failed to import nuggets");
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [selectedRows, currentUserId, toast]);

  /**
   * Toggle row selection
   */
  const handleToggleSelect = useCallback((id: string) => {
    setRowMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, { ...current, selected: !current.selected });
      }
      return newMap;
    });
  }, []);

  /**
   * Remove row from queue
   */
  const handleRemoveRow = useCallback((id: string) => {
    setRowMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  /**
   * Select/deselect all
   */
  const handleSelectAll = useCallback((selected: boolean) => {
    setRowMap(prev => {
      const newMap = new Map(prev);
      for (const [id, row] of newMap) {
        if (row.status === 'analyzed' && row.draftId) {
          newMap.set(id, { ...row, selected });
        }
      }
      return newMap;
    });
  }, []);

  /**
   * Toggle preview expansion for a row
   */
  const handleTogglePreview = useCallback((id: string) => {
    setExpandedPreviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 pb-20">
      <HeaderSpacer />
      
      {/* Header */}
      <div 
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} bg-slate-900/80 backdrop-blur-xl border-b border-purple-500/20`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <button 
            onClick={() => {
              if (isProcessing) {
                toast.error("Please wait for current operation to complete");
                return;
              }
              navigate(-1);
            }} 
            className="flex items-center gap-2 text-sm text-purple-300 hover:text-white mb-4 transition-colors"
            disabled={isProcessing}
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl">
                  <Youtube size={24} />
                </div>
                YouTube AI Analysis
              </h1>
              <p className="text-purple-300 mt-1">Extract intelligence from YouTube videos using Gemini AI</p>
            </div>
            
            {step === 'queue' && (
              <div className="flex items-center gap-3">
                {/* Progress indicator */}
                {isProcessing && totalCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-lg">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{currentIndex} / {totalCount}</span>
                  </div>
                )}
                
                {/* Stats badges */}
                <div className="flex items-center gap-2 text-xs">
                  {analyzedRows.length > 0 && (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
                      {analyzedRows.length} analyzed
                    </span>
                  )}
                  {errorRows.length > 0 && (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                      {errorRows.length} failed
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <button 
                  onClick={handleStartAnalysis}
                  disabled={isProcessing || pendingRows.length === 0}
                  className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-sm hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {isProcessing ? 'Analyzing...' : 'Start Analysis'}
                </button>
                
                <button 
                  onClick={handleImportSelected}
                  disabled={isProcessing || selectedRows.length === 0}
                  className="px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transition-all"
                >
                  <Globe size={16} />
                  Import Selected ({selectedRows.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Key Status Widget */}
        <div className="mb-6">
          <KeyStatusWidget />
        </div>

        {/* ================================================================= */}
        {/* STEP 1: INPUT */}
        {/* ================================================================= */}
        {step === 'input' && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 shadow-xl overflow-hidden">
            <div className="p-8">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4">
                    <Youtube size={32} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Paste YouTube URLs</h2>
                  <p className="text-purple-300 text-sm">One URL per line. We'll extract intelligence from each video.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">YouTube URLs</label>
                  <textarea 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://youtube.com/watch?v=...&#10;https://youtu.be/...&#10;https://youtube.com/watch?v=..."
                    className="w-full h-64 p-4 bg-slate-800/50 border border-purple-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm resize-none text-white placeholder-purple-400/50"
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={handleParseUrls}
                    disabled={!urlInput.trim()}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-purple-500/25"
                  >
                    <Play size={18} />
                    Load Videos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: QUEUE */}
        {/* ================================================================= */}
        {step === 'queue' && (
          <div className="space-y-4">
            {/* Queue header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-bold text-white">
                Analysis Queue ({rows.length} video{rows.length !== 1 ? 's' : ''})
              </h2>
              <div className="flex items-center gap-4">
                {analyzedRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSelectAll(true)}
                      className="text-xs text-purple-300 hover:text-white transition-colors"
                    >
                      Select All
                    </button>
                    <span className="text-purple-500">|</span>
                    <button
                      onClick={() => handleSelectAll(false)}
                      className="text-xs text-purple-300 hover:text-white transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => { setRowMap(new Map()); setStep('input'); setExpandedPreviews(new Set()); }} 
                  className="text-sm font-bold text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Layout Preview Toggle */}
            {analyzedRows.length > 0 && (
              <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4 border border-purple-500/20">
                <div className="flex items-center gap-2 text-sm text-purple-300">
                  <Eye size={16} />
                  <span>Preview Layout Mode:</span>
                </div>
                <LayoutPreviewToggle 
                  currentLayout={layoutMode} 
                  onLayoutChange={setLayoutMode} 
                />
              </div>
            )}

            {/* Queue list */}
            <div className="space-y-3">
              {rows.map((row) => (
                <QueueRow
                  key={row.id}
                  row={row}
                  onToggleSelect={handleToggleSelect}
                  onRemove={handleRemoveRow}
                  onTogglePreview={handleTogglePreview}
                  isProcessing={isProcessing}
                  isPreviewExpanded={expandedPreviews.has(row.id)}
                  layoutMode={layoutMode}
                  currentUserId={currentUserId || ''}
                  authorName={authorName}
                />
              ))}
            </div>

            {rows.length === 0 && (
              <div className="text-center py-12 text-purple-400">
                No videos in queue. Add YouTube URLs to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// QUEUE ROW COMPONENT
// ============================================================================

interface QueueRowProps {
  row: RowState;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onTogglePreview: (id: string) => void;
  isProcessing: boolean;
  isPreviewExpanded: boolean;
  layoutMode: LayoutMode;
  currentUserId: string;
  authorName: string;
}

const QueueRow: React.FC<QueueRowProps> = ({ 
  row, 
  onToggleSelect, 
  onRemove, 
  onTogglePreview,
  isProcessing,
  isPreviewExpanded,
  layoutMode,
  currentUserId,
  authorName,
}) => {
  const videoId = extractVideoId(row.url);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

  // Create preview article from intelligence for layout preview
  const previewArticle: Article | null = row.intelligence ? {
    id: row.draftId || row.id,
    title: row.intelligence.title,
    excerpt: row.intelligence.abstract,
    content: formatIntelligenceContent(row.intelligence),
    author: {
      id: currentUserId,
      name: authorName,
    },
    publishedAt: new Date().toISOString(),
    categories: [row.intelligence.metadata.category],
    tags: [
      row.intelligence.metadata.category.toLowerCase(),
      row.intelligence.metadata.sentiment.toLowerCase(),
    ],
    readTime: 3,
    visibility: 'private',
    source_type: 'ai-draft',
    media: {
      type: 'youtube',
      url: row.url,
      aspect_ratio: '16/9',
      previewMetadata: {
        url: row.url,
        title: row.intelligence.title,
        description: row.intelligence.abstract,
        providerName: row.intelligence.metadata.source,
        authorName: row.intelligence.metadata.speaker,
      },
    },
  } : null;

  return (
    <div className={`
      bg-slate-900/50 backdrop-blur-sm rounded-xl border transition-all overflow-hidden
      ${row.status === 'analyzing' ? 'border-purple-500/50 shadow-lg shadow-purple-500/10' : ''}
      ${row.status === 'analyzed' ? 'border-emerald-500/30' : ''}
      ${row.status === 'error' ? 'border-red-500/30' : ''}
      ${row.status === 'pending' ? 'border-slate-700/50' : ''}
    `}>
      <div className="p-4 flex items-start gap-4">
        {/* Thumbnail */}
        {thumbnailUrl && (
          <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-slate-800">
            <img 
              src={thumbnailUrl} 
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title or URL */}
          <h3 className="font-semibold text-white truncate">
            {row.intelligence?.title || row.url}
          </h3>
          
          {/* Metadata */}
          {row.intelligence && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                {row.intelligence.metadata.category}
              </span>
              <span className={`px-2 py-0.5 rounded-full ${
                row.intelligence.metadata.sentiment === 'Bullish' ? 'bg-emerald-500/20 text-emerald-300' :
                row.intelligence.metadata.sentiment === 'Bearish' ? 'bg-red-500/20 text-red-300' :
                'bg-slate-500/20 text-slate-300'
              }`}>
                {row.intelligence.metadata.sentiment}
              </span>
              <span className="text-purple-400">
                {row.intelligence.metadata.speaker}
              </span>
              {row.cacheHit && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full flex items-center gap-1">
                  <Clock size={10} />
                  Cached
                </span>
              )}
            </div>
          )}

          {/* Abstract */}
          {row.intelligence && (
            <p className="mt-2 text-sm text-purple-300 line-clamp-2">
              {row.intelligence.abstract}
            </p>
          )}

          {/* Error message */}
          {row.errorMessage && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
              <AlertCircle size={14} />
              {row.errorMessage}
            </div>
          )}

          {/* Draft status */}
          {row.draftId && (
            <div className="mt-2 text-xs text-emerald-400">
              ✓ Draft saved
            </div>
          )}
        </div>

        {/* Status & Actions */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {row.status === 'pending' && (
              <span className="text-purple-400 text-sm">Pending</span>
            )}
            {row.status === 'analyzing' && (
              <Loader2 size={20} className="text-purple-400 animate-spin" />
            )}
            {row.status === 'analyzed' && (
              <CheckCircle2 size={20} className="text-emerald-400" />
            )}
            {row.status === 'error' && (
              <XCircle size={20} className="text-red-400" />
            )}
          </div>

          {/* Preview toggle button (only for analyzed rows) */}
          {row.status === 'analyzed' && row.intelligence && (
            <button
              onClick={() => onTogglePreview(row.id)}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs ${
                isPreviewExpanded 
                  ? 'bg-purple-500/20 text-purple-300' 
                  : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/10'
              }`}
              title={isPreviewExpanded ? 'Hide preview' : 'Show preview'}
            >
              <Eye size={14} />
              {isPreviewExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* Selection checkbox (only for analyzed rows) */}
          {row.status === 'analyzed' && row.draftId && (
            <button
              onClick={() => onToggleSelect(row.id)}
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                row.selected 
                  ? 'bg-emerald-500 border-emerald-500' 
                  : 'border-slate-600 hover:border-purple-500'
              }`}
            >
              {row.selected && <CheckCircle2 size={14} className="text-white" />}
            </button>
          )}

          {/* Remove button */}
          {!isProcessing && row.status !== 'analyzing' && (
            <button
              onClick={() => onRemove(row.id)}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* LAYOUT PREVIEW SECTION */}
      {/* ================================================================= */}
      {isPreviewExpanded && previewArticle && (
        <div className="border-t border-slate-700/50 bg-slate-950/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
              <Eye size={14} />
              Preview: {layoutMode.charAt(0).toUpperCase() + layoutMode.slice(1)} Layout
            </h4>
          </div>
          
          {/* Layout Preview Container */}
          <div className={`
            ${layoutMode === 'grid' ? 'max-w-sm mx-auto' : ''}
            ${layoutMode === 'feed' ? 'max-w-2xl mx-auto' : ''}
            ${layoutMode === 'masonry' ? 'max-w-md mx-auto' : ''}
            ${layoutMode === 'utility' ? 'max-w-4xl mx-auto' : ''}
          `}>
            <NewsCard
              article={previewArticle}
              viewMode={layoutMode}
              onCategoryClick={() => {}}
              onClick={() => window.open(row.url, '_blank')}
              currentUserId={currentUserId}
              onTagClick={() => {}}
              isPreview={true}
            />
          </div>
          
          {/* Data Vault Preview */}
          {row.intelligence && row.intelligence.dataVault.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Key Takeaway */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                <h5 className="text-xs font-bold text-indigo-400 mb-2">🎯 Actionable Takeaway</h5>
                <p className="text-sm text-white">{row.intelligence.visualAnchor.actionableTakeaway}</p>
              </div>
              
              {/* Primary Signal */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                <h5 className="text-xs font-bold text-purple-400 mb-2">📡 Primary Signal</h5>
                <p className="text-sm text-white">{row.intelligence.domainIntelligence.primarySignal}</p>
              </div>
              
              {/* Risk */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <h5 className="text-xs font-bold text-amber-400 mb-2">⚠️ Friction Point</h5>
                <p className="text-sm text-white">{row.intelligence.frictionPoint}</p>
              </div>
            </div>
          )}
          
          {/* Data Vault Items */}
          {row.intelligence && row.intelligence.dataVault.length > 0 && (
            <div className="mt-4">
              <h5 className="text-xs font-bold text-slate-400 mb-2">📊 Data Vault</h5>
              <div className="flex flex-wrap gap-2">
                {row.intelligence.dataVault.map((item, idx) => (
                  <div key={idx} className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-400">{item.label}:</span>
                    <span className="text-sm text-white ml-1 font-semibold">{item.value}</span>
                    {item.timestamp && (
                      <span className="text-xs text-slate-500 ml-1">({item.timestamp})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPER: Format NuggetIntelligence as markdown content
// ============================================================================

function formatIntelligenceContent(intel: NuggetIntelligence): string {
  const lines: string[] = [];
  
  lines.push(`## ${intel.title}`);
  lines.push('');
  lines.push(`**${intel.metadata.speaker}** | ${intel.metadata.source} | ${intel.metadata.sentiment}`);
  lines.push('');
  lines.push(`> ${intel.abstract}`);
  lines.push('');
  lines.push('### Key Signal');
  lines.push(intel.domainIntelligence.primarySignal);
  lines.push('');
  lines.push('### Market Impact');
  lines.push(intel.domainIntelligence.impact);
  
  if (intel.domainIntelligence.metric) {
    lines.push('');
    lines.push(`**Key Metric:** ${intel.domainIntelligence.metric}`);
  }
  
  if (intel.dataVault.length > 0) {
    lines.push('');
    lines.push('### Data Vault');
    for (const item of intel.dataVault) {
      const ts = item.timestamp ? ` (${item.timestamp})` : '';
      lines.push(`- **${item.label}:** ${item.value}${ts}`);
    }
  }
  
  lines.push('');
  lines.push('### Memorable Insight');
  lines.push(`> "${intel.visualAnchor.anecdote}"`);
  lines.push('');
  lines.push('### Actionable Takeaway');
  lines.push(`🎯 ${intel.visualAnchor.actionableTakeaway}`);
  lines.push('');
  lines.push('### Risk / Friction Point');
  lines.push(`⚠️ ${intel.frictionPoint}`);
  
  return lines.join('\n');
}

export default BulkYouTubeAnalysisPage;

