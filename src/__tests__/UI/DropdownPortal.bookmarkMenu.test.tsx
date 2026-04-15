import React, { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { DropdownPortal } from '@/components/UI/DropdownPortal';

vi.mock('@/constants/layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants/layout')>();
  return {
    ...actual,
    getHeaderHeight: () => 56
  };
});

describe('DropdownPortal (bookmark-style menus)', () => {
  const innerWidth = 800;
  const innerHeight = 400;

  beforeEach(() => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(innerWidth);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(innerHeight);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockAnchorRect(el: HTMLElement, rect: Partial<DOMRect>) {
    const full: DOMRect = {
      x: rect.x ?? 0,
      y: rect.y ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
      bottom: rect.bottom ?? 0,
      toJSON: () => ({})
    };
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(full);
  }

  it('flips above the anchor when there is not enough space below (viewport edge / card footer)', async () => {
    function Harness({ open }: { open: boolean }) {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button
            ref={ref}
            type="button"
            data-testid="anchor"
            style={{ position: 'fixed', top: 340, left: 200, width: 40, height: 40 }}
          />
          <DropdownPortal isOpen={open} anchorRef={ref} align="right" onClickOutside={() => {}}>
            <div data-testid="panel-body" style={{ height: 180, width: 200 }}>
              Change Folder
            </div>
          </DropdownPortal>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    const anchor = screen.getByTestId('anchor');
    mockAnchorRect(anchor, {
      top: 340,
      left: 200,
      right: 240,
      bottom: 380,
      width: 40,
      height: 40
    });
    rerender(<Harness open />);

    const panel = await waitFor(() => screen.getByTestId('panel-body').parentElement);
    expect(panel).toBeTruthy();
    // jsdom often yields 0 layout height; stub measured height so collision logic runs (real browsers layout correctly).
    vi.spyOn(panel as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      top: 388,
      left: 200,
      right: 400,
      bottom: 568,
      width: 200,
      height: 180,
      x: 200,
      y: 388,
      toJSON: () => ({})
    });
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      const top = Number.parseFloat((panel as HTMLElement).style.top);
      expect(top).toBeLessThan(340);
    });
    const top = Number.parseFloat((panel as HTMLElement).style.top);
    const bottom = top + 180;
    expect(bottom).toBeLessThanOrEqual(innerHeight - 4 + 0.5);
  });

  it('shifts horizontally when the panel would overflow the right edge', async () => {
    function Harness({ open }: { open: boolean }) {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button
            ref={ref}
            type="button"
            data-testid="anchor"
            style={{ position: 'fixed', top: 80, left: innerWidth - 60, width: 40, height: 40 }}
          />
          <DropdownPortal isOpen={open} anchorRef={ref} align="right" onClickOutside={() => {}}>
            <div data-testid="panel-body" style={{ height: 80, width: 220 }}>
              Item
            </div>
          </DropdownPortal>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    const anchor = screen.getByTestId('anchor');
    mockAnchorRect(anchor, {
      top: 80,
      left: innerWidth - 60,
      right: innerWidth - 20,
      bottom: 120,
      width: 40,
      height: 40
    });
    rerender(<Harness open />);

    const panel = await waitFor(() => screen.getByTestId('panel-body').parentElement);
    const pr = (panel as HTMLElement).getBoundingClientRect();
    expect(pr.right).toBeLessThanOrEqual(innerWidth - 4 + 0.5);
  });

  it('returns focus to the anchor after Escape closes the menu', async () => {
    function FocusTest() {
      const [open, setOpen] = useState(true);
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={ref} type="button" data-testid="anchor" />
          <DropdownPortal
            isOpen={open}
            anchorRef={ref}
            onClickOutside={() => setOpen(false)}
            restoreFocusOnClose
          >
            <div style={{ height: 40 }}>Menu</div>
          </DropdownPortal>
        </>
      );
    }

    render(<FocusTest />);
    const anchor = screen.getByTestId('anchor');
    mockAnchorRect(anchor, {
      top: 100,
      left: 100,
      right: 140,
      bottom: 140,
      width: 40,
      height: 40
    });

    anchor.focus();
    expect(document.activeElement).toBe(anchor);

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Menu')).toBeNull();
      expect(document.activeElement).toBe(anchor);
    });
  });
});
