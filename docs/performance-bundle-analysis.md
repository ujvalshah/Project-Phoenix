# Bundle analysis and chunking notes (Performance)

Use this alongside `npm run analyze:bundle` / `npm run analyze:bundle:print` and [`scripts/bundle-budget.json`](../scripts/bundle-budget.json).

## How to measure

```bash
npm run build
node scripts/print-bundle-top.mjs
# Full treemap after:
ANALYZE=1 npm run build && start dist/stats.html
```

## Current setup

- [`vite.config.ts`](../vite.config.ts) now sets conservative `build.rollupOptions.output.manualChunks`.
- [`scripts/check-bundle-budget.mjs`](../scripts/check-bundle-budget.mjs) enforces `index-*.js` and `CreateNuggetModal-*.js` size caps.
- Feed cards: [`CardContent`](../src/components/card/atoms/CardContent.tsx) uses [`LightweightMarkdownExcerpt`](../src/components/card/atoms/LightweightMarkdownExcerpt.tsx) when collapsed and no table; full [`MarkdownRenderer`](../src/components/MarkdownRenderer.tsx) is `React.lazy`-loaded for expand / table / disclaimer-with-table paths.

## Analyzer findings (baseline)

From `ANALYZE=1 npm run build` (before manual chunks), the critical path had one dominant entry:

- `index-*.js`: **1,129,757 bytes** (budget max was 1,200,000)
- `CreateNuggetModal-*.js`: **166,181 bytes**
- Largest node in treemap: `react-dom-client.development.js` (inside `index-*.js`)

## Applied manualChunks

Goal: split stable vendors from app code for long-term caching and reduce the hot `index-*` payload.

Implemented in [`vite.config.ts`](../vite.config.ts):

1. **`vendor-react`** — `react`, `react-dom`, `react-router`, `scheduler`
2. **`vendor-query`** — `@tanstack/react-query`, `@tanstack/react-virtual`
3. **`vendor-markdown`** — `react-markdown`, `remark-*`, `rehype-*`, `mdast-*`, `micromark`, `unist-*`
4. **`vendor-sentry`** — `@sentry/*`

## Before/after snapshot

After applying chunks and rebuilding (`npm run analyze:bundle`):

- `index-*.js`: **465,177 bytes** (down from 1,129,757; ~58.8% reduction)
- `vendor-react-*.js`: **430.01 kB**
- `vendor-query-*.js`: **51.82 kB**
- `vendor-markdown-*.js`: **183.90 kB**
- `vendor-sentry-*.js`: **10.08 kB**
- `CreateNuggetModal-*.js`: **166,489 bytes** (stable)

## Budget guard update

- Tightened `index` budget in [`scripts/bundle-budget.json`](../scripts/bundle-budget.json):
  - `indexJsMaxBytes`: `1200000` -> `550000`
- `CreateNuggetModal` budget unchanged at `190000`.

Validation:

```bash
npm run analyze:bundle
npm run analyze:bundle:print
npm run test:bundles
```

## Risky splits intentionally avoided

- **Do not split React runtime internals** across multiple manual chunks (risk: duplicated runtime/scheduler edges).
- **Do not over-fragment admin/page code** into many tiny vendor chunks (risk: request waterfall and cache churn).
- **Do not isolate tiny helper libs** unless they are very stable and shared (risk: extra requests for negligible win).
- Keep validating with `stats.html`, `npm run test:bundles`, and smoke `/` + `/admin` routes after each split change.
