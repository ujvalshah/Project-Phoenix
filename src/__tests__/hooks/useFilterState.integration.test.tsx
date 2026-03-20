/**
 * Integration tests for useFilterState hook
 *
 * Tests the hook's runtime behavior: debounce timing, URL sync,
 * localStorage persistence, and state transitions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { useFilterState } from '@/hooks/useFilterState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper(initialRoute = '/') {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      {children}
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Debounce behavior
// ---------------------------------------------------------------------------

describe('search debounce', () => {
  it('updates searchInputValue immediately but delays searchQuery', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearchInput('hel');
    });

    // Input value updates immediately
    expect(result.current.searchInputValue).toBe('hel');
    // Debounced query has NOT updated yet
    expect(result.current.searchQuery).toBe('');

    // Advance past debounce (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.searchQuery).toBe('hel');
  });

  it('resets debounce timer on rapid typing', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearchInput('h');
    });
    act(() => {
      vi.advanceTimersByTime(200); // 200ms — not yet fired
    });
    act(() => {
      result.current.setSearchInput('he');
    });
    act(() => {
      vi.advanceTimersByTime(200); // 200ms from second keystroke — still not fired
    });

    // Only 400ms total, second keystroke reset the timer
    expect(result.current.searchQuery).toBe('');

    act(() => {
      vi.advanceTimersByTime(100); // 300ms from second keystroke
    });

    expect(result.current.searchQuery).toBe('he');
  });

  it('trims leading whitespace on input and trailing on debounce', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearchInput('  hello  ');
    });

    // Leading space trimmed immediately
    expect(result.current.searchInputValue).toBe('hello  ');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Debounced value is fully trimmed
    expect(result.current.searchQuery).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// Category management
// ---------------------------------------------------------------------------

describe('category management', () => {
  it('toggleCategory adds and removes categories', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.toggleCategory('Science');
    });
    expect(result.current.selectedCategories).toEqual(['Science']);

    act(() => {
      result.current.toggleCategory('Tech');
    });
    expect(result.current.selectedCategories).toEqual(['Science', 'Tech']);

    // Toggle off
    act(() => {
      result.current.toggleCategory('Science');
    });
    expect(result.current.selectedCategories).toEqual(['Tech']);
  });

  it('activeCategory derives correctly', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.activeCategory).toBe('All');

    act(() => {
      result.current.toggleCategory('Today');
    });
    expect(result.current.activeCategory).toBe('Today');

    act(() => {
      result.current.setSelectedCategories(['Science', 'Today']);
    });
    // "Today" takes priority
    expect(result.current.activeCategory).toBe('Today');

    act(() => {
      result.current.setSelectedCategories(['Tech']);
    });
    expect(result.current.activeCategory).toBe('Tech');
  });
});

// ---------------------------------------------------------------------------
// Sort management
// ---------------------------------------------------------------------------

describe('sort management', () => {
  it('defaults to latest', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });
    expect(result.current.sortOrder).toBe('latest');
  });

  it('accepts all valid sort orders', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    for (const sort of ['oldest', 'title', 'title-desc', 'latest'] as const) {
      act(() => {
        result.current.setSortOrder(sort);
      });
      expect(result.current.sortOrder).toBe(sort);
    }
  });
});

// ---------------------------------------------------------------------------
// Active filter count
// ---------------------------------------------------------------------------

describe('activeFilterCount and hasActiveFilters', () => {
  it('starts at 0 with no active filters', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('counts each active filter dimension', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearchInput('test');
      vi.advanceTimersByTime(300);
    });
    expect(result.current.activeFilterCount).toBe(1); // search

    act(() => {
      result.current.toggleCategory('Tech');
    });
    expect(result.current.activeFilterCount).toBe(2); // search + 1 category

    act(() => {
      result.current.setSelectedTag('react');
    });
    expect(result.current.activeFilterCount).toBe(3);

    act(() => {
      result.current.setSortOrder('oldest');
    });
    expect(result.current.activeFilterCount).toBe(4);

    act(() => {
      result.current.setFavorites(true);
    });
    expect(result.current.activeFilterCount).toBe(5);

    act(() => {
      result.current.toggleFormat('video');
    });
    expect(result.current.activeFilterCount).toBe(6);

    act(() => {
      result.current.setTimeRange('7d');
    });
    expect(result.current.activeFilterCount).toBe(7);

    expect(result.current.hasActiveFilters).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Clear / reset controls
// ---------------------------------------------------------------------------

describe('reset controls', () => {
  it('clearAll resets every filter dimension', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    // Set everything
    act(() => {
      result.current.setSearchInput('test');
      vi.advanceTimersByTime(300);
    });
    act(() => {
      result.current.toggleCategory('Tech');
      result.current.setSelectedTag('react');
      result.current.setSortOrder('oldest');
      result.current.setFavorites(true);
      result.current.setUnread(true);
      result.current.toggleFormat('video');
      result.current.setTimeRange('24h');
    });

    expect(result.current.activeFilterCount).toBeGreaterThan(0);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchInputValue).toBe('');
    expect(result.current.selectedCategories).toEqual([]);
    expect(result.current.selectedTag).toBeNull();
    expect(result.current.sortOrder).toBe('latest');
    expect(result.current.favorites).toBe(false);
    expect(result.current.unread).toBe(false);
    expect(result.current.formats).toEqual([]);
    expect(result.current.timeRange).toBe('all');
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('clearSearch only resets search', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearchInput('test');
      vi.advanceTimersByTime(300);
      result.current.toggleCategory('Tech');
    });

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchInputValue).toBe('');
    expect(result.current.selectedCategories).toEqual(['Tech']); // preserved
  });

  it('clearCategories only resets categories', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.toggleCategory('Tech');
      result.current.setSelectedTag('react');
    });

    act(() => {
      result.current.clearCategories();
    });

    expect(result.current.selectedCategories).toEqual([]);
    expect(result.current.selectedTag).toBe('react'); // preserved
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe('localStorage persistence', () => {
  it('persists sort preference to localStorage', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSortOrder('oldest');
    });

    // URL sync runs in useEffect — flush
    act(() => {
      vi.advanceTimersByTime(0);
    });

    const stored = localStorage.getItem('phoenix_filters');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).sort).toBe('oldest');
  });

  it('restores sort preference from localStorage on mount', () => {
    localStorage.setItem('phoenix_filters', JSON.stringify({ sort: 'title' }));

    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.sortOrder).toBe('title');
  });

  it('does NOT persist search query (ephemeral)', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setSearchInput('test');
      vi.advanceTimersByTime(300);
    });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    const stored = localStorage.getItem('phoenix_filters');
    if (stored) {
      expect(JSON.parse(stored).q).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// URL initialisation
// ---------------------------------------------------------------------------

describe('URL initialisation', () => {
  it('reads initial filters from URL params', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper('/?q=climate&sort=oldest&cat=Science&tag=env&favorites=1&time=7d'),
    });

    expect(result.current.searchInputValue).toBe('climate');
    expect(result.current.searchQuery).toBe('climate');
    expect(result.current.sortOrder).toBe('oldest');
    expect(result.current.selectedCategories).toEqual(['Science']);
    expect(result.current.selectedTag).toBe('env');
    expect(result.current.favorites).toBe(true);
    expect(result.current.timeRange).toBe('7d');
  });

  it('URL params take precedence over localStorage', () => {
    localStorage.setItem('phoenix_filters', JSON.stringify({ sort: 'title' }));

    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper('/?sort=oldest'),
    });

    expect(result.current.sortOrder).toBe('oldest'); // URL wins
  });
});

// ---------------------------------------------------------------------------
// Format toggle
// ---------------------------------------------------------------------------

describe('format toggle', () => {
  it('adds and removes formats', () => {
    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.toggleFormat('video');
    });
    expect(result.current.formats).toEqual(['video']);

    act(() => {
      result.current.toggleFormat('link');
    });
    expect(result.current.formats).toEqual(['video', 'link']);

    act(() => {
      result.current.toggleFormat('video');
    });
    expect(result.current.formats).toEqual(['link']);
  });
});
