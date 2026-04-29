/**
 * Detect markdown pipe tables without importing react-markdown (keeps CardContent collapsed path lighter).
 */

export function contentHasMarkdownTable(content: string): boolean {
  if (!content) return false;

  const lines = content.split('\n');
  let hasTableHeader = false;
  let hasTableSeparator = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('|') && !trimmed.startsWith('|')) {
      hasTableHeader = true;
    }
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      hasTableHeader = true;
    }
    if (/^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(trimmed)) {
      hasTableSeparator = true;
    }
  }

  return hasTableHeader && hasTableSeparator;
}
