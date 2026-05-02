import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LightweightMarkdownExcerpt } from '../LightweightMarkdownExcerpt';

describe('LightweightMarkdownExcerpt', () => {
  it('does not expose raw HTML-like text as DOM HTML', () => {
    const { container } = render(<LightweightMarkdownExcerpt content='<script>x</script>' />);
    expect(container.textContent).toContain('<script>');
    expect(container.querySelector('script')).toBeNull();
  });

  it('preserves line breaks', () => {
    render(<LightweightMarkdownExcerpt content={'line one\n\nline three'} />);
    expect(screen.getByText('line one')).toBeTruthy();
    expect(screen.getByText(/line three/)).toBeTruthy();
  });

  it('renders bare http(s) URLs as links', () => {
    render(
      <LightweightMarkdownExcerpt content={'See https://example.com/page for info.'} />,
    );
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('href', 'https://example.com/page');
    expect(a).toHaveAttribute('target', '_blank');
  });

  it('renders **bold** via slim inline parser (no react-markdown)', () => {
    const { container } = render(<LightweightMarkdownExcerpt content={'Here is **emphasis**'} />);
    expect(container.querySelector('strong')).toHaveTextContent('emphasis');
    expect(screen.getByText(/Here is/)).toBeTruthy();
  });

  it('renders markdown links and inline code', () => {
    render(
      <LightweightMarkdownExcerpt content="[`npm`](https://example.com) run build" />,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toMatch(/^https:\/\/example\.com\/?$/);
    expect(link.querySelector('code')).toHaveTextContent('npm');
  });
});
