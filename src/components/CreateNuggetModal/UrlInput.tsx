import React from 'react';
import { X } from 'lucide-react';

interface UrlInputProps {
  urlInput: string;
  urls: string[];
  onUrlInputChange: (value: string) => void;
  onAddUrl: () => void;
  onRemoveUrl: (url: string) => void;
  onUrlPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onTouchedChange?: (touched: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function UrlInput({
  urlInput,
  urls,
  onUrlInputChange,
  onAddUrl,
  onRemoveUrl,
  onUrlPaste,
  onTouchedChange,
  onErrorChange,
}: UrlInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUrlInputChange(e.target.value);
    if (onTouchedChange) onTouchedChange(true);
  };

  const handleBlur = () => {
    if (onTouchedChange) onTouchedChange(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddUrl();
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="url-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
        URLs (Optional - Add multiple)
      </label>
      <div className="flex gap-2">
        <input
          id="url-input"
          type="url"
          value={urlInput}
          onChange={handleChange}
          onBlur={handleBlur}
          onPaste={onUrlPaste}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com (paste multiple URLs to add all)"
          className="flex-1 px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white placeholder-slate-500"
        />
        <button
          type="button"
          onClick={onAddUrl}
          className="px-4 py-2.5 bg-primary-500 hover:bg-primary-400 text-white text-xs font-bold rounded-xl transition-colors"
        >
          Add URL
        </button>
      </div>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {urls.map((url, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <span className="text-xs text-primary-700 dark:text-primary-300 truncate max-w-[200px]">{url}</span>
              <button
                type="button"
                onClick={() => onRemoveUrl(url)}
                className="text-primary-600 hover:text-primary-800 dark:text-primary-400"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}












