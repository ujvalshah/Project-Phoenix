import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareMenu } from '@/components/shared/ShareMenu';

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  show: vi.fn(),
};

vi.mock('@/hooks/useToast', () => ({
  useToast: () => toast,
}));

describe('ShareMenu fallback behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(),
    });
  });

  function openShareMenu() {
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
  }

  it('shares via native flow from menu action', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: share,
    });

    render(
      <ShareMenu
        data={{ type: 'nugget', id: 'n1', title: 'Title', shareUrl: 'https://nuggets.one/article/n1' }}
        surface="test_surface"
      />
    );

    openShareMenu();
    fireEvent.click(screen.getByRole('button', { name: /share now/i }));

    await waitFor(() => {
      expect(share).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Shared');
    });
  });

  it('copies link when explicit copy action is selected', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: undefined,
    });

    render(
      <ShareMenu
        data={{ type: 'nugget', id: 'n1', title: 'Title', shareUrl: 'https://nuggets.one/article/n1' }}
        surface="test_surface"
      />
    );

    openShareMenu();
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Link copied!');
    });
  });

  it('treats native share cancellation as non-error', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError')),
    });

    render(
      <ShareMenu
        data={{ type: 'nugget', id: 'n1', title: 'Title', shareUrl: 'https://nuggets.one/article/n1' }}
        surface="test_surface"
      />
    );

    openShareMenu();
    fireEvent.click(screen.getByRole('button', { name: /share now/i }));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Share cancelled');
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copy when native share errors', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('Native share failed unexpectedly')),
    });

    render(
      <ShareMenu
        data={{ type: 'collection', id: 'c1', title: 'Collection', shareUrl: 'https://nuggets.one/collections/c1' }}
        surface="test_surface"
      />
    );

    openShareMenu();
    fireEvent.click(screen.getByRole('button', { name: /share now/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Link copied!');
    });
  });

  it('opens platform intent urls in new tab', async () => {
    const openSpy = vi.spyOn(window, 'open');
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: undefined,
    });

    render(
      <ShareMenu
        data={{ type: 'collection', id: 'c1', title: 'Collection', shareUrl: 'https://nuggets.one/collections/c1' }}
        surface="test_surface"
      />
    );

    openShareMenu();
    fireEvent.click(screen.getByRole('button', { name: /linkedin/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
  });
});

