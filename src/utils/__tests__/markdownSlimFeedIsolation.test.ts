import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TASK-034 perf guard: collapsed feed cards stay off the react-markdown + remark-gfm stack;
 * full GFM remains in `MarkdownRenderer` (detail / expanded / table escalation).
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

function readSrc(relUnderSrc: string): string {
  return fs.readFileSync(path.join(repoRoot, 'src', relUnderSrc), 'utf8');
}

const SLIM_SOURCES_NO_HEAVY_MARKDOWN = [
  'components/card/atoms/LightweightMarkdownExcerpt.tsx',
  'components/card/atoms/slimFeedMarkdown.tsx',
  'utils/contentHasMarkdownTable.ts',
];

function lineImportsHeavyMarkdown(line: string): boolean {
  const t = line.trim();
  if (t.startsWith('//')) return false;
  if (!/^\s*import\s/.test(line) && !/import\s*\(/.test(line)) return false;
  if (/from\s+['"]react-markdown['"]/.test(line)) return true;
  if (/from\s+['"]remark-gfm['"]/.test(line)) return true;
  if (/import\s*\(\s*['"]react-markdown['"]\s*\)/.test(line)) return true;
  if (/import\s*\(\s*['"]remark-gfm['"]\s*\)/.test(line)) return true;
  return false;
}

describe('markdown slim feed isolation (TASK-034 perf guard)', () => {
  it('slim excerpt + table-detection sources never import react-markdown or remark-gfm', () => {
    for (const rel of SLIM_SOURCES_NO_HEAVY_MARKDOWN) {
      const src = readSrc(rel);
      const bad: string[] = [];
      for (const line of src.split('\n')) {
        if (lineImportsHeavyMarkdown(line)) bad.push(line.trim());
      }
      expect(bad, rel).toEqual([]);
    }
  });

  it('CardContent uses lazy MarkdownRenderer only (no static react-markdown / remark-gfm)', () => {
    const src = readSrc('components/card/atoms/CardContent.tsx');
    expect(src).not.toMatch(/from\s+['"]react-markdown['"]/);
    expect(src).not.toMatch(/from\s+['"]remark-gfm['"]/);
    expect(src).toContain("import('@/components/MarkdownRenderer')");
  });

  it('MarkdownRenderer still imports full react-markdown + remark-gfm stack', () => {
    const src = readSrc('components/MarkdownRenderer.tsx');
    expect(src).toMatch(/from\s+['"]react-markdown['"]/);
    expect(src).toMatch(/from\s+['"]remark-gfm['"]/);
  });
});
