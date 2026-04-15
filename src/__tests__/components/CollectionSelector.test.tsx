import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionSelector } from '@/components/bookmarks/CollectionSelector';
import { ToastProvider } from '@/context/ToastContext';

const assignMutateAsync = vi.fn().mockResolvedValue({});

vi.mock('@/hooks/useBookmarks', () => ({
  useBookmarkCollections: () => ({
    data: [
      {
        id: 'folder-saved',
        name: 'Saved',
        order: 0,
        isDefault: true,
        bookmarkCount: 1,
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'folder-extra',
        name: 'Reading',
        order: 1,
        isDefault: false,
        bookmarkCount: 0,
        createdAt: '',
        updatedAt: ''
      }
    ],
    isLoading: false
  }),
  useCreateBookmarkCollection: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  }),
  useAssignBookmarkToCollections: () => ({
    mutateAsync: assignMutateAsync,
    isPending: false
  })
}));

function Harness({
  initialCollectionIds,
  isOpen = true,
  onClose = vi.fn(),
  onCollectionChange
}: {
  initialCollectionIds: string[];
  isOpen?: boolean;
  onClose?: () => void;
  onCollectionChange?: (ids: string[]) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={anchorRef}>
        anchor
      </button>
      <CollectionSelector
        bookmarkId="bm-1"
        itemId="item-1"
        initialCollectionIds={initialCollectionIds}
        isOpen={isOpen}
        onClose={onClose}
        onCollectionChange={onCollectionChange}
        anchorRef={anchorRef}
      />
    </>
  );
}

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('CollectionSelector', () => {
  beforeEach(() => {
    assignMutateAsync.mockClear();
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
      modalRoot.style.pointerEvents = 'auto';
    }
  });

  it('opens with all initial folder ids selected', async () => {
    renderWithToast(
      <Harness initialCollectionIds={['folder-saved', 'folder-extra']} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-folder-dialog')).toBeInTheDocument();
    });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('Done with empty selection assigns default Saved folder', async () => {
    const onClose = vi.fn();
    renderWithToast(<Harness initialCollectionIds={[]} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-folder-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(assignMutateAsync).toHaveBeenCalledWith({
        bookmarkId: 'bm-1',
        collectionIds: ['folder-saved']
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Done saves multi-folder membership after adding a second folder', async () => {
    renderWithToast(<Harness initialCollectionIds={['folder-saved']} />);

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-folder-dialog')).toBeInTheDocument();
    });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    fireEvent.click(options[1]);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(assignMutateAsync).toHaveBeenCalledWith({
        bookmarkId: 'bm-1',
        collectionIds: expect.arrayContaining(['folder-saved', 'folder-extra'])
      });
    });
    const ids = assignMutateAsync.mock.calls[0][0].collectionIds as string[];
    expect(ids).toHaveLength(2);
  });

  it('Escape closes without calling assign', async () => {
    const onClose = vi.fn();
    renderWithToast(
      <Harness initialCollectionIds={['folder-extra']} onClose={onClose} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-folder-dialog')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(assignMutateAsync).not.toHaveBeenCalled();
  });

  it('backdrop click closes without persisting', async () => {
    const onClose = vi.fn();
    renderWithToast(
      <Harness initialCollectionIds={['folder-saved']} onClose={onClose} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-folder-backdrop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('bookmark-folder-backdrop'));
    expect(onClose).toHaveBeenCalled();
    expect(assignMutateAsync).not.toHaveBeenCalled();
  });

  it('renders folder dialog with fixed positioning (not trapped in overflow ancestors)', async () => {
    renderWithToast(<Harness initialCollectionIds={['folder-saved']} />);

    await waitFor(() => {
      expect(screen.getByTestId('bookmark-folder-dialog')).toBeInTheDocument();
    });

    const panel = screen.getByTestId('bookmark-folder-dialog');
    expect(panel).toHaveClass('fixed');
  });
});
