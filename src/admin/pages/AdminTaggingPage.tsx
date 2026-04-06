import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Tags, ArrowRight, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAdminHeader } from '../layout/AdminLayout';
import { useTagTaxonomy } from '@/hooks/useTagTaxonomy';
import { getNormalizedApiBase } from '@/utils/urlUtils';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: taxonomy, isLoading: isTaxonomyLoading } = useTagTaxonomy();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

      {/* Current Taxonomy Reference */}
      {taxonomy && !isTaxonomyLoading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Current Tag Taxonomy</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Formats</h4>
              <div className="space-y-1">
                {taxonomy.formats.map(f => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{f.rawName}</span>
                    <span className="text-xs tabular-nums text-slate-400">{f.usageCount}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Domains</h4>
              <div className="space-y-1">
                {taxonomy.domains.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{d.rawName}</span>
                    <span className="text-xs tabular-nums text-slate-400">{d.usageCount}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Sub-Topics</h4>
              <div className="space-y-1">
                {taxonomy.subtopics.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{s.rawName}</span>
                    <span className="text-xs tabular-nums text-slate-400">{s.usageCount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
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
