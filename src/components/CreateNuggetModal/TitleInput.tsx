import React from 'react';

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  linkMetadataTitle?: string;
  error?: string | null;
  warning?: string | null;
  onTouchedChange?: (touched: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function TitleInput({
  value,
  onChange,
  onBlur,
  linkMetadataTitle,
  error,
  warning,
  onTouchedChange,
  onErrorChange,
}: TitleInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (onTouchedChange) onTouchedChange(true);
    if (onErrorChange && error) {
      // Clear error when user types
      onErrorChange(null);
    }
  };

  const handleBlurEvent = () => {
    if (onBlur) onBlur();
    if (onTouchedChange) onTouchedChange(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="title-input" className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Title (Optional)
        </label>
        {/* PHASE 2: Removed auto-fill indicator - titles are never auto-filled */}
      </div>
      <input
        id="title-input"
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlurEvent}
        placeholder="Enter a title for your nugget..."
        className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white placeholder-slate-500"
      />
      {error && (
        <div className="text-[10px] text-red-700 dark:text-red-400 font-medium">
          {error}
        </div>
      )}
      {warning && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 italic">
          {warning}
        </div>
      )}
    </div>
  );
}



