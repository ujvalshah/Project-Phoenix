import type { Collection } from '@/types';

export interface CollectionFilterGroup {
  parent: Collection;
  children: Collection[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sortByName(a: Collection, b: Collection): number {
  return a.name.localeCompare(b.name);
}

/**
 * Build collection groups for filter UIs.
 * - Keeps featured parents first for familiar ordering.
 * - Includes all remaining public root collections (not only featured ones).
 * - Applies search over both parents and children.
 */
export function buildCollectionFilterGroups(params: {
  featuredCollections: Collection[];
  publicCollections: Collection[];
  searchQuery: string;
}): CollectionFilterGroup[] {
  const { featuredCollections, publicCollections, searchQuery } = params;
  const normalizedSearch = normalize(searchQuery);

  const featuredById = new Map(featuredCollections.map((c) => [c.id, c]));
  const publicById = new Map(publicCollections.map((c) => [c.id, c]));

  const childrenByParent = new Map<string, Collection[]>();
  publicCollections.forEach((collection) => {
    if (!collection.parentId) return;
    const next = childrenByParent.get(collection.parentId) || [];
    next.push(collection);
    childrenByParent.set(collection.parentId, next);
  });
  childrenByParent.forEach((children, parentId) => {
    childrenByParent.set(parentId, [...children].sort(sortByName));
  });

  const rootPublicCollections = publicCollections.filter((c) => !c.parentId).sort(sortByName);
  const featuredParentIds = featuredCollections.map((c) => c.id);
  const featuredParentSet = new Set(featuredParentIds);
  const nonFeaturedRootIds = rootPublicCollections
    .map((c) => c.id)
    .filter((id) => !featuredParentSet.has(id));

  const orderedParentIds = [...featuredParentIds, ...nonFeaturedRootIds];
  const groups: CollectionFilterGroup[] = [];

  orderedParentIds.forEach((parentId) => {
    const parent = publicById.get(parentId) || featuredById.get(parentId);
    if (!parent) return;

    const children = childrenByParent.get(parent.id) || [];
    const parentMatches = parent.name.toLowerCase().includes(normalizedSearch);
    const matchingChildren = normalizedSearch
      ? children.filter((child) => child.name.toLowerCase().includes(normalizedSearch))
      : children;

    if (normalizedSearch && !parentMatches && matchingChildren.length === 0) {
      return;
    }

    groups.push({
      parent,
      children: parentMatches ? children : matchingChildren,
    });
  });

  return groups;
}
