import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';

vi.mock('@/constants/featureFlags', () => ({
  isFeatureEnabled: () => false,
}));

vi.mock('@/context/FilterStateContext', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useFilterSelector: (
    selector: (state: {
      contentStream: 'standard' | 'pulse';
      setContentStream: (s: 'standard' | 'pulse') => void;
    }) => unknown,
  ) =>
    selector({
      contentStream: 'standard',
      setContentStream: () => {},
    }),
}));

vi.mock('@/context/AppChromeScrollContext', () => ({
  useAppChromeScroll: () => ({
    isViewportNarrow: true,
    narrowHeaderHidden: false,
    setChromeInteractionActive: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePulseUnseen', () => ({
  useStandardUnseenCount: () => ({ data: 0 }),
  usePulseUnseenCount: () => ({ data: 0 }),
}));

describe('MobileBottomNav when MARKET_PULSE is disabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render Market Pulse tab (two-column shell)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Primary destinations' });
    const grid = nav.querySelector('[class*="grid-cols-2"]');
    expect(grid).toBeTruthy();
    expect(screen.queryByText('Market Pulse')).not.toBeInTheDocument();
  });
});
