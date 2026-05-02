import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useImperativeHandle, forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputHandle {
  clear: () => void;
  focus: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
}

interface SearchInputProps {
  /** Initial value to seed the input (read once on mount) */
  initialValue?: string;
  /**
   * Monotonic counter — when it increments, the input mirrors `externalValue`
   * into its local state. Lets callers (filter chip removal, clearSearch, URL
   * hydration) deterministically reset the visible input without taking over
   * every keystroke. Keystrokes still stay local to avoid render cascades.
   */
  resetSignal?: number;
  /** External value applied when `resetSignal` changes (and on mount alongside initialValue). */
  externalValue?: string;
  /** Called with the trimmed value after the debounce window (250ms) */
  onSearch: (value: string) => void;
  /** Called immediately on every change (for features like recent-search display) */
  onChangeImmediate?: (value: string) => void;
  /** Called when user presses Enter */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  iconSize?: number;
  showClearButton?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  inputId?: string;
  inputRole?: React.AriaRole;
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both';
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaActiveDescendant?: string;
  autoComplete?: string;
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onInputBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const DEBOUNCE_MS = 250;

/**
 * Self-contained search input with local state and built-in debounce.
 *
 * Keystrokes update only this component's local state, never the parent.
 * The parent is notified via `onSearch` only after the user pauses typing,
 * eliminating the re-render cascade that caused input lag.
 */
export const SearchInput = React.memo(forwardRef<SearchInputHandle, SearchInputProps>(({
  initialValue = '',
  resetSignal,
  externalValue,
  onSearch,
  onChangeImmediate,
  onSubmit,
  placeholder = 'Search...',
  className,
  inputClassName,
  iconSize = 16,
  showClearButton = true,
  autoFocus = false,
  ariaLabel = 'Search',
  inputId,
  inputRole,
  ariaAutocomplete,
  ariaControls,
  ariaExpanded,
  ariaActiveDescendant,
  autoComplete,
  onInputKeyDown,
  onInputFocus,
  onInputBlur,
}, ref) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the last value we emitted via onSearch so blur can't re-emit the
  // same value (and so the empty-on-blur path can't overwrite a kept commit).
  const lastEmittedRef = useRef(initialValue.trim());

  // Stable reference to the latest onSearch to avoid re-creating the debounce callback
  const onSearchRef = useRef(onSearch);
  const onChangeImmediateRef = useRef(onChangeImmediate);
  useLayoutEffect(() => {
    onSearchRef.current = onSearch;
    onChangeImmediateRef.current = onChangeImmediate;
  }, [onSearch, onChangeImmediate]);

  // External reset: when the parent bumps `resetSignal`, mirror `externalValue`
  // into local state and cancel any in-flight debounce. This is how filter
  // chip removal / clearSearch / clearAll make the visible input actually clear.
  const prevResetSignalRef = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal === undefined) return;
    if (prevResetSignalRef.current === resetSignal) return;
    prevResetSignalRef.current = resetSignal;
    const next = externalValue ?? '';
    queueMicrotask(() => {
      setLocalValue(next);
      lastEmittedRef.current = next.trim();
    });
    clearTimeout(debounceRef.current);
  }, [resetSignal, externalValue]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      setLocalValue('');
      clearTimeout(debounceRef.current);
      if (lastEmittedRef.current !== '') {
        lastEmittedRef.current = '';
        onSearchRef.current('');
      }
    },
    focus: () => inputRef.current?.focus(),
    setValue: (v: string) => {
      setLocalValue(v);
      clearTimeout(debounceRef.current);
      const trimmed = v.trim();
      if (lastEmittedRef.current !== trimmed) {
        lastEmittedRef.current = trimmed;
        onSearchRef.current(trimmed);
      }
    },
    getValue: () => localValue,
  }));

  // Cleanup debounce timer on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const emitOnSearch = (trimmed: string) => {
    if (lastEmittedRef.current === trimmed) return;
    lastEmittedRef.current = trimmed;
    onSearchRef.current(trimmed);
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trimStart();
    setLocalValue(raw);
    onChangeImmediateRef.current?.(raw);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      emitOnSearch(raw.trim());
    }, DEBOUNCE_MS);
  }, []);

  const handleClear = useCallback(() => {
    setLocalValue('');
    clearTimeout(debounceRef.current);
    emitOnSearch('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onInputKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current);
      const trimmed = localValue.trim();
      // Force emit on explicit submit even if value matches last emitted,
      // so parents treat Enter as an intentional commit gesture.
      lastEmittedRef.current = trimmed;
      onSearchRef.current(trimmed);
      onSubmit?.(trimmed);
    }
  }, [localValue, onSubmit, onInputKeyDown]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    onInputBlur?.(e);
    const trimmed = localValue.trim();
    if (trimmed !== localValue) {
      setLocalValue(trimmed);
    }
    clearTimeout(debounceRef.current);
    // Only emit on blur if the trimmed value is meaningfully different from
    // what we last emitted. Prevents blur from silently re-committing an
    // empty value after a clear, or re-firing the last debounced value.
    emitOnSearch(trimmed);
  }, [localValue, onInputBlur]);

  return (
    <div className={className ?? 'flex items-center px-3 transition-colors cursor-text w-full overflow-hidden'}>
      <div className="relative w-full">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
          <Search size={iconSize} />
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={onInputFocus}
          placeholder={placeholder}
          className={inputClassName ?? 'min-w-[50px] w-full flex-1 bg-transparent py-2.5 pl-10 text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder-slate-500'}
          aria-label={ariaLabel}
          role={inputRole}
          aria-autocomplete={ariaAutocomplete}
          aria-controls={ariaControls}
          aria-expanded={ariaExpanded}
          aria-activedescendant={ariaActiveDescendant}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
        {showClearButton && localValue && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}));

SearchInput.displayName = 'SearchInput';
