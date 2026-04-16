/** Shared labels for typeahead rows (desktop + mobile). */

export function formatSuggestionPublishedLabel(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}

export function formatContentStreamLabel(stream: string | undefined): string {
  if (stream === 'pulse') return 'Market Pulse';
  if (stream === 'both') return 'Both feeds';
  return 'Home';
}

export function formatSourceTypeLabel(sourceType: string | null | undefined): string {
  if (!sourceType || typeof sourceType !== 'string') return '';
  const t = sourceType.replace(/_/g, ' ').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
