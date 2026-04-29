# Nuggets v2 — Product Behavior & UI/UX Specification

**Status:** Product / UX source of truth for implementation  
**Audience:** Founders, design-minded engineers, LLM-assisted build  
**Does not replace:** `docs/NUGGETS_V2_BLUEPRINT.md` (engineering safeguards), `docs/NUGGETS_V2_MIGRATION_PLAN.md`, `docs/NUGGETS_V2_BUILD_EXECUTION.md` — **extends** them with **what users see and do**.

**Source-of-truth:** When docs disagree on **UI behavior, tabs, copy, tap targets, search UX**, **this file wins** (within blueprint constraints). **Vocabulary & frozen guardrails** — **`§0`** (subsections **§0.1**–**§0.14**). **Hard perf numbers & admin validation** — **`BLUEPRINT` §5.4**, **`BLUEPRINT` §15.1**.

**Baseline codebase:** Project-Phoenix (`nuggets_v60`) — patterns referenced include **`NewsCard`** (+ **`GridVariant`**, **`FeedVariant`**, **`MasonryVariant`**), **`ArticleGrid`** (`expanded` URL ↔ **`ArticleDrawer`** sync), **`ArticleModal`**, **`BookmarkButton`**, **`CollectionSelector`**, **`Header`** / **`MobileBottomNav`**, **`FilterStateContext`**, **`ShareMenu`** / **`sharing/`**.

---

## 0. Vocabulary & frozen decisions (LLM guardrails)

### 0.1 Surface names — use consistently in UI copy

| Term | Meaning |
|------|---------|
| **Home** | **`/`** — primary discovery grid (**not** “feed” in user-facing copy). |
| **Bookmarks** | **`/bookmarks`** — saved nuggets (**not** “Saved” as the nav label). |
| **Nugget** / **Nugget page** | The reading unit; route **`/nuggets/[id]/[slug]`**. Do **not** say “article page” in UI. |
| **Source** | Outbound attribution control for **`source_url`** — label **Source** or **View source**, **`target="_blank"`**. |

Code and SQL may keep **`articles`** / **`article_*`** internally.

### 0.2 Admin — first UI slice (DECIDED)

**In:** nugget (**`articles`**) CRUD, tags (assignment + create as needed), **`content_stream`**.  
**Out:** **`community_collections`** — **no** admin UI in the first slice; maintain lists via **Supabase Studio / SQL** until a dedicated later PR (**`BLUEPRINT` §15**, **`BUILD` PR-14**).

### 0.3 In-app notifications — launch (DECIDED)

**Launch-required:** sticky **bell** + panel + prefs + batching/caps per **`BLUEPRINT` §6.6**. **Forbidden:** disabled bell, empty “coming soon” shell. **Performance:** bell/notifications **off** the **`/`** critical path (lazy panel + isolated APIs).

**Panel behavior — authoritative checklist:** **`BLUEPRINT` §6.6b** — desktop popover (**~380–420px**), mobile **bottom/full-screen sheet**, read-state **on row click** (**not** on panel open), **Mark all as read**, badge **`9+`**, **same-tab** nugget navigation, **10–15** initial rows + scroll/load-more, **no websocket realtime**, **no push banners**, **no** **`/notifications`** route PMF.

### 0.4 Nugget page — required vs excluded chrome (DECIDED)

| Launch | Not launch |
|--------|------------|
| Title, hero, markdown **body**, **Source**, **publish date**, **tags**, **bookmark**, **share** | **Reading time** |
| **Author/curator** as **branded mark** (**§0.10** — **not** user initials) | **Related nuggets** rail |
| Single-column **magazine** layout | **Sidebar** / dashboard metadata column |

### 0.5 Search — when `q` hits the URL (DECIDED)

| User action | Behavior |
|-------------|----------|
| **Enter** or explicit **Search** control | Commits **`q`** to URL — result grid on **Home** |
| **Pick a nugget** from live suggestions | **Go to Nugget page** — **does not** commit **`q`** |

Debounced typing drives **suggestions only** until one of the rows above.

### 0.6 Empty states — copy & treatment (DECIDED — do not freestyle)

| Surface | Behavior & copy (adapt tone but keep intent) |
|---------|-----------------------------------------------|
| **Home — `q` set, zero results** (committed search returned nothing) | Keep page chrome (header, chips). **Headline:** *No nuggets match "{q}".* **Primary CTA:** **Clear search** (clears `q` only — preserves `stream` and `tags`). **Secondary:** **Clear all filters** (clears `tags` + `q`). |
| **Home — filters set (no `q`), zero results** (tags too narrow) | Keep page chrome. **Headline:** *No nuggets match these filters.* **Primary CTA:** **Clear filters** (clears `tags` + `q`; preserves `stream`). Secondary: link to **Home** base `/`. |
| **Home — feed fetch error** (network / 500) | Same shell. **Headline:** *Couldn't load nuggets.* **Inline button:** **Retry** (re-issues the current `getFeedPage`). **Not** a toast, not a modal. |
| **Bookmarks — fetch error** | Same shell. **Headline:** *Couldn't load saves.* **Inline button:** **Retry**. Mirrors feed error pattern — single error component reused. |
| **Nugget page — not found** (`notFound()` — bad `id` / deleted) | Single full-width message: *This nugget isn't available.* **Primary:** **Home** (`/`). **Do not** show an endless skeleton. |
| **Bookmarks — empty (authenticated, no rows)** | Same grid shell + empty illustration/placeholder. **Headline:** *Nothing saved yet.* **Body:** *Bookmark nuggets from Home to revisit them here.* **Primary:** browse **Home** (`/`). |
| **Bookmarks — anonymous direct hit** (`/bookmarks` while logged out) | **Server redirect** to `/login?next=/bookmarks` (NOT 404, NOT empty state). `BLUEPRINT` §0.7 / §2.a. |
| **Collections list** (`/collections`) | **Headline:** *No collections yet.* **Body:** one line that collections are **editorial lists** added over time (no "follow" CTA). Optional link back to **Home**. |
| **Notifications panel** | Align **`BLUEPRINT` §6.6b:** empty inbox — **Headline:** *No notifications yet.* **Body:** *When new nuggets are published, they'll appear here.* **Do not** reference collection-follow (not a v2 feature). "All caught up" **only** when inbox loaded and row count zero **after** reads — not confused with "never had notifications". |

### 0.7 Logged-out — bookmark affordance (DECIDED)

**Single pattern everywhere (card + Nugget page):** Tapping **bookmark** while logged out `navigate`s to **`/login?next=<current-path-encoded>`** — **no auth modal** opened from bookmark PMF (avoids stacking modals with Next App Router). After successful login, return user to `next` (bookmark action **not** auto-applied — user taps bookmark again unless you implement post-login intent later).

**`next=` whitelist (security freeze — open-redirect guard):** Server-side validation rejects `next` values that don't start with `/` OR start with `//` OR contain a scheme (`http:`, `javascript:`, etc.). On rejection, fall back to `/`. Apply in the login Route Handler **and** in any client-side redirect logic (defense-in-depth).

**No** toast-only UX as the **sole** feedback — redirect is explicit enough; optional **inline** disabled/tooltip state on icon: *Sign in to bookmark*.

### 0.8 Post-login return (**`next=`**) — bookmark intent (DECIDED)

After **`/login?next=`** succeeds, user lands on **`next`**. **Do not** auto-bookmark; **no** `localStorage` intent queue; **no** “we saved your intent” toast. User taps bookmark again — **`§0.7`**.

### 0.9 Search — Escape key (DECIDED)

**Escape** closes the suggestions panel and resets the **input field** to the **last committed `q`** from URL (or empty). **Does not** navigate.

### 0.10 Author / avatar on Nugget page (DECIDED)

**No** public user profiles PMF — **no** user-derived initials. Use a **static branded mark** (e.g. Nuggets **“N”** monogram) where an avatar circle is needed. **Community collection** detail: **first letter** of **`curator_name`** in a simple circle.

### 0.11 Notification row anatomy (DECIDED)

Align **`BLUEPRINT` §6.6b**. **Single-article row:** stream chip (**Nuggets** / **Market Pulse**) + **article title** (2-line clamp) + relative time (**2h ago**) + unread indicator (left accent **or** dot). **Tap:** same-tab **`/nuggets/[id]/[slug]`**; mark row **read**. **Batch / summary row:** **"N new …"** line (**stream**-labeled) + relative time + **no** article title. **Tap:** same-tab **`/?stream=`** matching that digest (**standard** / **pulse**); mark **all** rows in that batch **`read`** ( **`batch_key`** alignment — **`BLUEPRINT` §6.6**).

### 0.12 Bookmarks — stale targets (DECIDED)

If some bookmarked **`article_id`** rows are **deleted or unpublished**, list shows **remaining** items only; optional **one-line** helper: *Some saves are no longer available* when the API returns fewer rows than expected — **not** the same empty state as “never bookmarked” (**§0.6**).

### 0.13 `/account` — minimal PMF (**DECIDED)

**Gated** route — add `/account` to `middleware` matcher (`BLUEPRINT` §5.1). **Include:** email (read-only — from `auth.users`), **display name edit** (writes to **`profiles.display_name`** — `BLUEPRINT` §12.3a / §2.a; do **not** write to `auth.users.user_metadata` from the client), **change password** link (Supabase flow), **notification preference toggles** (§6.6 / `notification_preferences` — lazy-created on first read per §2.a). **Exclude:** avatar upload, social links, public profile URL, account deletion (defer post-PMF — needs RLS cascade thinking).

### 0.14 YouTube on Nugget page (DECIDED)

**Hero / poster** (`hero_thumb_url`) above the fold; primary **Watch on YouTube** `target="_blank"`. **Optional** iframe **only** below fold behind explicit **Load video** — **no** autoplay; **no** inline player on Home cards (§8 alignment).

**Body timestamp links** (e.g. `[2:34](#yt=154)` in `content_markdown`) load the embed (if not already loaded) and **seek the player to that second** — full state machine and implementation rules in **`BLUEPRINT` §6.3a**. Authors author timestamps with the `#yt={seconds}` URL-fragment convention; clicking is handled by a single client island, not per-link wiring.

---

## 1. Executive recommendation

**Overall UX direction:** Nuggets v2 should feel like a **fast, dense, editorial reader** — not a social timeline app, not a workspace app. One primary reading surface (**grid-forward Home**), **URL-addressable discovery** **`stream`** + **`tags`** + **`q`** (**blueprint §6.2**), **full-page Nugget page** reading with excellent typography and stable media, and **minimal chrome** until the user needs actions (bookmark, share, **Source**).

**What must change from the current app (and why):**

| Current pattern | v2 recommendation | Why |
|-----------------|-------------------|-----|
| **Heavy `NewsCard`** stacking modals (lightbox, link preview, edit, duplicate, report, tag popover) | **Thin card shell** + actions only where PMF requires | Performance, LLM-safe scope, fewer interaction traps |
| **Modal/drawer-first reading** (`ArticleModal`, **`ArticleDrawer`** + **`openArticle`** / **`expanded`**) mixed with routes | **Canonical `/nuggets/[id]/[slug]`** as primary reading surface | Shareable URLs, SEO, RSC-friendly blueprint |
| **Client-only filter state** (**`FilterStateContext`**) easy to drift from URL | **`nuqs`** — filters **are** the URL | Refresh-safe, shareable filters |
| **`BookmarkCollection`** / **`CollectionSelector`** folder UX | **Flat `/bookmarks`** only for PMF | Blueprint scope |
| **Multi-variant layouts** (grid / feed / masonry) as peers | **Single dense grid** default + defer masonry | Velocity + consistent density |

The current app optimized for **feature richness** (admin-adjacent flows embedded in cards). v2 optimizes for **read speed, clarity, and premium feel** first — features return only when they pay for themselves.

### 1b. Resolved: detail-first vs outbound-first (canonical — read before §6)

Two interaction stories appeared across drafts; **only one is valid for v2**:

| Narrative | What it means | v2 status |
|-----------|----------------|-----------|
| **Outbound-first** (legacy sketch) | Primary interaction opens **external source** in **`target="_blank"`**; feed stays mounted; scroll position trivially preserved. | **Rejected** for v2 PMF |
| **Detail-first** (canonical) | Primary interaction navigates to **`/nuggets/[id]/[slug]`**; sharing and OG use **one canonical URL**; **secondary** “Source” link may open externally. | **Required** |

**Why we chose detail-first:** Shareable canonical URLs, SEO and Open Graph on one page, simpler RSC story (`docs/NUGGETS_V2_BLUEPRINT.md`), and one clear reading surface. Scroll preservation via **staying on SPA** is traded for **proper nugget routes** — **Back** returns to **Home** (`/`); **Next.js App Router often does not restore prior browse-grid scroll position** (unlike some classic SPAs). **Accept** landing toward the **top of the grid** after Back for PMF; optional later: explicit restoration — **not** launch-blocking.

**Implementation rule:** Card **`onClick`** / primary link → **internal navigation** to detail. **Never** make the whole card a raw external `<a href={source}>`. A separate **“Source”** control may use **`target="_blank"`**.

---

## 2. Product UX principles

1. **Speed is a feature** — Perceived performance (`docs/NUGGETS_V2_BLUEPRINT.md` §8 skeletons, §9 CLS) matters as much as raw ms.
2. **URL is truth for discovery** — **`stream`**, **`tags`**, and committed **`q`** live in query params on **`/`** (`nuqs`) — **blueprint §6.2**. Debounced **suggestions** while typing; **committed search** updates **`q`** (shareable).
3. **One mental model for reading** — Home discovers → nugget page reads → optional outbound to source. No competing “tiles open drawer vs modal vs new tab” unless strictly necessary by breakpoint.
4. **Density over whitespace theatre** — Prefer **information-rich grids**; breathe only where readability degrades (detail body, legal).
5. **Read-heavy, not social** — No follower counts, reactions, or comment threads in PMF; **bookmark** is the lightest viable personal signal.
6. **Accessible by default** — Touch targets, focus rings, legible contrast — non‑negotiable (see §15).

---

## 3. Design system direction

**Visual direction:** **Quiet editorial premium** — neutral zinc/slate surfaces, **one brand accent** (Nuggets yellow `#F5B800` range per existing identity), restrained borders, **no loud gradients** except deliberate empty-image placeholders.

### Color system

| Token role | Light | Dark | Notes |
|------------|-------|------|--------|
| **Background** | `zinc-50` / white | `zinc-950` | Page chrome |
| **Surface / card** | white | `zinc-900` | Cards elevated subtly |
| **Border** | `zinc-200` | `zinc-800` | 1px default |
| **Text primary** | `zinc-900` | `zinc-100` | |
| **Text muted** | `zinc-500` | `zinc-400` | Meta, timestamps |
| **Accent / brand** | `#F5B800` (and darker hover) | Same hue, slightly softer on hover | Chips active, logo mark, focus adjunct |

### Light / dark mode

- **User-toggle + `prefers-color-scheme` initial** — match current **`App.tsx`** / header behavior intent.
- **Persist choice** (`localStorage` + no flash) — implementation detail; outcome: no wrong theme on navigation.
- **Implementation owner:** `docs/NUGGETS_V2_BUILD_EXECUTION.md` — **`next-themes` (or equivalent) + CSS variables** landed **before or with PR-06** so **`dark:`** isn’t sprayed inconsistently. **If** theme slips: move bullets here to **`§17` Deferred** explicitly — **do not** leave half-specified.

### Typography

- **Sans:** **Inter** (or current v1 preference) via **`next/font`** — blueprint §10.
- **Scale:** Title on card `text-sm`–`text-base` **semibold**; excerpt `text-xs`–`sm` **leading-relaxed**; detail page title `text-2xl`–`text-3xl`, body `text-base` `prose` max-width ~65ch.

### Spacing scale

- Use **4px base** (Tailwind default): card gap **`gap-3`** dense feed **`gap-4`** comfortable collections hero.
- Page horizontal padding: **`px-4`** mobile, **`lg:px-6`** desktop — align with **`ArticleGrid`** / **`HomePage`** feel.

### Border radius

- **Cards:** `rounded-xl` (12px) — consistent with prior blueprint tokens.
- **Chips / pills:** `rounded-full`.
- **Inputs / menus:** `rounded-lg`.

### Shadows

- **Minimal:** `shadow-sm` on cards **optional**; prefer **border + bg** for calm editorial look. Use **`shadow-md`** only for elevated overlays (dropdowns), not every card.

### Density rules

- **Feed:** **High density** — user preference explicit; maximize visible nuggets above fold without cramming unreadable text.
- **Detail:** **Lower density** — generous line-height and paragraph spacing.

### Card hierarchy

1. **Media block** (top, fixed aspect).
2. **Meta row** (tags/stream badge/date — subtle).
3. **Title** (dominant).
4. **Excerpt / quote** (bounded lines).
5. **Footer actions** (source link affordance, bookmark — tertiary).

### 3.1 Card spec (paste-ready — single source of truth)

This table consolidates everything else in §3 / §4 / §5 into one block UI components reference directly. **Deviation requires a doc edit, not a one-off override.**

| Property | Mobile (`< 640px`) | Tablet (`640–1024px`) | Desktop (`≥ 1024px`) |
|----------|--------------------|------------------------|------------------------|
| **Grid columns** | 1 | 2 | 3 |
| **Grid gap** | `gap-3` (12px) | `gap-4` (16px) | `gap-4` (16px) |
| **Page horizontal padding** | `px-4` (16px) | `px-4` | `lg:px-6` (24px) |
| **Card width** | full column (fluid) | column / 2 | column / 3 |
| **Image aspect ratio** | `aspect-video` (16:9) | same | same |
| **Image `sizes`** | `100vw` | `50vw` | `33vw` |
| **Card padding (text region)** | `p-4` (16px) | `p-4` | `p-4` |
| **Card border radius** | `rounded-xl` (12px) | same | same |
| **Card border** | `1px solid` border token | same | same |
| **Card background** | surface token (white / zinc-900) | same | same |
| **Card shadow** | none default; `shadow-sm` on hover only | same | same |
| **Title** | `text-base font-semibold leading-snug` | same | `text-base` |
| **Title clamp** | 2 lines | 2 lines | 2 lines |
| **Excerpt** | `text-sm leading-relaxed text-muted` | same | same |
| **Excerpt clamp** | 3 lines | 3 lines | 4 lines |
| **Meta row** (date · stream chip · primary tag) | `text-xs text-muted gap-2` | same | same |
| **Footer** (Source link, bookmark) | `text-xs gap-2` | same | same |
| **Min tap target** | 44×44px on bookmark / source icon | same | same |
| **Hover state** | none on touch | none | `border` lightens + `translate-y-px` (max 1px), `shadow-sm` |
| **Focus ring** | `ring-2 ring-brand/40` on keyboard focus | same | same |
| **Skeleton** | identical dimensions, `bg-skeleton` + `animate-pulse` | same | same |

**Fixed rules across breakpoints:**

- **Card height is fluid** — driven by content. **Image region is fixed** by aspect ratio so card height varies only by title/excerpt line count.
- **Title is required** — single nugget shape (§5 Standard card). No media-only-without-title cards.
- **One stream chip max** — never both standard and pulse.
- **Tag chip on card** — show **at most one** primary tag chip; full tag rail is on Home, not on cards.
- **No `react-markdown`** inside a card — cards always use plain-text `excerpt` from DB (`BLUEPRINT` §17 forbidden).
- **No per-card popovers** PMF (no tag popover on hover, no link unfurl preview, no edit menu) — keeps interaction model thin (§16).

### 3.2 Theme tokens — exact mapping (paste-ready)

Implemented via `next-themes` + Tailwind `dark:` + CSS variables (§3 / `BUILD` PR-03b). Tokens stay stable across components — never inline hex except for the brand accent.

| Token (CSS var) | Light | Dark | Tailwind class hint |
|-----------------|-------|------|---------------------|
| `--background` | `#FAFAFA` (zinc-50) | `#09090B` (zinc-950) | `bg-background` |
| `--surface` | `#FFFFFF` | `#18181B` (zinc-900) | `bg-surface` (cards, popovers) |
| `--border` | `#E4E4E7` (zinc-200) | `#27272A` (zinc-800) | `border-border` |
| `--text` | `#18181B` (zinc-900) | `#F4F4F5` (zinc-100) | `text-foreground` |
| `--text-muted` | `#71717A` (zinc-500) | `#A1A1AA` (zinc-400) | `text-muted` |
| `--brand` | `#F5B800` | `#F5B800` (same) | `text-brand` / `bg-brand` |
| `--brand-hover` | `#D99E00` | `#FFCA28` | `hover:bg-brand-hover` |
| `--ring` | `rgba(245,184,0,0.4)` | same | `ring-brand/40` |
| `--skeleton` | `#F4F4F5` (zinc-100) | `#27272A` (zinc-800) | `bg-skeleton animate-pulse` |
| `--danger` | `#DC2626` (red-600) | `#F87171` (red-400) | `text-danger` |

**Brand discipline:**

- `--brand` is for: active stream chip, active nav tab indicator, focus ring, logo monogram, **primary CTA buttons**.
- **Not** for: card title, body text, default borders, large fills (avoids loud yellow surfaces).
- **No gradients** anywhere except the deterministic image-placeholder fallback (`BLUEPRINT` §9, derived from first tag).

### 3.3 Header & global chrome (frozen)

**The header stays thin.** v1 nested filter affordances, search overlays, sub-toolbars, and stream switchers in the header — that chrome breadth is a primary cause of the click lag the founder described. v2 collapses the header to four elements; everything else lives in the page body chrome (stream tabs, chip rail — see §11.1).

#### Desktop header (`≥ 1024px`)

| Slot | Content |
|------|---------|
| **Left** | Logo (Nuggets monogram + wordmark) — `next/link` to `/` |
| **Center** | Inline search input (~480px max width) — focus opens suggestions panel below; commits `q` on Enter |
| **Right** (in order) | Theme toggle · Sign-in **or** notification bell (when authenticated, §6.6) · Account avatar (when authenticated, optional placeholder mark per §0.10) |

- Height: `h-14` (56px). Border-bottom: `1px solid var(--border)`. Background: `var(--surface)`.
- **No** filter affordances in the header (no sort, no chip overflow, no stream switcher — stream lives in body chrome).
- **No** sticky behavior PMF — header scrolls away on scroll-down (more vertical room for grid). Optional later: scroll-up reveal pattern. Don't ship it PMF.

#### Mobile header (`< 768px`)

| Slot | Content |
|------|---------|
| **Left** | Logo (monogram only — wordmark hidden) |
| **Right** | Search icon (opens full-screen overlay — `MobileSearchOverlay` analog) · Sign-in **or** bell · Account avatar (auth) |

- Height: `h-12` (48px). Same border / background as desktop.
- **Bottom nav persists** (§14) — four destinations: Nuggets · Market Pulse · Collections · Bookmarks (auth-only).

#### Footer (every page)

| Element | Notes |
|---------|-------|
| Disclaimer copy | Site-wide, single line, muted (§15 Disclaimer / `BLUEPRINT` §2 closed decision) |
| Legal links | Terms · Privacy · Contact — from `legal_pages` (`BLUEPRINT` §15) |
| Brand line | © Nuggets · year |

- **No** newsletter signup, no app-store badges, no social-icon strip PMF.
- Footer renders as static Server Component on every route — no client JS.

#### Visual hierarchy on Home (cross-reference)

Header → **Stream tabs** → **Chip rail** → **Active filters** (conditional) → **Grid** — full layout in §11.1. Header is intentionally not the place where filtering happens.

### 3.4 Explicit layout recommendations

| Element | Recommendation |
|---------|------------------|
| **Card width** | Fluid in CSS grid: **1 col** phone, **2** md, **3** xl (same breakpoints family as blueprint image `sizes`). |
| **Card height** | **Not fixed px** — height follows content; **media region fixed aspect** prevents jitter. |
| **Image aspect** | **`aspect-video` (16:9)** default for feed; detail hero may be **slightly taller** (`aspect-[21/9]` optional) — one rulebook, don’t mix aspects within same feed variant. |
| **Chips / tags** | Small `text-xs`, neutral bg, **one accent chip** max for “stream” if shown. |
| **Feed spacing** | **`gap-3`** grid; internal card padding **`p-3`** or **`p-4`**. |
| **Hover / focus / active** | **Hover:** subtle border lighten + **optional** `translate-y-px` (max 1px) — no aggressive lift. **Focus:** visible ring `ring-2 ring-brand/40`. **Active:** press state scale **not** required (reduce motion friendly). |

---

## 4. Feed layout system

### Nugget Feed (`/?stream=standard`)

- **Layout:** **Dense responsive grid** — priority surface for high scan rate.
- **Columns:** 1 / 2 / 3 by breakpoint (same as blueprint §9 first-row priority logic).
- **No masonry for PMF** — defer **`HomeGridVirtualized`** masonry complexity unless metrics demand.

### Market Pulse (`/?stream=pulse`)

- **Same grid system** as standard — **different data slice + fresher cache**, not a different chrome. Optional **micro-label** (“Pulse”) on card or section header only — avoid building a second layout engine.

### Collections

- **List (`/collections`):** **Slightly more spacious** than feed — collections are browsed less aggressively than nuggets; card = cover + title + short line + curator.
- **Detail (`/collections/[id]`):** **Same nugget grid density** as main feed for article cards inside — editorial consistency.

### Bookmarks (`/bookmarks`)

- **Same grid as Home** — familiar muscle memory; empty state is instructional (“Bookmark nuggets to revisit them later”) not decorative filler.

### Grid vs list

- **Default:** **Grid only** for Home and Bookmarks.
- **Optional later:** Compact **single-column list** for accessibility / power users — **post-PMF**.

---

## 5. Nugget card variants

### Standard card (default)

| Aspect | Spec |
|--------|------|
| **Purpose** | Default discovery everywhere |
| **Content** | Image (or placeholder), **title required** (single nugget type — **no** media-only-without-title), excerpt (clamped 3–4 lines), meta (date, primary tag), source affordance |
| **Image** | 16:9, lazy except first row per §9 |
| **Actions** | Bookmark **login-only** — logged-out users see **sign-in** path only; overflow menu **deferred** — optional **Share** icon PMF |
| **Use** | `/`, `/bookmarks`, inside collections |

### Compact card (optional PMF-late)

| Aspect | Spec |
|--------|------|
| **Purpose** | Search results sidebar / dense secondary surfaces |
| **Content** | Thumbnail small + title 2 lines + one meta |
| **Image** | 1:1 or 4:3 mini — **only if** introduced to avoid layout duplication bugs |

### Featured card (defer post-PMF unless editorial need)

| Aspect | Spec |
|--------|------|
| **Purpose** | Homepage hero strip or admin-picked spotlight |
| **Content** | Larger media, optional kicker |
| **Use** | Not required for launch |

### Pulse card

| Aspect | Spec |
|--------|------|
| **Purpose** | Same as standard — **badge-only differentiation** (“Pulse”) |
| **Avoid** | Separate interaction model — **same card component** |

---

## 6. Card interaction model

### Evaluation of current patterns

Today **`NewsCard`** orchestrates **`GridVariant`**, **`ArticleModal`**, **`ImageLightbox`**, **`LinkPreviewModal`**, etc. — powerful but **heavy for PMF** and hostile to the blueprint’s **full-page detail** strategy.

### Recommendation (decisive)

This table is **identical in intent** to **`docs/NUGGETS_V2_BLUEPRINT.md` §6.0** — no contradictions.

| Interaction | Recommendation |
|-------------|----------------|
| **Primary click** (card body / title / image) | **Navigate to `/nuggets/[id]/[slug]`** — full detail **everywhere** (desktop + mobile). |
| **Secondary: Source** | **Tertiary text link** (**Source**) on card footer opens **`target="_blank"` `rel="noopener"`** — does **not** replace primary click; power users skip detail when obvious. |
| **Modal / drawer** | **Do not use as default reader** in v2. Optional **future:** inline preview sheet **only** if metrics show detail-page abandonment — **not PMF**. |
| **Desktop vs mobile** | **Same primary behavior** — route navigation; avoid desktop-drawer / mobile-full mismatch (**`ArticleGrid`** `expanded` pattern replaced). |

**Why full page wins:** Canonical URLs for sharing, simpler mental model, aligns with **`generateMetadata`**, works with RSC skeleton → content story.

**Pros:** Shareable, bookmarkable tabs, back button semantics, less JS on Home.  
**Cons:** Loses “stay on grid” overlay feel — mitigate with **fast transitions** + **View Transitions** optional later.

### Share + bookmark placement

| Location | Bookmark | Share |
|----------|------------|-------|
| **Card** | **Yes** — icon button, doesn’t steal primary click | **Optional icon** PMF — **prefer detail row** if chrome crowded |
| **Detail** | **Yes** — sticky header or hero row | **Yes** — primary sharing surface |

**PMF:** **Nugget page** must have **Share + Bookmark** if card omits Share.

---

## 7. Shared URL landing experience

**Canonical share target:** **`https://nuggets.one/nuggets/{id}/{slug}`** (production domain + HTTPS).

### Behavior by inbound channel

All channels resolve to **the same Nugget page** — no separate “lite” HTML for WhatsApp. Differentiation is **OG preview quality**, not layout forks.

| Channel | User expectation | v2 behavior |
|---------|------------------|-------------|
| **WhatsApp** | Rich preview card | **OG title/description/image** must be correct (§10). Page loads **Nugget page** — first paint skeleton (blueprint §8), then content. |
| **Email** | Same link opens readable page | Identical — ensure **readable sans clutter** above fold: title + hero + first paragraph. |
| **LinkedIn / X** | Preview card | Same OG; **large enough `og:image`** min dimensions respected where possible. |
| **Direct browser** | Fast **Nugget page** read | Same; **no interstitial** for logged-out users. |

### Above the fold

- **Title**, **hero image or placeholder**, **first ~300 chars** of body or excerpt visible without scroll on typical phone.
- **Primary CTA:** Reading — not "Sign up". **Sign in** appears as **secondary** in header only.

### Crawler-render guarantee (frozen)

Social-platform crawlers (WhatsApp `WhatsApp/2.x`, `facebookexternalhit`, `LinkedInBot`, `Twitterbot`, `Slackbot`, etc.) hit `/nuggets/[id]/[slug]` and **must** receive a fully-rendered HTML response with all OG tags in `<head>` on the **first byte** — no client-side hydration required, no auth wall, no interstitial.

**Rules:**

- The detail route is a **Server Component** (`BUILD` PR-08); `generateMetadata` runs at request time and emits OG tags before any client JS loads.
- **Never** `redirect()` based on the User-Agent in this route — that breaks crawler caching.
- **Slug-mismatch redirect (301)** is the only redirect allowed on this route — that's expected by crawlers (they follow 301).
- **Draft / unpublished** nugget on this route returns **404** for all visitors including crawlers (no crawler-only preview path).
- **No** auth-gated content above the fold; OG `description` is a real excerpt, not "Sign in to read".

### Inbound shared link — fast first paint

The user clicked a link in WhatsApp/email/X — they expect the **content**, not chrome. Match server-render to that expectation:

| Element | Render order |
|---------|--------------|
| HTML `<head>` (OG, title) | byte 0 |
| Header chrome (logo, sign-in) | byte 0 (in initial HTML) |
| Title + hero + first paragraph of body | byte 0 (RSC streamed) |
| Below-fold body, related rails (none PMF) | streamed after |
| Bookmark button hydrated | post-paint client island |
| Theme toggle hydrated | post-paint client island |

**Forbidden:** loading skeleton on the server-rendered above-fold region. Skeleton appears only for client-hydrated islands (bookmark button, share menu).

### Logged-out vs logged-in

| Aspect | Logged-out | Logged-in |
|--------|------------|-----------|
| **Nugget** | Full read | Full read |
| **Bookmark** | **Sign-in affordance only** — **`/login?next=`** path (**§13**); **no** ghost-save state | Toggle save |
| **Related** | **Out** PMF — **§0.4** |

### Feel

- **Reading-first** — magazine **Nugget page**; **app-like** only in persistent nav (header / bottom nav).

---

## 8. Content-type behavior matrix

*v2 PMF assumes **primary thumbnail + title + excerpt + optional stored source URL** (for “Source” / OG — **not** the card’s primary tap target) — not full embed matrix on day one.*

| Type | Feed card | Detail page |
|------|-----------|-------------|
| **YouTube / video** | **Poster/thumbnail image** (16:9); **play affordance** subtle (icon overlay optional). **No inline player on card.** | **Frozen:** §0.14 — poster above fold + **Watch on YouTube**; embed **only** behind explicit load control below fold. **Timestamp links in body** (`[2:34](#yt=154)`) load + seek the embed — full spec `BLUEPRINT` §6.3a. |
| **Image** | Image fills aspect region; lightbox **defer** — tap goes to detail | Large image; pinch/zoom **defer** |
| **Blog / article** | Thumbnail + excerpt | **`prose`** markdown body; outbound **source** button |
| **Report / PDF** | Generic doc icon + title if no thumb | Link to PDF opens **new tab**; inline PDF viewer **defer** |
| **X post** | Screenshot/thumb if stored; else placeholder | Quote + link to post |
| **LinkedIn post** | Same | Same |
| **Podcast / audio** | Cover art 1:1 inside 16:9 letterbox OR centered square | Player embed **defer** — link to Spotify/Apple |

**Fallback:** Placeholder gradient/solid **§9** when **`hero_thumb_url`** missing — never broken image icon alone.

**Embed rule:** **No autoplay** ever. Embeds **below fold** or behind explicit tap **recommended**.

---

## 9. Sharing behavior

**Philosophy:** Sharing is **`canonical URL` + good preview`** first; in-app UI second.

### Canonical URL rules

- Always share **`/nuggets/[id]/[slug]`** — discovery URLs on **`/`** (`stream`, `tags`, `q`) are shareable **when intentional** (marketing may prefer clean nugget links — **default: share detail URL**).

### Share button placement

- **Detail:** **Primary** — header toolbar (**Share** + **Bookmark**).
- **Card:** **Secondary** — overflow or small icon; **omit on card** if it clutters — acceptable PMF.

### Actions

| Action | Behavior |
|--------|----------|
| **Native share** (`navigator.share`) | Preferred on mobile when supported — **`title` + `text` + `url`** |
| **Copy link** | Always available fallback — toast “Copied” |
| **WhatsApp** | **`https://wa.me/?text=` + encoded `title\nurl`** — optional explicit menu item |
| **X** | Intent URL or share sheet |
| **LinkedIn** | `linkedin.com/sharing/share-offsite/?url=` — match v1 **`ShareMenu`** / **`payloadBuilder`** intent |

### Share text strategy

- **Template:** `{title}` + line break + `{canonicalUrl}` — short; **no** keyword stuffing.

### UTM strategy

- **PMF:** **None** unless analytics clearly owned — avoid polluting canonical. Optional **`?utm_source=share`** **post-PMF** with discipline.

### Analytics events

- `share_initiated` { surface: card|detail, channel: native|copy|whatsapp|… }
- `bookmark_toggle` { surface, state }

### Launch-blocking OG validation gate (frozen — `BUILD` PR-17)

Bad OG previews on WhatsApp/X/LinkedIn are the most visible "the new app feels broken" moment. Treat as launch-blocking, not polish.

**Pre-launch validation script** (`web/scripts/validate-og.mjs`) — run against staging:

1. Fetch a **representative sample** of nuggets (e.g. 10): canonical URL `/nuggets/[id]/[slug]`.
2. Parse HTML `<head>`. Assert presence and shape of:
   - `<title>` non-empty, ≤ 70 chars
   - `<meta name="description">` non-empty, ≤ 200 chars
   - `<meta property="og:title">` matches `<title>`
   - `<meta property="og:description">` non-empty
   - `<meta property="og:image">` absolute HTTPS, host in CSP allowlist
   - `<meta property="og:url">` matches the canonical URL exactly (incl. slug segment)
   - `<meta property="og:type">` = `article`
   - `<meta name="twitter:card">` = `summary_large_image`
3. **HEAD-request the `og:image`** — assert `200`, `Content-Type: image/*`, body size < 5 MB.

**Manual checks (launch checklist):**

- [ ] Paste 3 staging URLs into **WhatsApp Web** — preview renders correctly.
- [ ] Paste 3 staging URLs into **LinkedIn Post Inspector** (`linkedin.com/post-inspector`) — refreshes cache, shows preview.
- [ ] Paste 3 staging URLs into **X Card validator** (or just compose a tweet draft) — card shows.

If any of the above fails, launch blocks until fixed. Cause is almost always: wrong `og:image` host, CSP blocking the host, or absolute URL missing protocol.

*v1 `ShareMenu` tests in `src/components/shared/` — reuse **behavioral** patterns, simplify UI.*

---

## 10. OG / metadata strategy

Implemented via **`generateMetadata`** on **`/nuggets/[id]/[slug]`** (Next).

| Field | Rule |
|-------|------|
| **`title`** | `{title} · Nuggets` or similar — **truncation** ~60 chars safe |
| **`description`** | Excerpt first 155 chars fallback |
| **`og:image`** | **`hero_thumb_url`** (or CDN derivative) absolute **HTTPS**; **1200×630 ideal** — Cloudinary transform if needed |
| **Fallback image** | Site default OG asset on `/public/og-default.png` |
| **`canonical`** | Matching article URL including slug segment |
| **`twitter:card`** | `summary_large_image` |

**WhatsApp / LinkedIn:** rely on OG; **test** with debugger tools before launch.

---

## 11. Search, tags, and filter UX

**Replace** implicit **`FilterStateContext`**-only model with **`nuqs`** for **`stream`** + **`tags`** + **`q`** (**blueprint §6.2**).

### Search (PMF — quality launch)

| Topic | Decision |
|-------|-----------|
| **Scope** | **Articles / nuggets only** — **no** community collections in search results |
| **Default scope** | **Current tab/stream only** — searching on Market Pulse searches Pulse; on Nuggets searches Standard |
| **Ranking** | **Relevance-first** for **both** streams — **do not** bias Pulse by recency vs Standard (**blueprint §6.2a**) |
| **Shareable URL** | **Yes** — committed **`q`** lives on **`/`** next to **`stream`** + **`tags`** (bookmarkable, refresh-safe). *Marketing shares* still typically point at **`/nuggets/...`** detail URLs (**§7**). |
| **Suggestions** | **Yes** — live dropdown in the header while typing. **Debounce 180ms**, **min query length 2 chars**, **cap 8 rows** (frozen — `BLUEPRINT` §6.2a / §2.a) |
| **Committed results** | **Yes** — **Enter** or explicit **Search** runs full result set on **Home** and commits **`q`** |
| **Suggestion pick** | **Navigates** to **Nugget page** — **does not** commit **`q`** (§0.5) |
| **Filter combo with tags** | `tags` + `stream` stay in URL; **search applies within** that slice. Multi-tag AND uses denormalized `articles.tag_slugs[]` GIN index — `BLUEPRINT` §2.a |
| **Suggest endpoint rate limit** | LRU sliding window **30 req / 30s** per anon-IP / `user.sub` (`BLUEPRINT` §5.5 / §2.a) |

### 11.1 Filter chrome architecture (frozen — replaces v1 sidebar pattern)

**v1 had three filter UIs** (`DesktopFilterSidebar`, `MobileFilterSheet`, `FilterPopover` + chips, plus `TaxonomySidebar` and `FilterScrollRow`). v2 has **one mental model in two presentations**:

- **Desktop:** horizontal chip rail under the header
- **Mobile:** bottom sheet opening a flat chip list

**No left filter sidebar PMF — explicit decision.** Kills v1's `DesktopFilterSidebar` / `TaxonomySidebar`. Reasons (closed):

1. Sidebar costs ~250px → loses 1 of 3 desktop columns above the fold (33% fewer cards visible on a surface that exists *to surface nuggets*).
2. A useful sidebar (collapse panels, dimension groups, multi-select widgets) implies a fat client widget tree — fights v2's `nuqs` + Server Component architecture.
3. Two filter UIs (sidebar desktop + sheet mobile) violates "one mental model" (§2.3).
4. Curated tags filtered by `is_official = true` (`BLUEPRINT` §2.a) yield ~12–30 chips total — fits a rail.
5. Tag dimensions (`format / domain / subtopic`) are deferred — flat list PMF, nothing taxonomic to surface in a sidebar.
6. v1's filter component sprawl (8+ modules feeding `FilterStateContext`) is a primary cause of the click-lag the founder described — re-introducing a sidebar re-introduces the failure mode.

#### Visual hierarchy on Home (top-down)

```
┌──────────────────────────────────────────────────────────┐
│ Header: logo · search input · theme · sign-in / bell     │  ← thin chrome
├──────────────────────────────────────────────────────────┤
│ Stream tabs: [ Nuggets ]  [ Market Pulse ]               │  ← primary chrome
├──────────────────────────────────────────────────────────┤
│ Tag chip rail: macro · crypto · policy · ai · …  [More]  │  ← max 2 lines desktop
├──────────────────────────────────────────────────────────┤
│ Active filters: macro ✕ · q="taiwan" ✕     Clear all    │  ← only if ≥1 filter
├──────────────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐                                     │
│ │card│ │card│ │card│   …                                 │  ← grid
│ └────┘ └────┘ └────┘                                     │
└──────────────────────────────────────────────────────────┘
```

#### Stream tabs (primary chrome — not just URL state)

- Two tabs: **Nuggets** (default) | **Market Pulse** — visible above the chip rail at all times.
- Each tab is a `next/link` with `prefetch` — instant swap (`BLUEPRINT` §5.7).
- Active tab: brand-colored bottom border or filled-chip treatment; inactive tab is text-only.
- Same component on desktop and mobile — full-width on mobile, content-width on desktop.
- Toggling stream **clears `tags` and `q`** (frozen — different corpus; §0.5).
- Mobile bottom nav still has Nuggets + Market Pulse destinations (§14) — both surfaces route to the same `/?stream=…` URL; the in-page tab and the bottom-nav tab stay in sync via `nuqs`.

#### Tag chip rail

- **Source:** `SELECT slug, label FROM tags WHERE is_official = true ORDER BY ` *(by usage count if denormalized later, else label)*. Curated set — small.
- **Desktop:** wraps to **max 2 lines**. If more chips than fit, last visible chip is **More** opening a popover with the full list.
- **Mobile:** single-line horizontal scroll (swipeable). End-of-list **Filters** chip opens the bottom sheet.
- Each chip is a `next/link` (`prefetch`, `nuqs` URL write).
- Active chip: filled brand color (§3.2 `--brand`), ✕ icon visible on hover / focus to remove.
- Chip click wraps URL write in `useTransition` — skeleton appears within one frame regardless of fetch latency (`BLUEPRINT` §5.7).
- **Multi-tag AND** semantics — `tag_slugs @> $1::text[]` (`BLUEPRINT` §2.a). No OR mode toggle.
- **No filter widget library** (`react-select`, headless-ui menu, etc.) — pure HTML buttons + nuqs.

#### Active filters bar

- Renders **only** when at least one of `tags`, `q` is set (stream alone doesn't count — it's always set).
- Shows each active filter as a removable pill: `macro ✕` (clears that tag), `q="taiwan" ✕` (clears search), comma-separated.
- Right-aligned **Clear all** action — clears `tags` + `q`; preserves `stream`.
- Position: between chip rail and grid. Not sticky PMF.
- Mobile: same row, smaller text, scrollable horizontally if filters overflow.

#### Mobile filter sheet

- Trigger: **Filters** chip at end of mobile rail, **or** a header icon — shows numeric badge when ≥1 filter active.
- Sheet: **bottom sheet** ~75% viewport height with: search-within-tags input (filters the chip list as user types), full chip list, **Apply** + **Clear** buttons.
- **Apply sequence (frozen — `BLUEPRINT` §5.7):** close sheet → grid skeleton appears within one frame → URL writes → fetch fires.
- Cancel / swipe down: discards draft selection, no URL change.

#### What's NOT in v2 filter chrome (frozen — kills v1 chrome bloat)

- ❌ Desktop left sidebar (`DesktopFilterSidebar`, `TaxonomySidebar`).
- ❌ Dimension grouping in chip rail (`format / domain / subtopic`) — `tags.dimension` exists in DB but UI is flat.
- ❌ Sort dropdown (`sortOrder=newest|oldest|popular`). Default feed is **always `published_at DESC`**; search is **always relevance-first** (`BLUEPRINT` §6.2a). No sort UI PMF.
- ❌ View-mode toggle (grid / list / compact). Single grid PMF.
- ❌ OR-mode for tags — AND only.
- ❌ Saved filter presets / "my filters". Defer.
- ❌ Per-tag color coding on chips — single neutral chip style + brand-colored active state.
- ❌ Filter affordances nested inside the header — header stays thin (logo · search · theme · sign-in/bell).
- ❌ Always-mounted "Back to top" button (v1 `BackToTopButton.tsx`). With prefetch + fast routes, scroll length isn't the friction it was. Add later only if user research demands.

#### How filters combine (unchanged)

- `stream` selects dataset (standard vs pulse) — **disjoint feeds**, no duplicated nuggets across streams.
- `tags` narrows within stream — **AND** between tags. Implementation: `tag_slugs @> $1::text[]` GIN index (`BLUEPRINT` §2.a).
- `q` (committed search) applies within `stream + tags`.

#### Stream toggle vs search (unchanged — frozen)

Changing `stream` (Nuggets ↔ Market Pulse) **clears `tags` and `q`** — different corpus; stale chips / query look broken.

---

## 12. Collections UX

**Tone:** **Editorial utility** — curated reading lists, **not** social profiles.

| Surface | Behavior |
|---------|----------|
| **List** | Cards: optional cover, title, description **one line**, **curator name**, entry count optional |
| **Detail** | Header: title, description, curator; below: **same nugget grid** as feed |
| **Actions** | **No follow, no save collection** (blueprint) — **browse-only** |

**Improvement vs v1:** Strip follower mechanics entirely from UI copy — avoid empty social affordances.

**Layout:** Editorial **card grid / list** on **`/collections`** — calm spacing, **no** PMF requirement for a radically new IA. Largest gains come from **server-first rendering**, **skeletons**, and **no social chrome**, not from redesigning the page topology.

**Cover:** **`BLUEPRINT` §12.3** — if **`cover_image_url`** is null, use **branded placeholder** **or** **first ordered entry’s** nugget hero thumb (deterministic).

**Tags vs collections (discovery):** **Tag filters + `q`** apply **only** on **`/`** (**§11**). **`/collections`** is separate browse (curated lists); **do not** reuse the Home tag rail on collection surfaces PMF — optional later: tag filter **within** one collection’s entries.

---

## 13. Bookmarks UX

- **Login-only:** **No** bookmark UI for logged-out users except **sign-in affordance** — **`§0.7`** (**`/login?next=`** redirect; **no** modal-from-bookmark PMF).
- **Route:** **`/bookmarks`** — chronological list (newest first), **same card** as Home.
- **Folders:** **Not in PMF** — single flat list (**folders deferred** unless explicitly prioritized later).
- **Improvement:** Remove **`CollectionSelector`** friction from save path — **one tap** bookmark only.

---

## 14. Mobile behavior

| Area | Rule |
|------|------|
| **Home density** | Same column progression — **1 col**; generous vertical rhythm **`gap-3`** |
| **Bottom nav** | **DECIDED tabs (v2):** **Nuggets** → `/` (`stream=standard`); **Market Pulse** → `/?stream=pulse`; **Collections** → `/collections`; **Bookmarks** → `/bookmarks` (show only when **authenticated**). **Logged-out:** omit Bookmarks tab. Bottom nav and the in-page **Stream tabs** above the grid (§11.1) are kept in sync via `nuqs` — both routes write the same `stream` URL param. **No mismatch UX** (don't have one say Nuggets while the other says Pulse). |
| **Cards** | Primary tap → **navigate** detail — **no drawer stack** PMF |
| **Detail** | Sticky mini-bar (bookmark/share) optional |
| **Sharing** | Native share first |
| **Filters** | Sheet UI |

**Do NOT:** Hijack scroll with floating panels; autoplay video; tiny touch targets on bookmark.

---

## 15. Accessibility and responsiveness

- **Focus visible** on all interactive elements — keyboard nav through Home grid and header.
- **Touch targets** ≥ **44×44px** where platform guidelines apply.
- **Motion:** Respect **`prefers-reduced-motion`** — disable non-essential transitions.
- **Images:** Meaningful **`alt`** from title; decorative empty states **`role="img"`** avoided — use **`aria-hidden`** on placeholders.
- **Loading:** Skeletons **not** spinners for main surfaces (blueprint §8).
- **Density:** Offer **browser zoom** friendly layouts — don’t lock font sizes to unusably small **below 14px** body on detail.

### Disclaimer (compliance)

- **Site-wide disclaimer** copy in the **global footer** on every page — **not** duplicated per-card or forced inline on nugget detail unless legally required later.

### Legal routes

- **`/legal/:slug`**, **`/contact`** — preserve IA; migrate existing legal/contact content (**`MIGRATION` §4.1**). Footer links on every page.

### Feedback, moderation, tags (PMF scope)

| Topic | Decision |
|-------|-----------|
| **In-app feedback widget** | **Out of PMF** — **Contact** page / email sufficient |
| **Content moderation** | **Publish / unpublish** in admin — **no** user reporting queue or triage UI at launch |
| **Tag creation** | **Admin-only** — **`BUILD` PR-14**; Home chip rail shows **official** tags only (**no** user-created tags) |

---

## 16. What should be improved from the current app

| Area | Change |
|------|--------|
| **Reading** | Replace modal/drawer stacks with **full-page detail** |
| **Cards** | Strip **`NewsCard`** modal carnival to **navigate + bookmark + optional share** |
| **Sharing** | Centralize on **canonical URL + OG**; simplify **`ShareMenu`** surface |
| **Media** | Stop mixing lightbox + preview modal + drawer — **one detail page** owns depth |
| **Hero vs gallery** | **Carousel/narrative order** (`article_media.sort_order`, **manual gallery PMF**) is independent of **feed/card cover**: admin sets **“Use as feed/card hero”** on an attachment so the first uploaded or first-in-list image need not be the cover; reorder alone does not move the hero (**`BLUEPRINT` §12.2a**). Inline images in the Markdown body render in prose on detail — **not** the carousel unless a future **`origin=inline`** job ships. |
| **Filters** | `nuqs` for `stream` / `tags` / `q` — §11. **No left sidebar** — chip rail + bottom sheet only (§11.1). Kills `DesktopFilterSidebar`, `TaxonomySidebar`, `FilterStateContext`, `FilterPopover`, `FilterPanel`, `FilterScrollRow` from v1. |
| **Sort UI** | **Removed.** Default feed `published_at DESC`; search relevance-first. No dropdown, no sort chip — v1's `sortOrder` field is dead PMF. |
| **View modes** | **Removed.** Single grid. Kills v1 grid/feed/masonry variant pickers. |
| **Header** | Thin — logo · search · theme · sign-in/bell. **No nested filter affordances.** §3.3. |
| **Back-to-top button** | **Removed as default chrome** (v1 `BackToTopButton.tsx`). With prefetch + fast routes, scroll length isn't the friction it was. Add later only if user research demands. |
| **Collections** | Remove social residue from presentation |
| **Admin** | Replace `Create`/`Edit` Nugget Modal spaghetti with greenfield admin routes — deliberate forms, validation, preview (BUILD PR-14) |
| **Cognitive load** | Fewer per-card chrome icons. **No** per-card popovers, hover unfurls, edit menus, report buttons. |

---

## 17. What is intentionally deferred

- **Masonry** uneven-row grids — **uniform responsive grid** for PMF (`BLUEPRINT` §18); revisit only with metrics (CSS masonry / virtualization **post-launch** if needed)
- In-feed **YouTube iframe**
- **Bookmark folders**
- **Related nuggets** rail on detail
- **Push / OS notification** subscription UX (device/browser push — `BLUEPRINT` §6.6 in-app bell ships PMF)
- **A/B hero** experiments on homepage
- Full **keyboard shortcuts** palette
- **Read-tracking / "seen" state** on detail page (no `readBy` map; no progress indicators)
- **Editorial backdating** of `published_at` after first publish (`BLUEPRINT` §15.1 freeze)
- **Author / curator profile pages** (`articles.created_by` exists in DB but no UI — `BLUEPRINT` §2.a)
- **Public profile pages** (`/profile/:userId`, `/u/:userId`) — `/profile/*` and `/myspace` redirect to `/`
- **Avatar uploads, bio, social links** on `/account` (§0.13)
- **Account deletion** UI (defer — needs RLS cascade thinking)
- **Service workers / PWA install prompt / offline mode** (`BLUEPRINT` §2.a)
- **Custom scroll-restoration** beyond App Router default (§6 / §1b)
- **OG metadata scraping** (`open-graph-scraper`) — admin authors metadata; scraping comes back behind an explicit "Fetch OG" admin action PR
- **Transactional email** (`resend`) — Supabase Auth handles its own emails; defer until `/contact` form ships
- **Desktop left filter sidebar** — single chip rail + bottom sheet pattern instead (§11.1)
- **Sort dropdown / sort chip** — feed always reverse-chronological, search always relevance-first (§11.1)
- **View-mode toggle** (grid / list / compact) — single grid PMF
- **Always-mounted "Back to top" button** — chrome bloat with negligible UX gain given prefetch + fast routes
- **Sticky header on scroll-down reveal** — header simply scrolls away PMF; reveal pattern is a polish item

---

## 18. Final recommended UX direction

**Nuggets v2 should feel like opening a well-designed reading app:** **dense grids** for discovery, **calm nugget pages** for depth, **URLs that always work**, **sharing that always previews correctly**, and **interactions so simple** they survive LLM implementation without sprawl. **Change the old default** — overlays were convenient for SPA iteration; **they are liability for performance, sharing, and clarity** in v2. Preserve **brand warmth** (accent yellow, readable type) and **user preference for density** on Home; **earn** complexity back only when metrics demand it.

---

**Companion:** Add this doc to LLM context alongside **`docs/NUGGETS_V2_BLUEPRINT.md`** when making **product-visible** decisions; use **`docs/NUGGETS_V2_BUILD_EXECUTION.md`** for **order of implementation**.

---

### Nomenclature

Canonical table: **`§0.1`** (**Home**, **Bookmarks**, **Nugget**, **Source**).

---

*Nuggets v2 product behavior & UI — April 2026*
