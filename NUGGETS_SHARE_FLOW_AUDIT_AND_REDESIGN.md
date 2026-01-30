# Nuggets Share Flow: Audit & Redesign Proposal

**Role:** Senior full-stack engineer × growth PM × UX psychologist.  
**Lens:** Skeptical, opinionated, grounded in Instagram, Twitter/X, Substack, Medium, Notion, Reddit, WhatsApp.  
**Assumption:** Current implementation is suboptimal unless proven otherwise.

---

## Executive Summary

The current Nuggets share flow is **broken end-to-end**. Shared **article links do not resolve** to the intended content; **OG previews are absent**; the **share trigger** ignores WhatsApp reality and sends a bare URL with no crafted message; and there is **no conversion path** from viewer → engaged user. Collections work only because `/collections/:id` exists—articles use `/#/article/:id`, which redirects to a **non-existent** `/article/:id` route. This document provides a brutal critique, a recommended architecture, concrete copy and technical checklists, and three alternative share strategies.

---

## 1. Share Trigger & Intent

### Why do people actually share?

| Driver | Examples | When it applies to Nuggets |
|--------|----------|----------------------------|
| **Status / identity** | “This reflects my taste.” | Sharing a sharp take or a niche insight. |
| **Usefulness** | “You need to see this.” | Summary, framework, or actionable takeaway. |
| **Curiosity hook** | “Wait till you see this.” | Provocative headline or surprising fact. |
| **Social gesture** | “Thought of you.” | Tagging a friend, “saving for later” by sharing. |

**Critical point:** People share **emotion + context**, not raw links. A generic “Share” that drops only `title` + `url` ignores *why* they tapped.

### What Nuggets should support (and when)

| Share type | When to offer | When **not** to |
|------------|----------------|------------------|
| **Share insight** | User is viewing full nugget (detail/modal). They’ve consumed; value is clear. | From card grid only (no context). |
| **Share summary** | Nugget has a clear takeaway; user might add a one-liner. | Vague or note-like content. |
| **Share takeaway** | Explicit “key takeaway” or highlight exists. | No structured takeaway. |
| **Share curiosity hook** | Strong title + teaser; “You won’t believe…” energy. | Bland or metadata-only title. |

**When not to ask users to share**

- **Before value:** Don’t prompt share on first open, before scroll, or before they’ve seen the punchline.
- **Empty or weak content:** No share CTA on “Untitled” or placeholder-heavy nuggets.
- **Private nuggets:** Never expose share for private content; grey out or hide.
- **Error states:** No share on “Article not found” or failed load.

### Current implementation (critique)

- **ShareMenu** is on **every** card (grid, masonry, utility) and in **ArticleDetail**.
- **Single action:** Web Share API `{ title, url }` or clipboard URL. **No** excerpt, **no** author, **no** pre-written message.
- **`meta`** (`author`, `text`/excerpt) is **passed in but unused** in ShareMenu. A **ShareModal** with WhatsApp-formatted text exists in the codebase but is **not wired** to the current share flow.
- **No** distinction between “share from card” vs “share from detail”; no “share insight” vs “share curiosity” etc.

**Verdict:** Share is a generic “copy link” with a native share sheet. It doesn’t leverage *why* users share or *what* they’re sharing.

---

## 2. WhatsApp & Messaging App Reality

### How WhatsApp renders links

- **Title:** Truncated (~40–60 chars in many clients; exact cut-off varies).
- **Description:** 2–3 lines, then “…”.
- **Image:** Often 1.91:1 or 1:1; smaller than 1.91:1 can letterbox or crop.
- **Domain:** Shown under description.
- **No** custom styling. What you put in **og:title**, **og:description**, **og:image** is what appears.

### What gets clicked vs ignored

**Clicked:**

- **Specificity:** “How X lost $2M in 48 hours” beats “Interesting article.”
- **Social proof:** “ shared with you” (when we can do it without feeling creepy).
- **Curiosity gap:** Enough to intrigue, not to spoil.
- **Trust:** Real name, recognizable brand, clean preview.

**Ignored:**

- Generic “Nuggets” or “Untitled” title.
- No image or broken image.
- Vague description (“Check this out”, “Read more”).
- Suspicious or spammable tone.

### Optimal choices for WhatsApp previews

| Element | Recommendation | Rationale |
|---------|----------------|-----------|
| **Title length** | **≤ 50 chars** for safe truncation; front-load the hook. | WhatsApp truncates; first words matter. |
| **Image** | **1200×630** (1.91:1); fallback **1:1** if card-style. **&lt; 300 KB** where possible. | OG standard; works across platforms. |
| **Description** | **≤ 155 chars**; benefit-focused, not app-centric. | Fits 2–3 lines; avoid “Sign up to read.” |
| **Tone** | **Neutral to slightly provocative.** Avoid hype or “You won’t believe!” | Trust > clickbait in DMs. |

### Mistakes most apps make

1. **App-centric copy:** “Sign up for Nuggets to view” → recipient has no reason to care.
2. **Generic OG for all links:** Same title “Nuggets” for every shared nugget → no differentiation.
3. **No image or slow image:** Placeholder or missing `og:image` → weak preview.
4. **Truncation surprises:** Long titles/descriptions with important info at the end.
5. **Cache:** WhatsApp caches aggressively; changing OG later doesn’t update old forwards.

### Current Nuggets state

- **No** per-article or per-collection OG tags. **Single** `index.html` with `<title>Nuggets</title>` only.
- All shared links **look identical** in WhatsApp: same title, no description, no image.
- **Verdict:** Nuggets is effectively **invisible** in the chat; it doesn’t compete with Substack, Medium, or Twitter links.

---

## 3. Open Graph & Technical Setup

### Best-practice OG tags for virality

```html
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Nuggets" />
<meta property="og:title" content="[Nugget title, max ~50 chars]" />
<meta property="og:description" content="[Excerpt or takeaway, max ~155 chars]" />
<meta property="og:image" content="[Absolute URL, 1200×630]" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="[Canonical share URL]" />
<meta property="og:locale" content="en_IN" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="[Same as og:title]" />
<meta name="twitter:description" content="[Same as og:description]" />
<meta name="twitter:image" content="[Same as og:image]" />
```

- **Canonical URL:** One canonical shape for shares (e.g. `https://app.nuggets.com/n/History123` or `/article/History123`). No `#/` in canonical.

### Static vs dynamic OG images

- **Dynamic:** Per-nugget (and per-collection) OG image. **Required** for link previews to be useful.
- **Static:** Only for generic pages (home, login, about). Use as **fallback** when dynamic generation fails.

### Personalized previews (sender name, context)

- **Sender name in OG:** Possible but brittle (e.g. “John shared this with you”). Cache invalidation and consistency are hard; WhatsApp doesn’t support dynamic OG per recipient.
- **Pragmatic approach:** Keep OG **content-centric** (title, excerpt, image). Use **share message** (see below) for “From John” or “Thought you’d find this useful.”

### Cache invalidation (WhatsApp, etc.)

- WhatsApp **caches** preview by URL. Updates to OG often **don’t** show for already-shared links.
- **Mitigation:**
  - **Query param** for new shares (e.g. `?v=2` or `?s=share`) only if you’re willing to change URLs; use sparingly.
  - **Version OG image URLs** if you change images (e.g. `.../og/abc123.png?v=2`).
  - Prefer **getting OG right at first share** over fixing later.

### Deep-link vs web-fallback strategy

- **Web-first:** Shared link **always** opens the **responsive web app** (article or collection page). Works everywhere, no app install required.
- **Deep-link (optional):** If Nuggets has a mobile app, use **same canonical URL**; serve OG from server. App can intercept via **App Links / Universal Links** when installed; otherwise fall back to web.
- **Recommendation:** Start **web-only**. Add deep-linking when a native app exists; keep **one** shareable URL.

### Current Nuggets state

- **No** OG implementation for article or collection pages. **No** dynamic meta, **no** per-resource images.
- **Verdict:** OG and technical preview setup are **missing**. This is the highest-impact fix.

---

## 4. Landing Page Experience (Critical)

### When a recipient clicks the link

**Within &lt; 3 seconds they should:**

1. **See** the nugget (or collection) **content**—or a clear, fast-loading skeleton.
2. **Understand** what they’re looking at (title, author, source).
3. **Scroll** to read without being blocked.

**Not in the first 3 seconds:**

- Login/signup gates.
- “Download our app” modals.
- Long intro animations or heavy JS before content.
- Generic “Nuggets” shell with no content.

### Scroll vs no-scroll

- **Scroll:** Allow full read in browser. Match Substack/Medium: **content first**, CTAs **after** value.
- **No-scroll:** Only if the nugget is **very** short (e.g. one paragraph). Otherwise, **always** allow scroll.

### Anonymous view vs forced login

- **Anonymous view:** Let them **read** the shared nugget (and collection) **without** signing in. Lower friction, higher viral potential.
- **Optional account:** Use **soft** prompts (e.g. “Save to your nuggets”, “Get more like this”) after they’ve read, not before.

**Compare:**

- **Instagram shared links:** Often land on login or generic feed; bad for non-users.
- **Substack:** Article first, subscribe CTA after. **Good** pattern.
- **Medium:** Friend links and publicly shared articles are **readable** without sign-up. **Good** pattern.
- **Notion:** Public pages are **fully readable**; “Duplicate” / “Add to workspace” come after. **Good** pattern.

**Recommendation:** **Anonymous read** for shared nuggets and collections. Gate **creation, save, follow** behind sign-up, not **consumption**.

### Copywriting tone: app-centric vs user-centric

- **App-centric (avoid):** “Sign up for Nuggets to view”, “Install the app”, “Join Nuggets.”
- **User-centric (prefer):** “A nugget from [Author]”, “From [Author]’s collection”, “Read the full take”, “Save this to your nuggets.”

**Current Nuggets state:**

- Shared **article** links **don’t work**: `/#/article/:id` → redirect to `/article/:id` → **no route**. User lands on **blank or 404**.
- **Collections** work (`/collections/:id`). Article detail is **only** in modal on home; **no** dedicated `/article/:id` (or `/n/:id`) route.
- **Verdict:** The **core landing experience for shared articles is broken**. Fix routing and add a **dedicated article landing route** before optimizing copy.

---

## 5. Conversion Psychology

### Converting without feeling spammy

- **Value first:** Let them **read** fully. Conversion ask **after**.
- **Soft CTAs:** “Save”, “Get more like this”, “Follow [Author]” — **optional**.
- **Hard CTAs:** “Sign up to continue”, “Install app” — use only when **necessary** (e.g. save, create). Never block **read**.

### Timing of “Install app” / sign-up

- **Too early:** Before they’ve seen content → **bounce**.
- **After scroll / read:** “Save this?” → “Sign up to save” is **acceptable**.
- **Exit intent / idle:** Soft “Get the app” or “Stay updated” can work, but **don’t** block.

### Guest reading vs gated content

- **Guest reading:** Shared nuggets and collections **readable** without login. **Do this.**
- **Gated:** Reserve for **premium** or **exclusive** content only, and be explicit.

### FOMO vs trust-building

- **FOMO:** “X people joined this week” — use **lightly**; can feel manipulative.
- **Trust:** Author name, clear source, “From [Name]’s collection.” **Prioritize** trust.

**Current Nuggets state:** No dedicated conversion flow on share landing; article landing is broken. Collections pages exist but conversion UX is **not** audited here.

---

## 6. India-Specific & Mobile-First Considerations

### Low patience thresholds

- **&lt; 3 s** to meaningful content. Avoid splash screens, heavy JS, or login walls.
- **Minimal steps:** Prefer **one tap** to read; **one tap** to share.

### Data-light design

- **Small OG images** (&lt; 300 KB where possible), **lazy-load** below fold.
- **No** auto-play video on landing; images and text first.

### Language & tone neutrality

- **English-first** but **neutral** tone; avoid idioms that don’t travel. Ready for **localization** later (labels, CTAs).

### WhatsApp dominance

- **Assume** most shares go to **WhatsApp**. Optimize **preview** (OG) and **share message** (pre-filled text) for WhatsApp. **Test** on WhatsApp Android/iOS.

**Current Nuggets state:** No India-specific optimizations; share flow is generic and broken. **Opportunity:** Fix baseline, then add data-light and WhatsApp-first tweaks.

---

## Brutally Honest Critique of Typical Share Flows

1. **Share = “Copy link”**  
   Dropping a raw URL with no message or context. **Nuggets does this** (plus native share sheet). **Bad.**

2. **Same preview for every link**  
   All links show “Nuggets” and no image. **Nuggets does this.** **Bad.**

3. **Shareable links that don’t open the right thing**  
   `/#/article/:id` redirects to a **non-existent** route. **Nuggets does this.** **Critical.**

4. **Login wall before read**  
   “Sign up to view.” **Nuggets** doesn’t gate read, but **article link doesn’t work** anyway.

5. **App-centric CTAs**  
   “Install our app” before value. **Avoid.** Prefer **content-first**, then **soft** CTAs.

6. **Ignoring WhatsApp**  
   No OG, no formatted share message. **Nuggets** currently ignores WhatsApp. **Bad** for India.

7. **No “why share”**  
   One generic Share button everywhere. No “share insight” vs “share takeaway,” no context. **Nuggets** does this. **Weak.**

8. **Cache oblivion**  
   Changing OG later without considering cache. **Nuggets** has no OG yet; when you add it, **design for cache** from day one.

---

## Recommended Nuggets Share Architecture (Flow Diagram, Text)

```
[ User taps Share (card or detail) ]
         │
         ▼
┌─────────────────────────────────────┐
│ Share intent                        │
│ • From detail? → "Share insight"    │
│ • From card?   → "Share" (link)     │
│ • Private?     → Hide / disable     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Share surface                       │
│ • Mobile: Native share sheet        │
│   - title, url, text (pre-filled)   │
│ • WhatsApp (optional explicit):     │
│   - wa.me link with prefilled text  │
│ • Fallback: Copy link + toast       │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Pre-filled message (e.g. WhatsApp)  │
│ *{Title}* by {Author}               │
│ {Excerpt or takeaway, 1–2 lines}    │
│ {Canonical URL}                     │
└─────────────────────────────────────┘
         │
         ▼
[ Recipient receives message + link ]
         │
         ▼
[ Clicks link → hits canonical URL ]
         │
         ▼
┌─────────────────────────────────────┐
│ Server / SSR                        │
│ • Resolve /n/:id or /article/:id    │
│ • Fetch nugget (or collection)      │
│ • Inject OG (and optional HTML)     │
│ • Return 200 + meta + body          │
└─────────────────────────────────────┘
         │
         ├── Crawler / WhatsApp fetcher
         │   → Uses OG only → rich preview
         │
         └── Browser
             → Load SPA or SSR shell
             → Hydrate, show content
         │
         ▼
┌─────────────────────────────────────┐
│ Landing page                        │
│ • < 3 s: Content or skeleton        │
│ • Anonymous read                    │
│ • Soft CTAs after read              │
└─────────────────────────────────────┘
         │
         ▼
[ Viewer → optional sign-up / save / follow ]
```

**Canonical URL shape (recommended):**

- **Nugget:** `https://<domain>/n/<id>` or `https://<domain>/article/<id>`
- **Collection:** `https://<domain>/collections/<id>`
- **No** `#/` in canonical. Redirect old `/#/article/:id` and `/#/collections/:id` to these.

---

## Exact Copy Examples

### WhatsApp preview (OG – title, description)

**Title (≤ 50 chars):**

```
How X lost $2M in 48 hours — and what they did next
```

**Description (≤ 155 chars):**

```
A nugget from Priya. The real story behind the crash, plus three lessons for founders. Read the full take on Nuggets.
```

**Alternative (more curiosity):**

```
Priya shared a take on the X collapse. "The numbers were there — we just didn't look."
```

### Share message (pre-filled in share sheet / wa.me)

```
*How X lost $2M in 48 hours* by Priya

The real story behind the crash, plus three lessons for founders.

https://app.nuggets.com/n/abc123
```

### Landing page headline (above the fold)

```
How X lost $2M in 48 hours — and what they did next
```

**Subhead:**

```
A nugget from Priya · 4 min read
```

### CTA buttons (soft, after read)

- **Primary:** `Save to my nuggets` → if not logged in → “Sign up to save.”
- **Secondary:** `Get more from Priya` → profile or follow.
- **Tertiary:** `Share this nugget` → same share flow.

### What to avoid

- “Sign up to view” / “Install app to read.”
- “Join Nuggets” as **primary** CTA before any value.
- Generic “Check this out” or “Read more” as **only** description.

---

## Technical Checklist

### OG tags (per nugget / per collection)

- [ ] **og:type** `article` (nugget) or `website` (collection).
- [ ] **og:site_name** `Nuggets`.
- [ ] **og:title** ≤ 50 chars; nugget title or collection name.
- [ ] **og:description** ≤ 155 chars; excerpt or collection description.
- [ ] **og:image** absolute URL, 1200×630 (or 1:1 fallback), &lt; 300 KB preferred.
- [ ] **og:image:width** / **og:image:height**.
- [ ] **og:url** canonical share URL (no hash).
- [ ] **og:locale** e.g. `en_IN`.
- [ ] **twitter:card** `summary_large_image`; **twitter:title**, **twitter:description**, **twitter:image** aligned with OG.

### URLs and routing

- [ ] **Canonical** share URL: `/n/:id` or `/article/:id` (nugget), `/collections/:id` (collection).
- [ ] **Redirect** `/#/article/:id` → canonical article URL.
- [ ] **Redirect** `/#/collections/:id` → `/collections/:id`.
- [ ] **Route** `/article/:id` or `/n/:id` **implemented**; fetch article and render (SPA or SSR).

### OG serving

- [ ] **Dynamic** OG per nugget/collection (server or edge).
- [ ] **Crawler detection** optional: serve **OG-only** or **minimal HTML** to WhatsApp/FB/Twitter bots; full app for users.
- [ ] **Fallback** OG (static) when nugget missing or error.

### Deep links and fallbacks

- [ ] **Web-first:** Same URL works in browser.
- [ ] **Deep-link** (optional): App Links / Universal Links when app exists; fallback web.

### Share flow (client)

- [ ] **Pre-filled** `text` (or equivalent) in Web Share API where supported.
- [ ] **WhatsApp-specific** option: `wa.me` with `text=` pre-filled (optional but useful for India).
- [ ] **Copy** fallback: canonical URL + optional short message in clipboard or toast.

### Landing page

- [ ] **Anonymous read** for shared nuggets and collections.
- [ ] **Content visible** &lt; 3 s (or skeleton).
- [ ] **Soft** sign-up / save / follow CTAs **after** content.

### Performance and reliability

- [ ] **OG image** generation or selection **fast**; avoid blocking preview fetch.
- [ ] **Cache** strategy for OG (and image) agreed; versioning if you need to change later.

---

## Three Alternative Share Strategies

### A. Viral

**Goal:** Maximize **reach** and **forwardability**.

**Tactics:**

- **Curiosity-led** OG title and description; slight provocation.
- **Pre-filled share message** with hook + “You won’t believe…” tone.
- **“Share this”** CTA **inside** the landing page (above fold, subtle).
- **Optional** “X people shared this” or “Trending in [Tag]” **social proof**.
- **Low** sign-up friction; **optional** account to “get more like this.”

**Trade-offs:** Risk of feeling **clickbaity** or **spammy** if overdone. Best for **growth** phase; balance with **trust** (author, source).

**When to choose:** You’re prioritising **acquisition** and **awareness**; you’re okay with softer branding in favor of shares.

---

### B. Trust-first

**Goal:** Maximize **credibility** and **brand safety**.

**Tactics:**

- **Neutral, accurate** OG title and description; **no** hype.
- **Author and source** prominent in preview and landing.
- **“From [Name]”** / “From [Name]’s collection” in share message and UI.
- **No** “Trending” or “X people shared” on shared pages.
- **Soft** CTAs only; **no** pushy “Sign up now.”

**Trade-offs:** **Lower** viral potential than Strategy A; **higher** trust and **quality** perception.

**When to choose:** You’re building **author-led** or **expert** positioning; brand and **long-term** trust matter more than short-term virality.

---

### C. Creator-centric

**Goal:** Maximize **creator attribution** and **follow** potential.

**Tactics:**

- **Creator** front and centre: name, avatar, “A nugget from [Name]” in OG and share message.
- **Collection** shares emphasize **curator** and **collection name**.
- **Landing** page: **creator** card, “More from [Name]”, “Follow” CTA.
- **Share message** templates that **creators** can customize (e.g. default “shared by [Name]” plus optional custom line).

**Trade-offs:** **Less** “platform-first” vibe; **more** “creator-first.” Works best if Nuggets is **creator-led** (e.g. Substack-like).

**When to choose:** Growth relies on **creators** and **collections**; you want shares to **drive follows** and **creator loyalty**.

---

## Summary of Priorities

| Priority | Action |
|----------|--------|
| **P0** | **Fix** article share links: add `/article/:id` (or `/n/:id`) route, implement redirect from `/#/article/:id`, ensure shared link **opens the nugget**. |
| **P0** | **Add** dynamic OG (and optional SSR) for nuggets and collections; **1200×630** image, **&lt; 50** char title, **&lt; 155** char description. |
| **P1** | **Use** `meta` (author, excerpt) in share: **pre-filled** message for Web Share and **optional** WhatsApp-specific flow. |
| **P1** | **Landing:** Anonymous read, content &lt; 3 s, **soft** CTAs after read. |
| **P2** | **Differentiate** “share from card” vs “share from detail”; **hide** share for private nuggets. |
| **P2** | **Choose** one of the three strategies (Viral / Trust-first / Creator-centric) and **align** OG, share message, and CTAs. |
| **P3** | **India / WhatsApp:** Data-light OG images, **test** previews on WhatsApp; consider **wa.me** pre-fill. |

---

## Appendix: Current Implementation Reference

Quick pointers for implementers:

| What | Where |
|------|--------|
| Share button (Web Share / clipboard) | `src/components/shared/ShareMenu.tsx` |
| Share URL (nugget) | `src/components/card/atoms/CardActions.tsx` → `origin/#/article/${articleId}` |
| Share URL (collection) | `src/pages/CollectionDetailPage.tsx`, `CollectionCard.tsx` → `origin/#/collections/${id}` |
| Article detail share URL | `src/components/ArticleDetail.tsx` → `window.location.href` (context-dependent) |
| Hash → path redirect | `src/App.tsx` → `HashRedirect` |
| Routes | `src/App.tsx`; no `/article/:id` route; `/feed` and `/feed/:articleId` → redirect to `/` |
| Article detail (modal) | `ArticleModal` + `ArticleDetail` on `HomePage`, `CollectionDetailPage`, etc. |
| Article detail (page) | `src/pages/ArticleDetail.tsx` (`ArticleDetailPage`) — **not routed** |
| HTML / meta | `index.html` — `<title>Nuggets</title>` only; no OG |
| Metadata (inbound unfurl) | `server/src/services/metadata.ts` — for **creating** nuggets, not share previews |

**Fix order:** Add `/article/:id` route → wire `ArticleDetailPage` → point share URLs to canonical path → add OG (server or edge) → enhance ShareMenu with pre-filled message.
