import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Badge } from '../UI/Badge';
import { tagsInclude } from '@/utils/tagUtils';

export interface SelectableDropdownOption {
  id: string;
  label: string;
}

export interface SelectableDropdownProps<T extends SelectableDropdownOption> {
  id: string;
  label: string;
  required?: boolean;
  selected: string[];
  options: T[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (optionId: string) => void;
  onDeselect: (optionId: string) => void;
  onCreateNew?: (searchValue: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  warning?: string | null;
  touched?: boolean;
  emptyPlaceholder?: string;
  renderOption?: (option: T, isSelected: boolean, isFocused: boolean) => React.ReactNode;
  getOptionLabel?: (option: T) => string;
  getOptionId?: (option: T) => string;
  filterOptions?: (options: T[], searchValue: string) => T[];
  canCreateNew?: (searchValue: string, options: T[]) => boolean;
  comboboxRef?: React.RefObject<HTMLDivElement | null>;
  listboxRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  icon?: React.ReactNode;
  onBlur?: () => void;
}

export function SelectableDropdown<T extends SelectableDropdownOption>({
  id,
  label,
  required = false,
  selected,
  options,
  searchValue,
  onSearchChange,
  onSelect,
  onDeselect,
  onCreateNew,
  placeholder = "Search...",
  helperText,
  error,
  warning,
  touched = false,
  emptyPlaceholder = "Add items...",
  renderOption,
  getOptionLabel = (option) => option.label,
  getOptionId = (option) => option.id,
  filterOptions,
  canCreateNew,
  comboboxRef: externalComboboxRef,
  listboxRef: externalListboxRef,
  className = "",
  icon,
  onBlur: externalOnBlur,
}: SelectableDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const internalComboboxRef = useRef<HTMLDivElement>(null);
  const internalListboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const comboboxRef = externalComboboxRef || internalComboboxRef;
  const listboxRef = externalListboxRef || internalListboxRef;

  const filteredOptions = filterOptions 
    ? filterOptions(options, searchValue)
    : options.filter(opt => getOptionLabel(opt).toLowerCase().includes(searchValue.toLowerCase()));

  const showCreateOption = onCreateNew && canCreateNew 
    ? canCreateNew(searchValue, options)
    : onCreateNew && searchValue && !options.some(opt => getOptionLabel(opt).toLowerCase() === searchValue.toLowerCase());

  const totalOptions = filteredOptions.length + (showCreateOption ? 1 : 0);

  /**
   * Handles selection of an item and maintains UX flow:
   * - Clears the input field
   * - Keeps focus in the input
   * - Re-opens the dropdown for continued adding
   */
  const handleItemSelected = () => {
    onSearchChange('');
    setFocusedIndex(-1);
    // Use setTimeout to ensure state updates complete before refocusing
    setTimeout(() => {
      inputRef.current?.focus();
      setIsOpen(true);
    }, 0);
  };

  /**
   * Handles keyboard navigation and actions
   * - Arrow Up/Down: Navigate through options
   * - Enter: Select highlighted item or create new if no match
   * - Escape: Close dropdown without clearing input
   * - Backspace: Remove last chip when input is empty
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(-1);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < totalOptions - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : totalOptions - 1));
        break;
      case 'Enter':
        e.preventDefault();
        const trimmedSearch = searchValue.trim();
        
        // If a dropdown item is highlighted, select it
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const option = filteredOptions[focusedIndex];
          const optionId = getOptionId(option);
          // Use case-insensitive comparison for tag matching
          if (!tagsInclude(selected, optionId)) {
            onSelect(optionId);
            handleItemSelected();
          }
        } 
        // If "Create new" option is highlighted, create it
        else if (focusedIndex === filteredOptions.length && showCreateOption && onCreateNew) {
          if (trimmedSearch && trimmedSearch.length > 1) {
            onCreateNew(trimmedSearch);
            handleItemSelected();
          }
        }
        // If no item is highlighted but text exists, try to create new
        else if (focusedIndex === -1 && trimmedSearch && trimmedSearch.length > 1) {
          // Check if we can create new (not a duplicate)
          const canCreate = canCreateNew 
            ? canCreateNew(trimmedSearch, options)
            : !options.some(opt => getOptionLabel(opt).toLowerCase() === trimmedSearch.toLowerCase());
          
          if (canCreate && onCreateNew) {
            onCreateNew(trimmedSearch);
            handleItemSelected();
          } else if (!canCreate && filteredOptions.length > 0) {
            // If it's a duplicate, select the first matching option
            const matchingOption = filteredOptions[0];
            const optionId = getOptionId(matchingOption);
            // Use case-insensitive comparison for tag matching
            if (!tagsInclude(selected, optionId)) {
              onSelect(optionId);
              handleItemSelected();
            }
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        // Close dropdown but do NOT clear input
        setIsOpen(false);
        setFocusedIndex(-1);
        comboboxRef.current?.focus();
        break;
      case 'Backspace':
        // If input is empty and there are selected items, remove the last one
        if (!searchValue.trim() && selected.length > 0) {
          e.preventDefault();
          const lastSelected = selected[selected.length - 1];
          onDeselect(lastSelected);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Delay to allow click events to fire
    setTimeout(() => {
      if (!listboxRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setFocusedIndex(-1);
        if (externalOnBlur) {
          externalOnBlur();
        }
      }
    }, 200);
  };

  return (
    <div className={`relative group space-y-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
        {label}
        {required && <span className="text-xs text-red-600 dark:text-red-400" aria-label="required">*</span>}
      </label>
      <div
        id={id}
        ref={comboboxRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-describedby={`${id}-helper ${id}-error`}
        aria-invalid={!!error}
        aria-required={required}
        aria-label={label}
        tabIndex={0}
        className={`w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm min-h-[42px] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          error
            ? 'border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-900/20'
            : touched && selected.length === 0 && required
            ? 'border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
        }`}
        onClick={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        {icon && <div className="text-slate-500 dark:text-slate-400 shrink-0">{icon}</div>}
        
        <div className="flex-1 flex flex-nowrap gap-1.5 items-center overflow-x-auto custom-scrollbar no-scrollbar-visual">
          {selected.length > 0 ? (
            selected.map(id => {
              const option = options.find(opt => getOptionId(opt) === id);
              return option ? (
                <Badge
                  key={id}
                  label={getOptionLabel(option)}
                  variant="primary"
                  onRemove={() => onDeselect(id)}
                />
              ) : null;
            })
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{emptyPlaceholder}</span>
          )}
        </div>
        
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </div>
      
      {helperText && (
        <p id={`${id}-helper`} className="text-[10px] text-slate-700 dark:text-slate-300 italic">
          {helperText}
        </p>
      )}
      
      {error && (
        <div id={`${id}-error`} role="alert" aria-live="polite" className="text-[10px] text-red-700 dark:text-red-400 font-medium">
          {error}
        </div>
      )}
      
      {warning && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 italic">
          {warning}
        </div>
      )}
      
      {isOpen && (
        <div
          id={`${id}-listbox`}
          ref={listboxRef}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30"
        >
          <div className="fixed inset-0 -z-10" onClick={() => { setIsOpen(false); setFocusedIndex(-1); }} />
          <input
            ref={inputRef}
            autoFocus
            id={`${id}-search-input`}
            className="w-full text-xs border-b border-slate-200 dark:border-slate-600 pb-2 mb-2 focus:outline-none focus:border-primary-500 bg-transparent px-2 text-slate-900 dark:text-white placeholder-slate-500 font-medium"
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setFocusedIndex(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                // Close dropdown but do NOT clear input
                setIsOpen(false);
                setFocusedIndex(-1);
                comboboxRef.current?.focus();
              } else {
                handleKeyDown(e);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Search ${label.toLowerCase()}`}
            aria-controls={`${id}-listbox`}
          />
          <div className="max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-1">
            {filteredOptions.map((option, idx) => {
              const optionId = getOptionId(option);
              // Use case-insensitive comparison for tag matching
              const isSelected = tagsInclude(selected, optionId);
              const isFocused = focusedIndex === idx;
              
              return (
                <button
                  key={optionId}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  ref={(el) => {
                    if (isFocused && el) {
                      el.focus();
                      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      onDeselect(optionId);
                      setFocusedIndex(-1);
                    } else {
                      onSelect(optionId);
                      handleItemSelected();
                    }
                  }}
                  className={`text-left text-[11px] px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-200'
                  } ${isFocused ? 'ring-2 ring-primary-500' : ''}`}
                >
                  {renderOption ? renderOption(option, isSelected, isFocused) : (
                    <>
                      <span>{getOptionLabel(option)}</span>
                      {isSelected && <Check size={14} className="text-primary-600 dark:text-primary-400" />}
                    </>
                  )}
                </button>
              );
            })}
            
            {showCreateOption && onCreateNew && (
              <button
                role="option"
                aria-selected={false}
                tabIndex={-1}
                ref={(el) => {
                  if (focusedIndex === filteredOptions.length && el) {
                    el.focus();
                    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const trimmedSearch = searchValue.trim();
                  if (trimmedSearch && trimmedSearch.length > 1) {
                    onCreateNew(trimmedSearch);
                    handleItemSelected();
                  }
                  setFocusedIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setIsOpen(false);
                    setFocusedIndex(-1);
                    comboboxRef.current?.focus();
                  }
                }}
                className={`text-left text-[11px] px-2 py-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-primary-600 font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  focusedIndex === filteredOptions.length ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                Create "{searchValue}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

