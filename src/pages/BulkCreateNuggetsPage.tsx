/**
 * Bulk Create Nuggets Page - Fast & Boring Metadata Import
 * 
 * A simple, reliable tool for importing nuggets from:
 * - Pasted links (one per line)
 * - CSV files
 * - Excel files
 * 
 * NO AI features - just metadata fetching and batch creation.
 * For AI-powered YouTube analysis, use /youtube-analysis instead.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BatchRow, ImportMode } from '@/types/batch';
import { batchService } from '@/services/batchService';
import { BatchPreviewCard } from '@/components/batch/BatchPreviewCard';
import { LayoutPreviewToggle, LayoutMode } from '@/components/admin/LayoutPreviewToggle';
import { FileSpreadsheet, FileText, Link as LinkIcon, Download, ChevronRight, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { queryClient } from '@/queryClient';
import { HeaderSpacer } from '@/components/layouts/HeaderSpacer';
import { LAYOUT_CLASSES } from '@/constants/layout';
import { Z_INDEX } from '@/constants/zIndex';

// Helper for small delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const BulkCreateNuggetsPage: React.FC = () => {
  const { currentUserId, currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const isMountedRef = useRef(true);
  const authorName = currentUser?.name || 'User';

  // --- State ---
  const [activeTab, setActiveTab] = useState<ImportMode>('links');
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [previewLayout, setPreviewLayout] = useState<LayoutMode>('grid');
  
  const [linkInput, setLinkInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // --- Handlers ---

  const handleLinksParse = async () => {
    if (!linkInput.trim()) return;
    if (!currentUserId) {
      toast.error("You must be logged in to batch upload");
      return;
    }
    
    setIsProcessing(true);
    try {
      const parsed = await batchService.parseLinks(linkInput);
      if (!isMountedRef.current) return;
      
      // Fetch metadata with real unfurl service
      const { rows: withMeta, errors } = await batchService.fetchMetadataForRows(parsed, currentUserId, authorName);
      if (!isMountedRef.current) return;
      
      setRows(withMeta);
      setStep('review');
      
      // Show aggregated error feedback if any
      if (errors.length > 0 && isMountedRef.current) {
        const errorCount = errors.length;
        const totalCount = withMeta.length;
        if (errorCount === totalCount) {
          toast.error(`Failed to fetch metadata for all ${errorCount} URLs. Using fallback data.`);
        } else {
          toast.warning(`${errorCount} of ${totalCount} URLs failed to fetch metadata. Using fallback data.`);
        }
      }
    } catch (e: any) {
      // Ignore cancellation errors
      if (e?.message === 'Request cancelled') {
        return;
      }
      if (isMountedRef.current) {
        toast.error(e?.message || "Failed to parse links");
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'csv' | 'excel') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!currentUserId) {
      toast.error("You must be logged in to batch upload");
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = type === 'csv' 
        ? await batchService.parseCSV(file) 
        : await batchService.parseExcel(file);
      
      if (!isMountedRef.current) return;
        
      // If titles are missing, try to fetch meta
      const needsMeta = parsed.some(r => !r.title);
      if (needsMeta) {
        const { rows: finalRows, errors } = await batchService.fetchMetadataForRows(parsed, currentUserId, authorName);
        if (!isMountedRef.current) return;
        
        setRows(finalRows);
        
        // Show aggregated error feedback if any
        if (errors.length > 0 && isMountedRef.current) {
          const errorCount = errors.length;
          const totalCount = finalRows.length;
          if (errorCount === totalCount) {
            toast.error(`Failed to fetch metadata for all ${errorCount} URLs. Using fallback data.`);
          } else {
            toast.warning(`${errorCount} of ${totalCount} URLs failed to fetch metadata. Using fallback data.`);
          }
        }
      } else {
        setRows(parsed);
      }
      
      if (!isMountedRef.current) return;
      setStep('review');
    } catch (e: any) {
      // Ignore cancellation errors
      if (e?.message === 'Request cancelled') {
        return;
      }
      if (isMountedRef.current) {
        console.error(e);
        toast.error(e?.message || `Failed to parse ${type.toUpperCase()} file`);
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        // Reset input
        e.target.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!currentUserId) {
      toast.error("You must be logged in to import nuggets");
      return;
    }
    
    // Only import rows with 'ready' status
    const selectedRows = rows.filter(r => r.selected && r.status === 'ready');
    if (selectedRows.length === 0) {
      toast.error("No items selected for import");
      return;
    }
    
    console.log(`Starting batch creation: ${selectedRows.length} rows selected`);
    
    setIsProcessing(true);
    setBatchProgress({ current: 0, total: selectedRows.length });
    
    try {
      const result = await batchService.createBatch(rows, currentUserId, authorName, (current, total) => {
        if (isMountedRef.current) {
          setBatchProgress({ current, total });
        }
      });
      
      if (!isMountedRef.current) return;
      
      const successCount = result.filter(r => r.status === 'success').length;
      const errorCount = result.filter(r => r.status === 'error').length;
      
      console.log(`Batch creation complete: ${successCount} success, ${errorCount} errors`);
      
      // Clear preview data to free memory
      const cleanedRows = result.map(row => ({
        ...row,
        previewArticle: undefined,
      }));
      setRows(cleanedRows);
      
      if (isMountedRef.current) {
        if (successCount > 0) {
          let message = `Successfully created ${successCount} nugget${successCount > 1 ? 's' : ''}`;
          if (errorCount > 0) {
            message += `. ${errorCount} failed.`;
            toast.warning(message);
          } else {
            toast.success(message + '!');
          }
          
          // Invalidate and refetch articles query to refresh feed
          await delay(500);
          await queryClient.invalidateQueries({ 
            queryKey: ['articles'],
            refetchType: 'all'
          });
          await queryClient.refetchQueries({ 
            queryKey: ['articles'],
            type: 'active'
          });
        } else {
          const message = errorCount > 0 
            ? `Failed to create nuggets. ${errorCount} error${errorCount > 1 ? 's' : ''}.`
            : 'Failed to create nuggets.';
          toast.error(message);
        }
      }
    } catch (e: any) {
      if (e?.message === 'Request cancelled') {
        return;
      }
      if (isMountedRef.current) {
        toast.error(e?.message || "Batch creation failed");
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
        setBatchProgress(null);
      }
    }
  };

  // --- Render Helpers ---

  const downloadTemplate = (type: 'csv' | 'excel') => {
    const headers = ['url', 'title', 'text', 'categories', 'visibility'];
    const row = ['https://example.com', 'Example Title', 'Optional note', 'tech, news', 'public'];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const ext = type === 'excel' ? 'csv' : 'csv';
    link.setAttribute("download", `nuggets_template.${ext}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Count ready rows for the import button
  const readyCount = rows.filter(r => r.selected && r.status === 'ready').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <HeaderSpacer />
      
      {/* Header */}
      <div 
        className={`sticky ${LAYOUT_CLASSES.STICKY_BELOW_HEADER} ${LAYOUT_CLASSES.PAGE_TOOLBAR}`}
        style={{ zIndex: Z_INDEX.CATEGORY_BAR }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <button 
            onClick={() => {
              if (isProcessing) {
                toast.error("Please wait for current operation to complete");
                return;
              }
              if (currentUserId) {
                navigate(`/profile/${currentUserId}`);
              } else {
                navigate('/');
              }
            }} 
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white mb-4 transition-colors"
            disabled={isProcessing}
          >
            <ArrowLeft size={16} /> Back to My Space
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Batch Import
              </h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1">Import multiple nuggets from links, CSV, or Excel files.</p>
            </div>
            {step === 'review' && (
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-gray-500 dark:text-slate-400">
                  {rows.filter(r => r.selected).length} items selected
                </div>
                <div className="flex items-center gap-3">
                  {batchProgress && (
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {batchProgress.current} / {batchProgress.total}
                    </div>
                  )}
                  <button 
                    onClick={handleImport}
                    disabled={isProcessing || readyCount === 0}
                    className="px-6 py-2 bg-yellow-400 text-gray-900 rounded-xl font-bold text-sm hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Import Selected ({readyCount})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {step === 'input' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-slate-800">
              <button 
                onClick={() => setActiveTab('links')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'links' ? 'border-yellow-400 text-gray-900 dark:text-white bg-yellow-50/50 dark:bg-yellow-900/10' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <LinkIcon size={18} /> Paste Links
              </button>
              <button 
                onClick={() => setActiveTab('csv')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'csv' ? 'border-yellow-400 text-gray-900 dark:text-white bg-yellow-50/50 dark:bg-yellow-900/10' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <FileText size={18} /> Import CSV
              </button>
              <button 
                onClick={() => setActiveTab('excel')}
                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'excel' ? 'border-yellow-400 text-gray-900 dark:text-white bg-yellow-50/50 dark:bg-yellow-900/10' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <FileSpreadsheet size={18} /> Import Excel
              </button>
            </div>

            <div className="p-8 flex-1 flex flex-col">
              
              {/* LINK MODE */}
              {activeTab === 'links' && (
                <div className="flex flex-col h-full max-w-2xl mx-auto w-full gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-slate-200">Paste URLs (one per line)</label>
                    <textarea 
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="https://example.com/article-1&#10;https://example.com/article-2"
                      className="w-full h-64 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 font-mono text-sm resize-none text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={handleLinksParse}
                      disabled={!linkInput.trim() || isProcessing}
                      className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg"
                    >
                      {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <>Next <ChevronRight size={18} /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* FILE MODES */}
              {(activeTab === 'csv' || activeTab === 'excel') && (
                <div className="flex flex-col items-center justify-center h-full gap-6 max-w-xl mx-auto w-full text-center">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 mb-2">
                    {activeTab === 'csv' ? <FileText size={40} /> : <FileSpreadsheet size={40} />}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Upload your {activeTab === 'csv' ? 'CSV' : 'Excel'} file</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      Ensure your file has headers: <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-slate-300">url, title, text, categories, visibility</code>
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 w-full max-w-sm">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-slate-700 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 hover:border-yellow-400 transition-colors group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <p className="mb-2 text-sm text-gray-500 dark:text-slate-400 group-hover:text-yellow-600 transition-colors font-bold">Click to upload</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">or drag and drop</p>
                      </div>
                      <input type="file" className="hidden" accept={activeTab === 'csv' ? ".csv" : ".xlsx, .xls"} onChange={(e) => handleFileUpload(e, activeTab === 'csv' ? 'csv' : 'excel')} />
                    </label>

                    <button 
                      onClick={() => downloadTemplate(activeTab === 'csv' ? 'csv' : 'excel')}
                      className="text-xs font-bold text-yellow-600 hover:text-yellow-700 flex items-center justify-center gap-1.5 py-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 rounded-lg transition-colors"
                    >
                      <Download size={14} /> Download {activeTab.toUpperCase()} Template
                    </button>
                  </div>
                  
                  {isProcessing && <div className="flex items-center gap-2 text-sm font-bold text-gray-500"><Loader2 size={16} className="animate-spin" /> Parsing file...</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Review & Edit ({rows.length} items)
              </h2>
              <button 
                onClick={() => { setRows([]); setStep('input'); }} 
                className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
              >
                Discard All
              </button>
            </div>
            
            {/* Layout Preview Toggle */}
            <div className="flex items-center justify-between">
              <LayoutPreviewToggle
                currentLayout={previewLayout}
                onLayoutChange={setPreviewLayout}
              />
            </div>
            
            {/* Card Grid Preview */}
            <div className={
              previewLayout === 'feed'
                ? 'flex flex-col gap-8 max-w-2xl mx-auto'
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            }>
              {rows.map((row) => (
                <BatchPreviewCard
                  key={row.id}
                  row={row}
                  layoutMode={previewLayout}
                  onRemove={(id) => setRows(prev => prev.filter(r => r.id !== id))}
                  onRetry={async (id) => {
                    const row = rows.find(r => r.id === id);
                    if (!row || !isMountedRef.current || !currentUserId) return;
                    try {
                      const { rows: updatedRows } = await batchService.fetchMetadataForRows(
                        [{ ...row, status: 'pending' as const, errorMessage: undefined }],
                        currentUserId,
                        authorName
                      );
                      if (isMountedRef.current && updatedRows.length > 0) {
                        setRows(prev => prev.map(r => r.id === id ? updatedRows[0] : r));
                        toast.success('Metadata refreshed');
                      }
                    } catch (e: any) {
                      if (e?.message !== 'Request cancelled' && isMountedRef.current) {
                        console.error('Retry failed:', e);
                        toast.error(e?.message || 'Failed to retry metadata fetch');
                      }
                    }
                  }}
                  onUpdate={(id, updates) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))}
                />
              ))}
            </div>
            
            {rows.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                No items to review. Add URLs to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
