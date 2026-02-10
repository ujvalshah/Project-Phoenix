import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check } from 'lucide-react';
import { SelectableDropdown, SelectableDropdownOption } from './SelectableDropdown';
import { normalizeCategoryLabel } from '@/utils/formatters';
import { storageService } from '@/services/storageService';
import { removeTag } from '@/utils/tagUtils';

interface TagSelectorProps {
  selected: string[];
  availableCategories: string[]; // CATEGORY PHASE-OUT: Kept prop name for backward compatibility, but represents tags
  onSelectedChange: (selected: string[]) => void;
  onAvailableCategoriesChange: (tags: string[]) => void; // CATEGORY PHASE-OUT: Kept prop name but represents tags
  error: string | null;
  touched: boolean;
  onTouchedChange: (touched: boolean) => void;
  onErrorChange: (error: string | null) => void;
  comboboxRef?: React.RefObject<HTMLDivElement | null>;
  listboxRef?: React.RefObject<HTMLDivElement | null>;
}

export function TagSelector({
  selected,
  availableCategories, // CATEGORY PHASE-OUT: This prop represents tags, not categories
  onSelectedChange,
  onAvailableCategoriesChange, // CATEGORY PHASE-OUT: This prop represents tags, not categories
  error,
  touched,
  onTouchedChange,
  onErrorChange,
  comboboxRef,
  listboxRef,
}: TagSelectorProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Track pending API calls to prevent race conditions
  const pendingCreationsRef = useRef<Set<string>>(new Set());

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

  // CATEGORY PHASE-OUT: availableCategories prop represents tags
  const tagOptions: SelectableDropdownOption[] = availableCategories
    .filter(tag => typeof tag === 'string' && tag.trim() !== '')
    .map(tag => ({ id: tag, label: tag }));

  /**
   * Checks if a tag already exists (case-insensitive comparison)
   */
  const isDuplicate = (tag: string): boolean => {
    const normalizedTag = tag.toLowerCase().trim();
    return selected.some(selectedTag => selectedTag.toLowerCase().trim() === normalizedTag);
  };

  const handleSelect = useCallback(async (optionId: string) => {
    const normalized = normalizeCategoryLabel(optionId);
    if (!normalized) return;

    const cleanCat = normalized.replace(/^#/, '');

    // Case-insensitive duplicate check
    if (isDuplicate(cleanCat)) return;

    // Optimistically update UI immediately
    onSelectedChange([...selected, cleanCat]);
    setSearchValue('');
    if (!touched) onTouchedChange(true);

    // Clear error immediately when tag is added
    if (error) {
      const newError = validateTags();
      onErrorChange(newError);
    }

    // CATEGORY PHASE-OUT: Add to available tags if missing (case-insensitive check)
    const tagExists = availableCategories.some(
      tag => tag.toLowerCase().trim() === cleanCat.toLowerCase().trim()
    );

    if (!tagExists) {
      // Prevent duplicate API calls for the same tag
      if (pendingCreationsRef.current.has(cleanCat.toLowerCase())) {
        return;
      }

      pendingCreationsRef.current.add(cleanCat.toLowerCase());

      try {
        // Method name kept for backward compatibility but creates tags
        await storageService.addCategory(cleanCat);
        onAvailableCategoriesChange([...availableCategories, cleanCat].sort());
      } catch (err) {
        // Log error but don't remove from selection (optimistic update stays)
        // Tag is already in local state, user can still use it
        console.error('[TagSelector] Failed to persist tag to backend:', err);
      } finally {
        pendingCreationsRef.current.delete(cleanCat.toLowerCase());
      }
    }
  }, [selected, availableCategories, touched, error, onSelectedChange, onTouchedChange, onErrorChange, onAvailableCategoriesChange]);

  const handleDeselect = useCallback((optionId: string) => {
    // Use case-insensitive removal to handle rawName casing differences
    onSelectedChange(removeTag(selected, optionId));
    if (!touched) onTouchedChange(true);
    // Validate tags when tag is removed
    if (touched) {
      const newError = validateTags();
      onErrorChange(newError);
    }
  }, [selected, touched, onSelectedChange, onTouchedChange, onErrorChange]);

  const handleCreateNew = useCallback(async (searchValueInput: string) => {
    // Trim and validate: ignore empty or 1-char values
    const trimmed = searchValueInput.trim();
    if (!trimmed || trimmed.length <= 1) {
      return;
    }

    // Prevent double-creation if already creating
    if (isCreating) return;
    setIsCreating(true);

    try {
      // Normalize the input
      const normalized = normalizeCategoryLabel(trimmed);
      if (normalized) {
        const cleanCat = normalized.replace(/^#/, '');
        // Case-insensitive duplicate check
        if (!isDuplicate(cleanCat)) {
          await handleSelect(cleanCat);
        }
      }
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, handleSelect]);

  const filterOptions = useCallback((options: SelectableDropdownOption[], search: string): SelectableDropdownOption[] => {
    return options.filter(opt =>
      typeof opt.label === 'string' &&
      opt.label.trim() !== '' &&
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, []);

  const canCreateNew = useCallback((search: string, options: SelectableDropdownOption[]): boolean => {
    // Never auto-create on empty string or 1-char values
    const trimmed = search.trim();
    if (!trimmed || trimmed.length <= 1) return false;

    const normalized = normalizeCategoryLabel(trimmed);
    if (!normalized) return false;
    const cleanCat = normalized.replace(/^#/, '');

    // Check against both options and selected items (case-insensitive)
    const existsInOptions = options.some(opt =>
      opt.label && typeof opt.label === 'string' && opt.label.toLowerCase().trim() === cleanCat.toLowerCase().trim()
    );
    const existsInSelected = isDuplicate(cleanCat);

    return !existsInOptions && !existsInSelected;
  }, [selected]); // Re-compute when selected changes

  const handleBlur = useCallback(() => {
    if (!touched) onTouchedChange(true);
    const newError = validateTags();
    onErrorChange(newError);
  }, [touched, onTouchedChange, onErrorChange]);

  // Format tag labels with # prefix for display in badges
  const formatTagLabel = useCallback((label: string) => `#${label}`, []);

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
      isLoading={isCreating}
      formatSelectedLabel={formatTagLabel}
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

