import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookmarkButton } from '@/components/bookmarks/BookmarkButton';
import { bookmarkService } from '@/services/bookmarkService';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'user' },
    currentUserId: 'user-1',
    currentUser: { id: 'user-1', role: 'user' },
    isAdmin: false,
    isAuthenticated: true,
    isLoading: false,
    modularUser: null,
    featureFlags: null,
    signupConfig: null,
    login: vi.fn(),
    signup: vi.fn(),
    socialLogin: vi.fn(),
    logout: vi.fn(),
    isAuthModalOpen: false,
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
    authModalView: 'login' as const
  })
}));

vi.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    withAuth: (fn: () => void) => () => {
      fn();
    }
  })
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}));

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('BookmarkButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from server: stale local bookmark cleared when API says not saved', async () => {
    vi.spyOn(bookmarkService, 'isLocallyBookmarked').mockReturnValue(true);
    vi.spyOn(bookmarkService, 'getStatus').mockResolvedValue({
      isBookmarked: false,
      bookmarkId: undefined,
      collectionIds: []
    });
    vi.spyOn(bookmarkService, 'syncLocalFromServer').mockImplementation(() => {});

    renderWithQuery(<BookmarkButton itemId="n1" itemType="nugget" />);

    await waitFor(() => {
      expect(bookmarkService.getStatus).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-button')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });

  it('rolls back optimistic save when toggle fails and there was no cached status', async () => {
    vi.spyOn(bookmarkService, 'isLocallyBookmarked').mockReturnValue(false);
    vi.spyOn(bookmarkService, 'getStatus').mockResolvedValue({
      isBookmarked: false,
      bookmarkId: undefined,
      collectionIds: []
    });
    vi.spyOn(bookmarkService, 'toggle').mockRejectedValue(new Error('network'));
    vi.spyOn(bookmarkService, 'syncLocalFromServer').mockImplementation(() => {});

    renderWithQuery(<BookmarkButton itemId="n2" itemType="nugget" />);

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-button')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    fireEvent.click(screen.getByTestId('bookmark-button'));

    await waitFor(() => {
      expect(bookmarkService.toggle).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-button')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });
});
