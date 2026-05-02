import React, { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as featureFlags from '@/constants/featureFlags';
import { useFilterState, sanitizeContentStreamAgainstPulseFlag } from '@/hooks/useFilterState';

function createWrapper(initialPath: string) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );
  Wrapper.displayName = 'MarketPulseFilterWrapper';
  return Wrapper;
}

describe('sanitizeContentStreamAgainstPulseFlag', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns standard when stream is pulse and MARKET_PULSE is disabled', () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockImplementation((key) =>
      key === 'MARKET_PULSE' ? false : true,
    );
    expect(sanitizeContentStreamAgainstPulseFlag('pulse')).toBe('standard');
    expect(sanitizeContentStreamAgainstPulseFlag('standard')).toBe('standard');
  });

  it('preserves pulse when MARKET_PULSE is enabled', () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockImplementation((key) =>
      key === 'MARKET_PULSE' ? true : false,
    );
    expect(sanitizeContentStreamAgainstPulseFlag('pulse')).toBe('pulse');
  });
});

describe('useFilterState + MARKET_PULSE', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not activate pulse feed from URL when MARKET_PULSE is off', () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockImplementation((key) =>
      key === 'MARKET_PULSE' ? false : true,
    );

    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper('/?stream=pulse'),
    });

    expect(result.current.contentStream).toBe('standard');
  });

  it('honors stream=pulse in URL when MARKET_PULSE is on', () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockImplementation((key) =>
      key === 'MARKET_PULSE' ? true : false,
    );

    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper('/?stream=pulse'),
    });

    expect(result.current.contentStream).toBe('pulse');
  });

  it('ignores setContentStream(pulse) when MARKET_PULSE is off', () => {
    vi.spyOn(featureFlags, 'isFeatureEnabled').mockImplementation((key) =>
      key === 'MARKET_PULSE' ? false : true,
    );

    const { result } = renderHook(() => useFilterState(), {
      wrapper: createWrapper('/'),
    });

    expect(result.current.contentStream).toBe('standard');
    result.current.setContentStream('pulse');
    expect(result.current.contentStream).toBe('standard');
  });
});
