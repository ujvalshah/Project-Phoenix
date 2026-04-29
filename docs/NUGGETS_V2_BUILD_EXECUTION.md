# Nuggets v2 — PR-by-PR Execution Document

**Purpose:** Implementation-safe build sequence for Cursor / Claude after **`docs/NUGGETS_V2_BLUEPRINT.md`** (Revised v2 — loading UX §8, infinite scroll §7, indexes §13, **`content_stream` §12.2**, **search §6.2a**), **`docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md`** (what to build for users — cards, interactions, sharing), and **`docs/NUGGETS_V2_MIGRATION_PLAN.md`** are approved.  
**Not:** Architecture revision, migration replanning, or production code in this file.

**Source-of-truth:** PR **ordering** and **merge scopes** live here — **cannot override** blueprint architecture/migration data rules **— if unclear, edit blueprint/migration first.**

---

## 0. Document precedence (when scopes overlap)

Use this **numeric order** so LLMs don’t argue circular “this doc wins” clauses:

1. **`docs/NUGGETS_V2_MIGRATION_PLAN.md`** — What Mongo imports (**identifiers**, **`both`→`standard`**, collections rows, **no bookmark/user import**).
2. **`docs/NUGGETS_V2_BLUEPRINT.md`** — Architecture (**RSC payload**, middleware shape, indexes, caching posture).
3. **`docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md`** — User-visible behavior (**tabs**, search UX, copy).
4. **`docs/NUGGETS_V2_BUILD_EXECUTION.md`** — **PR sequence and merge boundaries only** — never contradicts **1–3** on data or product facts.

**Authoritative implementation order (anti-drift):** **`BUILD_EXECUTION` PR-01 → PR-02 → …** is the **only** ordered backlog implementers should follow. **`MIGRATION_PLAN` §11** (“build order after migration approval”) is **planning / stakeholder narrative** — **not** a competing sequence to **`BUILD`** PR numbers. **`BLUEPRINT` §4** phases describe **dependency shape** (schema before UI), **not** calendar dates. **ETL (`PR-15`)** may run **in parallel** on staging once **`PR-02`** DDL exists — dry-run readiness gate aligns with **`PR-07`** feed queries (**`BUILD`** **`PR-06`** objective note).

**If documents conflict:** **PR ordering / merge boundaries** → **`BUILD_EXECUTION` wins**. **Schema columns, indexes, RLS data rules** → **`BLUEPRINT` wins** (then **`MIGRATION_PLAN`** for Mongo→Postgres mapping). **UI copy and interaction** → **`PRODUCT` wins**. **`BUILD`** must **not** contradict **1–3** on facts — edit those docs first.

---

## 1. Execution summary

### What this document is for

- Defines **ordered PR-sized milestones**, **scope boundaries**, **validation gates**, and **what must not ship** in each step.
- Translates **migration plan phases** into **mergeable units** that minimize dual-runtime confusion and LLM boundary mistakes.

### Out of scope for this document

- Changing the target architecture (stack, RLS posture, feed model).
- Rewriting the blueprint or migration plan (update those docs separately).
- Actual TypeScript/SQL implementation — only **where** and **what** to implement.

### How to use with Cursor / Claude

1. Work **one PR at a time**: merge or checkpoint before starting the next.
2. Paste **only** the current PR section + **Build principles** + relevant **Implementation details by domain** into the prompt.
3. Require output to include **validation checklist** results before closing the PR.
4. If a PR fails validation, **do not** proceed — fix or split the PR.

---

## 2. Build principles

### Performance budgets (`BLUEPRINT` §5.4)

- **Home / feed:** first-page batch **24** lean rows; transfer guardrail **~256 KiB** initial route payload.
- **Nugget detail:** **~192 KiB** guardrail; **LCP ≤ 2.5 s**, **CLS ≤ 0.1** staging targets.

### PR sizing

- **One vertical slice or one foundation layer per PR.** If a PR touches feed + auth + admin + ETL, **split it**.
- **Ceiling guidance:** avoid PRs that simultaneously change **schema**, **Next routing**, and **ETL** — max **two** of those axes.

### Server vs Client boundaries

- **Default:** pages and data loaders are **Server Components** unless they need browser APIs or local state.
- **`'use client'`** only for: pagination sentinel + fetch, bookmark toggle, theme/mobile shell nuance, forms with client validation UX.
- **Forbidden:** client components importing modules that use **`cookies()`** or **`SUPABASE_SERVICE_ROLE_KEY`**.

### Data fetching (public feed)

- **First page:** fetched on server; **cards rendered as HTML** with **lean fields only** (no full `content`/`content_markdown` on list).
- **Continuation:** **`fetch`** from Route Handler or **`GET`** Route Handler — **no TanStack Query** on feed (replaces **`useInfiniteArticles`** pattern in **`src/hooks/useInfiniteArticles.ts`** mentally — do not port that hook).
- **Client receives:** **cursor** `{ published_at, id }` for pager — **not** duplicated full first-page JSON blobs (**blueprint RSC payload rule**).

### Caching

- **`revalidate`:** pulse band **120–300s**, standard feed longer — tune in PR dedicated to caching/pulse.
- **`revalidateTag('article:' + id)`** on publish/update — wire when admin exists.
- Do **not** promise ISR for arbitrary **`searchParams`** combinations until validated against Next version — document dynamic segments honestly.

### Safety / rollback

- Each PR should leave **`main`** (or **`develop`**) deployable or behind **feature branch** with clear revert = single revert commit.
- **Schema migrations:** forward migration file in repo; **avoid destructive alter** without backup note for staging.

### Canonical card interaction (no drift)

- **Primary card action** = navigate to **`/nuggets/[id]/[slug]`** — see **`docs/NUGGETS_V2_BLUEPRINT.md` §6.0** and **`docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md` §1b / §6**.
- **Do not** implement **outbound-only** cards (`target="_blank"` as sole reading path). Secondary **Source** link may open externally.

### LLM coding rules

- Every PR description states **Server vs Client** explicitly for new files.
- No **`any`**; strict TypeScript.
- **`middleware.ts` matcher:** use blueprint **`§5.1`** — includes **`/admin`**, **`/account`**, **`/bookmarks`**, **`/api/bookmarks/*`**; **not** **`/api/collections/*`** for public GET. Validate session behaviour on staging per blueprint note.
- **Skeletons / CLS:** implement **`§8` Loading UX contract** and **`§9` Image contract** on feed and detail before marking feed PRs done.

---

## 3. PR sequence overview

**Ordered milestones (why this order):**

| Order | Focus | Risk reduced |
|-------|--------|----------------|
| **PR-01** | Next app scaffold + repo layout | Everything else depends on build pipeline |
| **PR-02** | Supabase SQL schema + indexes (no app logic) | Data contract before queries |
| **PR-03** | Supabase clients + env validation | Wrong env caught early |
| **PR-03b** | **`next-themes`** + CSS variables + **no FOUC** (PRODUCT §3) — **before PR-06** | Avoid inconsistent **`dark:`** patches across PRs |
| **PR-04** | `next/image` + Cloudinary loader + `remotePatterns` | Image runtime failures avoided late |
| **PR-05** | Server query modules + types (read-only articles/tags) | Shared layer before UI |
| **PR-06** | `/` Home: server grid + **`nuqs`** for **`stream`** + **`tags`** + **`q`** (**blueprint §6.2** shareable) + thin pager | Core UX; single discovery URL model from first merge |
| **PR-07** | Feed pagination Route Handler + cursor | Isolated API surface |
| **PR-08** | `/nuggets/[id]/[slug]` detail + metadata | Canonical URLs early |
| **PR-09** | **Filter polish + search QA** — **`nuqs` only in PR-06** |
| **PR-10** | Pulse vs standard cache TTL + tags | Mis-cache isolated |
| **PR-11** | Collections read routes | Community parity (**`CollectionsPage`** / **`CollectionDetailPage`** analog) |
| **PR-12** | Supabase Auth (**email/password + Google OAuth**) + middleware matcher refinement | Before writes |
| **PR-13** | Flat bookmarks + RLS verification | User data correctness |
| **PR-14** | Admin minimal article/tag/stream CRUD + `revalidateTag` | Writes isolated |
| **PR-14b** | Notifications fan-out cron (above-cap drain) | Decouples publish latency from large recipient sets |
| **PR-15** | Mongo → Postgres ETL scripts + staging runbook | Data movement separate from UI polish |
| **PR-16** | **Optional:** Legacy URL redirects — **omit for greenfield** with no public URLs; add **only if** imported content needs **`legacy_mongo_id`** inbound links (**migration §4**) |
| **PR-17** | Observability (**GA4** + Web Vitals / optional **`@vercel/analytics`**) | Ops visibility before cutover |
| **PR-18** | Docs: cutover checklist + delete policy for old stack | Human gate |

**Resolved:** Canonical bookmarks route is **`/bookmarks`**; **no** legacy path redirects required at launch (greenfield). **Resolved (REVISED — `BLUEPRINT` §2.a):** Next app lives in **`web/`** (sibling folder, **own `package.json`**), **NOT** repo root and **NOT** `apps/web` monorepo. Existing root (`src/`, `server/`, `vite.config.ts`, root `package.json`) **untouched** until cutover. Avoids React/Vite/Next peer-dep skew during build. Monorepo migration is post-cutover, optional, and a CI/tooling concern. (**§10 checklist.**)

---

## 4. PR-by-PR execution plan

### PR-01 — Next.js application scaffold

| Field | Content |
|-------|---------|
| **Objective** | Runnable Next.js App Router project aligned with import alias **`@/*`**, TypeScript strict, ESLint, **no feature routes yet**. |
| **Exact scope** | `create-next-app`-equivalent tree at **`web/`** (`web/app/layout.tsx`, `web/app/page.tsx` placeholder, `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/.env.example`), **`README`** snippet "how to run". **`web/package.json`** is **greenfield** — include only the v2 dependency set; **do not** merge in legacy `vite`, `express`, `bullmq`, etc., from the existing Phoenix root `package.json`. **Repo layout (frozen — `BLUEPRINT` §2.a):** Next app in `web/` (sibling folder), **NOT** repo root and **NOT** `apps/web` monorepo. |
| **Files touched** | New **`web/**`** tree only — **do not** delete or modify `src/App.tsx`, `server/`, `vite.config.ts`, root `package.json`, or `package-lock.json`. Existing app must remain buildable. |
| **Dependencies (v2 PMF runtime)** | Node 20+. **Required at PR-01:** `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@tailwindcss/typography`, `lucide-react`, `tailwind-merge`, `clsx`, `zod`. **Added later:** `@supabase/ssr` + `@supabase/supabase-js` (PR-03), `next-themes` (PR-03b), `nuqs` (PR-06), `react-markdown` + `remark-gfm` (PR-08), `@vercel/analytics` (PR-17), `react-hook-form` (PR-14, **admin only**). **Forbidden in `web/package.json`** (`BLUEPRINT` §19 + §2.a): `express`, `helmet`, `cors`, `compression`, `morgan`, `multer`, `cookie-parser`, `express-rate-limit`, `bcryptjs`, `jsonwebtoken`, `bullmq`, `redis`, `rate-limit-redis`, `mongoose`, `web-push`, `react-router-dom`, `@tanstack/react-query`, `@tanstack/react-virtual`, `@google/genai`, `open-graph-scraper`, `resend`, `papaparse`, `xlsx`, `probe-image-size`, `moment`/`date-fns`/`dayjs`, any client state library (Redux/Zustand/Jotai/etc.), **`framer-motion`**, **`react-spring`**, **`auto-animate`**, **`slugify`** (npm package — use `scripts/shared/slug.ts`), **`@vercel/og`**, **`react-modal`**, **`@headlessui/react`** (in public chunks), **`react-youtube`**, **`react-player`**, **`@sentry/react`** / **`@sentry/nextjs`** (Vercel logs only PMF). CI grep gate at PR-01 close. |
| **CI grep gates** (PR-01 close — fail build on any match) | `! grep -rE "\bis_published\b" web/ scripts/ supabase/ db/`<br>`! grep -rE "from ['\"]framer-motion['\"]" web/`<br>`! grep -rE "rehype-raw" web/`<br>`! grep -rE "service_role\|SUPABASE_SERVICE_ROLE_KEY" web/components web/app --include='*.tsx' --include='*.ts' \| grep -v "import 'server-only'"` |
| **Validation** | `npm run build` succeeds; empty home renders; **no** Supabase required to build. |
| **Must NOT include** | Supabase wiring, feed UI, Mongo. |
| **Legacy dependency hygiene** | Greenfield **`package.json`** must **not** inherit Phoenix **`express`**, **`mongoose`**, **`bullmq`**, **`redis`**, **`web-push`**, **`@google/genai`**, legacy JWT/crypto stacks, etc. **`mongoose`** stays **ETL-only** (**`scripts/migrate`** / isolated **`package.json`** scope if needed). **`open-graph-scraper`** — **admin/server-only**, SSRF-guarded (**`BLUEPRINT`**). **`@dnd-kit/*`** — **admin media reorder only** — **dynamic import** / route isolation so it never lands in public feed chunks. |
| **Rollback** | Delete scaffold folder / revert commit. |

---

### PR-02 — PostgreSQL schema (Supabase migrations)

| Field | Content |
|-------|---------|
| **Objective** | Versioned SQL per blueprint **§13** + **§12.6** (indexes + notification tables). **Mirror `BLUEPRINT` §2.a freezes exactly** — any deviation is a doc bug, not LLM creativity. **`articles`:** `source_url`, `hero_*`, `hero_media_id` FK ON DELETE SET NULL, **`status` enum `draft`\|`published` only** (single source of truth — **NO `is_published` column**), `slug NOT NULL UNIQUE` (generated at insert via shared util), **`tag_slugs text[] not null default '{}'`** (denormalized — GIN-indexed), **`created_by uuid null references auth.users(id) on delete set null`**, `published_at` set once on first publish (never recomputed). **Omit PMF DDL:** `scheduled_for`, `approval_*`, `access_tier`, `visibility`, `slug_version`, `is_published`. **`tags`** with full schema (id, slug, label, dimension nullable, `is_official` boolean, legacy_mongo_id, created_at) — **`BLUEPRINT` §12.1**. **`profiles`** (id PK ref auth.users, display_name, timestamps) + insert trigger to seed on auth.users insert — **`BLUEPRINT` §12.3a**. **`article_media`** (`origin` enum `manual`\|`inline` — PMF inserts `manual` only). **`content_stream`** check constraint `'standard'\|'pulse'`. `legacy_mongo_id UNIQUE` on articles, tags, community_collections. FTS `search_vector tsvector` weighted (title>excerpt>body). **`community_collections`** (+ entries). **`user_notifications`** + **`notification_preferences`** (defaults `mute_all=false, stream_standard=true, stream_pulse=true` — but **lazy-create**, no seed trigger; `BLUEPRINT` §6.6 / §2.a). **Indexes (must match `BLUEPRINT` §13 names):** `idx_articles_feed` and `idx_articles_stream_feed` use **`WHERE status = 'published'`** (NOT `is_published`), `idx_articles_tag_slugs` GIN, `idx_articles_search` GIN, `idx_user_notifications_inbox`, `ux_user_notifications_user_batch_key` partial unique for ON CONFLICT batch upserts, `idx_notification_prefs_active_standard` and `idx_notification_prefs_active_pulse` partial WHERE `mute_all=false`. |
| **Exact scope** | Migrations only — **no application reads**. |
| **Files touched** | **`supabase/migrations/*.sql`** **or** **`db/migrations/*.sql`** (team convention). |
| **Dependencies** | PR-01 optional (can land in parallel if paths independent). |
| **Validation** | Apply to Supabase staging project; `\d` / query smoke `SELECT 1`; index list matches blueprint. |
| **Must NOT include** | RLS policies **if** team prefers PR-02b — **acceptable split**: PR-02a DDL, PR-02b RLS. |
| **Rollback** | Migration down scripts or restore staging DB snapshot. |

---

### PR-02b — RLS policies (split if PR-02 too large)

| Field | Content |
|-------|---------|
| **Objective** | Policies: public read **`status = 'published'`** articles + all tags + community_collections; **`bookmarks`** user-scoped; **`user_notifications`** + **`notification_preferences`** user-scoped (**`BLUEPRINT` §12.6 / §14**); **`profiles`** user-scoped (`id = auth.uid()`) — **`BLUEPRINT` §12.3a**; **no** service role in client. **Profiles seed trigger:** on `auth.users` insert → `INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING`. |
| **Validation** | Supabase SQL editor tests with anon key vs user JWT for bookmarks. |

---

### PR-03 — Supabase clients + env validation

| Field | Content |
|-------|---------|
| **Objective** | **`lib/supabase/server.ts`**, **`lib/supabase/browser.ts`** (or `client.ts`), **`lib/env.ts`** with **Zod** parsing **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — server-only secrets listed but not bundled to client. |
| **Files touched** | `lib/**`, possibly **`instrumentation.ts`** — **not** feature routes. |
| **Dependencies** | PR-02 applied on staging. |
| **Validation** | Server-only script or temporary RSC page logs “connected” using anon client **read** `articles` count (zero OK). |
| **Must NOT include** | Middleware auth refresh yet — **PR-03** stays simple; **or** merge with PR-12 carefully (prefer separate). |
| **Rollback** | Revert `lib/env` + clients. |

---

### PR-03b — Theme tokens + dark mode (`next-themes`)

| Field | Content |
|-------|---------|
| **Objective** | **`next-themes`** (**`class`** strategy) + Tailwind **`dark:`** wired to **CSS variables** matching PRODUCT §3 token table; **`suppressHydrationWarning`** on **`html`** as required; **no flash** on nav. |
| **Dependencies** | PR-01. |
| **Validation** | Toggle + system preference; reload preserves theme; feed skeleton doesn’t flash wrong chrome. |
| **Must NOT include** | Full design polish — tokens + plumbing only. |
| **Defer alternative:** If skipped, move PRODUCT §3 dark bullets to **`§17` Deferred** explicitly — **do not** leave unspecified. |

---

### PR-04 — Cloudinary image loader + `remotePatterns`

| Field | Content |
|-------|---------|
| **Objective** | **`next.config.ts`**: `loader: 'custom'`, **`loaderFile`**, **`images.remotePatterns`** for **`res.cloudinary.com`**. **`lib/cloudinary-loader.ts`**: document **exact URL shape** — e.g. **`https://res.cloudinary.com/{cloud}/image/upload/{transform}/{public_id}`** where **`transform`** maps **`width`**, **`q_auto`**, **`f_auto`** from `next/image` props (match existing v1 loader if porting). |
| **Dependencies** | PR-01. |
| **Validation** | Single **`next/image`** on a static Cloudinary URL in dev **does not throw**; Network tab shows loader usage. |
| **Must NOT include** | Full card UI. |

---

### PR-05 — Read models + query helpers (server-only)

| Field | Content |
|-------|---------|
| **Objective** | Typed **`getFeedPage`**, **`getArticleById`**, **`listTags`** — **Supabase server client**, **lean selects** for list vs detail. Cursor **`(published_at, id)`**. Map DB rows → **`ArticleCard`** props type. |
| **Files touched** | **`lib/queries/*.ts`**, **`types/article.ts`**. |
| **Dependencies** | PR-02, PR-03. |
| **Validation** | Unit-style tests optional; manual call from temporary Server Component **throws on missing env** clearly. |
| **Must NOT include** | Pagination Route Handler (PR-07). |

---

### PR-06 — Home feed: server first page + client pager shell + `nuqs`

| Field | Content |
|-------|---------|
| **Objective** | **`app/page.tsx`**: Wire URL state with **`nuqs`** per **current** **`nuqs` App Router** integration (provider/adapter pattern — follow package docs for the installed major version; **do not** hardcode export names that change between releases) for **`stream`** + **`tags`** + committed **`q`** — pass into **`getFeedPage`** / search (**blueprint §6.2** URL-owned). Wire **`GET`** **`/api/search/suggest`** + **`GET`** **`/api/search`** (**required `stream` query param** — **`BLUEPRINT` §6.2**) via **one shared module** (**`lib/search/`**) — **PR-09** refines UX only. **Rendering posture (freeze):** **`app/page.tsx`** is a **dynamic** Server Component (reads **`searchParams`** / **`nuqs`** server bridge). **Do not** add **`export const revalidate`** on **`app/page.tsx`** for arbitrary URL combos — **ISR-like freshness** lives in **`getFeedPage`** via **`fetch`** cache **`revalidateTag('feed')`** / tags (**`BLUEPRINT` §11**). Shell dynamic; data layer tag-invalidated. Server fetch first page; render **ArticleCard** list **without** fat props (**§5.2**). Client **`FeedPagination`** receives **`initialCursor`** **only**. **Skeletons §8**; **§9** images. **`ArticleCard`** Server Component shell + thin **`ArticleCardActions`** client. |
| **Files touched** | `web/app/page.tsx`, `web/components/feed/**`, `web/components/article/ArticleCard*.tsx`, `web/components/chrome/Header.tsx`, `web/components/chrome/StreamTabs.tsx`, `web/components/chrome/TagChipRail.tsx`, `web/components/chrome/ActiveFiltersBar.tsx`. |
| **Chrome layout — follow exactly** | Header per `PRODUCT` §3.3 (thin: logo · search · theme · sign-in/bell — no filter affordances nested in header). Body chrome per `PRODUCT` §11.1 (stream tabs → chip rail → active-filters bar → grid). Card spec per `PRODUCT` §3.1 (paste-ready table). Theme tokens per `PRODUCT` §3.2. **No** desktop left filter sidebar — explicit decision (§11.1). |
| **Dependencies** | PR-05. |
| **Validation** | Lighthouse: no duplicate massive JSON for articles in HTML payload (inspect RSC payload size / network); **refresh preserves filters** in URL; scroll stub works. **Bundle budget CI gate (§2.a):** add `web/scripts/check-bundle-budget.mjs` (port spirit of v1 root script) — fails CI if Home route JS > **~85 KiB gzip** or detail route JS > **~60 KiB gzip** or first-paint transfer > **~256 KiB** Home / **~192 KiB** detail (`BLUEPRINT` §5.4). Bypass requires explicit "BUNDLE-BUDGET-WAIVER:" line in PR description with justification. Target: **mobile LCP ≤ 2.5s**, **CLS ≤ 0.1** on cold `/` with seed data — aspirational until staging baseline exists. |
| **Frozen rules pulled from `BLUEPRINT` §2.a / §5.7** | (a) `priority={true}` only on first card (`index === 0`), not the first row's worth (§9). (b) Feed cache scope: only canonical first page cached via `revalidateTag('feed:standard')` / `'feed:pulse'`; filtered URLs dynamic (§11). (c) HTTP cache headers on `/api/feed` per §5.4. (d) No client state libraries beyond `nuqs` + React local. (e) No `react-markdown` on cards. (f) **All in-app links use `next/link`** — never `<a href>` for internal routes (§5.7). (g) **Filter chip / stream toggle wraps URL writes in `useTransition`** — skeleton appears within one frame regardless of fetch latency (§5.7). (h) **Card spec follows `PRODUCT` §3.1 paste-ready table** — no per-component dimension overrides. (i) **`<NuqsAdapter>` mounts in `app/(main)/layout.tsx`** (route group containing `/`, `/bookmarks`, `/collections`), **NEVER** in `app/layout.tsx` — keeps detail and other routes from being forced dynamic. |
| **Responsiveness gates** | INP ≤ 200ms p75 (Web Vitals); click-to-route-change ≤ 100ms (manual verify on throttled mobile staging); filter chip → skeleton ≤ one frame. Failures block merge. |
| **Must NOT include** | TanStack Query; Mongo; filter UX polish deferred to **PR-09**; client state libraries (Zustand etc.); virtualization. |
| **Rollback** | Revert feed components only. |

---

### PR-07 — Feed pagination API

| Field | Content |
|-------|---------|
| **Objective** | **`GET /api/feed`** (or **`app/api/feed/route.ts`**) accepts **`cursor`** + **`stream`** + tag filters **stubbed minimal**. Returns **JSON array** **lean** + **`nextCursor`**. **Rate limiting — `BLUEPRINT` §5.5:** **no custom Redis-backed** throttle in Next; **`/api/feed`** unthrottled PMF **in-app** (platform caps orthogonal); optional LRU sliding window **only** for **`/api/search/suggest`** (**`PR-06`** wires the route; **`PR-09`** search QA — same posture). |
| **Dependencies** | PR-05, PR-06. |
| **Validation** | Infinite scroll loads page 2; **cursor** stable when **`published_at`** ties (two rows same ms — **use id**). **Staging ETL dry-run gate:** once **`scripts/migrate`** lands (**PR-15** parallel track), **re-run** feed queries against **real migrated row counts** — **pass/fail** before declaring launch-ready (**not** optional polish only). |
| **Must NOT include** | Auth. |

---

### PR-08 — Article detail route

| Field | Content |
|-------|---------|
| **Objective** | **`web/app/nuggets/[id]/[slug]/page.tsx`**: **Load by `id` only** (UUID). RLS enforces visibility — drafts return 404 for **everyone, including admins**. **In-product draft preview is out of PMF**; admins preview by setting `status='published'` in staging or via Supabase Studio. `generateMetadata` for OG; slug mismatch → **301** redirect to canonical. **Body markdown:** render with `react-markdown` + `remark-gfm`, **`img` component overridden per `BLUEPRINT` §9.1** (Cloudinary → `next/image` custom loader; else `<img loading="lazy">`; column-bounded). **No `rehype-raw`** — disallow raw HTML. **Detail JS budget ≤ ~60 KiB gzip** (§5.4). |
| **Dependencies** | PR-05. |
| **Validation** | Share URL resolves; **Source** shows; wrong slug **301**. **Detail load always uses UUID `id` first** — never `WHERE slug = $2` as primary lookup or fallback (§6.3). **Drafts 404 for all visitors including authenticated admins** (RLS-enforced; no service-role detail fetch). Markdown body images render with correct loader and stay column-bounded. **YouTube spec (`BLUEPRINT` §6.3a):** poster + Watch on YouTube renders without iframe on first paint; clicking timestamp link `[2:34](#yt=154)` loads embed and seeks; `react-markdown` link override for `#yt=` href routes to player island. **Crawler render guarantee (`PRODUCT` §7):** OG tags present in HTML at byte 0; `curl -A "facebookexternalhit/1.1"` returns full `<head>` with `og:image` absolute HTTPS. |
| **Must NOT include** | Comments, bookmarks on page **until** PR-13 if avoiding churn — **or** include read-only bookmark icon inactive until PR-13 (**pick one** — prefer bookmark UI **with** PR-13 only). |

---

### PR-09 — Filter polish + search QA (`nuqs` baseline lives in PR-06 only)

| Field | Content |
|-------|---------|
| **Objective** | `nuqs` / `stream` / `tags` / `q` shipped in PR-06 — no duplicate wiring here. This PR implements the **filter chrome architecture** per `PRODUCT` §11.1: (1) **stream tabs** above chip rail (Nuggets · Market Pulse — primary chrome, `next/link prefetch`); (2) **tag chip rail** sourced from `WHERE is_official = true` — desktop wraps to max 2 lines with **More** popover overflow, mobile single-line scroll with end-of-list **Filters** chip; (3) **active filters bar** between rail and grid — removable pills + Clear all (renders only when `tags` or `q` set); (4) **mobile bottom sheet** with search-within-tags, full chip list, Apply / Clear; (5) **stream toggle clears `tags` + `q`** (frozen — §0.5); (6) AND tag QA via `tag_slugs @> $1::text[]` (no counting joins — `BLUEPRINT` §2.a); (7) search suggestions **180ms debounce, 2-char min, 8-row cap** (§6.2a / §2.a); (8) every chip click wraps URL write in `useTransition` — skeleton within one frame regardless of fetch latency (`BLUEPRINT` §5.7). **Pure HTML buttons + nuqs — no filter widget library** (no `react-select`, no headless-ui menu). |
| **Forbidden in this PR (frozen — `PRODUCT` §11.1)** | Desktop left filter sidebar (`DesktopFilterSidebar` / `TaxonomySidebar` analogs); dimension grouping (`format` / `domain` / `subtopic` sections); sort dropdown / sort chip (feed is always `published_at DESC`, search relevance-first); view-mode toggle (grid / list / compact); OR-mode for tags; saved filter presets; per-tag color coding; filter affordances nested in the header; always-mounted "Back to top" button. |
| **Dependencies** | PR-06, PR-07, PR-05. |
| **Validation** | Share URL reproduces view; complex multi-tag **AND** matches SQL intent. |
| **Must NOT include** | Full parity with all **`useInfiniteArticles`** filters (**formatTagIds**, **`collectionId`**, etc.) — **defer** unless PR labeled **scope creep**. |

---

### PR-10 — Caching: pulse vs standard

| Field | Content |
|-------|---------|
| **Objective** | **`revalidate`** split: pulse shorter (**120–300s**), standard longer; **`revalidateTag`** helper for articles — wire **`publish`** only after PR-14 **or** stub tag invalidation with no-op admin. |
| **Dependencies** | PR-06–PR-09. |
| **Validation** | Change article in DB manually → stale window behaves as expected; document **not** real-time. |
| **Must NOT include** | Edge cases for personalized routes. |

---

### PR-11 — Community collections (read-only)

| Field | Content |
|-------|---------|
| **Objective** | **`app/collections/page.tsx`**, **`app/collections/[id]/page.tsx`** — mirror **`CollectionsPage`**, **`CollectionDetailPage`** **read paths** only; **no followers** UI. |
| **Dependencies** | PR-02 data exists + PR-05 queries extended. |
| **Validation** | Empty/skeleton states; featured order if column migrated. |
| **Must NOT include** | Collection CRUD for users (defer post-PMF if not in blueprint). |

---

### PR-12 — Authentication (Supabase — password + Google OAuth)

| Field | Content |
|-------|---------|
| **Objective** | Login/register/forgot flows per Supabase (**password + Google OAuth** provider configured); **`middleware.ts`** **`export const config.matcher`** — **copy blueprint §5.1** (includes **`/bookmarks`**, **`/account`**, **`/api/bookmarks/*`**; excludes public **`/api/collections`** GET pattern). Session refresh **without** **`cookies()`** in root layout for `/`. |
| **Files touched** | **`middleware.ts`**, **`app/(auth)/**`**, **`app/login`** etc. |
| **Dependencies** | PR-03. |
| **Validation** | Protected route **redirects** when logged out; **public `/`** still builds when anon. |
| **Must NOT include** | JWT parity with **`server/src/controllers/authController.ts`**. |

---

### PR-13 — Flat bookmarks

| Field | Content |
|-------|---------|
| **Objective** | **Server Actions** or Route Handlers **insert/delete** **bookmarks**; **BookmarkButton** client — **no** **BookmarkCollection** / **CollectionSelector**. **`web/app/bookmarks/page.tsx`** — canonical list (`BLUEPRINT` §6.5). Anonymous hit on `/bookmarks` → **`/login?next=/bookmarks`** (NOT 404). **Batch bookmark presence:** `GET /api/bookmarks/check?ids=` — **max 24 IDs** per request (§5.4); server returns **400** if `> 24`; **anonymous request short-circuits to `200 {}`** (no DB call, `Cache-Control: private, no-store`); empty `ids` → `200 {}`; client splits sequential batches if viewport needs `> 24`. **`next=` whitelist:** server must reject `next` values that don't start with `/` or that start with `//` (open-redirect guard) — `BLUEPRINT` §0.7 / PRODUCT §0.7. |
| **Dependencies** | PR-12, PR-02 RLS. |
| **Validation** | RLS: user A cannot read user B's bookmarks; duplicate insert idempotent or clean error. |
| **Must NOT include** | Folders. |

### PR-14 — Admin minimal (articles + tags + stream)

| Field | Content |
|-------|---------|
| **Objective** | **`web/app/admin/**`** — `articles` CRUD, tags (assign + create — admin-only per `PRODUCT` §15), `content_stream`. **Cache busts on save (frozen — `BLUEPRINT` §11 / §2.a):** `revalidateTag('article:' + id)` AND `revalidateTag('feed:standard')` AND `revalidateTag('feed:pulse')` — both feed tags always (cheap when not currently cached). **`tag_slugs[]` recomputation (`BLUEPRINT` §2.a):** every tag write must rewrite `articles.tag_slugs` from the current `article_tags` join in the same transaction; **never** trust an in-memory list. Same util used in ETL (PR-15). **`community_collections`:** no admin routes in PR-14 (Studio/SQL only — `BLUEPRINT` §15, `PRODUCT` §0.2). **Greenfield UX:** route-level create/edit — Zod mirrors `BLUEPRINT` §15.1 (publish vs draft rules, messages). Markdown-first; `source_url` → Source; `article_media` (manual gallery only PMF — `BLUEPRINT` §2.a) + "Use as feed/card hero" → `hero_media_id` / `hero_*` per `BLUEPRINT` §12.2a — **no** sync from `content_markdown` inline `![](url)` into `article_media`. **`slugify` shared with PR-15** — **slug generated at insert** (no `draft-` prefix — §2.a). **Admin save writes `created_by = auth.uid()`** (§2.a). **Notification fan-out** triggered when `status` flips to `'published'` — synchronous up to 5,000 recipients, queued above (`BLUEPRINT` §6.6 / §2.a). **`@dnd-kit` for media reorder dynamic-imported** so it never lands in non-admin chunks. |
| **Dependencies** | PR-12, PR-02, service role server-only module. |
| **Validation** | Publish updates public feed within **`revalidate`** window; **no** service role in client bundle (**grep** CI). |
| **Must NOT include** | **`community_collections`** CRUD UI; Market Pulse CMS configs (**`MarketPulseIntroConfig`** etc.) — **defer**. |

---

### PR-14b — Notifications fan-out cron (above-cap drain)

| Field | Content |
|-------|---------|
| **Objective** | Vercel Cron route **`web/app/api/cron/notifications-fanout/route.ts`** running every 60s. Drains the **above-cap** notification fan-out queue introduced when admin publish exceeds 5,000 recipients (`BLUEPRINT` §6.6 / §2.a). Uses **same** `INSERT … ON CONFLICT` upsert path as the synchronous publish handler — single shared util. **No Redis/BullMQ.** |
| **Implementation** | Lightweight `pending_fanout` table OR scan `articles` recently transitioned to `published` whose recipient sweep is incomplete — pick one in PR description. Idempotent: re-running on the same `(user_id, batch_key)` is safe via `ON CONFLICT DO UPDATE`. |
| **Auth** | Cron route protected via `Authorization: Bearer ${CRON_SECRET}` header (Vercel Cron sends this) — reject all other callers. |
| **Validation** | Force a publish to a synthetic recipient set > 5,000 in staging; verify cron tick drains within 1–2 minutes; re-run cron manually — no duplicates. |
| **Must NOT include** | Realtime / WebSocket; email/push delivery; backfill of historical publishes. |

---

### PR-15 — ETL scripts (Mongo → Postgres)

| Field | Content |
|-------|---------|
| **Objective** | Runnable **`scripts/migrate/*.ts`** (lives in repo root `scripts/migrate/` with **its own `package.json`** — `mongoose` stays here; never imported from `web/`). Uses `MONGO_URI` + Supabase service role server-side only — imports `Article`, `Tag`, `Collection` (+ entries) per `NUGGETS_V2_MIGRATION_PLAN.md`. **`article_media`** from legacy structured media only (`origin=manual`) — **no** Markdown inline-image extraction PMF (`BLUEPRINT` §12.2a). **Do not** read Mongo `Bookmark` — Postgres `bookmarks` stays **empty** until v2 users save (§3.6 migration plan). **Shared `slugify` + collision suffix** — single module used by ETL and admin (PR-14): `slugify(title) + '-' + substr(replace(id::text,'-',''),1,6)` — generated at insert time for **every** row regardless of status (§2.a, no `draft-` prefix). **`tag_slugs[]` populated** for every migrated row in the same transaction. **`is_official` mapping for tags:** Mongo `Tag.isOfficial` → Postgres `tags.is_official`; default `false` if absent. **`articles.created_by` = NULL** for migrated rows (admin can backfill later). |
| **Dependencies** | PR-02 schema stable. |
| **Validation** | Dry-run counts; **`legacy_mongo_id`** strategy; **`both`** → **`standard`**; **collections** entry counts vs Mongo; **verify output slug uniqueness** before bulk import. |
| **Must NOT include** | Automatic production execution — **manual** staging gate. |
| **Parallel track** | Start ETL **against staging early** — aim for **first dry-run by PR-07** so feed/query code isn’t validated only on hand-seeded rows. |

---

### PR-16 — Legacy redirects (**optional / defer default**)

| Field | Content |
|-------|---------|
| **Objective** | **Greenfield launch (no public v1 URLs):** **skip** this PR — **no** `next.config` redirects required. **If** SEO/marketing later needs inbound compatibility (e.g. shared **`legacy_mongo_id`** links post-import): add **`app/article/[mongoId]/route.ts`** → **`SELECT id, slug FROM articles WHERE legacy_mongo_id = $1`** → **`NextResponse.redirect`** **301** to **`/nuggets/[uuid]/[slug]`**. **Do not** expand **`middleware`** matcher for redirects — prefer explicit Route Handler. |
| **Dependencies** | PR-08, PR-15 data (staging). |
| **Validation** | **If implemented:** legacy mongo URL **301** → **`/nuggets/...`**; **no redirect loops**. **If skipped:** N/A. |

---

### PR-17 — Observability

| Field | Content |
|-------|---------|
| **Objective** | **Ship both:** Google Analytics 4 (GA4) via `next/third-parties/google` — deferred load pattern for low CLS — **and** `@vercel/analytics` on Vercel for **Web Vitals / page views** — tiny bundle, **not** a second behavioral analytics stack competing with GA. **Optional:** `Speed Insights`. Pageviews + route-level navigation only at launch unless product expands — no custom event sprawl. **Do not** also ship Plausible as primary without intent. **Consent:** Consent Mode / CMP when GDPR traffic matters. **Web Vitals reporting:** capture **INP** specifically and dashboard it — `BLUEPRINT` §5.7 target is ≤ 200ms p75; regressions surface here. **OG validation script** `web/scripts/validate-og.mjs` (`PRODUCT` §9) lands in this PR — runs against staging on every deploy and prints a pass/fail summary. Manual WhatsApp / LinkedIn / X validation is part of the launch checklist (**launch-blocking**). |
| **Must NOT include** | Heavy **`routeProfiling`** port Day 1; redundant analytics stacks. |

---

### PR-18 — Cutover documentation + old stack tombstone

| Field | Content |
|-------|---------|
| **Objective** | **`docs/CUTOVER_RUNBOOK.md`**: DNS, rollback, freeze writes; **explicit list**: **`server/src/index.ts`**, **`src/App.tsx`** retained until cutover — **do not delete** in PR-01–17. |
| **Validation** | Human sign-off. |

---

### PR size warnings

- **Split PR-09** if filters explode: **PR-09a** `stream` only, **PR-09b** tags + search **`q`**.
- **Split PR-14** admin: **articles CRUD** first, **tag admin** second.

---

## 5. Implementation details by domain

### App scaffold / routing

- **New Next tree** lives in **`web/`** sibling folder (frozen — `BLUEPRINT` §2.a) — **do not merge routers** with current Vite `src/`.
- `web/` has **its own** `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, ESLint config. Repo root tooling untouched.
- Route groups: `(marketing)`, `(main)`, `admin` as needed — decide one convention in PR-01.

### Feed rendering

- **Reference behavior:** **`src/pages/HomePage.tsx`**, **`ArticleGrid.tsx`** — **do not copy** TanStack **`useInfiniteArticles`**.
- **Defer:** **`HomeGridVirtualized.tsx`** virtualization until perf measurement fails.

### Article detail

- **Reference:** modal stack in **`ArticleModal`** — **replace** with **`app/nuggets/...`** only.

### Market Pulse

- **Reference:** **`contentStream`** in **`Header.tsx`** / **`MobileBottomNav.tsx`** — implement **`nuqs`** **`stream=pulse`** per blueprint.

### Collections

- **Reference:** **`server/src/models/Collection.ts`**, pages **`CollectionsPage`**, **`CollectionDetailPage`** — **no** **`followers`** fields.

### Bookmarks

- **Reference:** **`Bookmark.ts`** migrate flat; **ignore** **`BookmarkCollection.ts`**, **`bookmarkCollections`** routes for v2 launch.

### Tags / filters / search

- **Reference:** **`Tag.ts`** dimensions — core PMF may ship **subset** (`format`/`domain`/`subtopic` columns) **or** simplified tag list — **do not import** entire **`searchController.ts`** complexity in PR-09; **defer** suggestions endpoint parity.

### Auth

- **Reference:** **`authController.ts`**, **`AuthContext`** — **replace** with Supabase; **no** bcrypt/JWT in Next bundle.

### Admin

- **Reference:** **`adminController.ts`** — **thin slice** PR-14 only.

### Images / media

- **Reference:** **`cloudinaryService.ts`**, **`Article`** `media`/`primaryMedia` — ETL derives **`primary_image_url`**; **`next/image`** only after PR-04.

### Caching / revalidation

- Implement in **PR-10** + finalize when **PR-14** emits tags.

### Mongo → Postgres migration scripts

- **Isolate** in **PR-15**; **never** import Mongoose from **`app/`**.

### Redirects / canonical URLs

- **PR-16** + **`generateMetadata`** canonical in **PR-08**.

### Observability / analytics

- **PR-17:** **`Google Analytics (GA4)`** as primary web analytics (**founder**); **`@vercel/analytics`** / Speed Insights optional — **see PR-17 objective**.
- **Defer** **`RouteTransitionProfiler`** from **`App.tsx`**.

### Cleanup / deletion of old code

- **Only after cutover** (migration plan): remove **or** archive **`server/`**, **`vite.config`**, **`src/`** SPA — **not** in early PRs.

---

## 6. Temporary bridge strategy

| Keep on old stack during build | Why |
|--------------------------------|-----|
| **Production `nuggets.one`** | Until cutover PR approved |
| **MongoDB** | Source of truth until ETL + switch |
| **Express API** | Unchanged — **read-only** recommended for prod during Next staging tests **if** parallel QA compares APIs — **avoid dual-write** |

| Bridge allowed | Notes |
|----------------|-------|
| **Manual content entry** in Supabase staging while iterating UI | OK |
| **Exported JSON dumps** from Mongo for ETL dev | OK |

| Must NOT dual-write | Why |
|---------------------|-----|
| **Articles/bookmarks** to Mongo **and** Postgres in prod | Corruption + rollback nightmare |

---

## 7. Validation strategy

### Staging checks

- Deploy Preview on Vercel per PR where applicable.
- Supabase **staging** project separate from prod until cutover.

### Parity checks

- Sample **N** articles: title, excerpt, primary image, **`content_stream`**, tag slugs — vs Mongo export (**after PR-15**).

### Performance checks

- Lighthouse mobile **≥** agreed threshold for **`/`** and **`/nuggets/...`**.
- **RSC payload** size sanity after PR-06 (**no** fat props).

### SEO checks

- Canonical URLs, **`generateMetadata`**, optional legacy redirects (**PR-16** — **omit** if greenfield).

### Auth checks

- Session refresh only on matched routes; anon **`/`** remains cache-friendly per blueprint tests.

### Data integrity checks

- Bookmark uniqueness; **`legacy_mongo_id`** unique; FK **`article_tags`**.

---

## 8. Rollback strategy

| Step | Revert action |
|------|----------------|
| Bad PR merge | **Git revert** single PR |
| Bad migration | Restore staging DB snapshot; fix forward migration |
| Failed cutover | **DNS** back to Vite+Express deployment; Mongo still authoritative if ETL was copy-only |
| **Preserve always** | Mongo backups, **`legacy_mongo_id`** columns **months** post-cutover |

**Signals to rollback launch:** error rate spike, auth failures > threshold, **wrong articles visible** (RLS hole), **redirect loops**.

---

## 9. Deferred scope (must not ship in v2 initial launch)

Explicit **non-build** per blueprint + migration plan:

- **`BookmarkCollection`** / folder UX (**`BookmarkButton`** + **`CollectionSelector`** parity).
- **Notifications page** (**`NotificationsPage`**, **`notificationsRouter`**).
- **Push** (**`web-push`**, **`PushSubscription`**).
- **Community collection followers** (**`Collection`** model follower arrays).
- **Pulse unseen badges** (**`/api/articles/pulse/unseen-count`** etc. in **`articles.ts`** routes).
- **Full admin parity** (**`adminController`** CMS configs — Pulse intro strips, etc.).
- **BullMQ / Redis** job runners in-app.
- **TanStack Query on public feed** (**`useInfiniteArticles`** pattern).
- **Modal-first reading** (**`ArticleModal`** default UX).
- **`HomeGridVirtualized`** unless perf requires — **fast-follow** if feed **~150+** cards without windowing hurts mobile (**CLS**/scroll jank); consider **manual “load more” cap** before full virtualization.
- **TanStack Query on `/bookmarks`, `/collections`, notifications panel** (forbidden everywhere PMF, not just public feed).
- **`framer-motion` / animation libs PMF.**
- **`@vercel/og` dynamic OG generation.**
- **In-product draft preview.**
- **A grep guard for `is_published`** is part of CI from PR-01 onward.

---

## 10. Final execution checklist (before code starts)

- [ ] **`docs/NUGGETS_V2_BLUEPRINT.md`** (Revised v2) frozen / tagged.
- [ ] **`docs/NUGGETS_V2_MIGRATION_PLAN.md`** acknowledged.
- [x] **Repo layout (REVISED — `BLUEPRINT` §2.a):** v2 ships from **`web/`** sibling folder with its own `package.json`. NOT repo root, NOT `apps/web` monorepo. Existing root untouched until cutover. Monorepo migration is post-cutover and optional.
- [ ] **`content_stream`:** **`§12.2`** — **`both`** → **`standard`**; **Phase 1 ETL** includes **articles + tags + collections** (**migration plan** founder scope).
- [ ] **Supabase** staging project + anon/service keys in CI secrets pattern — **decided**.
- [ ] **Public profile scope** — **defer PMF**; **`/profile/*`**, **`/myspace`** → **`301`** **`/`** (or keep legacy handler stub) per migration **`§12`** until product ships profiles.
- [ ] **Branch strategy:** **`next-v2`** long-lived vs **trunk** — **decided**.
- [ ] **First PR owner** assigned — **Person/tool**.

---

*Document version: execution sequencing only — aligned with blueprint + migration plan — April 2026.*
