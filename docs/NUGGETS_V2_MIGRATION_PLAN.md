# Nuggets v2 — Migration Plan (Planning Only)

**Repo:** `nuggets_v60` (Project-Phoenix)  
**Status:** Planning document — **no implementation code**  
**Companion:** `docs/NUGGETS_V2_BLUEPRINT.md` (engineering — §§5–13), `docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md` (product/UI — parity targets vs intentional UX changes), `docs/NUGGETS_V2_BUILD_EXECUTION.md` (PR order)  

This plan maps the **current Vite + React + Express + MongoDB** codebase to **Next.js App Router + Supabase PostgreSQL + Vercel**, with explicit cutover, risks, and PMF cuts.

**Source-of-truth:** When docs disagree on **data shape, ETL order, identifier mapping**, **this file wins**.

---

### Founder migration scope (v2 launch — explicit)

**Import from Mongo (Phase 1 ETL):** **`articles`/`tags`/`article_tags`** + **`community_collections`** + **`community_collection_entries`** (ship **`/collections`** with real data). **Do not import:** Mongo **users**, **legacy bookmarks**. Supabase **`auth.users`** are **fresh** (admin invite **manually** if simplest).

**Feeds:** **Nuggets** and **Market Pulse** remain **separate logical feeds** — **no duplicate Postgres rows** per Mongo article — see **`docs/NUGGETS_V2_BLUEPRINT.md` §12.2**.

---

## 1. Executive migration recommendation

### Recommendation: **Greenfield rewrite + one-shot data migration + hard cutover**

**Why not a phased “strangler” on Express?**  
The blueprint changes **routing model** (URL-owned **`stream`/`tags`/`q`** on **`/`**, **`/nuggets/[id]/[slug]`** detail), **auth** (Supabase vs JWT/cookies in `server/src/controllers/authController.ts` + `authenticateToken`), **data layer** (Postgres vs Mongoose), and **rendering** (RSC vs full SPA). Serving “half” traffic through Express long-term duplicates security, caching, and SEO work. **Founder scope:** migrate **articles, tags, collections (+entries)** — **no** legacy users/bookmarks — cutover complexity stays bounded.

**Why greenfield?**  
The client is centered on **`src/App.tsx`** routes, **`useInfiniteArticles`** (`src/hooks/useInfiniteArticles.ts`), **`ArticleGrid`** / **`HomeGridVirtualized`**, and many contexts (`FilterStateContext`, `AuthContext`, etc.). Incrementally swapping the shell still implies **rewriting feed, detail, search, admin** to match v2. A **new Next app** (separate tree or branch) implements the blueprint cleanly. **Bookmarks** in v2 are **net-new** (no Mongo bookmark migration).

**Hybrid element that *is* acceptable:**  
Run **Mongo → Postgres ETL** as **offline batch scripts** (similar spirit to `server/scripts/*.ts`, `migrate-canonical-names` in `package.json`) **before** DNS switch — not a live dual-write.

**Summary:** **Rewrite the app**, **migrate data once**, **validate in staging**, **cut over** with rollback via **reverting DNS + Mongo backup**, not feature flags across two stacks indefinitely.

---

## 2. Current → Target mapping

| Current (representative) | Target v2 |
|--------------------------|-----------|
| **Client shell** | **Next.js App Router** (`app/`): replaces **`src/main.tsx`**, **`src/App.tsx`**, **`react-router-dom`** routes |
| **Feed rendering** | **Server-first page** + lean props + **client pagination island** (no TanStack Query on feed per blueprint). Replaces **`HomePage.tsx`**, **`ArticleGrid.tsx`**, **`HomeGridVirtualized.tsx`**, **`useInfiniteArticles.ts`** |
| **Detail views** | **`/nuggets/[id]/[slug]`** RSC/detail pipeline — replaces **`ArticleModal`**, **`ArticleDrawer`**, **`/?openArticle=`** pattern (`ArticleRedirect` in **`App.tsx`**) |
| **Market Pulse** | **`/?stream=pulse`** (nuqs) — replaces **`contentStream`** via **`FilterStateContext`** / **`Header.tsx`** / **`MobileBottomNav.tsx`** (`standard` vs `pulse`) |
| **Collections (community)** | **`community_collections`** + entries — maps **`server/src/models/Collection.ts`** + **`collections` routes** (`server/src/routes/collections.ts`) |
| **Bookmarks** | **Flat `bookmarks`** — **v2-only** — **no Mongo bookmark import** (founder: no legacy users to migrate) |
| **Tags / filters** | **`tags`**, **`article_tags`**, dimensions optional — maps **`server/src/models/Tag.ts`** + article **`tagIds`** |
| **Search** | Postgres **`tsvector`** + **`pg_trgm`** optional + dedicated suggest/search routes — **quality launch** per blueprint §6.2a (relevance-first; tab-scoped) |
| **Auth** | **Supabase Auth** — replaces **`authController.ts`**, **`authenticateToken`**, JWT utils (**`server/src/utils/jwt.ts`**), **`AuthContext`** patterns |
| **Admin** | Next **admin segment** + server-only writes — replaces **`AdminPanelPage`**, **`server/src/routes/admin.ts`**, **`adminController.ts`** (large surface) |
| **Images/media** | **Cloudinary** URLs + **`next/image`** custom loader — maps **`server/src/services/cloudinaryService.ts`** + **`Article`** media fields (simplified to primary image PMF) |
| **Caching** | **Next `revalidate` / `revalidateTag`**, edge-friendly public shells — replaces reliance on **Express `compression`** + client-side refetch patterns alone |
| **In-app notifications** (bell) | **New implementation** in Next — **blueprint §6.6** — **not** a port of legacy **`notificationsRouter`** |
| **Push / web-push** | **Deferred** — **`PushSubscription`**, **`web-push`** not ported for PMF |
| **API layer** | **Route Handlers + Server Actions** replace **`server/src/index.ts`** mounting **`articles`**, **`bookmarks`**, **`collections`**, etc. |
| **Redis / BullMQ / jobs** | **Not ported for PMF** — **`redisClient`**, **`rate-limit-redis`**, **BullMQ** queues replaced by **Supabase + Vercel cron / deferred** where needed |

---

## 3. Data migration plan

### 3.1 Identifier strategy

- **Articles:** Mongo `_id` (ObjectId) → Postgres `id` (UUID). `legacy_mongo_id text UNIQUE` — **one row per Mongo document** (feeds do not duplicate articles — `BLUEPRINT` §12.2).
- **Slug (frozen — `BLUEPRINT` §2.a):** Generated at insert as `slugify(title) + '-' + substr(replace(id::text,'-',''),1,6)`. Single shared util used by ETL and admin. UNIQUE — collision is impossible because the suffix is UUID-derived. **No `slug_version` column.** **No `draft-` prefix pattern.**

### 3.2 `articles` ← `Article` (`server/src/models/Article.ts`)

| Mongo / concept | Postgres | Notes |
|-----------------|----------|--------|
| `_id` | `id` UUID + `legacy_mongo_id` | Stable lookups during transition |
| `title`, `excerpt`, `content` | `title`, `excerpt`, `content_markdown` | Map markdown/HTML consistently |
| `publishedAt` | `published_at` timestamptz | Normalize ISO strings; **set once, never recomputed** (`BLUEPRINT` §15.1) |
| `status`, `visibility`, publishability | **`articles.status`** (`'draft'` \| `'published'`) — **single source of truth** (`BLUEPRINT` §2.a). `visibility` and `approval_*` **omitted** in Postgres. | **`is_published` does NOT exist in v2 schema** (§2.a). Map Mongo published/draft semantics directly into `status`. |
| `tagIds[]` | `article_tags` rows + **`articles.tag_slugs[]` denormalized** (§2.a) | Resolve ObjectIds → tag UUIDs; **populate `tag_slugs[]` in same transaction** for the multi-tag AND query path |
| (none) | **`articles.created_by`** = NULL for all migrated rows | Mongo users are not migrated (§3.7); column exists for future curator UI (`BLUEPRINT` §2.a) |
| (generated) | **`articles.slug`** | Generated at insert via shared util `slugify(title) + '-' + substr(replace(id::text,'-',''),1,6)` — **same util as admin** (§3.1, `BLUEPRINT` §2.a). UNIQUE — never collides because of UUID-derived suffix. |
| **`contentStream`**: `standard` \| `pulse` \| **`both`** | Postgres **`standard` \| `pulse` only** — **one row per Mongo doc** | **`both`** → **`standard`** (founder: **`both`** unlikely). **`pulse`** / **`standard`** unchanged. |
| `media`, `primaryMedia`, `supportingMedia`, `displayImageIndex` | **`article_media`** rows + **`articles.hero_*`** | Collapse legacy graphs → **ordered `article_media`** (**kind**, **`origin=manual`**, **`sort_order`**); **YouTube** URLs → **`kind=youtube`** + **`video_id`**; **compute `hero_*`** per blueprint **§12.2a** (no feed-time joins). **Do not** PMF-parse **`content_markdown`** for inline images into **`article_media`** — **deferred** post-PMF optional job (**`BLUEPRINT` §2**, **`§12.2a`**) |
| `externalLinks` | **`articles.source_url`** (singular) | **Primary** link or first suitable attribution — **not** gallery media |
| `layoutVisibility`, masonry flags | **omit** PMF | Per blueprint |
| `showDisclaimer`, `disclaimerText` | **omit** | Site-wide disclaimer |
| `engagement`, `readBy` | defer / omit | Unseen badge logic deferred |

**Rich fields:** Store **`content`/`media` blob`** optionally in **`articles.extra_legacy jsonb`** **one-time** for forensic rollback (optional, privacy-reviewed). **Never** select this column in app queries, RSC list payloads, or anon-authenticated reads — **service-role forensic scripts only** (grep CI for accidental `extra_legacy`).

### 3.2b `article_media` (target schema — blueprint §12.2a)

ETL **creates `article_media`** from collapsed Mongo media fields **before** relying on admin re-save (**`origin=manual`** only). Set **`articles.hero_media_id`** to the legacy **“primary” / intended hero** row when known (**displayImageIndex**, **`isPrimary`**, etc.); else **`NULL`** and **fallback** recompute (**`BLUEPRINT` §12.2a**). **`hero_*`** must be **filled** for every migrated **published** row so feeds never join **`article_media`** for cards. **Inline images embedded only in legacy HTML/markdown body** stay **in `content_markdown`** for detail render — **no** ETL second pass into **`article_media`** unless/until **`§12.2a`** post-PMF job ships.

### 3.3 `tags` ← `Tag` (`server/src/models/Tag.ts`)

| Mongo | Postgres |
|-------|-----------|
| `_id` | `id` UUID + `legacy_mongo_id` |
| `rawName` | `label` |
| `canonicalName` | `slug` (normalized to unique slug) |
| `isOfficial` | **`is_official boolean not null default false`** (`BLUEPRINT` §12.1 / §2.a) — **drives Home chip rail** filter. Default `false` if absent in source. |
| `dimension` | `dimension text null check (dimension is null or dimension in ('format','domain','subtopic'))` — kept for future grouping; not surfaced PMF |
| `parentTagId`, `sortOrder`, `status`, `aliases`, `usageCount`, `type` | **Dropped** — flat tags PMF (`BLUEPRINT` §19) |

Normalize `canonicalName` → unique `slug`.

**Tag dedup (frozen — PR-15):** if multiple Mongo `Tag` documents share a canonical name, ETL picks the row with the lowest `created_at` and discards the rest **before** computing `legacy_mongo_id UNIQUE`. Discarded Mongo `_ids` are written to a `migration_log` table for traceability.

### 3.4 `article_tags`

- Join table `article_id`, `tag_id` (PK on the pair).
- **In the same migration transaction**, populate **`articles.tag_slugs text[]`** (denormalized — `BLUEPRINT` §2.a) from the resolved tag slugs for that article. Multi-tag AND filtering at runtime uses `tag_slugs @> $1::text[]` against the GIN index — no counting joins. Source of truth remains `article_tags`; `tag_slugs` is rebuilt on every tag write (admin and ETL share one util).

### 3.5 `community_collections` ← `Collection` (`server/src/models/Collection.ts`)

| Mongo | Postgres | Notes |
|-------|----------|--------|
| `_id` | UUID + `legacy_mongo_id` | |
| `rawName`, `canonicalName`, `description` | `title`, `description` | Map naming consistently |
| `creatorId`, curator display | `curator_name` **text** | **No user FK** — derive display string from **`Collection`** / populated curator fields **or** placeholder (**users not migrated**) |
| `type`, `isFeatured`, `featuredOrder`, `entries[]` | Core columns + **`community_collection_entries`** | |

**`entries`:** `{ articleId, … }` → resolve **`article_id`** via migrated **`articles.legacy_mongo_id`** lookup.

**Followers:** **Not migrated** (blueprint deferred).

**Phase 1:** **Ship `/collections`** with migrated rows (**blueprint** public read).

### 3.6 Bookmarks

**No Mongo import.** Postgres **`bookmarks`** is **v2-only** (flat **`user_id` + `article_id`**).

### 3.7 Users / auth / profiles

- **Supabase Auth:** **Fresh accounts only** — **no Mongo user migration**.
- **Admin:** Invite `auth.users` manually via Supabase dashboard / Admin API; set `app_metadata.is_admin = true` (`BLUEPRINT` §14).
- **`profiles` table (`BLUEPRINT` §12.3a / §2.a):** seeded **automatically** by Postgres trigger on `auth.users` insert (`INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING`). ETL **does not** create `profiles` rows — there are no users to migrate. First admin login fills `display_name` via `/account` UI.
- **`articles.created_by`:** NULL for all migrated rows; admin save writes `auth.uid()` for new content.

### 3.8 Backfill strategy

1. Freeze Mongo writes — short maintenance window.
2. Dump **`articles`**, **`tags`**, **`collections`**.
3. **Phase 1 ETL order:** **`tags`** → **`articles`** → **`article_tags`** → **`community_collections`** → **`community_collection_entries`** (entries **after** articles resolve IDs).
4. Validation: counts; **standard vs pulse disjoint** checks (**blueprint**); spot-check **collection** entry counts vs Mongo.
5. **`vacuum analyze`** / indexes (**blueprint §13**).

### 3.9 Transform / normalize / drop summary

| | Action |
|---|--------|
| Tag dimensions | **Keep column** in DB; **PMF filter UI = flat chip list** (see product doc §11) — **not** dimension-grouped UI |
| **Collections** | **Migrate Phase 1** — **`§3.5`** — ship **`/collections`** |
| Pulse unseen (`readBy`, **`articlesController`** unseen endpoints) | **Defer** — no migration of read maps |
| In-app notifications | **Greenfield** — **§6.6** schema + jobs (**not** legacy router port) |
| Media richness | **Transform down** to primary image PMF |
| Disclaimer fields | **Drop** |
| Bookmark folders | **Drop** from schema |

---

## 4. Route and UX parity plan

### 4.1 Current routes (**`src/App.tsx`**)

| Current path | v2 target | Change |
|--------------|-----------|--------|
| **`/`** | **`/`** with **`stream`, `tags`, `q`** in URL (**nuqs**) — **shareable** (**blueprint §6.2**) | Modal **`openArticle`** removed — **use `/nuggets/...`** |
| **`/feed`**, **`/feed/:articleId`** | Redirect → **`/`** or obsolete | Already **`Navigate to "/"`** — align with v2 |
| **`/collections`**, **`/collections/:collectionId`** | **`/collections`**, **`/collections/[id]`** | ID-stable; slug optional later |
| **`/article/:articleId`** | **`/nuggets/[id]/[slug]`** | **Canonical** hybrid URLs — **no** query-param modal primary |
| **`/bookmarks`** (**`SavedPage`**) | **`/bookmarks`** (canonical — greenfield) | Per blueprint **`§6.5`** |
| **`/profile/:userId`** | Defer **public profiles** **or** minimal **`/u/[id]`** | Blueprint PMF may shrink — **intentional** scope cut unless required |
| **`/myspace`** | Redirect | Map to profile/saved per product |
| **`/account`** | **`/account`** | Supabase settings equivalent |
| **`/admin/*`** | **`/admin/*`** | Rebuilt |
| **`/notifications`** | **Replaced by** in-app bell + panel (**blueprint §6.6**) — **not** legacy route parity |
| **`/forgot-password`**, **`/reset-password`** | Next auth pages | Supabase flows |
| **`/legal/:slug`**, **`/contact`** | Same IA | Content migration |

### 4.2 Intentional behavior changes

- **Article open:** **Full page** replaces **`ArticleModal`** / **`?openArticle=`**.
- **Bookmark folders:** Removed — saved UI simplifies (**`SavedPage.tsx`** / **`CollectionSelector`** patterns obsolete).
- **Pulse unseen badges:** API **`/api/articles/pulse/unseen-count`** etc. (**`articles.ts` routes**) — **defer**.

### 4.3 Must remain equivalent where promised

- **Four-tab navigation (mobile):** Nuggets / Market Pulse / Collections / Bookmarks — **Bookmarks** authenticated-only (**`docs/NUGGETS_V2_PRODUCT_BEHAVIOR_AND_UI.md` §14**).
- **Public read:** Anonymous browsing works.
- **Bookmarks:** Save/remove **flat** list works for authenticated users.

---

## 5. Feature parity matrix

| Current feature | v2 equivalent | Keep / Simplify / Defer / Delete | Notes / risk |
|-----------------|---------------|-----------------------------------|----------------|
| **Modal article detail** (`ArticleModal`, `openArticle` query) | **Article page** | **Delete** default modal UX | SEO++, clarity++; UX change |
| **Drawer / secondary detail** (`ArticleDrawer`) | Optional **defer** | **Defer** | Reduce duplication |
| **Feed infinite scroll** (`useInfiniteArticles`, **`ArticleGrid`**) | **fetch + observer** | **Simplify** | No TanStack on feed |
| **Virtualization** (`HomeGridVirtualized.tsx`) | CSS/grid **or** virtual **defer** | **Simplify / Defer** | Perf validate after ship |
| **Tags & filters** (`FilterStateContext`, **`CategoryToolbar`**) | URL state + server lists | **Keep / Simplify** | Dimensions may shrink |
| **Content stream** (`standard`/`pulse`/`both` on **`Article.ts`**) | URL **`stream`** + **single DB row per article** | **Keep** | Mongo **`both`** → Postgres **`standard`** (**§12.2**) |
| **Bookmarks** (`Bookmark.ts`) | Flat **`bookmarks`** | **v2-only** | **No Mongo import** |
| **Bookmark folders** (`BookmarkCollection.ts`, **`bookmarkCollections`**) | — | **Delete** | User communication if any used folders |
| **Collections** (`Collection.ts`) | **`community_collections`** | **Simplify** | No followers |
| **Search** (`searchController.ts`) | FTS **`§6.2a`** + suggestions API | **Keep — launch quality** | Header suggestions + committed (**PRODUCT §11**) |
| **Markdown** (`MarkdownRenderer`, cards excerpt) | Server detail + lean cards | **Keep / Simplify** | |
| **Media / masonry** (`ArticleGrid` masonry, **`layoutVisibility`**) | Primary image + grid | **Defer** masonry | |
| **In-app notifications** (legacy **`notificationsRouter`**) | **New** bell + **`§6.6`** — **not** a port | **Replace** | Legacy UI/router **not** carried forward |
| **Push** (`web-push`, **`PushSubscription`**) | None PMF | **Defer** | |
| **Admin config** (`AdminConfigPage`, **`MarketPulseIntroConfig`**, etc.) | Minimal admin + hardcoded copy | **Simplify / Defer** | Large **`adminController`** shrink |
| **Unfurl / OG** (`unfurl`, **`open-graph-scraper`**, **`ogMiddleware`**) | **`generateMetadata`**, admin-only fetch | **Simplify** | SSRF surface shrinks if OG scraping trimmed |
| **Analytics / perf** (`PlausibleRouteTracker`, **`routeProfiling`**) | Replace with **`@vercel/analytics`** + Web Vitals **or** Plausible | **Keep / Simplify** | Don’t lose observability on cutover |

---

## 6. Migration strategy (phases)

### Phase 0 — Audit, freeze, parity definition

- Inventory **`server/src/models/*.ts`** used in production paths vs dead scripts.
- Freeze **blueprint** + **this plan**; list **must-have URLs** (SEO, shared links).
- Define **acceptance checks**: feed loads, pulse toggle, collection pages, bookmark CRUD, article detail, admin publish.

### Phase 1 — Postgres schema + RLS skeleton

- Apply migrations in Supabase (tags, articles, joins, collections, bookmarks) — indexes per blueprint **`§13`**.
- **RLS:** `bookmarks` user-scoped; public read policies for published content — align with blueprint **§14**.
- **`content_stream` / `both`:** blueprint **`§12.2`** — **`both`** → **`standard`** if present.
- **No production cutover yet.**

### Phase 2 — ETL: Mongo → Postgres

- Scripts read Mongo (**mongoose** or raw export), write Postgres with **`legacy_mongo_id`** mapping tables.
- Dry-run on staging DB; row-count + checksum samples.
- **Feed UI is not blocked** on ETL (blueprint Phase **1b**): dev may use empty DB + skeletons until staging ETL passes.

### Phase 3 — Next app scaffolding

- New **`web/`** sibling folder (frozen — `BLUEPRINT` §2.a) with own `package.json` — structure per `NUGGETS_V2_BLUEPRINT.md` (middleware matcher, `remotePatterns`, cursor pagination). NOT repo root, NOT `apps/web` monorepo.
- **Not done yet:** full admin parity, notifications.

### Phase 4 — Public read surfaces

- **`/`** Home + **`stream`/`tags`/`q`**, **`/nuggets/[id]/[slug]`**, **`/collections/**`.
- Connect to Supabase read-only (anon) paths.
- Performance pass: **RSC payload discipline**, image loader.

### Phase 5 — Auth + bookmarks + writes

- Supabase **password** flows.
- **Bookmarks** Server Actions / handlers + RLS tests.
- **Admin** article CRUD + publish + **`revalidateTag`**.

### Phase 6 — Cutover rehearsal

- Staging **DNS / preview** domain full QA.
- Compare random articles/tags vs Mongo source.

### Phase 7 — Production cutover + cleanup

- **Writes freeze (explicit owner):** Name **who authorizes** halting Mongo writes during cutover (**typically founder**). Prefer **one short freeze window** (**~1–2h**) over undocumented incremental deltas unless operational reality forces incremental sync — **document the chosen pattern** before launch day.
- Maintenance window: **final incremental sync** if needed (small delta) **or** freeze writes briefly (**same decision as above**).
- Switch **`nuggets.one`** to Vercel deployment.
- Keep **Mongo snapshot read-only** + backups **N days** for rollback.

### Deliberately not done before launch

- BullMQ Redis pipelines, push, bookmark folders, full **`adminController`** parity, **`profile`** social features.

---

## 7. Risk register

| Risk | Why | Likelihood | Impact | Mitigation |
|------|-----|------------|--------|------------|
| **Schema mismatch** (`both` streams, tag dimensions) | Query logic diverges from Mongo behavior | Med | High | Explicit mapping doc + feed/query tests on staging |
| **Route / SEO breakage** | Old **`/article/:id`** bookmarks SEO — greenfield may omit redirects (**BUILD PR-16** optional) | Low | Med | Add **`legacy_mongo_id`** handler **only if** inbound links matter |
| **Missing parity** (search suggestions, filters) | Users notice regressions | Med | Med | Prioritized QA checklist + “known limitations” |
| **Cache invalidation bugs** | Stale pulse/main feed | Med | Med | Tag-level **`revalidateTag`** + pulse TTL 120–300s validated |
| **RLS/auth misconfiguration** | Data leaks or broken bookmarks | Med | Critical | Supabase policy tests; never expose service role |
| **Data loss** | Failed migration batch | Low | Critical | Backup Mongo first; idempotent ETL; verify counts |
| **Slug canonical errors** | Duplicate slugs, bad redirects | Med | Med | Unique index `(slug)` + slug collision rules |
| **LLM implementation drift** | Wrong `'use client'` boundaries | High | Med | Blueprint guardrails + PR checklist |
| **Performance regression** | Heavy markdown on list, missing virtualization | Med | Med | Lighthouse budgets + `@vercel/analytics` |

---

## 8. Cutover plan

### 8.1 Approach

- **Recommended:** **Staging parity first**, then **hard cutover** (DNS **or** Vercel project swap) — **not** long-lived dual-user-facing backends.

### 8.2 Pre-switch validation

- **Smoke:** `/`, `/?stream=pulse`, `/nuggets/{known}`, `/collections`, auth login, bookmark add/remove.
- **Data:** Sample **articles**, **tags**, **collections**, **bookmarks** counts vs Mongo export.
- **SEO:** **`generateMetadata`**, canonical URLs on article pages.
- **Security:** RLS spot-tests with anon vs user JWT.

### 8.3 Compare old vs new

- Scripted **diff**: random **N** articles — title, excerpt, primary image URL, tag slugs, **`contentStream`** semantics.
- **Collections:** entry counts per collection.

### 8.4 Rollback

- **Revert DNS** to previous deployment (current stack).
- **Restore Mongo** from snapshot if post-cutover writes occurred on wrong system (avoid dual-write confusion — **freeze writes** during cut window).

### 8.5 Gates

- **Maintenance banner** optional during final sync.
- **No** complex feature flags needed if single release — optional **`NEXT_PUBLIC_READ_ONLY`** only if risky migration retries.

---

## 9. What to keep temporarily

| Asset | Role |
|-------|------|
| **Mongo backup + snapshot** | Rollback reference |
| **Express deployment artifact** | Rollback instance until confidence window ends |
| **`legacy_mongo_id` columns** | Redirects and support |
| **Optional read-only Mongo viewer** | Internal compare — **not** user-facing |

**Avoid:** Running **Express API** and **Next** as parallel **write** paths — dual-write is high-risk.

---

## 10. What to delete in v2 (target codebase)

- **SPA shell:** **`src/App.tsx`** routing model (post-cutover archive or delete branch).
- **`react-router-dom`**, **Vite-only** entrypoints when Next owns prod.
- **`useInfiniteArticles` + TanStack on feed** — removed per blueprint.
- **`BookmarkCollection`** APIs and **`CollectionSelector`** folder UX.
- **`FeedLayoutPage` / `ResponsiveLayoutShell`** if still present — superseded.
- **Express `server/`** — decommission after migration **or** keep archived repo snapshot only.
- **Redis, BullMQ, rate-limit-redis** from **runtime** dependency graph if unused post-cutover.
- **Dead admin routes** not in PMF admin scope.

---

## 11. Build order after migration plan approval

**Precedence:** This section is **stakeholder / milestone narrative**. **`docs/NUGGETS_V2_BUILD_EXECUTION.md`** (**PR-01 → …**) is the **authoritative merge order** for engineers — **follow `BUILD` when the two differ.**

Recommended **milestones / PR sequence**:

1. **Supabase schema + RLS** (articles, tags, joins, collections, bookmarks).
2. **Mongo → Postgres ETL** + validation harness (staging).
3. **Next skeleton** — layout, middleware matcher, Cloudinary **`remotePatterns`**, health route.
4. **Public feed + article detail** (read-only).
5. **`stream=pulse` + revalidation** tuning.
6. **Collections** read paths.
7. **Supabase Auth** + flat bookmarks.
8. **Admin CRUD** + **`revalidateTag`** wiring.
9. **Redirects** from legacy **`/article/:id`** (mongo id) if needed.
10. **Cutover playbook** + monitoring — merge **launch PR**.

---

## 12. Open decisions (founder / tech lead)

1. ~~**Next.js repo layout:**~~ **CLOSED** — `web/` sibling folder with own `package.json` (`BLUEPRINT` §2.a). Monorepo migration is post-cutover and optional.
2. **Public profiles (`/profile/:userId`):** (**Recommend defer**) **`/profile/*`**, **`/myspace`** → **`/`** or **`/bookmarks`** when authed — no **`MySpacePage`** parity PMF.

**Closed:** **`§3.7`** — **fresh Supabase accounts only** (founder: **no** Mongo user migration). **Bookmarks route** **`/bookmarks`** (**greenfield** — **no** legacy redirects). **`content_stream`:** Mongo **`both`** → **`standard`** (**§12.2**). **Phase 1 ETL:** **`articles` + `tags` + `collections` (+entries)** — **no** bookmarks/users import. **Multi-tag filter:** **AND** (**PRODUCT §11** — confirmed).

---

*End of migration planning document — implementation and execution prompts are out of scope here.*
