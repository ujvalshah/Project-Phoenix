import React, { useState, useCallback, useRef } from 'react';
import { Globe, Lock, Check } from 'lucide-react';
import { SelectableDropdown, SelectableDropdownOption } from './SelectableDropdown';
import { Collection } from '@/types';
import { storageService } from '@/services/storageService';
import { useToast } from '@/hooks/useToast';

interface CollectionSelectorProps {
  selected: string[];
  availableCollections: Collection[];
  visibility: 'public' | 'private';
  onSelectedChange: (selected: string[]) => void;
  onAvailableCollectionsChange?: (collections: Collection[]) => void;
  currentUserId?: string;
  comboboxRef?: React.RefObject<HTMLDivElement | null>;
  listboxRef?: React.RefObject<HTMLDivElement | null>;
}

export function CollectionSelector({
  selected,
  availableCollections,
  visibility,
  onSelectedChange,
  onAvailableCollectionsChange,
  currentUserId,
  comboboxRef,
  listboxRef,
}: CollectionSelectorProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const toast = useToast();

  // Track pending creations to prevent duplicate API calls
  const pendingCreationsRef = useRef<Set<string>>(new Set());

  const visibleCollections = availableCollections.filter(c => c.type === visibility);

  // Use collection ID for proper tracking, but still display name
  // Note: Using name as ID for backward compatibility with selection logic
  const collectionOptions: SelectableDropdownOption[] = visibleCollections.map(col => ({
    id: col.name, // Keep using name for now to maintain compatibility
    label: col.name,
  }));

  /**
   * Checks if a collection already exists (case-insensitive comparison)
   */
  const isDuplicate = (collectionName: string): boolean => {
    const normalizedName = collectionName.toLowerCase().trim();
    return selected.some(selectedName => selectedName.toLowerCase().trim() === normalizedName);
  };

  const handleSelect = useCallback((optionId: string) => {
    // Case-insensitive duplicate check
    if (!isDuplicate(optionId)) {
      onSelectedChange([...selected, optionId]);
    }
    setSearchValue('');
  }, [selected, onSelectedChange]);

  const handleDeselect = useCallback((optionId: string) => {
    // Case-insensitive removal
    const normalizedId = optionId.toLowerCase().trim();
    onSelectedChange(selected.filter(id => id.toLowerCase().trim() !== normalizedId));
  }, [selected, onSelectedChange]);

  const handleCreateNew = useCallback(async (searchValueInput: string) => {
    // Trim and validate: ignore empty or 1-char values
    const trimmed = searchValueInput.trim();
    if (!trimmed || trimmed.length <= 1) {
      return;
    }

    // Case-insensitive duplicate check
    if (isDuplicate(trimmed)) {
      return;
    }

    // Validate user is authenticated
    if (!currentUserId) {
      toast.error('You must be logged in to create a collection');
      return;
    }

    // Prevent duplicate API calls
    const normalizedName = trimmed.toLowerCase();
    if (pendingCreationsRef.current.has(normalizedName)) {
      return;
    }

    // Prevent double creation
    if (isCreating) return;
    setIsCreating(true);
    pendingCreationsRef.current.add(normalizedName);

    try {
      // Create the collection via API
      const newCollection = await storageService.createCollection(
        trimmed,
        '',
        currentUserId,
        visibility
      );

      // Add to available collections (single update, no double refresh)
      // Normalize by ID to prevent duplicates
      const existingIds = new Set(availableCollections.map(c => c.id));
      if (!existingIds.has(newCollection.id)) {
        const updatedCollections = [...availableCollections, newCollection];
        onAvailableCollectionsChange?.(updatedCollections);
      }

      // Add to selected collections (auto-select the newly created collection)
      onSelectedChange([...selected, trimmed]);

      // Note: Removed the double refetch that was causing flicker
      // The optimistic update above is sufficient
      // If we need fresh data, it should be handled at a higher level (React Query)

      setSearchValue('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create collection';
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
      pendingCreationsRef.current.delete(normalizedName);
    }
  }, [selected, availableCollections, visibility, currentUserId, isCreating, onSelectedChange, onAvailableCollectionsChange, toast]);

  const filterOptions = useCallback((options: SelectableDropdownOption[], search: string): SelectableDropdownOption[] => {
    return options.filter(opt =>
      opt.label && typeof opt.label === 'string' && opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, []);

  const canCreateNew = useCallback((search: string, options: SelectableDropdownOption[]): boolean => {
    // Never auto-create on empty string or 1-char values
    const trimmed = search.trim();
    if (!trimmed || trimmed.length <= 1) return false;

    // Check against both options and selected items (case-insensitive)
    const existsInOptions = options.some(opt =>
      opt.label && typeof opt.label === 'string' && opt.label.toLowerCase().trim() === trimmed.toLowerCase().trim()
    );
    const existsInSelected = isDuplicate(trimmed);

    return !existsInOptions && !existsInSelected;
  }, [selected]); // Re-compute when selected changes

  const label = visibility === 'public' ? 'Community Collection' : 'Private Collection';
  const placeholder = visibility === 'public'
    ? 'Find or create community collection...'
    : 'Find or create private collection...';
  const helperText = visibility === 'public'
    ? 'Create or Add your nugget to a Community Collection'
    : 'Save this nugget to your private collection.';
  const emptyPlaceholder = visibility === 'public'
    ? 'Add to community collection'
    : 'Add to your private collection';

  return (
    <SelectableDropdown
      id={`collections-combobox-${visibility}`}
      label={label}
      selected={selected}
      options={collectionOptions}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onSelect={handleSelect}
      onDeselect={handleDeselect}
      onCreateNew={handleCreateNew}
      placeholder={placeholder}
      helperText={helperText}
      emptyPlaceholder={emptyPlaceholder}
      isLoading={isCreating}
      filterOptions={filterOptions}
      canCreateNew={canCreateNew}
      comboboxRef={comboboxRef}
      listboxRef={listboxRef}
      icon={visibility === 'public' ? <Globe size={14} /> : <Lock size={14} />}
      renderOption={(option, isSelected) => (
        <>
          <span>{option.label}</span>
          {isSelected && <Check size={14} className="text-primary-600 dark:text-primary-400" />}
        </>
      )}
    />
  );
}

