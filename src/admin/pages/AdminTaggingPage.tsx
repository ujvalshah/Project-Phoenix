import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Tags, ArrowRight, Lightbulb, Pencil, Trash2, Plus, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useAdminHeader } from '../layout/AdminLayout';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { getNormalizedApiBase } from '@/utils/urlUtils';
import type { TaxonomyTag } from '@/types';

type Dimension = 'format' | 'domain' | 'subtopic';

interface TagFormState {
  name: string;
  sortOrder: number;
  aliases: string; // comma-separated in the form, parsed on submit
}

interface EditorState {
  mode: 'create' | 'edit';
  dimension: Dimension;
  /** Present in edit mode only */
  tagId?: string;
  initial: TagFormState;
}

const AUTH_STORAGE_KEY = 'nuggets_auth_data_v2';

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.token || data.accessToken || null;
  } catch {
    return null;
  }
}

interface ImportResult {
  message: string;
  totalRows: number;
  updated: number;
  skipped: number;
  errors: number;
  validationErrors?: Array<{ row: number; error: string }>;
}

export const AdminTaggingPage: React.FC = () => {
  const { setPageHeader } = useAdminHeader();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: taxonomy, isLoading: isTaxonomyLoading } = useTagTaxonomy();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Inline dimension-tag editor state
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isSavingTag, setIsSavingTag] = useState(false);

  // Coverage stats
  const [coverage, setCoverage] = useState<{
    total: number; withAny: number; withFormat: number; withDomain: number; withSubtopic: number;
    missingAny: number; missingFormat: number; missingDomain: number;
  } | null>(null);
  const [isCoverageLoading, setIsCoverageLoading] = useState(false);

  const fetchCoverage = async () => {
    setIsCoverageLoading(true);
    try {
      const token = getAuthToken();
      const BASE_URL = getNormalizedApiBase();
      const response = await fetch(`${BASE_URL}/categories/taxonomy/coverage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`${response.status}`);
      setCoverage(await response.json());
    } catch {
      toast.error('Failed to load coverage stats');
    } finally {
      setIsCoverageLoading(false);
    }
  };

  // Fetch coverage on mount
  useEffect(() => { fetchCoverage(); }, []);

  const refreshTaxonomy = () => {
    queryClient.invalidateQueries({ queryKey: ['tagTaxonomy'] });
    fetchCoverage();
  };

  const openCreate = (dimension: Dimension) => {
    const list =
      dimension === 'format' ? taxonomy?.formats :
      dimension === 'domain' ? taxonomy?.domains :
      taxonomy?.subtopics;
    const nextSortOrder = (list && list.length > 0)
      ? Math.max(...list.map(t => t.sortOrder ?? 0)) + 1
      : 1;
    setEditorState({
      mode: 'create',
      dimension,
      initial: { name: '', sortOrder: nextSortOrder, aliases: '' },
    });
  };

  const openEdit = (dimension: Dimension, tag: TaxonomyTag) => {
    setEditorState({
      mode: 'edit',
      dimension,
      tagId: tag.id,
      initial: {
        name: tag.rawName,
        sortOrder: tag.sortOrder ?? 0,
        aliases: '', // Loaded lazily — see below
      },
    });
  };

  const closeEditor = () => setEditorState(null);

  const saveTag = async (form: TagFormState) => {
    if (!editorState) return;
    setIsSavingTag(true);
    try {
      const token = getAuthToken();
      const BASE_URL = getNormalizedApiBase();
      const aliases = form.aliases
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const body = {
        name: form.name.trim(),
        dimension: editorState.dimension,
        sortOrder: form.sortOrder,
        aliases,
        isOfficial: true,
        status: 'active' as const,
      };

      const url = editorState.mode === 'create'
        ? `${BASE_URL}/categories`
        : `${BASE_URL}/categories/${editorState.tagId}`;
      const method = editorState.mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Save failed (${response.status})`);
      }

      toast.success(editorState.mode === 'create' ? 'Tag created' : 'Tag updated');
      closeEditor();
      refreshTaxonomy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setIsSavingTag(false);
    }
  };

  const deprecateTag = async (dimension: Dimension, tag: TaxonomyTag) => {
    const confirmed = window.confirm(
      `Deprecate "${tag.rawName}"?\n\n` +
      `This hides the tag from filters and the picker, but ${tag.usageCount} existing nugget(s) ` +
      `that already reference it will keep showing it. The tag is NOT permanently deleted.`
    );
    if (!confirmed) return;

    try {
      const token = getAuthToken();
      const BASE_URL = getNormalizedApiBase();
      const response = await fetch(`${BASE_URL}/categories/by-id/${tag.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Delete failed (${response.status})`);
      }
      toast.success(`"${tag.rawName}" deprecated`);
      refreshTaxonomy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast.error(msg);
    }
    void dimension; // dimension reserved for future per-axis logic
  };

  useEffect(() => {
    setPageHeader(
      'Bulk Tag Management',
      'Export nuggets to Excel, review/edit tags, and re-import for bulk classification.'
    );
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const token = getAuthToken();
      const BASE_URL = getNormalizedApiBase();
      const response = await fetch(`${BASE_URL}/admin/tagging/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nugget_tag_mapping_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel file downloaded successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      toast.error(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Please select an .xlsx file');
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setImportResult(null);
    try {
      const token = getAuthToken();
      const BASE_URL = getNormalizedApiBase();
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${BASE_URL}/admin/tagging/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const result: ImportResult = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Import failed');
      }

      setImportResult(result);
      toast.success(`Import complete: ${result.updated} nuggets updated`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const formatCount = taxonomy?.formats?.length ?? 0;
  const domainCount = taxonomy?.domains?.length ?? 0;
  const subtopicCount = taxonomy?.subtopics?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Taxonomy Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Format Tags"
          value={isTaxonomyLoading ? '...' : String(formatCount)}
          sublabel="Podcast, Report, Blog, etc."
          color="blue"
        />
        <StatCard
          label="Domain Tags"
          value={isTaxonomyLoading ? '...' : String(domainCount)}
          sublabel="Finance, Technology, etc."
          color="emerald"
        />
        <StatCard
          label="Sub-topic Tags"
          value={isTaxonomyLoading ? '...' : String(subtopicCount)}
          sublabel="Gold, AI, India Focused, etc."
          color="amber"
        />
      </div>

      {/* Coverage Badge */}
      {coverage && (
        <div className={`rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          coverage.missingAny === 0 && coverage.missingFormat === 0
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-center gap-3">
            {coverage.missingAny === 0 && coverage.missingFormat === 0 ? (
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-amber-500 shrink-0" />
            )}
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Dimension Coverage: {coverage.total > 0 ? ((coverage.withAny / coverage.total) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-4">
                <span>Format: {coverage.withFormat}/{coverage.total}{coverage.missingFormat > 0 && <span className="text-amber-600 dark:text-amber-400"> ({coverage.missingFormat} missing)</span>}</span>
                <span>Domain: {coverage.withDomain}/{coverage.total} <span className="text-slate-400">(optional)</span></span>
                <span>Subtopic: {coverage.withSubtopic}/{coverage.total} <span className="text-slate-400">(optional)</span></span>
              </div>
            </div>
          </div>
          <button
            onClick={fetchCoverage}
            disabled={isCoverageLoading}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-50 shrink-0"
          >
            {isCoverageLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Workflow Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Download */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">1</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Download & Review</h3>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Export all nuggets with their current collections and auto-suggested dimension tags.
            The Excel file includes 3 sheets:
          </p>

          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 mb-6">
            <li className="flex items-start gap-2">
              <FileSpreadsheet size={14} className="mt-0.5 text-slate-400 shrink-0" />
              <span><strong>Tag Mapping</strong> — All nuggets with suggested format/domain/subtopic</span>
            </li>
            <li className="flex items-start gap-2">
              <Lightbulb size={14} className="mt-0.5 text-slate-400 shrink-0" />
              <span><strong>Instructions</strong> — Column descriptions, valid tag names, and rules</span>
            </li>
            <li className="flex items-start gap-2">
              <Tags size={14} className="mt-0.5 text-slate-400 shrink-0" />
              <span><strong>AI Prompt</strong> — Ready-to-paste prompt for AI-assisted classification</span>
            </li>
          </ul>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isDownloading ? (
              <><Loader2 size={16} className="animate-spin" /> Exporting...</>
            ) : (
              <><Download size={16} /> Download Excel</>
            )}
          </button>
        </div>

        {/* Step 2: Upload */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">2</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Upload Reviewed File</h3>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            After reviewing and correcting the tags in the Excel file, upload it here.
            Only the <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">suggested_format</code>, <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">suggested_domain</code>, and <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">suggested_subtopic</code> columns are read.
          </p>

          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="tagging-file-input"
            />
            <label
              htmlFor="tagging-file-input"
              className="flex items-center justify-center gap-2 w-full px-5 py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              <FileSpreadsheet size={16} />
              {selectedFile ? selectedFile.name : 'Click to select .xlsx file'}
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isUploading ? (
              <><Loader2 size={16} className="animate-spin" /> Importing...</>
            ) : (
              <><Upload size={16} /> Upload & Apply Tags</>
            )}
          </button>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className={`rounded-2xl border p-6 ${
          importResult.errors > 0
            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
        }`}>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            {importResult.errors > 0 ? (
              <AlertCircle size={18} className="text-amber-500" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-500" />
            )}
            Import Results
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{importResult.totalRows}</div>
              <div className="text-xs text-slate-500">Total rows</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{importResult.updated}</div>
              <div className="text-xs text-slate-500">Updated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-400">{importResult.skipped}</div>
              <div className="text-xs text-slate-500">Skipped (empty)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{importResult.errors}</div>
              <div className="text-xs text-slate-500">Errors</div>
            </div>
          </div>

          {importResult.validationErrors && importResult.validationErrors.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Validation Issues (first 50):</h4>
              <div className="max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Row</th>
                      <th className="px-3 py-1.5 text-left text-slate-500 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.validationErrors.map((ve, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 tabular-nums">{ve.row}</td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{ve.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workflow Guide */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Workflow Guide</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <Step num={1} text="Download the Excel file" />
          <ArrowRight size={14} className="hidden sm:block text-slate-300 shrink-0" />
          <Step num={2} text="Open the 'Instructions' sheet for guidance" />
          <ArrowRight size={14} className="hidden sm:block text-slate-300 shrink-0" />
          <Step num={3} text="Use the 'AI Prompt' sheet for bulk AI classification" />
          <ArrowRight size={14} className="hidden sm:block text-slate-300 shrink-0" />
          <Step num={4} text="Review & edit the 'Tag Mapping' sheet" />
          <ArrowRight size={14} className="hidden sm:block text-slate-300 shrink-0" />
          <Step num={5} text="Upload the reviewed file" />
        </div>
      </div>

      {/* Editable Taxonomy */}
      {taxonomy && !isTaxonomyLoading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Manage Tag Taxonomy</h3>
            <span className="text-xs text-slate-400">Add, rename, reorder, or deprecate dimension tags</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <DimensionColumn
              title="Formats"
              colorClass="text-blue-600 dark:text-blue-400"
              tags={taxonomy.formats}
              onAdd={() => openCreate('format')}
              onEdit={(t) => openEdit('format', t)}
              onDelete={(t) => deprecateTag('format', t)}
            />
            <DimensionColumn
              title="Domains"
              colorClass="text-emerald-600 dark:text-emerald-400"
              tags={taxonomy.domains}
              onAdd={() => openCreate('domain')}
              onEdit={(t) => openEdit('domain', t)}
              onDelete={(t) => deprecateTag('domain', t)}
            />
            <DimensionColumn
              title="Sub-Topics"
              colorClass="text-amber-600 dark:text-amber-400"
              tags={taxonomy.subtopics}
              onAdd={() => openCreate('subtopic')}
              onEdit={(t) => openEdit('subtopic', t)}
              onDelete={(t) => deprecateTag('subtopic', t)}
            />
          </div>
        </div>
      )}

      {editorState && (
        <TagEditorModal
          state={editorState}
          isSaving={isSavingTag}
          onClose={closeEditor}
          onSubmit={saveTag}
        />
      )}
    </div>
  );
};

// ─── Dimension column with edit/delete affordances ────────────────────────

const DimensionColumn: React.FC<{
  title: string;
  colorClass: string;
  tags: TaxonomyTag[];
  onAdd: () => void;
  onEdit: (tag: TaxonomyTag) => void;
  onDelete: (tag: TaxonomyTag) => void;
}> = ({ title, colorClass, tags, onAdd, onEdit, onDelete }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <h4 className={`text-xs font-bold ${colorClass} uppercase tracking-wider`}>{title}</h4>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        title={`Add ${title.toLowerCase().replace(/s$/, '')}`}
      >
        <Plus size={12} /> Add
      </button>
    </div>
    <div className="space-y-1">
      {tags.length === 0 && (
        <div className="text-xs text-slate-400 italic">No tags yet</div>
      )}
      {tags.map(t => (
        <div
          key={t.id}
          className="group flex items-center justify-between gap-2 text-sm py-1 px-2 -mx-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50"
        >
          <span className="text-slate-700 dark:text-slate-300 truncate">{t.rawName}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs tabular-nums text-slate-400">{t.usageCount}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(t)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                title="Edit"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => onDelete(t)}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                title="Deprecate (soft delete)"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Modal: create / edit a dimension tag ─────────────────────────────────

const TagEditorModal: React.FC<{
  state: EditorState;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (form: TagFormState) => void;
}> = ({ state, isSaving, onClose, onSubmit }) => {
  const [name, setName] = useState(state.initial.name);
  const [sortOrder, setSortOrder] = useState<number>(state.initial.sortOrder);
  const [aliases, setAliases] = useState(state.initial.aliases);

  const dimensionLabel =
    state.dimension === 'format' ? 'Format'
    : state.dimension === 'domain' ? 'Domain'
    : 'Sub-Topic';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name, sortOrder, aliases });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {state.mode === 'create' ? `Add ${dimensionLabel} Tag` : `Edit ${dimensionLabel} Tag`}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Climate & Energy"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sort order
            </label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-slate-500">Lower numbers appear first in filter bars and pickers.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Aliases (optional)
            </label>
            <input
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Climate, ESG, Energy Transition"
            />
            <p className="mt-1 text-xs text-slate-500">
              Comma-separated. Used by the bulk XLSX importer to match historical spellings.
              {state.mode === 'edit' && ' Leave blank to keep current aliases unchanged is NOT supported — submitting an empty list clears all aliases.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sublabel: string; color: 'blue' | 'emerald' | 'amber' }> = ({ label, value, sublabel, color }) => {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs opacity-70 mt-0.5">{sublabel}</div>
    </div>
  );
};

const Step: React.FC<{ num: number; text: string }> = ({ num, text }) => (
  <div className="flex items-center gap-2 shrink-0">
    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center">{num}</span>
    <span className="text-xs">{text}</span>
  </div>
);
