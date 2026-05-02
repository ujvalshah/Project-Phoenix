# Route: Article detail

## Canonical paths

From [`src/App.tsx`](../../src/App.tsx):

- Public link pattern: `/article/:articleId`
- Today this **redirects into the homepage modal experience** via `/?openArticle=:id` (see `ArticleRedirect` in Router table).

Likely UI entrypoints:

- Homepage modal / drawer stack (not a dedicated article page in the default path)
- Standalone page variants may still exist depending on route table — verify [`src/App.tsx`](../../src/App.tsx) when changing navigation.

Supporting components commonly involved:

- [`src/components/ArticleDetail.tsx`](../../src/components/ArticleDetail.tsx)


## Perf notes

Markdown and media heavy surfaces often dominate here vs feed cards:

- Prefer lazy paths for heavyweight viewers if not needed above the fold.

## Related API

[`../apis/articles.md`](../apis/articles.md)
