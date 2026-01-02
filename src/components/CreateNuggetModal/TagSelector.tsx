import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { SelectableDropdown, SelectableDropdownOption } from './SelectableDropdown';
import { normalizeCategoryLabel } from '@/utils/formatters';
import { storageService } from '@/services/storageService';
import { removeTag } from '@/utils/tagUtils';

interface TagSelectorProps {
  selected: string[];
  availableCategories: string[];
  onSelectedChange: (selected: string[]) => void;
  onAvailableCategoriesChange: (categories: string[]) => void;
  error: string | null;
  touched: boolean;
  onTouchedChange: (touched: boolean) => void;
  onErrorChange: (error: string | null) => void;
  comboboxRef?: React.RefObject<HTMLDivElement | null>;
  listboxRef?: React.RefObject<HTMLDivElement | null>;
}

export function TagSelector({
  selected,
  availableCategories,
  onSelectedChange,
  onAvailableCategoriesChange,
  error,
  touched,
  onTouchedChange,
  onErrorChange,
  comboboxRef,
  listboxRef,
}: TagSelectorProps) {
  const [searchValue, setSearchValue] = useState('');

  const validateTags = (): string | null => {
    if (selected.length === 0) {
      return "Please add at least one tag. Tags enable smarter news discovery.";
    }
    return null;
  };

  // Validate tags when selected changes (if touched)
  useEffect(() => {
    if (touched) {
      const error = validateTags();
      onErrorChange(error);
    }
  }, [selected, touched, onErrorChange]);

  const tagOptions: SelectableDropdownOption[] = availableCategories
    .filter(c => typeof c === 'string' && c.trim() !== '')
    .map(cat => ({ id: cat, label: cat }));

  /**
   * Checks if a tag already exists (case-insensitive comparison)
   */
  const isDuplicate = (tag: string): boolean => {
    const normalizedTag = tag.toLowerCase().trim();
    return selected.some(selectedTag => selectedTag.toLowerCase().trim() === normalizedTag);
  };

  const handleSelect = async (optionId: string) => {
    const normalized = normalizeCategoryLabel(optionId);
    if (normalized) {
      const cleanCat = normalized.replace(/^#/, '');
      // Case-insensitive duplicate check
      if (!isDuplicate(cleanCat)) {
        onSelectedChange([...selected, cleanCat]);
        setSearchValue('');
        if (!touched) onTouchedChange(true);
        // Clear error immediately when tag is added
        if (error) {
          const newError = validateTags();
          onErrorChange(newError);
        }
        // Add to available categories if missing (case-insensitive check)
        const categoryExists = availableCategories.some(
          cat => cat.toLowerCase().trim() === cleanCat.toLowerCase().trim()
        );
        if (!categoryExists) {
          await storageService.addCategory(cleanCat);
          onAvailableCategoriesChange([...availableCategories, cleanCat].sort());
        }
      }
    }
  };

  const handleDeselect = (optionId: string) => {
    // Use case-insensitive removal to handle rawName casing differences
    onSelectedChange(removeTag(selected, optionId));
    if (!touched) onTouchedChange(true);
    // Validate tags when category is removed
    if (touched) {
      const newError = validateTags();
      onErrorChange(newError);
    }
  };

  const handleCreateNew = async (searchValue: string) => {
    // Trim and validate: ignore empty or 1-char values
    const trimmed = searchValue.trim();
    if (!trimmed || trimmed.length <= 1) {
      return;
    }
    
    // Normalize the input
    const normalized = normalizeCategoryLabel(trimmed);
    if (normalized) {
      const cleanCat = normalized.replace(/^#/, '');
      // Case-insensitive duplicate check
      if (!isDuplicate(cleanCat)) {
        await handleSelect(cleanCat);
      }
    }
  };

  const filterOptions = (options: SelectableDropdownOption[], search: string): SelectableDropdownOption[] => {
    return options.filter(opt => 
      typeof opt.label === 'string' && 
      opt.label.trim() !== '' && 
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  };

  const canCreateNew = (search: string, options: SelectableDropdownOption[]): boolean => {
    // Never auto-create on empty string or 1-char values
    const trimmed = search.trim();
    if (!trimmed || trimmed.length <= 1) return false;
    
    const normalized = normalizeCategoryLabel(trimmed);
    if (!normalized) return false;
    const cleanCat = normalized.replace(/^#/, '');
    
    // Check against both options and selected items (case-insensitive)
    const existsInOptions = options.some(opt => opt.label.toLowerCase().trim() === cleanCat.toLowerCase().trim());
    const existsInSelected = isDuplicate(cleanCat);
    
    return !existsInOptions && !existsInSelected;
  };

  const handleBlur = () => {
    if (!touched) onTouchedChange(true);
    const newError = validateTags();
    onErrorChange(newError);
  };

  return (
    <SelectableDropdown
      id="tags-combobox"
      label="Tags"
      required
      selected={selected}
      options={tagOptions}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onSelect={handleSelect}
      onDeselect={handleDeselect}
      onCreateNew={handleCreateNew}
      placeholder="Search or type to create tags..."
      helperText="Tags enable smarter news discovery."
      error={error}
      warning={touched && !error && selected.length === 0 ? "Tags are required before submitting." : undefined}
      onBlur={handleBlur}
      touched={touched}
      emptyPlaceholder="Add tags (required)..."
      renderOption={(option, isSelected) => (
        <>
          <span>#{option.label}</span>
          {isSelected && <Check size={14} className="text-primary-600 dark:text-primary-400" />}
        </>
      )}
      filterOptions={filterOptions}
      canCreateNew={canCreateNew}
      comboboxRef={comboboxRef}
      listboxRef={listboxRef}
      icon={<div className="text-slate-500 dark:text-slate-400 font-bold text-xs">#</div>}
    />
  );
}

