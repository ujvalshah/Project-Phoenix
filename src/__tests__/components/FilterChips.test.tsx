/**
 * Tests for FilterChips component
 *
 * Verifies correct chip rendering, dismiss handlers, and clear-all behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips } from '@/components/header/FilterChips';
import type { SortOrder } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<Parameters<typeof FilterChips>[0]> = {}) {
  return {
    searchQuery: '',
    selectedCategories: [] as string[],
    selectedTag: null as string | null,
    sortOrder: 'latest' as SortOrder,
    collectionName: null as string | null,
    onClearSearch: vi.fn(),
    onRemoveCategory: vi.fn(),
    onClearTag: vi.fn(),
    onClearSort: vi.fn(),
    onClearCollection: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('FilterChips rendering', () => {
  it('renders nothing when no filters are active', () => {
    const { container } = render(<FilterChips {...defaultProps()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a chip for search query', () => {
    render(<FilterChips {...defaultProps({ searchQuery: 'hello' })} />);
    expect(screen.getByText(/Search: "hello"/)).toBeTruthy();
  });

  it('renders chips for each selected category', () => {
    render(<FilterChips {...defaultProps({ selectedCategories: ['Tech', 'Science'] })} />);
    expect(screen.getByText('Tech')).toBeTruthy();
    expect(screen.getByText('Science')).toBeTruthy();
  });

  it('renders a chip for selected tag', () => {
    render(<FilterChips {...defaultProps({ selectedTag: 'react' })} />);
    expect(screen.getByText('Tag: react')).toBeTruthy();
  });

  it('renders a chip for non-default sort order', () => {
    render(<FilterChips {...defaultProps({ sortOrder: 'oldest' })} />);
    expect(screen.getByText('Sort: Oldest')).toBeTruthy();
  });

  it('does NOT render a chip for default sort (latest)', () => {
    render(<FilterChips {...defaultProps({ sortOrder: 'latest' })} />);
    expect(screen.queryByText(/Sort:/)).toBeNull();
  });

  it('renders a chip for collection name', () => {
    render(<FilterChips {...defaultProps({ collectionName: 'India' })} />);
    expect(screen.getByText('Collection: India')).toBeTruthy();
  });

  it('does NOT render collection chip when collectionName is null', () => {
    render(<FilterChips {...defaultProps({ collectionName: null })} />);
    expect(screen.queryByText(/Collection:/)).toBeNull();
  });

  it('renders "Clear all" button when multiple chips exist', () => {
    render(<FilterChips {...defaultProps({ searchQuery: 'x', collectionName: 'India' })} />);
    expect(screen.getByText('Clear all')).toBeTruthy();
  });

  it('does NOT render "Clear all" when only one chip exists', () => {
    render(<FilterChips {...defaultProps({ searchQuery: 'x' })} />);
    expect(screen.queryByText('Clear all')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dismiss handlers
// ---------------------------------------------------------------------------

describe('FilterChips dismiss callbacks', () => {
  it('calls onClearSearch when search chip is dismissed', () => {
    const onClearSearch = vi.fn();
    render(<FilterChips {...defaultProps({ searchQuery: 'test', onClearSearch })} />);

    const removeBtn = screen.getByLabelText('Remove Search: "test" filter');
    fireEvent.click(removeBtn);
    expect(onClearSearch).toHaveBeenCalledOnce();
  });

  it('calls onRemoveCategory with category name when category chip is dismissed', () => {
    const onRemoveCategory = vi.fn();
    render(<FilterChips {...defaultProps({ selectedCategories: ['Tech'], onRemoveCategory })} />);

    const removeBtn = screen.getByLabelText('Remove Tech filter');
    fireEvent.click(removeBtn);
    expect(onRemoveCategory).toHaveBeenCalledWith('Tech');
  });

  it('calls onClearTag when tag chip is dismissed', () => {
    const onClearTag = vi.fn();
    render(<FilterChips {...defaultProps({ selectedTag: 'react', onClearTag })} />);

    const removeBtn = screen.getByLabelText('Remove Tag: react filter');
    fireEvent.click(removeBtn);
    expect(onClearTag).toHaveBeenCalledOnce();
  });

  it('calls onClearSort when sort chip is dismissed', () => {
    const onClearSort = vi.fn();
    render(<FilterChips {...defaultProps({ sortOrder: 'oldest', onClearSort })} />);

    const removeBtn = screen.getByLabelText('Remove Sort: Oldest filter');
    fireEvent.click(removeBtn);
    expect(onClearSort).toHaveBeenCalledOnce();
  });

  it('calls onClearCollection when collection chip is dismissed', () => {
    const onClearCollection = vi.fn();
    render(<FilterChips {...defaultProps({ collectionName: 'India', onClearCollection })} />);

    const removeBtn = screen.getByLabelText('Remove Collection: India filter');
    fireEvent.click(removeBtn);
    expect(onClearCollection).toHaveBeenCalledOnce();
  });

  it('calls onClearAll when "Clear all" is clicked', () => {
    const onClearAll = vi.fn();
    render(<FilterChips {...defaultProps({ searchQuery: 'x', collectionName: 'India', onClearAll })} />);

    fireEvent.click(screen.getByText('Clear all'));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('FilterChips accessibility', () => {
  it('has a status role container', () => {
    render(<FilterChips {...defaultProps({ searchQuery: 'test' })} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('has aria-label on the container', () => {
    render(<FilterChips {...defaultProps({ searchQuery: 'test' })} />);
    expect(screen.getByLabelText('Active filters')).toBeTruthy();
  });

  it('each dismiss button has an aria-label', () => {
    render(<FilterChips {...defaultProps({
      searchQuery: 'x',
      selectedCategories: ['Tech'],
      selectedTag: 'react',
      sortOrder: 'oldest',
    })} />);

    expect(screen.getByLabelText(/Remove Search/)).toBeTruthy();
    expect(screen.getByLabelText(/Remove Tech/)).toBeTruthy();
    expect(screen.getByLabelText(/Remove Tag: react/)).toBeTruthy();
    expect(screen.getByLabelText(/Remove Sort: Oldest/)).toBeTruthy();
  });

  it('"Clear all" button has aria-label', () => {
    render(<FilterChips {...defaultProps({ searchQuery: 'x', collectionName: 'India' })} />);
    expect(screen.getByLabelText('Clear all filters')).toBeTruthy();
  });
});
