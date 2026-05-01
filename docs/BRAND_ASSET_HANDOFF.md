# Nuggets Brand Asset Handoff

Designer + Engineer Brief (Greenfield Recreation)

Use this as the single source of truth for recreating logo, favicon, app icons, and social preview assets.

Production base URL for all public assets: `https://nuggets.one`

## 1) Brand Identity Snapshot

- Product name: `Nuggets`
- Extended title: `Nuggets: The Knowledge App`
- Core mark concept: rounded yellow square with bold dark `N`
- Visual style: minimal, flat, clean, high contrast

## 2) Exact Visual Tokens

### Colors

- Brand primary (logo tile): `#facc15`
- Logo letter (`N`): `#111827`
- Theme color (manifest/browser UI): `#0f172a`
- PWA background color: `#f1f5f9`

### Geometry

- Master icon artboard: `512x512`
- Corner radius: `96` (on 512 canvas)
- Logo letter alignment: centered
- Style: no gradients/shadows in icon itself (flat fill)

### Typography

- Logo glyph family: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Header wordmark family: `'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif`
- Glyph: uppercase `N`, bold weight

## 3) Required Deliverables (Filenames + Specs)

### A) Core app icon assets

1. `public/icon.svg`
   - Master source icon
   - `512x512` SVG
   - Yellow rounded square (`#facc15`) + centered dark `N` (`#111827`)

2. `public/icons/favicon-32.png`
   - `32x32` PNG
   - Derived from master icon

3. `public/apple-touch-icon.png`
   - `180x180` PNG
   - Derived from master icon

4. `public/icons/icon-192.png`
   - `192x192` PNG
   - PWA icon (`purpose: any`)

5. `public/icons/icon-512.png`
   - `512x512` PNG
   - PWA icon (`purpose: any`)

6. `public/icons/icon-512-maskable.png`
   - `512x512` PNG
   - Maskable safe-area variant (glyph scaled/inset for mask clipping safety)

7. `public/icons/badge-72.png`
   - `72x72` PNG
   - Notification badge asset
   - White `N` on transparent background

### B) Social preview assets

8. `public/og-default.svg`
   - Editable source
   - `1200x630` SVG
   - Dark gradient background + subtle grid + "Nuggets" headline + support line

9. `public/og-default.png`
   - `1200x630` PNG
   - Final OG/Twitter fallback image

### C) Source templates used to generate final files

- `scripts/brand-icons/icon-maskable.svg`
- `scripts/brand-icons/badge.svg`
- `scripts/generate-brand-icons.mjs`

## 4) Usage Map (Where each logo/image is used)

### Website head metadata

In `index.html`:

- `<link rel="icon" type="image/svg+xml" href="https://nuggets.one/icon.svg" />`
- `<link rel="icon" type="image/png" sizes="32x32" href="https://nuggets.one/icons/favicon-32.png" />`
- `<link rel="apple-touch-icon" sizes="180x180" href="https://nuggets.one/apple-touch-icon.png" />`
- `<link rel="manifest" href="https://nuggets.one/manifest.json" />`
- `<meta property="og:image" content="https://nuggets.one/og-default.png" />`
- `<meta name="twitter:image" content="https://nuggets.one/og-default.png" />`

### PWA install manifest

In `public/manifest.json`:

- `icons`:
  - `https://nuggets.one/icons/icon-192.png` (`192x192`, purpose `any`)
  - `https://nuggets.one/icons/icon-512.png` (`512x512`, purpose `any`)
  - `https://nuggets.one/icons/icon-512-maskable.png` (`512x512`, purpose `maskable`)
- `badge`: `https://nuggets.one/icons/badge-72.png`
- `theme_color`: `#0f172a`
- `background_color`: `#f1f5f9`

### Push notifications (fallback asset references)

- `public/sw.js`
  - `icon: 'https://nuggets.one/icons/icon-192.png'`
  - `badge: 'https://nuggets.one/icons/badge-72.png'`
- `server/src/services/notificationService.ts`
  - `DEFAULT_WEB_PUSH_ICON = 'https://nuggets.one/icons/icon-192.png'`
  - `DEFAULT_WEB_PUSH_BADGE = 'https://nuggets.one/icons/badge-72.png'`

### SEO/social fallback image usage

- `api/public-seo.ts` -> `DEFAULT_IMAGE = 'https://nuggets.one/og-default.png'`
- `api/og-proxy.ts` -> fallback resolves to `https://nuggets.one/og-default.png`
- `server/src/middleware/ogMiddleware.ts` -> fallback resolves to `https://nuggets.one/og-default.png`

### In-app logo rendering (code-rendered, not file asset)

- `src/components/Header.tsx`
  - `NuggetsLogoMark` renders yellow tile + `N` directly in UI (matches app favicon treatment)

## 5) Export & Production Rules

- Keep exact filenames and paths listed above (to avoid broken references)
- PNG exports must be crisp; no blurry scaling artifacts
- SVGs should remain clean and editable (no unnecessary metadata)
- Keep icon center alignment consistent at all sizes
- Validate favicon contrast in both light/dark browser chrome
- Keep maskable glyph inside safe area (no clipping on Android masks)

## 6) Acceptance Checklist (Designer + Engineer sign-off)

- [ ] All required files exist in the exact paths above
- [ ] `public/icon.svg` matches brand spec (yellow tile, dark `N`, rounded corners)
- [ ] `public/icons/favicon-32.png` renders correctly in browser tabs
- [ ] `public/apple-touch-icon.png` displays correctly when added to iOS home screen
- [ ] `public/manifest.json` references resolve without 404s
- [ ] PWA install displays correct 192 and 512 icons
- [ ] Maskable icon displays correctly without clipping
- [ ] Push notifications show correct fallback icon and badge
- [ ] OG/Twitter previews use `public/og-default.png` fallback when no custom image exists
- [ ] No icon/image 404s in browser network panel
- [ ] PWA/icon-related checks pass in Lighthouse

## 7) Optional Automation (Approved)

Use the existing icon generation script for deterministic output:

1. Update source SVGs:
   - `public/icon.svg`
   - `scripts/brand-icons/icon-maskable.svg`
   - `scripts/brand-icons/badge.svg`
2. Run generation:
   - `npm run icons:generate`
3. Verify updated outputs:
   - `public/icons/*`
   - `public/apple-touch-icon.png`
4. Smoke test:
   - Browser favicon
   - PWA install prompt/icon
   - Notification icon/badge fallback
   - OG fallback image
