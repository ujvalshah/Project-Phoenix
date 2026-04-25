import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from '@/components/header/SearchInput';

describe('SearchInput submit behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits current input value on Enter without waiting for debounce', () => {
    const onSearch = vi.fn();
    const onSubmit = vi.fn();

    render(<SearchInput onSearch={onSearch} onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /search/i });

    fireEvent.change(input, { target: { value: 'Iconiq' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('Iconiq');
    expect(onSearch).toHaveBeenCalledWith('Iconiq');
  });
});
