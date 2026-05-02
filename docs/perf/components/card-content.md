# Component: CardContent

## Purpose

Card body rendering path; historically a major CPU surface if full markdown runs per card.

Primary file:

- [`src/components/card/atoms/CardContent.tsx`](../../src/components/card/atoms/CardContent.tsx)

## Perf topics

- Prefer lightweight excerpt rendering in feed
- Defer full markdown to expand/detail surfaces

## Related

Markdown renderer: [`src/components/MarkdownRenderer.tsx`](../../src/components/MarkdownRenderer.tsx)
