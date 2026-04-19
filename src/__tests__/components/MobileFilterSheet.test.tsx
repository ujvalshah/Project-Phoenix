/**
 * MobileFilterSheet — regression for reopen-during-exit (invisible fullscreen blocker).
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import MobileFilterSheet from '@/components/header/MobileFilterSheet';
import type { FilterState } from '@/components/header/filterTypes';

vi.mock('@/hooks/useTagTaxonomy', () => ({
  useTagTaxonomy: () => ({
    data: {
      formats: [{ id: 'fmt-1', rawName: 'Podcast', usageCount: 3 }],
      domains: [{ id: 'dom-1', rawName: 'Technology', usageCount: 2 }],
      subtopics: [],
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useFeaturedCollections', () => ({
  useFeaturedCollections: () => ({ data: [], isLoading: false }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));

const defaultFilters: FilterState = {
  collectionId: null,
  formatTagIds: [],
  domainTagIds: [],
  subtopicTagIds: [],
};

function RaceHarness() {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  return (
    <>
      <button type="button" aria-label="toggle-sheet" onClick={() => setIsOpen((o) => !o)}>
        toggle
      </button>
      <MobileFilterSheet
        isOpen={isOpen}
        filters={filters}
        onChange={setFilters}
        onClearAll={() => setFilters(defaultFilters)}
        onClose={() => setIsOpen(false)}
        resultCount={42}
      />
    </>
  );
}

describe('MobileFilterSheet', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recovers when reopened during exit animation (no stuck invisible layer)', async () => {
    render(<RaceHarness />);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    });

    const backdropPresentation = document.querySelector('#drawer-root [role="presentation"]');
    expect(backdropPresentation).toBeTruthy();
    await waitFor(() => {
      expect(backdropPresentation?.className).toMatch(/pointer-events-auto/);
    });

    const toggle = screen.getByRole('button', { name: 'toggle-sheet' });
    await act(async () => {
      fireEvent.click(toggle);
    });
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy();
    });

    const backdropAfter = document.querySelector('#drawer-root [role="presentation"]');
    await waitFor(() => {
      expect(backdropAfter?.className).toMatch(/pointer-events-auto/);
    });
  });
});
