# Nuggets v2 — Execution Blueprint (Revised v2)

**Status:** Decision-complete for migration planning  
**Audience:** Founders + engineers (Cursor / Claude)  
**Basis:** Project-Phoenix (`nuggets_v60`) product reality + founder decisions + Next.js / Supabase safeguards + performance-first UX spec  

This document supersedes prior blueprint drafts. It is **parity-aware**, **PMF-scoped**, **implementation-safe**, and **LLM-guardrailed** (explicit rules to prevent common vibe-coding failure modes).

**Source-of-truth:** When docs disagree on **architecture, schema, indexes, RSC boundaries**, **this file wins** — **unless** the conflict is **Mongo→Postgres field mapping** (**migration plan wins**) or **pure UX/copy** (**product doc wins**). **Full precedence list:** `docs/NUGGETS_V2_BUILD_EXECUTION.md` **§0**.

**Companion docs:** `docs/NUGGETS_V2_MIGRATION_PLAN.md`, `docs/NUGGETS_V2_BUILD_EXECUTION.md`, `docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md` (product/UI behavior — not duplicated here)

---

## 1. Executive summary

Ship **Nuggets v2** as **Next.js App Router + Supabase (PostgreSQL + Auth) + Vercel**, with:

- **Server-rendered** feed shells and **first-page card HTML** without shipping fat article payloads to client islands  
- **Tag-first** taxonomy; **Nuggets (standard) and Market Pulse (pulse) are separate feeds** — **no overlapping rows**, **no duplicate cards** for the same logical publish. Each article has **exactly one** **`content_stream`** (`standard` \| `pulse`). Legacy Mongo **`both`** (rare) maps to **`standard`** — §12.2. **Cursor pagination** `(published_at DESC, id DESC)`  
- **URL-owned** discovery on **`/`** (`nuqs`): **`stream`**, **`tags`**, **`q`** (search) — **single shareable model** — §6.2  
- **Infinite scroll** via **`fetch` + client state** — **no TanStack Query on the public feed** (PMF)  
- **Skeleton-first loading UX** — never blank white, never spinner-only  
- **Flat bookmarks** only (no folders); **saved list** at **`/bookmarks`** (§6.5) — greenfield; **no** legacy URL redirects  
- **Community collections** — fully public, anonymous-accessible, no save/follow  
- **Article URLs:** stable **ID lookup** + **readable slug** segment with **canonical redirects**  
- **Pulse:** **120–300s** freshness SLA vs longer standard feed  
- **Disclaimer:** **site-wide copy only** — no per-nugget disclaimer fields  
- **Auth:** **email + password** + **Google OAuth**  
- **Explicit Next.js safeguards:** narrow middleware, **no duplicate RSC JSON for first page**, **`remotePatterns`** for Cloudinary  

---

## 2. Founder decisions (closed)

| Topic | Decision |
|--------|-----------|
| **Article URLs** | **Hybrid:** stable **`id`** for lookup; **`slug`** for readability. Canonical URL uses both; title changes **redirect** to latest slug without breaking links. |
| **Community collections — followers** | **Deferred for PMF** — no follower lists, counts, or social graph in schema/API. |
| **Collections — save/bookmark** | **Not a feature.** Users bookmark individual nugget cards only. Collections have no save/follow action. |
| **Collections — visibility** | **Fully public.** Both `/collections` list and `/collections/[id]` detail are anonymous-accessible. No auth required to browse. |
| **Collections — detail page** | Shows: **collection title + description + curator name** + article cards (same card UX as feed). |
| **Bookmarks list route** | **Canonical `/bookmarks`** for the flat saved-nuggets list (UI label **Bookmarks**). Greenfield — **no** redirects from old paths. |
| **Auth** | **Email + password** + **Google OAuth** at launch. Magic link / Apple deferred. |
| **Pulse freshness** | **120–300 second** revalidation SLA initially (shorter than standard feed). |
| **Legal / disclaimers** | **No per-nugget fields.** One **standard disclaimer** for all nuggets; copy lives in **global config / legal strip**, not `articles` rows. |
| **Migration** | **Full greenfield rewrite** — build new, cut over when ready. No incremental patching of v1. |
| **Database** | **Fully committed to PostgreSQL** migration. MongoDB is retired as system of record. |
| **Admin UI — collections** | **First `app/admin` slice has no `community_collections` CRUD** — **Supabase Studio / SQL** only until a later explicit PR. **`BUILD` PR-14** matches. |
| **In-app notifications** | **Launch-required** (bell + §6.6) — **not** acceptable to ship a disabled bell; implement off critical path for **`/`** TTFB. |
| **Search commit rules** | **`q`** commits on **Enter / explicit submit only**; **selecting a nugget suggestion navigates to detail** without writing **`q`** — **PRODUCT §0** / §11. |
| **Search API contract** | **`GET` only** for **`/api/search/suggest`** and **`/api/search`**. **`stream`** query param **required** on both — default **`standard`** when omitted at handler boundary (mirror URL default). Results **always stream-scoped** — **no** global cross-stream search PMF. **Live suggestions** must send the **same `stream`** as Home (**`/?stream=pulse`** → **`stream=pulse`** on both endpoints). |
| **`scheduled_for` publishing** | **Defer column + cron** until post-PMF — no orphan scheduler without **`VERCEL_CRON`** / explicit job (**omit from PR-02** unless mechanism ships same PR). |
| **`approval_*` / `access_tier`** | **Omit from PR-02 DDL PMF** — add with workflow/paywall PRs — **`BLUEPRINT` §12.2** narrative columns marked **deferred** in migrations. |
| **`hero_media_id` fallback** | **Always** set **`hero_media_id`** to the chosen fallback **`article_media`** row when deriving hero from walk — **same rule in ETL (`PR-15`) and admin save** — **no** “leave null but fill **`hero_*`** only” branch. Exception: **no** suitable media → both null. |
| **`article_media` PMF** | **Manual-only** — rows created **only** from explicit gallery uploads / ordered attachments in **admin** and from collapsed legacy Mongo media graphs in **ETL** (**`origin = manual`**). **No** automatic promotion of **`![](url)`** in **`content_markdown`** into **`article_media`** at launch — **detail** renders inline images via **Markdown**; **feeds/cards** use **`hero_*`** and **`article_media`** only. Post-PMF optional batch: **`origin = inline`** sync (**§12.2a**). |
| **Admin identity** | **All `app/admin` gate checks** use **`user.app_metadata.is_admin === true`** exclusively after **`getUser()`** (**`§14`**) — **one pattern** codebase-wide so LLMs cannot mix alternatives. **`app_metadata.roles`** (or similar) **may exist** but is **not read** for authorization PMF (**future/non-PMF** use OK). **`is_admin`** set via Supabase Admin API for staff. |
| **`articles.status` enum (PR-02)** | **`draft` \| `published` only** — **no** `scheduled`, `archived` in PMF DDL. **Unpublish → `status='draft'`** (single source of truth — §2.a; no second boolean). Expand enum only when workflows ship. |
| **`articles.visibility` column** | **Omit from PR-02 DDL** — no column until product defines semantics (**was** “as needed” narrative — **removed** from schema spec for PMF). |
| **Search — Escape** | **`PRODUCT` §0.9** — closes suggestions; restores draft input to last committed **`q`**. |
| **YouTube — detail PMF** | **`PRODUCT` §0.14** — poster + **Watch on YouTube**; embed only behind explicit load — **not** “recommended” wording. |

### 2.a Revision freezes (anti-drift, data-model, perf)

These are **closed decisions** added in this revision. They override any conflicting wording elsewhere in this doc and in companion docs. **Read before PR-02.**

| Topic | Decision |
|-------|----------|
| **`articles.is_published`** | **Removed.** `status text not null default 'draft' check (status in ('draft','published'))` is the **single source of truth**. All partial indexes use `WHERE status = 'published'`. **No second boolean.** §6.6 publish trigger is "row transitions to `status='published'`". |
| **`articles.slug`** | **NOT NULL UNIQUE.** Generated by application/ETL at insert time as `slugify(title) + '-' + substr(replace(id::text, '-', ''), 1, 6)`. Both `id` and `slug` are written in a **single INSERT statement**; the application calls `crypto.randomUUID()` to generate `id` (the column `DEFAULT gen_random_uuid()` is a safety net for direct SQL inserts only). **Shared util at `scripts/shared/slug.ts`** — imported by the Next.js app via path alias `@shared/slug` and by `scripts/migrate/` via relative path. Title rename → regenerate, **301** from old. **No `draft-` prefix.** |
| **`profiles` table (new)** | **Required PMF.** `profiles(id uuid pk references auth.users(id) on delete cascade, display_name text, created_at timestamptz default now(), updated_at timestamptz default now())`. Trigger seeds row on `auth.users` insert. RLS: select/update where `id = auth.uid()`. Holds **all editable user fields** PMF (display_name only). **No** writes to `auth.users.user_metadata` from the client. |
| **`articles.created_by`** | **Add column** `uuid null references auth.users(id) on delete set null`. ETL writes NULL; admin save writes `auth.uid()`. **No UI surface PMF** — kept so future curator pages don't require destructive migration. |
| **`articles.tag_slugs text[]` (denormalized)** | **Required PMF.** `not null default '{}'`, recomputed in admin save **and** ETL on every tag write. **GIN-indexed.** Multi-tag AND queries: `WHERE tag_slugs @> $1::text[]` — **no counting joins at the cursor pager**. Stays in sync with `article_tags`; `article_tags` remains source of truth, `tag_slugs` is derived. |
| **`tags` table — full schema** | `tags(id uuid pk default gen_random_uuid(), slug text unique not null, label text not null, dimension text null check (dimension is null or dimension in ('format','domain','subtopic')), is_official boolean not null default false, created_at timestamptz default now())`. **Home chip rail filter:** `WHERE is_official = true`. User-created/auto-tags can exist (`is_official = false`) but **never** appear on the public chip rail. |
| **Notification fan-out — cap + queue** | **Synchronous fan-out cap = 5,000 matched recipients per publish.** Above cap: enqueue via **Vercel Cron** route (`/api/cron/notifications-fanout`, 60s interval) — publish handler returns `200` with `{ fanout: 'queued' }`. **No bespoke queue/Redis.** `notification_preferences` requires partial index `(stream_standard, stream_pulse) WHERE mute_all = false` for the recipient query. |
| **`notification_preferences` lazy-create** | Row created **lazily on first authenticated request** that needs it (bell open, prefs page) with defaults `mute_all=false, stream_standard=true, stream_pulse=true`. **No** seed-on-signup trigger. |
| **Bell rendering — anonymous** | **No bell** in header for anonymous users (avoids dead chrome and a wasted JS island). Header renders **Sign in** instead. |
| **Notification panel polling** | Refresh on bell-open + **60s interval while panel is open**, **stop polling when closed**. No interval when bell is closed. |
| **Search timings (PMF freeze)** | Suggestion **debounce 180ms**; **min query length 2 chars** before suggest fires; **suggestion cap 8 rows**; suggest endpoint LRU sliding window **30 req / 30s** per anon-IP / `user.sub`. Committed search has **no min length** beyond non-empty after trim. |
| **Markdown body images (detail)** | **`react-markdown` `img` component is overridden:** if `src` starts with `https://res.cloudinary.com` → `next/image` with custom Cloudinary loader, `sizes="(max-width: 768px) 100vw, 720px"`; else → `<img loading="lazy" decoding="async" />` inside `<figure>`. **Every body image is column-bounded** (`max-w-prose`, never escapes). **No** sync into `article_media` PMF (§12.2a unchanged). |
| **Production headers / CSP** | **Required PMF.** Configured in `next.config.ts` `async headers()` — see **§5.6**. Helmet/Express equivalents are gone with Express. |
| **Repo layout (PMF freeze)** | **Repo layout exception:** the Next.js app is at the repo root, not under `web/`. This repo is greenfield-only — no legacy server code coexists here. All doc references to `web/` resolve to the repo root. CI paths, grep gates, and import aliases use repo root paths accordingly.<br><br>**PMF freeze:** single Next.js App Router tree at **`app/`**, **`components/`**, **`lib/`**, **`package.json`** at repository root (`create-next-app`–equivalent layout without a `web/` folder). Monorepo / `apps/web` nesting is **out of scope** for this blueprint unless explicitly revised. |
| **Feed cache scope** | **Only the canonical first page** (`stream` + empty `tags` + empty `q` + null cursor) is server-cacheable via `revalidateTag`. **Filtered URLs are dynamic.** Don't try to ISR `searchParams` permutations. Tags: `feed:standard` and `feed:pulse` — both bust on admin save. Per-article: `article:{id}`. |
| **Priority image loading** | `priority={true}` for the **first card only** (`index === 0`) — **not** the first row's worth (1–3 cards). Single LCP candidate. All other cards lazy. Override `LCP` rule in §9. |
| **Client state libraries** | **None beyond `nuqs` + React local state.** **Forbidden in PMF:** Redux, Zustand, Jotai, Recoil, MobX, Valtio, XState. URL state via `nuqs`; ephemeral UI state via `useState`/`useReducer`; cross-route persistence via Supabase. |
| **Date / formatting libraries** | **None.** Use `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` directly. **Forbidden:** `moment`, `date-fns`, `dayjs`, `luxon` PMF. |
| **Service worker** | **None.** Drop legacy `serviceWorkerRegistration.ts` pattern entirely. **No** offline mode, no PWA install prompt, no push registration PMF. |
| **CSS / styling** | **Tailwind v3 only** (JIT). **Forbidden runtime CSS-in-JS:** `styled-components`, `emotion` (runtime), `stitches`. Inline `style` allowed for dynamic values; everything static is Tailwind. |
| **Bundle budget — CI gate** | PMF launch must include CI check enforcing **§5.4** transfer ceilings on Home and detail (replicate spirit of v1 `scripts/check-bundle-budget.mjs` against Next build output). PR fails if breached without an explicit waiver line in PR description. |
| **`react-hook-form`** | **ALLOWED** in `app/admin/**` only. **Banned** in any non-admin route. Public forms (login, contact) use native `<form>` + Server Action + server-side Zod parse. |
| **`clsx`** | **ALLOWED.** `tailwind-merge` for class merging stays as primary; `clsx` for boolean class composition where merging isn't needed. |
| **`slugify` (npm package)** | **BANNED.** Use `scripts/shared/slug.ts` (hand-rolled, zero deps). |
| **`@vercel/og`** | **DEFERRED PMF** — admin authors `hero_thumb_url`. |

---

## 3. Core architecture

| Layer | Choice |
|--------|--------|
| **Framework** | Next.js (App Router) |
| **Hosting** | Vercel |
| **Database** | Supabase PostgreSQL |
| **Auth** | Supabase Auth (**email/password + Google OAuth**) |
| **Images** | Cloudinary URLs + **`next/image`** **custom loader** (avoid Vercel Image Optimization quota burn at scale) |
| **Validation** | Zod |
| **URL state** | `nuqs` on **`/`**: **`stream`**, **`tags`**, **`q`** — all URL-owned per §6.2 |
| **Fonts** | `next/font` — never a `<link>` tag |

**Not in v2 core:** Express API as user-facing surface, MongoDB as system of record, Redis/BullMQ for feed paths, JWT cookie stack parity with v1, TanStack Query on public feed, bookmark folders, editorial curated bundles, **push notifications** (mobile/web push — deferred). **In-app notifications** (sticky header bell) **are in PMF** — §6.6.

---

## 4. Build sequence (do in this order)

> **Why this order matters:** Each phase produces something shippable. Auth bugs won't block your feed. Collections won't break your core read path.

> **Execution note (greenfield vs this table):** Phases are **logical dependencies**, not a strict calendar. **`docs/NUGGETS_V2_BUILD_EXECUTION.md`** may merge **feed/detail/collections UI** on **hand-seeded or empty Postgres** while **ETL** (**§1b**, **`scripts/migrate/**`) runs **in parallel** toward staging validation — **intentional**. **Production cutover** still gates on **validated ETL + parity checks**, not on “frontend waited for ETL.” Do **not** treat PR ordering conflicts as bugs unless data rules contradict **`docs/NUGGETS_V2_MIGRATION_PLAN.md`**.

| Phase | Scope |
|-------|-------|
| **1 — Schema + indexes** | Postgres tables + all required indexes (Section 13). Dev/staging can run with empty DB — feed works with skeletons → empty state. |
| **1b — ETL pipeline** | Mongo → Postgres migration script. Run on staging with real data; seed production only when ETL passes validation. Feed is not blocked on this. |
| **2 — Feed page** | `/` with stream toggle, tag filters, infinite scroll, skeletons — the core read path |
| **3 — Nugget detail** | `/nuggets/[id]/[slug]` with canonical slug redirect logic |
| **4 — Collections** | `/collections` list + `/collections/[id]` detail — public, anonymous |
| **5 — Auth + bookmarks** | Sign up/in (**password + Google**), flat bookmarks at **`/bookmarks`**, bookmark state hydration on browse grid |
| **6 — Admin** | CRUD **`articles`**, tag assignment, **`content_stream`** only — **no** **`community_collections`** UI in first slice (**Studio/SQL** for collection edits until later PR) (**`BUILD_EXECUTION` PR-14**) |

---

## 5. Next.js safeguards (must ship)

### 5.1 Auth, middleware, and caching

**Risk:** Refreshing sessions everywhere + reading **`cookies()`** in **root layouts** forces **dynamic** rendering and weakens static/ISR behavior for public pages.

**Rules:**

1. **`middleware.ts` matcher** — restrict to routes that need session refresh only. Copy this exactly:

```typescript
// middleware.ts
export const config = {
  matcher: [
    '/admin/:path*',
    '/bookmarks',                // canonical bookmarks page (see §6.5)
    '/account/:path*',           // profile / settings — session refresh
    '/api/bookmarks/:path*',     // bookmark read/write — needs auth cookies
    // NOT: /api/collections/* public reads — no session needed for GET
    // NOT: /collections/* — fully public, anonymous-accessible
  ],
}
```

Everything else (`/`, `/nuggets/[id]/[slug]`, `/collections`, `/collections/[id]`) serves as anonymous HTML. Bookmark state is hydrated client-side post-paint (see Section 17).

> **Validate on staging:** With this narrow matcher, session/refresh cookies are not refreshed on `/`-only visits. This is usually fine (client `createBrowserClient` handles refresh), but verify that sessions don't silently expire during long anonymous sessions before users hit **`/bookmarks`**. Widen the matcher only if you observe expiry issues — not preemptively.

> **Spike before freezing matcher:** Exercise **`/login`**, **`/signup`**, password reset, and **return to `/bookmarks`** — confirm cookies/session behave as Supabase docs prescribe for your Next.js layout split. **Optionally** add **`/login`**, **`/signup`** to **`matcher`** only if staging proves refresh gaps (**don’t** copy matcher blindly without evidence).

2. **`cookies()`** — avoid in the **root layout** for all routes. Session reads only under layouts that require auth.

3. **Public browse-grid bookmark UX** — server renders anonymous HTML for cards; after hydration, a small client fetch loads which **nugget IDs** are bookmarked for the visible set. Progressive personalization without making the whole page dynamic.

---

### 5.2 RSC payload — do not pass fat `initialArticles` to Client Components

**Risk:** Passing **24+** full article rows (including markdown bodies) into a `'use client'` pager serializes into flight payload → HTML + duplicate JSON (**§5.4** caps **24** lean rows).

**Rules:**

1. **First page:** Render `ArticleCard` grid from the server with **card-only fields** (title, excerpt, image URL, id, tag labels). **No `content_markdown` on list payloads.**
2. **Client pager:** Receives **only** `initialCursor: { published_at, id }` — not the full initial array.
3. **Pagination:** `fetch('/api/feed?cursor=…')` returns the next slice; append in client state.

```
app/page.tsx (Server)
  → fetch first page (lean select — no content_markdown)
  → render <ArticleGridServer /> (Server) — first page as HTML
  → render <FeedPaginationClient initialCursor={...} /> ('use client') — cursor only

FORBIDDEN: <FeedClient initialArticles={hugeArray} /> when hugeArray duplicates server-rendered bodies.
```

---

### 5.3 `next/image` + Cloudinary — allowlist hosts

**Rule:** In `next.config.ts`, set `images.remotePatterns` for `https://res.cloudinary.com` (and any other image hosts). Keep this even with `loader: 'custom'`.

```typescript
// next.config.ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'res.cloudinary.com',
    },
  ],
}
```

---

### 5.4 Performance budgets (PMF — freeze for CI / LLMs)

**Goal:** predictable payloads — Codex must **not** invent page sizes.

| Metric | Target | Notes |
|--------|--------|--------|
| **Home `/` first meaningful paint payload** | Transfer **≤ ~256 KiB** (gzip-aware; measure in Lighthouse / Network) for HTML + **lean** first-page grid — **no** `content_markdown` in card props | Tune against **24** cards max below |
| **Nugget detail initial route** | Transfer **≤ ~192 KiB** guardrail for shell + hero + metadata — **body** in one server render; **no** duplicated full article JSON to client islands | Full markdown stays server/streamed — **forbid** fat duplicated props |
| **LCP (mobile p75, staging)** | **≤ 2.5 s** on seeded content | Already **`BUILD` PR-06** aspirational — **enforce** before launch freeze |
| **CLS** | **≤ 0.1** Home + Nugget page | Fixed **16:9** card frames (**§9**) |
| **First-page feed batch size** | **24** nuggets max per request (cursor page size) | Matches **3 × 8** dense desktop rows at common breakpoints — **do not** ship 30+ without perf review |
| **Home `/` route JS budget** | Client JS for the route ≤ **~85 KiB gzip** (initial chunk + first-load route chunk) | Tailwind + Next runtime + `nuqs` + thin pager + bookmark island. **No** TanStack Query, no client state lib, no virtualization PMF. |
| **Nugget detail route JS budget** | Client JS ≤ **~60 KiB gzip** | Body markdown is server-rendered — client only does bookmark, share, theme. |

**Pagination:** All subsequent pages use same **24** (or smaller last page). **API** defaults **`limit=24`** unless overridden internally.

**HTTP cache headers (Route Handlers — `/api/feed`, public reads):**
- **Canonical** (no `q`, no `tags`, default `stream`): `Cache-Control: public, s-maxage=120, stale-while-revalidate=600` for pulse; `s-maxage=600, stale-while-revalidate=1800` for standard. Vercel CDN handles.
- **Filtered** (`q` set or any `tags`): `Cache-Control: private, no-store` — these are user-driven and rarely shared in identical form.
- **Authenticated** (bookmark check, etc.): always `private, no-store`.

### 5.5 API rate limiting & abuse posture (PMF — DECIDED)

**Goals:** predictable behavior for LLMs; **no custom Redis/BullMQ-backed rate limiter inside the Next app** for PMF (avoids reintroducing the legacy dependency graph). **Platform limits** (**Vercel**, **Supabase**, CDN/edge) may still apply — that is **orthogonal** and **not** “no throttling anywhere.”

| Surface | Decision |
|---------|----------|
| **Public read APIs** (`/api/feed`, **`GET`** search) | **No custom Redis** rate limiter in app code. Rely on **indexes** + healthy query shapes; optional **later** tighten with edge rules if abused. |
| **`GET /api/search/suggest`** | **Optional:** in-process **sliding-window** guard (e.g. **`lru-cache`** or **`Map`** keyed by **anon IP** or **authenticated `user.sub`**) — **cheap**, Route Handler-local — **or** omit at PMF if traffic stays low (**document choice in PR-06 PR notes**). **Do not** add **`rate-limit-redis`**. |
| **`/admin/**`** | **Authorization** (**`§14`**) is the gate — **not** a second bespoke Redis throttle PMF. **Brute-force** mitigation stays **Supabase Auth** dashboard + infra defaults. |

**Anonymous identifier for `/api/search/suggest` LRU rate limit (frozen):**

```
request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
```

Authenticated identifier: `user.id` (uuid). Empty/spoofed IPs all share the `'anon'` bucket — acceptable PMF; revisit if abuse appears.

### 5.7 Interactivity & responsiveness contract (PMF — required)

**Why this section exists:** v1's defining failure was **interaction lag** — clicking *View full article*, switching nav tabs, or toggling a filter would stall or hang the page. Root causes: TanStack on the feed firing refetches on filter changes, `FilterStateContext` re-rendering the entire grid, fat per-card click handlers, `useEffect` chains, modal-stack mount cost, no transition isolation. v2 removes these causes architecturally — but the **targets below must be enforced** so they don't creep back in.

**Targets (CI / staging gates — frozen):**

| Metric | Target | Notes |
|--------|--------|-------|
| **INP** (Interaction to Next Paint) | **≤ 200ms p75** on mobile staging | Measured via Web Vitals / `@vercel/analytics` |
| **Click-to-route-change** (card → detail, nav tab switch) | **≤ 100ms** to first paint of skeleton on the new route | Achieved via `<Link>` prefetch + `useTransition` — see rules below |
| **Filter / stream toggle response** | **Skeleton within 50ms** of click; data may arrive later | URL writes synchronously, fetch starts after |
| **Bookmark toggle** | **Visual flip ≤ 16ms** (one frame) — server confirms async | Optimistic UI with rollback |

**Mandatory implementation rules (LLM guardrail):**

1. **Use `next/link` everywhere for in-app navigation.** No `<a href="/nuggets/...">` for internal routes. `<Link>` prefetches in viewport by default — this is what makes route swaps feel instant. Never set `prefetch={false}` unless the link goes to a route the user is unlikely to follow (e.g. footer legal pages).

2. **Wrap non-urgent state updates in `startTransition`** (React 19). Filter chip click → URL write urgent, grid replacement non-urgent:
   ```
   const [isPending, startTransition] = useTransition()
   onClick={() => {
     startTransition(() => {
       setTags(next)        // nuqs URL write
     })
   }}
   ```
   Show pending state via `isPending` (skeleton overlay) without freezing the rest of the UI.

3. **No `useEffect` chains for derived state.** If state B is computed from state A, it's `useMemo`, not a second `useEffect`. Chained effects are the #1 cause of visible lag in v1.

4. **No work in render that depends on `window`/`document` synchronously.** Use `useSyncExternalStore` for browser-state subscriptions, never `useState` + `useEffect` ping-pong.

5. **Bookmark toggle = optimistic.** Flip the icon state immediately on click; fire the Server Action / Route Handler in the background; revert + toast on error. **Never** await the network before flipping.

6. **No barrel imports for component trees.** `import { Card } from '@/components'` that re-exports 50 files forces all 50 into the chunk graph. Import directly from the file (`@/components/article/ArticleCard`).

7. **Forbidden in event handlers:** `JSON.stringify(largeObj)`, sync regex over body text, sync analytics (`telemetry.track` must be fire-and-forget), DOM measurements (use `ResizeObserver`), array sorts > 100 items.

8. **Suspense boundary scope:** every route has a top-level `<Suspense>` with skeleton fallback. **Within** the route, smaller suspense boundaries isolate slow data (bookmark presence, notification badge) so they don't block first paint.

9. **No global click listeners** for closing menus / popovers. Use `<Popover>`-style native focus management; if absolutely needed, scope to the popover root element.

10. **No imperative scroll restoration / sessionStorage offset hacks** (§6.0). Accept App Router default — landing near top of feed after Back is acceptable PMF.

**Anti-pattern allow list (things v1 did that v2 must not):**

- ❌ Modal stack (`ArticleModal` + `ArticleDrawer` + `ImageLightbox` + `LinkPreviewModal` mounted simultaneously) — replaced by full-page detail (§6.0).
- ❌ Filter context spanning entire tree → URL via `nuqs` instead.
- ❌ `useInfiniteArticles` TanStack pattern — replaced by `fetch` + `useTransition` pager.
- ❌ Per-card popovers, hover-loaded previews, hover-loaded link unfurls.
- ❌ Synchronous Sentry capture in event handlers — Sentry init is lazy, capture is async.

**Validation (PR-06 / PR-08 gates):**

- Lighthouse mobile **TBT ≤ 200ms** on cold `/`.
- Manually verify: tap card → detail skeleton appears in **<150ms** on a mid-range Android over 4G simulation.
- Manually verify: filter chip click → grid skeleton appears within **one frame**, fetch returns later.
- Bookmark toggle never blocks UI even with throttled 3G in DevTools.

---

### 5.6 Production headers / CSP (PMF — required)

**Helmet/Express are gone.** Headers configured in `next.config.ts` via `async headers()`. Apply to `'/(.*)'` unless noted. Validate on staging before launch.

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' data: https://res.cloudinary.com https://i.ytimg.com;
  media-src 'self' https://res.cloudinary.com;
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://vitals.vercel-insights.com;
  frame-src https://www.youtube.com https://www.youtube-nocookie.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Notes:**
- `'unsafe-inline'` on `script-src` is acceptable PMF for Next inline runtime; tighten with nonces post-PMF if needed — **do not** block launch on nonce wiring.
- If §0.14 YouTube embed lands behind explicit load, prefer `youtube-nocookie.com` in `frame-src`.
- `frame-ancestors 'none'` blocks anyone embedding Nuggets — intentional.
- **Auth callback routes** (`/auth/callback/*`) may need `form-action` extended to Supabase domains — handle in PR-12.

---

## 6. Routing model

### 6.0 Canonical interaction: feed card → article (single source of truth)

**Do not mix this section with legacy “outbound-first” drafts.** Some earlier blueprint sketches suggested **primary card action = open external source in `target="_blank"`** so the feed tab never navigates away and scroll position is trivially preserved. **That interaction model is deprecated for Nuggets v2.**

| Topic | **v2 canonical behavior** |
|-------|---------------------------|
| **Primary tap/click on card** (media, title, excerpt body) | **Navigate** to **`/nuggets/[id]/[slug]`** — full nugget detail route (see §6.3). |
| **Opening the source site** | **Secondary** control only — e.g. footer link **“View source”** / domain with **`target="_blank"`** **`rel="noopener noreferrer"`**. Never the only path to reading a nugget. |
| **Feed scroll after return** | User uses **browser Back** from detail → feed. **Next.js App Router does not reliably restore feed scroll position on Back** the way a classic client-only SPA sometimes does — **landing near top of feed after Back is accepted PMF behavior.** Optional later: `scrollRestoration` / sessionStorage offset / virtualization-aware hooks — **do not** block launch on custom restoration. |

**Aligned with:** `docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md` §6 (card interaction model).

**LLM guardrail:** Implementations must **not** ship cards whose **default** click opens only an external URL.

---

### 6.1 Feed (Market Pulse + Standard)

**Shared shell + URL state**, not separate top-level routes.

- `/` with `stream=standard` (default) vs `stream=pulse` (via `nuqs`)
- Optional later: `/market-pulse` as marketing alias → redirect to `/?stream=pulse`

### 6.2 Filters and search (canonical query contract — single URL model)

**Browse surface:** Call it **Home / Discover / Browse** in product copy — avoid “feed” as the primary user-facing word (**PRODUCT**).

**Streams:** **`stream=standard`** (Nuggets) and **`stream=pulse`** (Market Pulse) load **disjoint** article rows — implementation must never surface the same **`articles.id`** in both streams.

| Mechanism | Values | Notes |
|-----------|--------|-------|
| **`stream`** (URL, `nuqs`) | `standard` \| `pulse` | Default: **`standard`** (omit or explicit). |
| **`tags`** (URL, `nuqs`) | comma-separated slugs | e.g. `tags=crypto,macro` |
| **`q`** (URL, `nuqs`) | string | **Committed search query** — **URL-owned** alongside **`stream`** + **`tags`**. Example: **`/?stream=pulse&q=taiwan&tags=macro`**. **Committed `q` updates only on Enter or explicit Search submit** — **not** when picking a nugget from suggestions (**PRODUCT §0 / §11**). |

**Multi-tag semantics (DECIDED, founder-confirmed):** **`AND`** — a nugget must match **all** selected tag slugs (narrowing). Implement as counting joins / overlap per query layer — **not** OR-by-default.

**Single source of truth:** **`stream`** + **`tags`** + **`q`** via **`nuqs`** on **`/`**. **Do not** duplicate committed discovery state in React context except ephemeral draft UI (e.g. typing before submit).

### 6.2a Search quality (PMF — articles / nuggets only)

**Scope:** **Articles/nuggets only** — **exclude** community collections from search results.

**Ranking:** **Relevance-first** for both streams — **do not** weight recency strongly for Pulse vs Standard differently at PMF; **`published_at`** may be a weak tie-breaker only.

**Behavior:** **Live suggestions** while typing (debounced); **committed `q`** + full result grid **only** on **Enter / explicit Search** — selecting a suggestion **navigates to Nugget page** without committing **`q`** (**PRODUCT §0 / §11**).

**Implementation guardrails:**

- **`search_vector`** (`tsvector`): index **`title`**, **`excerpt`**, body snippet fields as agreed in migration; **weighted** `ts_rank_cd` / **`setweight`** (title > excerpt > body).
- **Phrase and typo tolerance:** optional **`pg_trgm`** / **`similarity`** on **`title`** as fast-follow if FTS alone feels brittle — **plan indexes** so adding trigram doesn’t require a rewrite.
- **API:** **`GET`** **`/api/search/suggest?q=&stream=`** + **`GET`** **`/api/search?q=&stream=&cursor=`** — **`stream` required** (default **`standard`** at handler if missing); **no** `POST` bodies PMF — **no** fat payloads; pagination cursor-compatible.
- **Timings (frozen — §2.a):** suggestion **debounce 180ms**, **min query length 2 chars**, **suggestion result cap 8**, suggest endpoint LRU sliding window **30 req / 30s** per anon-IP / `user.sub`. Committed search has no min length beyond non-empty after trim.

**Collections:** browse **`/collections`** separately — **not** mixed into search.

### 6.2b Nugget shape (single type)

**PMF:** **One card/detail schema** — **every** published nugget has a **non-empty `title`** (and excerpt/body rules per admin validation). **Eliminate** legacy “media-only without title” — migrate or discard legacy rows that cannot satisfy **`title`** with editorial rules in migration plan.

### 6.3 Nugget detail — hybrid ID + slug (public URL uses “nugget”; DB table remains `articles`)

**Pattern:** `/nuggets/[id]/[slug]`

**Behavior:**
- Lookup always by `id` (UUID, stable)
- If slug segment missing or wrong but id valid → **301** to canonical slug for current title
- Title edits → update `slug` → old URLs still resolve by id, then redirect to new slug

**Implementation note:** Store `slug` on **`articles`**; regenerate from title on publish/rename; never change `id`. **Greenfield:** no legacy URL redirects required beyond canonical slug correction for the **same** nugget.

**Required chrome at launch (PMF — no improvisation):** Single-column **magazine** layout — **title**, **hero**, **body** (`prose` markdown), **`source_url`** surfaced as **Source** (outbound **`target="_blank"`**), **publish date**, **tags**, **bookmark + share**, **author/curator** placeholder per **`PRODUCT` §0.10** (**branded mark** — **not** user initials). **Exclude:** reading time, related-nugget rails, sidebar metadata columns — **PRODUCT §0 / §7**.

### 6.3a YouTube playback & timestamps (frozen — fills PRODUCT §0.14 gap)

**Scope:** When a nugget's `hero_media_kind = 'youtube'` (i.e. `article_media.kind = 'youtube'` is the cover), the detail page renders YouTube content. Body markdown may also contain timestamp links that should seek the same player.

#### Rendering states (single state machine — no LLM improvisation)

| State | Trigger | UI |
|-------|---------|-----|
| **Poster** (default first paint) | Page load | Static `hero_thumb_url` image + ▶ overlay + **Watch on YouTube** outbound link (`target="_blank" rel="noopener noreferrer"`) below |
| **Embed loaded** | User clicks the **Load video** affordance under the poster (or any timestamp link in the body — see below) | `<iframe>` mounts (`youtube-nocookie.com/embed/{video_id}?enablejsapi=1`), poster replaced |
| **Outbound** (fallback) | User clicks **Watch on YouTube** | Opens `youtube.com/watch?v={video_id}` in new tab. Embed not loaded. |

**Never autoplay.** **Never** mount the iframe on first paint. **Never** show the embed on Home cards (§0.14).

#### Body timestamp link syntax (frozen)

Authors write timestamp links in markdown using a **fragment URL convention** so the body stays portable:

```
Listen to [the macro context at 2:34](#yt=154) before reading further.
```

- Format: `#yt={seconds}` — integer seconds. `2:34` → `154`. `1:05:22` → `3922`.
- The link's visible text is human-readable (`2:34`, `1h 5m`).
- **One YouTube target per nugget** PMF — the nugget's hero video. Nuggets with multiple videos are post-PMF (would need `#yt=videoId:seconds`).

#### Click behavior on a `#yt={seconds}` link

Single client island on the detail page (`<YouTubePlayer />`) owns this state machine:

```
onClick(seconds):
  if (state === 'poster' || state === 'outbound')
    state = 'embed'
    iframeSrc = `${embedUrl}?enablejsapi=1&start=${seconds}`
    scroll embed into view
  else if (state === 'embed')
    iframe.contentWindow.postMessage({ event: 'command', func: 'seekTo', args: [seconds, true] })
    iframe.contentWindow.postMessage({ event: 'command', func: 'playVideo', args: [] })
    scroll embed into view
```

**`react-markdown` link override:** `a[href^="#yt="]` renders a `<button>` (not `<a>`) wired to the player island. Button styling looks like a link — no separate component for users.

**Accessibility:** button has `aria-label="Play from 2:34"`; `prefers-reduced-motion` skips smooth-scroll into view, jumps directly.

#### Player implementation rules

- **Library:** none. Use the native YouTube IFrame API via `postMessage` (no `react-youtube` / `react-player` wrapper — both are >30 KiB and pull duplicate React).
- **Domain:** `youtube-nocookie.com` (privacy-respecting; CSP `frame-src` already includes it — §5.6).
- **Sandbox:** `<iframe sandbox="allow-scripts allow-same-origin allow-presentation">` (no `allow-forms`).
- **Aspect ratio:** `aspect-video` (16:9) container, fixed before mount → no CLS when iframe replaces poster.
- **Cleanup:** on route leave, `<YouTubePlayer />` unmounts and tears down the postMessage listener.
- **Forbidden:** `<video>` with YouTube CDN URLs (illegal); pulling `youtube.com` (with cookies) instead of `nocookie`; mounting the iframe in a portal outside the page flow.

#### Telemetry (optional, lightweight)

`youtube_play` `{ video_id, seconds, source: 'poster'|'timestamp' }` — fire-and-forget. **No** play-progress tracking PMF.

#### Out of PMF

- Multiple videos per nugget.
- Spotify / Apple Podcast inline players (link-only — §8 PRODUCT).
- Custom video player UI on top of the iframe.
- Picture-in-picture / persistent player across nav (v1 had `PersistentVideoPlayer` — explicitly **not** ported).

---

### 6.4 Collections

- `/collections` — public list of all community collections (anonymous access)
- `/collections/[id]` — collection detail: title + description + curator name + article cards

**No `/collections/[id]/[slug]`** for PMF — ID-first is sufficient.  
**No save/follow actions** on collection pages.  
**Followers:** out of scope — no columns or APIs.

### 6.5 Bookmarks list (flat)

- **`/bookmarks`** — canonical authenticated page for saved nuggets (UI label **Bookmarks**).

### 6.6 In-app notifications (bell — PMF) vs push (deferred)

**Product:** Sticky header **bell** opens an in-app **Notifications** panel/list — **not** browser push at launch.

**Naming:** Use **Notifications** in UI. Reserve **“push”** for a future **device/browser subscription** channel; schema/API may use `notification_delivery_channel` later (`in_app` \| `push` \| …).

**When to create rows:** Only when a nugget **transitions to `status='published'`** (single source of truth — §2.a). **Do not** notify on: draft saves, draft edits, unpublish, deletes, collection-only maintenance, or edits to already-published content (unless product later adds an explicit "material update" rule).

**Batching:** Within a **30-minute** window, batch **new publishes** in the **same `content_stream`** into **one grouped** notification when multiple nuggets qualify.

**Batching mechanics (DECIDED — PMF, hybrid sync + capped queue):** Implemented **synchronously** in the admin **publish** Route Handler (after **`status`** flips to **`published`**, same request) **up to a fan-out cap of 5,000 matched recipients** (**§2.a**). Beyond the cap, the publish handler returns `200 { fanout: 'queued' }` and a **Vercel Cron** route (`/api/cron/notifications-fanout`, 60s interval) drains the remainder using a `pending_fanout` lightweight table or a NOTIFY signal — **whichever the LLM picks must use the same `INSERT … ON CONFLICT` upsert**, no Redis/BullMQ.

**`batch_key`** format (**frozen — §12.6**): **`{content_stream}:{YYYY-MM-DD HH:00}`** in **UTC** (hour bucket — e.g. **`standard:2026-04-28 14:00`**). **Concurrency:** Do **not** rely on naive **`SELECT` … then `INSERT`** — concurrent publishes can race and **double-insert**. Use **atomic `INSERT … ON CONFLICT … DO UPDATE`** against the **`(user_id, batch_key)`** partial unique index (**§12.6** / **§13**) to upsert **`batch_summary` / grouped** digest rows. **Single-article** **`kind`** notifications use **`batch_key = NULL`** and are plain **`INSERT`** (no conflict with partial index).

**Recipient query (PMF — handles users without a `notification_preferences` row):**

```sql
SELECT u.id AS user_id
FROM auth.users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
WHERE COALESCE(np.mute_all, false) = false
  AND COALESCE(np.stream_standard, true) = true   -- when content_stream='standard'
  -- OR: AND COALESCE(np.stream_pulse, true) = true  -- when content_stream='pulse'
```

Lazy-create remains as specified. **No seed-on-signup trigger.** Defaults are baked into the query via `COALESCE`, so users who have never opened the bell still receive notifications. **Publish handler must complete in ≤ 1.5s** including in-cap fan-out; above-cap work is best-effort under the 60s cron tick.

**`notification_preferences` lazy-create (§2.a):** Row created on first authenticated request that needs it (bell open, prefs page) with defaults `mute_all=false, stream_standard=true, stream_pulse=true`. **No** seed-on-signup trigger.

**Caps:** **3–5** visible “new content” notifications per user per day; overflow collapses into **one summary** row.

**Preferences:** Toggles — **Nuggets** (`standard`), **Market Pulse** (`pulse`), **Important only** (optional rules TBD), **Mute all**.

**Audience (freeze):** Notify **authenticated users who have notifications enabled** (respect **Mute all** and per-stream toggles). **Do not** notify anonymous sessions. **Do not** email/push at launch. **Anonymous users do not see a bell** in the header (§2.a) — header renders **Sign in** instead.

**RLS:** Users read/update **only** their own notification rows and preferences.

**Launch classification (DECIDED):** **Launch-required** — ship bell + panel + preferences + batching/caps per above for go-live (**no** disabled bell / “coming soon” stub). **Performance isolation:** notifications fetch/UI **must not** block **`/`** first-byte path — lazy-load bell panel, separate Route Handlers.

### 6.6b Panel UX & mechanics (DECIDED — prevents UI drift)

| Topic | Decision |
|-------|-----------|
| **Surface — desktop** | Bell opens an **anchored panel / popover** (not a full route) — **~380–420px** wide, **right-aligned** under/header-adjacent to bell — keeps browsing context. |
| **Surface — mobile** | **Bottom sheet** or **full-screen sheet** — **no** tiny popover / cramped dropdown on touch screens. |
| **Dedicated `/notifications` route** | **Deferred PMF** — inbox lives **only** in the panel (**lazy-fetch on bell open**). Optional **`View all`** can scroll/paginate **inside** the sheet; add a route **later only if** product insists. |
| **Unread → read** | Mark **read when user activates that notification row** (click/focus-enter). **Do not** auto-clear unread on **panel open** (avoids accidental clears). **`Mark all as read`** is supported as explicit bulk action. |
| **Bell badge** | **Numeric unread** count on bell icon — **cap display at `9+`** (still accurate server-side). |
| **Row click — single article** | **Same-tab** navigation to **`/nuggets/[id]/[slug]`** — no forced new tab; **no** expand-in-place preview PMF. Mark **that** row **read** on activate (**§6.6**). |
| **Row click — batch / summary** | Copy **"N new …"** per **`§6.6`** caps; **no** single article title. **Same-tab** navigate to **`/?stream=standard`** or **`/?stream=pulse`** matching the notification **`content_stream`** (filtered unread window is optional polish — landing on correct stream is required). Mark **all** notifications grouped under that summary **`batch_key`** **read** on click. |
| **Initial fetch** | **10–15** rows max on first open — sorted **newest first** — then **infinite scroll** inside panel **or** **Load more** control (pick one pattern team-wide). |
| **Realtime** | **No** WebSocket / Supabase realtime subscriptions **for bell counts/list PMF**. Refresh on **bell-open** + **60s interval while the panel is open** (frozen — §2.a). **No** polling when panel is closed and **no** background polling on the bell badge. |
| **Push-adjacent UI** | **None at launch** — **no** “push disconnected”, browser-permission banners, or device-status strips (**push deferred** — avoids conceptual clutter). |

> **Interaction with §6.6 caps:** Daily grouping/collapse limits (**§6.6**) govern **what rows exist** and summaries; **§6.6b** governs **how the panel loads and behaves**. Both apply — **no** contradiction.

---

## 7. Pagination model

**PMF default:** Infinite scroll via `IntersectionObserver` + `fetch` + React state — **no TanStack Query** on public feed.

**Cursor:** opaque `{ published_at, id }` (never `published_at` alone — tie-breaker prevents duplicates at timestamp collisions).

### Infinite scroll implementation rules (LLM guardrail)

```
- IntersectionObserver sentinel: place it 400px ABOVE the bottom of the list
  (not at the very bottom — gives fetch time to return before user hits end)

- Fetch guard: use a isFetchingRef = useRef(false) boolean to prevent
  double-fires when observer triggers multiple times in rapid succession

- State append: [...prevCards, ...newCards] — NEVER replace the array

- On filter/stream/tag change: reset cursor to null, clear cards array, fetch page 1

- Error state: show inline "Couldn't load more — Retry" button inside the browse list
  (not a toast, not a modal, not a full page error)

- End state: explicit "You're all caught up" marker when API returns empty next page

- Loading state: append skeleton cards below fold before fetch returns
  (see Section 8 — skeleton spec)
```

**Upgrade path:** TanStack Query after PMF if optimistic caches or offline requirements appear.

---

## 8. Loading UX contract (skeleton-first)

> This is the single biggest determinant of whether the app *feels* fast. Implement skeletons before polishing any other UI.

### Rules

- **Never show a blank white screen** during any loading state
- **Never use a centered spinner** as the only loading indicator on feed or article pages
- **Never wait for fetch to complete** before showing a transition — clear old content instantly, show skeletons immediately

### Skeleton spec per surface

| Surface | Skeleton |
|---------|---------|
| **Feed initial load** | Grid of 6–8 ArticleCard skeletons (same dimensions as real cards) |
| **Infinite scroll — next page loading** | 3–4 skeleton cards appended below last real card, before fetch returns |
| **Filter / stream / tag change** | Skeleton grid replaces feed grid **instantly on interaction** — do not wait for fetch |
| **Article detail** | Skeleton for: hero image block + title block + body paragraph lines |
| **Collections list** | Grid of collection card skeletons |
| **Collection detail** | Skeleton for: title/description header + article card grid |
| **Route transition (page → page)** | `<Suspense>` boundary with skeleton fallback — never a spinner for page-to-page nav |

### Implementation note

Use `<Suspense fallback={<FeedSkeleton />}>` at route boundaries in Next.js App Router. Skeleton components are pure CSS — no JS, no state, no data fetching. They should render in < 1ms.

---

## 9. Image contract for cards

> CLS (Cumulative Layout Shift) from images is the #1 cause of "feels janky" on feed apps. Fix it with fixed aspect ratio containers.

**Rules:**

```
- All ArticleCard images: fixed aspect ratio container (e.g. aspect-video = 16:9) with CSS
  NEVER let images reflow the layout. This causes CLS.

- Use next/image with sizes prop appropriate to column count
  e.g. sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"

- Quality: cards → quality={75}, article hero → quality={85}

- Priority loading: `priority={true}` for the **first card only** (`index === 0`) — single LCP candidate
  — All other cards lazy (next/image default)
  — **Do not** mark the first row's worth (1–3) eager — the LCP element is one image, not a row

- Null image: if **`hero_thumb_url`** is null, render a **deterministic gradient placeholder seeded from `articles.id`** (UUID hashed to a hue).
  Never depends on tags (tags have no inherent order). Never renders a broken <img>.

- Skeleton: image container shows skeleton bg-color until image loads
  Use CSS background + onLoad handler to transition from skeleton to image
```

### 9.1 Detail body — markdown image contract (PMF freeze)

Inline `![alt](url)` images in `articles.content_markdown` render in the detail page `prose` body. **`react-markdown` `img` component is overridden** (§2.a):

```
function MarkdownImage({ src, alt }) {
  if (!src) return null
  if (src.startsWith('https://res.cloudinary.com')) {
    return (
      <figure className="my-4">
        <Image
          src={src}
          alt={alt ?? ''}
          width={720}
          height={0}              // intrinsic height; CLS prevented via aspect-ratio CSS on figure
          sizes="(max-width: 768px) 100vw, 720px"
          className="h-auto w-full rounded-lg"
        />
        {alt ? <figcaption className="text-sm text-muted">{alt}</figcaption> : null}
      </figure>
    )
  }
  return (
    <figure className="my-4">
      <img src={src} alt={alt ?? ''} loading="lazy" decoding="async" className="h-auto w-full rounded-lg" />
      {alt ? <figcaption className="text-sm text-muted">{alt}</figcaption> : null}
    </figure>
  )
}
```

**Rules (LLM guardrail):**
- Every body image must be **column-bounded** (`max-w-prose` ancestor on the article body) — never escapes column.
- **No** sync from inline `![](url)` into `article_media` PMF (§12.2a unchanged).
- **No** `next/image` for non-Cloudinary hosts (custom loader is Cloudinary-specific) — fall back to `<img loading="lazy">`.
- **Sanitize** markdown: disallow raw HTML in `react-markdown` (default is safe, do not opt into `rehype-raw`).
- **Reading width** stays narrow: body container `max-w-prose` (~65ch) — images render at column width.
- **Plugin allowlist (frozen):** detail-page `react-markdown` plugins are **exactly**: `remark-gfm` + the `MarkdownImage` `img` component override. **No other rehype/remark plugins PMF** — never `rehype-raw`, `rehype-highlight`, `rehype-slug`, etc. Any addition requires a doc edit.

---

## 10. Font loading rules

```
- Use next/font (Google Fonts or local) — NEVER a <link> tag in layout.tsx
- Preload: preload = true for body font
- font-display: swap for all font variants
- Tailwind: JIT mode (default in v3+) — ensure no purge misconfigs in production build
```

---

## 11. Caching model (realistic)

**Do not assume** edge HTML for every arbitrary `searchParams` combination.

| Surface | Guidance |
|---------|-----------|
| **Default feed** (`stream=standard`, no filters) | `revalidate` in the minutes range where route allows ISR — validate against Next version for `searchParams` usage |
| **Filtered / search URLs** | Expect **dynamic** behavior; optimize DB + indexes instead of fighting the cache |
| **Pulse** (`stream=pulse`) | `revalidate` **120–300s** (founder SLA). Tune within band by editorial tolerance. |
| **Standard feed** | `revalidate` **600–900s** or higher — exact numbers set at implementation |
| **Article detail** | Per-article `revalidate` + `revalidateTag('article:' + id)` on publish/update |
| **Collections list** | `revalidate` in minutes range — collections change infrequently |
| **Collection detail** | `revalidate` moderate + `revalidateTag('collection:' + id)` on edit |

**Invalidation:** Prefer tag-level `revalidateTag` for surgical updates; `revalidatePath` when coarse bust is acceptable.

**Cache scope (frozen — §2.a):** **Only the canonical first page** of each stream is server-cacheable — `stream` set, **empty `tags`**, **empty `q`**, null cursor. Tags: `feed:standard`, `feed:pulse`. Filtered URLs (any `tags` or `q`) are **dynamic** — don't try to ISR `searchParams` permutations. Article detail uses `article:{id}`. Admin save **must** call `revalidateTag('feed:standard')` and `revalidateTag('feed:pulse')` (cheap when neither is currently cached) plus `revalidateTag('article:{id}')`.

**Implementation:** Cache lives in `getFeedPage()` via `fetch` + `next: { tags: ['feed:standard'] }` (or 'feed:pulse'), **not** via `export const revalidate` on `app/page.tsx` (route is dynamic).

---

## 12. Data model

### 12.1 Taxonomy

**Tag-first.** No parallel category system for PMF.

**`tags` schema (frozen — §2.a):**
```
tags(
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  label        text not null,
  dimension    text null check (dimension is null or dimension in ('format','domain','subtopic')),
  is_official  boolean not null default false,
  legacy_mongo_id text unique null,
  created_at   timestamptz not null default now()
)
```

**`article_tags` schema:**
```
article_tags(
  article_id  uuid not null references articles(id) on delete cascade,
  tag_id      uuid not null references tags(id) on delete cascade,
  primary key (article_id, tag_id)
)
```

**Indexes** on `tag_id`, `article_id`, slug lookups — see §13.

**Public chip rail filter:** `WHERE is_official = true` — non-official tags can exist (curator-created, ETL-only) but never appear on the Home chip rail. Admin-controlled.

### 12.2 Articles (core fields)

**Authoring model:** **Markdown-first** body (`content_markdown`) — **no** heavy block editor PMF. **Single `source_url`** (attribution — **not** the same as gallery media). **Cards/feeds** use **`hero_*`** + **`article_media`** (**manual-only PMF** — **`§2`**, **`§12.2a`**); **inline images in the body** render on **detail** via Markdown and **do not** populate **`article_media`** at launch.

| Field | Notes |
|-------|-------|
| `id` | `uuid primary key default gen_random_uuid()` — stable, never changes |
| `slug` | `text not null unique` — **generated at insert** as `slugify(title) + '-' + substr(replace(id::text,'-',''),1,6)` (§2.a). Regenerated on title change with **301** from old. **No `draft-` placeholder.** |
| `title` | `text not null` (max 300 chars at app layer) |
| `source_url` | `text null` — **single** canonical attribution URL (report, article, YouTube page, podcast page, etc.) |
| `excerpt` | `text null` — cards + OG; never full `content_markdown` on list payloads |
| `content_markdown` | `text not null default ''` — detail + admin editor; inline **`![](url)`** allowed — **renders on detail only via override (§9.1)**; **not** synced into **`article_media`** PMF (§12.2a) |
| **`hero_media_id`** | `uuid null references article_media(id) on delete set null on update cascade` — which attachment drives feed/card hero. Editorial override: reordering `sort_order` does not move hero unless `hero_media_id` points there (or you clear it for fallback). |
| **Hero (denormalized — recomputed on save/publish)** | `hero_media_kind text null`, `hero_media_url text null`, `hero_video_id text null`, `hero_thumb_url text null` — copied from the row `hero_media_id` references (when set); fallback when null per §12.2a. **Feeds read these columns only.** |
| `tag_slugs` | `text[] not null default '{}'` (§2.a) — **denormalized** array of `tags.slug` values for this article, recomputed on every tag write in admin and ETL. **GIN-indexed.** Multi-tag AND queries: `tag_slugs @> $1::text[]`. `article_tags` remains source of truth; `tag_slugs` is derived. |
| `created_by` | `uuid null references auth.users(id) on delete set null` (§2.a) — admin save writes `auth.uid()`; ETL writes NULL. **No UI surface PMF.** |
| `published_at` | `timestamptz null` — cursor pagination field. **Set once on first transition to `published`** and **never recomputed** (§15.1). |
| `created_at`, `updated_at` | `timestamptz not null default now()` |
| `content_stream` | `text not null check (content_stream in ('standard','pulse'))` — **exactly one per article**; feeds do not overlap |
| `status` | `text not null default 'draft' check (status in ('draft','published'))` — **single source of truth for visibility** (§2.a). Partial indexes use `WHERE status = 'published'`. |
| ~~`is_published`~~ | **Removed PMF (§2.a)** — `status` is the only flag. Do **not** add a second boolean. |
| `scheduled_for` | **Deferred PMF** — omit column until cron/workflow ships. |
| `visibility` | **Omitted from PR-02 DDL** — defer until defined. |
| `approval_status`, `approved_by`, `approved_at` | **Deferred PMF** — omit columns from PR-02 DDL; add when approval workflow ships. |
| `access_tier` | **Deferred** — omit column PMF. |
| `search_vector` | **Generated column** — `tsvector` weighted per §6.2a (`setweight` title > excerpt > body); full DDL below the table. |

**Excluded by founder decision:** `showDisclaimer`, `disclaimerText` per article.

**`search_vector` DDL (frozen — PR-02):**

```sql
search_vector tsvector generated always as (
  setweight(to_tsvector('english', coalesce(title, '')),     'A') ||
  setweight(to_tsvector('english', coalesce(excerpt, '')),   'B') ||
  setweight(to_tsvector('english', coalesce(content_markdown, '')), 'C')
) stored
```

Language config `english` PMF. Generated column — never a trigger, never an app-written field.

**Deprecated pattern:** Do **not** reintroduce parallel Mongo-style fields (**`primaryMedia`**, **`supportingMedia`**, multiple image arrays). **`article_media`** + hero denormalization replace them.

### 12.2a `article_media` — canonical visual list + hero derivation

**Table `article_media`:** `id`, `article_id`, **`kind`** (`image` \| `youtube`), **`url`**, **`video_id`** (nullable), **`sort_order`**, **`origin`** (`manual` \| `inline`), `created_at`.

**PMF (manual-only — `§2`):** **`article_media`** holds **only** curator-defined attachments: **`origin = manual`** for every row created in **admin** or **ETL** from legacy structured media. **`sort_order`** is the **gallery / carousel sequence** on detail (ascending). **Do not** implement **save/publish hooks** that parse **`content_markdown`** and insert **`origin = inline`** rows for launch.

**Two surfaces (intentional):**

- **Markdown body:** Inline **`![](url)`** images **render in prose** on **`/nuggets/[id]/[slug]`** — same URL may appear **only** there until a future inline-sync job.
- **Gallery / feeds:** **`article_media`** + **`articles.hero_*`** — cards and OG never depend on parsing body markup.

**Post-PMF — optional `origin = inline` sync (when shipped):** Batch or on-publish job extracts image URLs from **`content_markdown`**, inserts **`article_media`** rows with **`origin = inline`**, **`sort_order`** after manual rows in **first occurrence top-to-bottom** order. **Dedupe** before insert: **normalized URL** match against existing **`article_media`** (manual **or** inline) — **do not** duplicate. **Run on explicit publish or batch job** — **not** every autosave tick. Spec this algorithm when the PR is scheduled; until then, **`inline`** exists in the enum for forward-compatible DDL only.

---

**Hero vs gallery order (recommended model)**

| Concept | Meaning |
|---------|--------|
| **Gallery / narrative order** | **`article_media.sort_order`** — **carousel sequence on detail**, editorial flow. **Independent** of which asset is the **feed/card hero**. |
| **Feed/card hero** | **`articles.hero_media_id`** → one **`article_media`** row whose **`kind`**/**URL** drive **`hero_*`** denormalized columns. |

**Why separate:** The **first** uploaded asset or **first** in **`sort_order`** is often **not** the image you want on the grid (logo vs hero shot, thumbnail vs landscape). **Don’t** infer hero only from “first in list” without an escape hatch.

**Admin UX (minimal):**

- **“Use as feed/card hero”** (or **Set as cover**) on a media row → sets **`articles.hero_media_id`** to that row’s **`id`**, then **recompute `hero_*`**.
- **Reorder gallery** → updates **`sort_order` only** — **does not** move **`hero_media_id`** unless you add an explicit **“Make first image the hero”** action (optional shortcut).
- **Clear hero selection** → **`hero_media_id = NULL`** → **fallback** algorithm runs.

**DB constraint:** **`hero_media_id`** **`FK → article_media(id)` ON DELETE SET NULL ON UPDATE CASCADE** (exact FK clause per migration). Row must satisfy **`article_media.article_id = articles.id`**. On delete of the referenced media row: **`hero_media_id`** becomes **NULL**, then **fallback** recomputes (**§12.2a**).

---

**Recompute `hero_*` on `articles` (same transaction as save/publish):**

1. **If `hero_media_id` is set** and still points at a **valid** row for **`articles.id`:** copy **`kind`**, **`url`**, **`video_id`**, resolved **thumb URL** into **`hero_*`** fields (images → **`hero_thumb_url`** = display URL or Cloudinary transform; YouTube → **`hero_thumb_url`** from provider thumb API **or** stable **`video_id`** URL pattern).
2. **Else (fallback — `hero_media_id` null):** walk **`article_media`** for this article in **`sort_order` ASC**, pick **first suitable** row (**`kind`** image or youtube with resolvable asset). **Always set `hero_media_id`** to that row’s **`id`** when chosen — **same in admin save and ETL** — then fill **`hero_*`**. (**No** branch that fills **`hero_*`** without setting **`hero_media_id`**.)
3. **If none suitable:** **`hero_*` = null**, **`hero_media_id` = null** → feed **placeholder** (**§9**).

Feed/list queries use **`articles.hero_thumb_url`** (and **`hero_*`**) only — **no N+1** into **`article_media`** for card grids.

**YouTube:** Detail page can inline or focused player — **not** inside the **image** lightbox (**PRODUCT** behavior — separate viewer).

> **`content_stream` in Mongo (`both`) — single Postgres row (DECIDED).** v2 treats **Nuggets** and **Market Pulse** as **separate feeds with no duplicated articles**. Each Postgres row has **`standard` OR `pulse`**, never two rows per Mongo document.
>
> **ETL mapping for Mongo `both`:** Founder confirms **`both` is unlikely** in legacy data. **If any documents still have `both`, map to `standard`** (never duplicate rows). **`legacy_mongo_id`** **`UNIQUE`** — one UUID **`id`** per Mongo `_id`.
>
> **`standard`** vs **`pulse`** otherwise follows Mongo `contentStream` when **`standard`** \| **`pulse`** — unchanged.
>
### 12.3 Community collections

**Table naming** (avoid collision with editorial "collections" language): `community_collections`, `community_collection_entries`

| Table | Key fields |
|-------|-----------|
| `community_collections` | `id`, `title`, `description`, `curator_name`, **`cover_image_url` nullable**, `created_at`, `is_published` (boolean — **scope: this table only**; the `articles` `is_published` removal in §2.a does **not** apply here, since collections have no `status` enum) |
| `community_collection_entries` | `collection_id`, `article_id`, `position` (for ordering), `created_at` |

**Cover (DECIDED — single derivation path):** `cover_image_url` is **optional**. **Always derive** the displayed cover deterministically:

1. If `cover_image_url` is set → use it.
2. Else if the collection has at least one entry → use **first entry by `position` ASC**'s `articles.hero_thumb_url`.
3. Else → branded placeholder (collection has zero entries).

This collapses the previous two-path "branded OR first entry" rule into one resolution order; UI never picks between them ad-hoc.

**`community_collection_entries` DDL (frozen — PR-02; FKs explicit, CASCADE alignment with §12.4 bookmarks rationale):**

```sql
community_collection_entries(
  collection_id  uuid not null references community_collections(id) on delete cascade,
  article_id     uuid not null references articles(id) on delete cascade,
  position       int  not null,
  created_at     timestamptz not null default now(),
  primary key (collection_id, article_id)
)
```

**Deferred:** followers, follower counts, social graph, save/follow actions.

### 12.3a Profiles (frozen — §2.a)

**Required PMF.** Holds editable user fields. Do **not** write to `auth.users.user_metadata` from the client (it's user-writable by default).

```
profiles(
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
)
```

**Trigger:** seed `profiles` row on `auth.users` insert (Postgres trigger or Supabase auth hook — pick one in PR-02b).

**RLS:** select/update where `id = auth.uid()`; **public select** of `display_name` only via a view if/when nugget pages need to render author display names (PMF: not yet — §0.10 uses branded mark).

**Out of PMF:** avatar, bio, social links, public profile URL.

**Backfill (one-time, in PR-02b migration script — required):** After the trigger is deployed, run:

```sql
INSERT INTO profiles (id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
```

This is required in the PR-02b migration script before any admin-facing query joins `profiles`. The trigger only fires on new inserts — existing `auth.users` rows (admin accounts created before deployment) will have no `profiles` row without this backfill.

### 12.4 Bookmarks

**Flat:** `(user_id, article_id)` unique pair + timestamps. No folders/lists for PMF.

**`bookmarks` DDL (frozen — PR-02):**

```sql
bookmarks(
  user_id    uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
)
-- ON DELETE CASCADE on article_id is acceptable because admin never hard-deletes
-- published articles (unpublish = status='draft'). Hard delete is rare and intentional.
```

### 12.5 Editorial bundles

**Deferred** — no second `collections` concept until defined.

### 12.6 In-app notifications — DDL (PMF)

**Required for launch** (**§6.6** / **§6.6b**) — ship in **same migration wave as core tables** (**`BUILD` PR-02**) to avoid destructive mid-flight DDL.

**`notification_preferences` DDL (frozen — PR-02):**

```sql
notification_preferences(
  user_id          uuid primary key references auth.users(id) on delete cascade,
  mute_all         boolean not null default false,
  stream_standard  boolean not null default true,
  stream_pulse     boolean not null default true,
  updated_at       timestamptz not null default now()
)
```

Defaults favor **enabled** unless `mute_all`. Lazy-create on first authenticated request that needs the row (§2.a) — no seed-on-signup trigger; recipient query (§6.6) handles the missing-row case via `LEFT JOIN` + `COALESCE` defaults.

**`user_notifications`:** **`id`** UUID PK, **`user_id`** **`FK → auth.users`**, **`article_id`** nullable **`FK → articles.id`**, **`kind`** **`TEXT`** (e.g. **`single`** | **`batch_summary`**), **`content_stream`** **`TEXT`** nullable (**`standard`** \| **`pulse`**), **`is_read`** **`BOOLEAN`**, **`batch_key`** **`TEXT`** nullable — **format (frozen):** **`{content_stream}:{YYYY-MM-DD HH:00}`** **UTC** hour bucket (same as **`§6.6`** batching), **`title`** / **`body`** **`TEXT`** nullable (render-ready strings), **`created_at`**. **Unique (batch upserts):** partial **`UNIQUE (user_id, batch_key) WHERE batch_key IS NOT NULL`** (**§13** snippet) enables atomic **`INSERT … ON CONFLICT (user_id, batch_key) DO UPDATE`** for grouped notifications; **`single`** rows keep **`batch_key` NULL**.

**Creation path:** **server-only** on publish transition (admin Route Handler / server action) — **no** DB trigger requirement PMF. **Batching:** upsert **`batch_summary`** rows with **`INSERT … ON CONFLICT`** per **`§6.6`** — **no** cron.

**Indexes:** **`(user_id, is_read, created_at DESC)`** for inbox; **`(user_id, created_at DESC)`** for history.

---

## 13. Required database indexes

> Without these, feed queries degrade badly past 10k articles. Add them at schema creation time, not later.

```sql
-- Feed queries (the hot path — partial index excludes drafts via status)
CREATE INDEX idx_articles_feed
  ON articles (published_at DESC, id DESC)
  WHERE status = 'published';

-- Stream-filtered feed (pulse / standard)
CREATE INDEX idx_articles_stream_feed
  ON articles (content_stream, published_at DESC, id DESC)
  WHERE status = 'published';

-- Multi-tag AND filtering (denormalized array, GIN — §2.a)
-- tag_slugs @> ARRAY['crypto','macro'] uses this; no counting joins needed
CREATE INDEX idx_articles_tag_slugs ON articles USING GIN (tag_slugs);

-- article_tags relationship (still source of truth — used for admin reads, joins)
CREATE INDEX idx_article_tags_article ON article_tags (article_id);
CREATE INDEX idx_article_tags_tag ON article_tags (tag_id);
CREATE INDEX idx_article_tags_tag_article ON article_tags (tag_id, article_id);

-- Tag slug lookup (rail + URL filter resolution)
-- (already enforced by UNIQUE in tags.slug column definition — no extra index needed)

-- In-app notifications (inbox)
CREATE INDEX idx_user_notifications_inbox
  ON user_notifications (user_id, is_read, created_at DESC);

-- Batch digest upserts: one grouped row per user per batch_key bucket (atomic ON CONFLICT)
CREATE UNIQUE INDEX ux_user_notifications_user_batch_key
  ON user_notifications (user_id, batch_key)
  WHERE batch_key IS NOT NULL;

-- Notification recipient query (publish fan-out — §6.6).
-- Recipient query joins auth.users LEFT JOIN notification_preferences with
-- COALESCE defaults; auth.users(id) PK is sufficient for the join. The
-- partial indexes below remain useful only when np row exists.
CREATE INDEX idx_notification_prefs_active_standard
  ON notification_preferences (user_id)
  WHERE mute_all = false AND stream_standard = true;
CREATE INDEX idx_notification_prefs_active_pulse
  ON notification_preferences (user_id)
  WHERE mute_all = false AND stream_pulse = true;
-- Defaults are baked into the query via COALESCE; users without a row are still notified.

-- Idempotency for kind='single' notifications (single-article rows have batch_key=NULL,
-- so the partial unique index ux_user_notifications_user_batch_key does not cover them).
-- Without this, two concurrent publishes for the same article can insert duplicate rows.
CREATE UNIQUE INDEX ux_user_notifications_user_article_single
  ON user_notifications (user_id, article_id)
  WHERE kind = 'single' AND article_id IS NOT NULL;

-- Full text search
CREATE INDEX idx_articles_search ON articles USING GIN (search_vector);
-- Optional later (scale): partial GIN WHERE status = 'published' — only if index bloat matters

-- Bookmarks (user's saved list — unique constraint + fast lookup)
CREATE UNIQUE INDEX idx_bookmarks_user_article ON bookmarks (user_id, article_id);
CREATE INDEX idx_bookmarks_user ON bookmarks (user_id, created_at DESC);

-- Slug lookup (already enforced by UNIQUE in articles.slug column definition;
-- listed for visibility in redirect resolution code paths — §6.3)
-- CREATE UNIQUE INDEX idx_articles_slug ON articles (slug);  -- redundant with column UNIQUE

-- Article media (gallery + hero source rows — feed uses denormalized hero_* on articles)
CREATE INDEX idx_article_media_article ON article_media (article_id, sort_order ASC);
-- FK (in CREATE TABLE): articles.hero_media_id REFERENCES article_media(id) ON DELETE SET NULL ON UPDATE CASCADE

-- Collection entries (ordered list per collection)
CREATE INDEX idx_collection_entries_collection
  ON community_collection_entries (collection_id, position ASC);

-- Profiles (no extra indexes PMF — id PK + auth.uid() RLS lookups suffice)
```

---

## 14. Auth and RLS

**Minimum v2**

- Supabase **email + password** + **Google OAuth** (configure provider in Supabase dashboard; callback URLs per environment)

**RLS day one**

- `bookmarks`: users read/write **only** own rows
- **`user_notifications`** (or equivalent): users read/update **only** own rows (**§6.6**)
- **`notification_preferences`**: users read/update **only** own row (**§6.6** / **§2.a** lazy-create)
- **`profiles`** (§12.3a): users read/update **only** own row (`id = auth.uid()`); public select of `display_name` only via a dedicated view if/when nugget pages need it (PMF: not yet — §0.10)

**RLS soon / as needed**

- `community_collections` when private collections exist — enforce creator/membership rules

**Server-only rule**

- Admin writes via **service role** in server-only code paths **after** the requesting user is verified as admin (**never** “service role instead of auth”).
- `SUPABASE_SERVICE_ROLE_KEY` **never** in client bundles or exposed to browser.

**Admin identity (DECIDED — §2):**

1. After **`getUser()`** / session JWT in a Route Handler / Server Action: **gate every `/admin` handler** with **`user.app_metadata.is_admin === true`** (**boolean**) **only** — **never** alternate patterns (`roles.includes` / mixed checks across files). **`app_metadata.roles`** **may exist** for **future / non-PMF** use — **not read** by PMF **`/admin`** authorization code.
2. Set **`app_metadata.is_admin`** via **Supabase Admin API** / one-off script for staff — **not** editable from client.
3. **`/admin/**`** routes: **403** if check fails; **no** reliance on hidden form fields.

---

## 15. Admin scope (PMF)

**In scope (first admin UI slice — DECIDED)**

- CRUD **`articles`** (nuggets), publish/unpublish
- Tag assignment (+ tag creation as needed for editorial vocabulary)
- Set **`content_stream`**

**Explicitly out of first admin UI slice (DECIDED)**

- **`community_collections`** — **no** create/edit/reorder UI in **`app/admin`** at launch; use **Supabase Studio** / SQL (or a future **PR-14c**). Public **`/collections`** stays **read-only** from the app.

**Deferred**

- Pulse intro/micro-header CMS — prefer hardcoded or single config row
- Full `adminController` parity, AI ingestion, bulk spreadsheets, deep moderation

### 15.1 Admin validation & publish workflow (DECIDED — anti-drift)

**Draft vs published** (single source of truth = `status` — §2.a)

| Action | `status` | Public feeds | `published_at` |
|--------|----------|--------------|----------------|
| **Save draft** | `draft` | **Hidden** | unchanged |
| **Publish** (valid, **first** time) | `published` | **Visible** | **Set to `now()`** |
| **Publish** (valid, after unpublish) | `published` | **Visible** | **Unchanged** — never recomputed |
| **Unpublish** (DECIDED) | `draft` | **Hidden** — explicit confirm dialog | unchanged |

**`published_at` is set once and never recomputed** (§2.a). Editorial backdating / manual override is **post-PMF**. Cursor pagination depends on monotonic `published_at`; reshuffling on republish would break the feed order.

**Required before Publish (server validates — Zod)**

| Field | Rule |
|-------|------|
| **`title`** | Non-empty after trim; **max length** e.g. **300** chars |
| **`content_markdown`** | Non-empty after trim (minimum **1** visible character — no blank publishes) |
| **`excerpt`** | If empty at publish time → **auto-fill** from plain-text preview of body (**first ~240 chars** trimmed with ellipsis) — **no** publish blocked solely on excerpt |
| **`content_stream`** | Required enum **`standard` \| `pulse`** |
| **`source_url`** | **Optional** — if present must be **valid absolute URL** (`http:` / `https:`) |

**Optional PMF:** hero entirely from **`article_media`** (**manual** rows) / defaults; tags optional but typical. **No** requirement to populate **`article_media`** from Markdown inline images (**§12.2a**).

**Slug (`slug`) — frozen §2.a**

- **Generate:** On **insert** (every row, draft or published) as `slugify(title) + '-' + substr(replace(id::text,'-',''),1,6)`. Single shared util in admin and ETL.
- **Update:** On title change while in **either** status → regenerate slug. If transitioning a **published** title-rename → **301** canonical redirect from old slug (§6.3).
- **No `draft-` placeholder pattern.** Drafts have real unique slugs from creation. UNIQUE constraint never collides because of the `id`-derived suffix.

**Validation messages (user-facing — consistent tone)**

| Code | Message pattern |
|------|-----------------|
| `title_required` | *Add a title before publishing.* |
| `body_required` | *Add content before publishing.* |
| `source_url_invalid` | *Enter a valid http(s) URL or leave Source empty.* |
| `stream_required` | *Choose Nuggets or Market Pulse.* |

**Autosave:** Draft **Save** does **not** run full publish validation beyond basic schema (allow empty body **only** for drafts). **Publish** button runs **full** publish validation.

**`published_at` set-once enforcement (DDL — PR-02):**

```sql
CREATE OR REPLACE FUNCTION articles_freeze_published_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.published_at IS NOT NULL
     AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    NEW.published_at := OLD.published_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_articles_freeze_published_at
BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION articles_freeze_published_at();
```

Cursor pagination depends on monotonic `published_at`; this trigger guarantees republish (or any future workflow) cannot recompute it.

---

## 16. Feature parity matrix

| Area | v2 |
|------|-----|
| **Browse / Home** | `/` with **`stream` + `tags` + `q`** in URL (**single shareable model** — §6.2); infinite scroll |
| **Market Pulse** | `/?stream=pulse` — same shell, different revalidate band |
| **Nugget detail** | Full page **`/nuggets/[id]/[slug]`** with canonical slug redirects |
| **Markdown** | Full render on detail only; cards get excerpt/plain |
| **Media** | **`article_media`** (**manual** PMF) + **`hero_*`** on **`articles`** — **§12.2a**; body inline images render on detail only; masonry deferred |
| **External / Source links** | **Secondary** on cards (detail is primary reading path); outbound prominence minimal |
| **Community collections** | Yes; fully public; no save/follow; no followers |
| **Editorial collections** | Deferred |
| **Bookmarks** | Flat only; **`/bookmarks`** list; no collection-level saves |
| **Search** | **Baseline** suggest + committed search per **§6.2a** (**launch**); **defer** *advanced* tuning (extra ranking passes, heavy typo pipelines beyond agreed **`pg_trgm`** stub) |
| **In-app notifications** | Bell + **`§6.6`** — PMF |
| **Push notifications** | Deferred (device/browser subscription) |
| **OG / unfurl** | `generateMetadata` + server fetch for admin; defer aggressive scraping |
| **Disclaimer** | Site-wide copy only |
| **Skeletons** | Required on all surfaces (see Section 8) |

---

## 17. Rendering and component boundaries (LLM guardrails)

**Allowed**

- Server pages fetch lean lists; render first page as HTML
- `'use client'` pagination island receives cursor + endpoint, not duplicate full rows
- Thin `'use client'` `ArticleCardActions` (bookmark button) only where needed
- `<Suspense>` boundaries with skeleton fallbacks at every route boundary

**Forbidden**

- `'use client'` parents importing Server Components as default imports
- Passing full article bodies into client components for first-page duplication
- Service role imports in client bundles
- Blank/white loading states — always show a skeleton
- Centered spinner as sole loading indicator on feed or article pages
- **Client state libraries** (Redux, Zustand, Jotai, Recoil, MobX, Valtio, XState) — §2.a. URL state via `nuqs`; ephemeral UI via `useState`/`useReducer`; cross-route persistence via Supabase.
- **Date / formatting libraries** (`moment`, `date-fns`, `dayjs`, `luxon`) — use `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` directly. §2.a.
- **Runtime CSS-in-JS** (`styled-components`, `emotion` runtime, `stitches`) — Tailwind v3 only. Inline `style` allowed for dynamic values.
- **Lodash / underscore full imports** — only specific function imports (`lodash-es/debounce`) when no native equivalent. Prefer native.
- **Service workers / PWA install / offline mode** PMF — §2.a.
- **Custom scroll-restoration libraries / sessionStorage offset hacks** — accept App Router default; revisit only if metrics demand (§6.0).
- **Animation libraries beyond Tailwind transitions / `framer-motion` for `<5KB` use** — generally avoid; default to CSS transitions.
- **Heavy markdown components on cards** — cards use plain `excerpt` from DB. **Never** render `react-markdown` inside an `ArticleCard`.
- **TanStack Query on ANY read path** (public feed, `/bookmarks`, `/collections`, notifications panel) — replaced by `fetch` + `useTransition`.
- **`useEffect` chains that mirror `searchParams` or `nuqs` into `useState`/context.**
- **`framer-motion`** in any non-admin chunk.
- **`react-hook-form`** outside `app/admin/**`.
- **Service-role Supabase client** imported by anything other than a module with `import 'server-only'` at the top.
- **`<NuqsAdapter>` mounted in `app/layout.tsx`** — must mount in route-group layout.

**Bookmark hydration pattern**

```
1. Server renders anonymous HTML for all cards (no bookmark state)
2. After paint, one batched GET per feed page (matching feed page size 24):
   /api/bookmarks/check?ids=id1,id2,...   (max 24 IDs)
   - Anonymous request → server short-circuits to 200 {} (no DB call,
     Cache-Control: private, no-store).
   - Empty ids → 200 {}.
   - The client triggers exactly one bookmark-check per getFeedPage resolution
     — not per card, not per N IDs. Subsequent feed pages each fire one more.
3. Client updates bookmark button state for visible cards
4. Optimistic toggle on bookmark click — revert on API error
```

---

## 18. Explicitly deferred

- **`@google/genai` / GenAI SDK** — **not** in v2 **Next** **`package.json` PMF** unless product opens an explicit admin/ingestion PR. If legacy scripts still need it: **isolate** under **`scripts/`** with **`devDependencies`** / separate install — **never** default import in **`app/`** routes.
- **`open-graph-scraper`** — **removed PMF**. OG metadata is authored by admin (`excerpt`, `hero_thumb_url`); no scraping needed at launch. Re-add only behind an explicit "Fetch OG metadata" admin action PR.
- **`resend` / transactional email** — Supabase Auth handles its own emails; only needed if `/contact` form ships PMF — defer until then.
- Followers on community collections
- Bookmark folders (`BookmarkCollection`-style)
- Save/follow actions on collections
- Editorial curated bundles
- **Push** notification parity (browser/OS subscription — **not** in-app bell)
- Heavy OG scraping on hot paths
- **Masonry / uneven-row masonry grids** — **defer**. PMF uses **fixed-row responsive CSS grid** (dense predictable CLS). **If** masonry returns later: prefer **native CSS masonry** where supported + measurable fallback; **avoid** shipping **`HomeGridVirtualized`**-style complexity until metrics prove need — virtualization fights RSC-first simplicity.
- TanStack Query on public feed
- **Read-tracking / "seen" maps** on detail (`readBy` legacy column not migrated)
- **Editorial backdating** of `published_at` after first publish (§15.1 freeze)
- **Author / curator profile pages** (`articles.created_by` exists in DB but no UI surface PMF — §2.a)
- **Public profile pages** (`/profile/:userId`, `/u/:userId`) — defer; legacy `/profile/*` and `/myspace` redirect to `/`
- **In-product draft preview on `/nuggets/[id]/[slug]`** — admins preview via Supabase Studio or by toggling `status` to `'published'` in staging. PMF detail route returns 404 for all drafts including authenticated admins.
- **`@vercel/og` dynamic OG image generation** — admin authors `hero_thumb_url`; OG uses that asset directly.
- **Per-article scheduled publish (`scheduled_for`) and approval workflow** (`approval_status`, `approved_by`, `approved_at`, `access_tier`, `visibility`) — DDL omits these columns; do not invent placeholders.
- **inline-image sync from `content_markdown` into `article_media`** — `origin='inline'` enum value exists for forward compatibility; no PMF code reads or writes it.
- **Public profile pages (`/profile/:userId`, `/u/:userId`), avatar uploads, account deletion, social links** — `articles.created_by` has no UI surface.
- **Service worker / PWA install / offline mode / push registration.**
- **Custom scroll restoration on Back-from-detail** — App Router default is the spec.
- **`<MobileSearchOverlay>` as a separate component** — single `<HeaderSearch>` expands on mobile; do not fork.
- **Sentry (any flavor) PMF** — Vercel logs only at launch.
- **Cache invalidation hook for collections** — until collections admin ships (post-PMF), `/collections` and `/collections/[id]` rely on time-based revalidate (300s); Studio edits do not bust cache.

---

## 19. Explicitly deleted / not carried to v2

- MongoDB + Mongoose as primary store
- Express as public API for app (bridge scripts only if needed for migration)
- Helmet, cors, compression, morgan, multer, cookie-parser, express-rate-limit (all Express middleware — replaced by Next/Vercel + §5.6 headers)
- bcryptjs, jsonwebtoken (Supabase Auth replaces)
- Redis, BullMQ, rate-limit-redis (no in-app rate limiter / queue PMF — §5.5)
- web-push, PushSubscription, VAPID keys (push deferred — §6.6 in-app bell only)
- react-router-dom (Next App Router replaces)
- @tanstack/react-virtual (virtualization deferred — §17/18)
- Service worker / `serviceWorkerRegistration.ts` / PWA install prompt (§2.a)
- Plausible analytics SDK + custom `RouteTransitionProfiler` (§17 deferred — GA4 + Vercel Analytics replace)
- Per-nugget disclaimer fields (`showDisclaimer` / `disclaimerText`)
- Modal-first article UX as default (optional polish later)
- TanStack Query on public infinite feed
- `useInfiniteArticles` hook + `FilterStateContext` + all client-side filter state
- Bookmark folders, `BookmarkCollection`, `CollectionSelector` folder UX
- Collection save/follow actions
- Multi-variant card layouts (`GridVariant` / `FeedVariant` / `MasonryVariant`) — single card component PMF
- `articles.is_published` (replaced by `status` — §2.a)
- `articles.media`, `primaryMedia`, `supportingMedia`, `displayImageIndex`, `images[]`, `video`, `documents[]`, `themes[]`, `mediaIds[]`, `readBy`, `engagement`, `externalLinks`, `layoutVisibility` (Mongo legacy — collapsed into `article_media` + `hero_*` + `source_url`)
- `articles.scheduled_for`, `approval_status`, `approved_by`, `approved_at`, `access_tier`, `visibility` (deferred — omitted from PMF DDL)
- `Tag.aliases`, `Tag.usageCount`, `Tag.parentTagId`, `Tag.sortOrder` (collapsed — flat tags PMF; `dimension` kept nullable; `is_official` added)

---

## 20. Readiness for next step

This blueprint is **decision-complete** for:

- URL patterns (hybrid id+slug, collections ID-first)
- Pulse vs standard (URL + revalidate band)
- Caching realism (dynamic vs ISR per surface)
- Auth (password + Google OAuth) + RLS scope
- Three Next safeguards (middleware/cookies, lean RSC props, image allowlist)
- Disclaimer and followers scope
- Collections scoping (public, anonymous, no save/follow, detail page content)
- Loading UX contract (skeleton-first on all surfaces)
- Infinite scroll implementation rules
- Image contract (CLS prevention)
- Database indexes (required at schema creation)
- Build sequence (phase order)

**Next step:** data migration mapping (Mongo → Postgres field-by-field) and route-by-route parity checks.

---

*Nuggets v2 blueprint revised — incorporates founder Q&A + Next.js safeguards + performance UX spec + collections scoping — April 2026*
