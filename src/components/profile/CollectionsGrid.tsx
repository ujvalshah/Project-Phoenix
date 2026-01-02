import React from 'react';
import { Collection } from '@/types';
import { CollectionCard } from '../collections/CollectionCard';
import { Folder } from 'lucide-react';

interface CollectionsGridProps {
  collections: Collection[];
  onCollectionClick?: (id: string) => void;
  // Selection
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  // Update callback
  onCollectionUpdate?: (updatedCollection: Collection) => void;
}

export const CollectionsGrid: React.FC<CollectionsGridProps> = ({ 
    collections, 
    onCollectionClick,
    selectionMode = false,
    selectedIds = [],
    onSelect,
    onCollectionUpdate
}) => {
  if (collections.length === 0) {
    return (
      <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <Folder className="mx-auto text-slate-300 mb-2" size={32} />
        <p className="text-slate-500">No collections found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {collections.map(col => (
        <CollectionCard 
            key={col.id} 
            collection={col}
            onClick={() => onCollectionClick?.(col.id)}
            selectionMode={selectionMode}
            isSelected={selectedIds.includes(col.id)}
            onSelect={onSelect}
            onCollectionUpdate={onCollectionUpdate}
        />
      ))}
    </div>
  );
};
