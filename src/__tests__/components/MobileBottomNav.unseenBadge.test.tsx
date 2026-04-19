import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';

const mocks = vi.hoisted(() => ({
  stream: 'standard' as 'standard' | 'pulse',
  homeCount: 0,
  pulseCount: 0,
}));

vi.mock('@/context/FilterStateContext', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useFilterSelector: (
    selector: (state: { contentStream: 'standard' | 'pulse'; setContentStream: (stream: 'standard' | 'pulse') => void }) => unknown,
  ) =>
    selector({
      contentStream: mocks.stream,
      setContentStream: (stream: 'standard' | 'pulse') => {
        mocks.stream = stream;
      },
    }),
}));

vi.mock('@/context/AppChromeScrollContext', () => ({
  useAppChromeScroll: () => ({
    isViewportNarrow: true,
    narrowHeaderHidden: false,
    setChromeInteractionActive: vi.fn(),
  }),
}));

vi.mock('@/constants/featureFlags', () => ({
  isFeatureEnabled: (key: string) => key === 'MARKET_PULSE',
}));

vi.mock('@/hooks/usePulseUnseen', () => ({
  useStandardUnseenCount: () => ({ data: mocks.homeCount }),
  usePulseUnseenCount: () => ({ data: mocks.pulseCount }),
}));

describe('MobileBottomNav unseen badges', () => {
  beforeEach(() => {
    mocks.stream = 'standard';
    mocks.homeCount = 0;
    mocks.pulseCount = 0;
  });

  function renderNav() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
  }

  it('does not render badge when unseen count is zero', () => {
    renderNav();
    expect(screen.queryByText('99+')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unseen Nuggets updates/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unseen Market Pulse updates/i)).not.toBeInTheDocument();
  });

  it('renders numeric badges and caps count at 99+', () => {
    mocks.homeCount = 3;
    mocks.pulseCount = 120;
    renderNav();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.getByLabelText('3 unseen Nuggets updates')).toBeInTheDocument();
    expect(screen.getByLabelText('99+ unseen Market Pulse updates')).toBeInTheDocument();
  });
});
