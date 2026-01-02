import React, { useState } from 'react';
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
  const toast = useToast();

  const visibleCollections = availableCollections.filter(c => c.type === visibility);

  const collectionOptions: SelectableDropdownOption[] = visibleCollections.map(col => ({
    id: col.name,
    label: col.name,
  }));

  /**
   * Checks if a collection already exists (case-insensitive comparison)
   */
  const isDuplicate = (collectionName: string): boolean => {
    const normalizedName = collectionName.toLowerCase().trim();
    return selected.some(selectedName => selectedName.toLowerCase().trim() === normalizedName);
  };

  const handleSelect = (optionId: string) => {
    // Case-insensitive duplicate check
    if (!isDuplicate(optionId)) {
      onSelectedChange([...selected, optionId]);
    }
    setSearchValue('');
  };

  const handleDeselect = (optionId: string) => {
    onSelectedChange(selected.filter(id => id !== optionId));
  };

  const handleCreateNew = async (searchValue: string) => {
    // Trim and validate: ignore empty or 1-char values
    const trimmed = searchValue.trim();
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

    try {
      // Create the collection via API
      const newCollection = await storageService.createCollection(
        trimmed,
        '',
        currentUserId,
        visibility
      );

      // Optimistically add to available collections immediately
      // Normalize by ID to prevent duplicates
      const existingIds = new Set(availableCollections.map(c => c.id));
      if (!existingIds.has(newCollection.id)) {
        const updatedCollections = [...availableCollections, newCollection];
        onAvailableCollectionsChange?.(updatedCollections);
      }

      // Add to selected collections (auto-select the newly created collection)
      onSelectedChange([...selected, trimmed]);
      
      // Refetch collections of the current visibility type to sync with backend
      // This ensures we have the latest data from the server
      try {
        const refreshedCollections = await storageService.getCollections({ type: visibility });
        
        // Merge strategy: Keep collections of OTHER types, replace collections of CURRENT type with refreshed
        const otherTypeCollections = availableCollections.filter(c => (c.type || 'public') !== visibility);
        const mergedCollections = [...otherTypeCollections, ...refreshedCollections];
        
        // Normalize by ID to remove any duplicates (defensive)
        const collectionsMap = new Map<string, Collection>();
        mergedCollections.forEach(c => {
          if (!collectionsMap.has(c.id)) {
            collectionsMap.set(c.id, c);
          }
        });
        
        onAvailableCollectionsChange?.(Array.from(collectionsMap.values()));
      } catch (refetchError) {
        // If refetch fails, the optimistic update is still in place
        // Just log the error - the collection was created successfully
        console.warn('Failed to refetch collections after creation:', refetchError);
      }
      
      setSearchValue('');
    } catch (error: any) {
      console.error('Failed to create collection:', error);
      toast.error(error?.message || 'Failed to create collection');
    }
  };

  const filterOptions = (options: SelectableDropdownOption[], search: string): SelectableDropdownOption[] => {
    return options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  };

  const canCreateNew = (search: string, options: SelectableDropdownOption[]): boolean => {
    // Never auto-create on empty string or 1-char values
    const trimmed = search.trim();
    if (!trimmed || trimmed.length <= 1) return false;
    
    // Check against both options and selected items (case-insensitive)
    const existsInOptions = options.some(opt => opt.label.toLowerCase().trim() === trimmed.toLowerCase().trim());
    const existsInSelected = isDuplicate(trimmed);
    
    return !existsInOptions && !existsInSelected;
  };

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
  const createText = visibility === 'public'
    ? 'Create community collection'
    : 'Create private collection';

  return (
    <SelectableDropdown
      id="collections-combobox"
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

