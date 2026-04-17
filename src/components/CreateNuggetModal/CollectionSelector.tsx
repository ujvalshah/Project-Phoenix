import React, { useState, useCallback, useMemo } from 'react';
import { Globe, Lock, Check } from 'lucide-react';
import { SelectableDropdown, SelectableDropdownOption } from './SelectableDropdown';
import { Collection } from '@/types';

function scopedNameKey(collection: Collection): string {
  const parentKey = collection.parentId ?? 'root';
  return `${parentKey}::${(collection.name || '').toLowerCase().trim()}`;
}

function collectionPrimaryLine(collection: Collection, nameById: Map<string, string>): string {
  const name = collection.name || '';
  if (!collection.parentId) return name;
  const parentName = nameById.get(collection.parentId);
  return parentName ? `${parentName} → ${name}` : name;
}

function collectionOptionLabel(
  collection: Collection,
  nameById: Map<string, string>,
  pathCounts: Map<string, number>,
  showTechnicalIds: boolean
): string {
  const primary = collectionPrimaryLine(collection, nameById);
  const key = scopedNameKey(collection);
  const ambiguousPath = (pathCounts.get(key) || 0) > 1;
  const suffix =
    showTechnicalIds || ambiguousPath || collection.parentId
      ? ` · …${collection.id.slice(-8)}`
      : '';
  return `${primary}${suffix}`;
}

interface CollectionSelectorProps {
  selected: string[];
  availableCollections: Collection[];
  visibility: 'public' | 'private';
  onSelectedChange: (selected: string[]) => void;
  /** When true, every option includes a short id suffix (admin tooling). */
  showTechnicalIds?: boolean;
  comboboxRef?: React.RefObject<HTMLDivElement | null>;
  listboxRef?: React.RefObject<HTMLDivElement | null>;
}

export function CollectionSelector({
  selected,
  availableCollections,
  visibility,
  onSelectedChange,
  showTechnicalIds = false,
  comboboxRef,
  listboxRef,
}: CollectionSelectorProps) {
  const [searchValue, setSearchValue] = useState('');

  const visibleCollections = availableCollections.filter((c) => c.type === visibility);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of availableCollections) {
      m.set(c.id, c.name || '');
    }
    return m;
  }, [availableCollections]);

  const pathCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of visibleCollections) {
      const k = scopedNameKey(c);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [visibleCollections]);

  const collectionOptions: SelectableDropdownOption[] = useMemo(
    () =>
      visibleCollections.map((col) => ({
        id: col.id,
        label: collectionOptionLabel(col, nameById, pathCounts, showTechnicalIds),
      })),
    [visibleCollections, nameById, pathCounts, showTechnicalIds]
  );

  const isDuplicateId = useCallback(
    (collectionId: string): boolean => selected.includes(collectionId),
    [selected]
  );

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!isDuplicateId(optionId)) {
        onSelectedChange([...selected, optionId]);
      }
      setSearchValue('');
    },
    [selected, onSelectedChange, isDuplicateId]
  );

  const handleDeselect = useCallback(
    (optionId: string) => {
      onSelectedChange(selected.filter((id) => id !== optionId));
    },
    [selected, onSelectedChange]
  );

  const filterOptions = useCallback((options: SelectableDropdownOption[], search: string): SelectableDropdownOption[] => {
    const q = search.toLowerCase();
    return options.filter((opt) => {
      if (!opt.label || typeof opt.label !== 'string') return false;
      if (opt.label.toLowerCase().includes(q)) return true;
      const col = visibleCollections.find((c) => c.id === opt.id);
      if (!col) return false;
      const plain = (col.name || '').toLowerCase();
      const parentName = col.parentId ? (nameById.get(col.parentId) || '').toLowerCase() : '';
      return plain.includes(q) || parentName.includes(q);
    });
  }, [visibleCollections, nameById]);

  const label = visibility === 'public' ? 'Community Collection' : 'Private Collection';
  const placeholder =
    visibility === 'public'
      ? 'Find community collection...'
      : 'Find private collection...';
  const helperText =
    visibility === 'public'
      ? 'Add your nugget to an existing community collection.'
      : 'Add your nugget to an existing private collection.';
  const emptyPlaceholder =
    visibility === 'public' ? 'Add to community collection' : 'Add to your private collection';

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
      placeholder={placeholder}
      helperText={helperText}
      emptyPlaceholder={emptyPlaceholder}
      filterOptions={filterOptions}
      comboboxRef={comboboxRef}
      listboxRef={listboxRef}
      getOptionLabel={(opt) => opt.label}
      getOptionId={(opt) => opt.id}
      icon={visibility === 'public' ? <Globe size={14} /> : <Lock size={14} />}
      renderOption={(option, isSelected) => (
        <>
          <span className="text-left">{option.label}</span>
          {isSelected && <Check size={14} className="text-primary-600 dark:text-primary-400 shrink-0" />}
        </>
      )}
    />
  );
}
