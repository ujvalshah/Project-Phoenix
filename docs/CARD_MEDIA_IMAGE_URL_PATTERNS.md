# Card Media Image URL Patterns

This document lists the URL kinds currently identified as **images** for rendering in the card media section.

Primary source of truth:
- `src/utils/urlUtils.ts` (`isImageUrl()` and `detectProviderFromUrl()`)
- Secondary card ingestion behavior: `src/utils/mediaClassifier.ts` (`getAllImageUrls()`)

## Purpose

When a URL is recognized as an image:
- It is classified as `type: "image"` by `detectProviderFromUrl()`.
- It can be used as primary/supporting card media.
- Metadata fetch is skipped (`shouldFetchMetadata()` returns `false` for image URLs).

---

## 1) Direct Image Extension URLs

Recognized by extension (case-insensitive), including query/hash suffixes:
- `.jpg`
- `.jpeg`
- `.png`
- `.gif`
- `.webp`
- `.svg`
- `.svgz`

Examples:
- `https://example.com/photo.jpg`
- `https://cdn.site.com/image.webp?itok=abc`
- `https://assets.site.com/icon.svg#v2`

---

## 2) Cloudflare Image Delivery URLs (No Extension Required)

Recognized pattern:
- Path contains `/cdn-cgi/imagedelivery/`
- Plus width/height resizing indicator in path or query:
  - query contains `w=` or `h=`
  - or path segment contains `/w=<num>` or `/h=<num>`

Example:
- `https://host.com/cdn-cgi/imagedelivery/<id>/<token>/w=1350`

---

## 3) Social/Platform Image CDNs (Host-Based)

Recognized as image URLs:

### Twitter / X
- Host: `pbs.twimg.com`
- Path starts with `/media/`

Example:
- `https://pbs.twimg.com/media/ABC123?format=jpg&name=large`

### LinkedIn
- Host contains `media.licdn.com`
- Path contains `/image/`

Example:
- `https://media.licdn.com/dms/image/C4D22AQ...`

### Reddit
- Host exactly:
  - `i.redd.it`
  - `preview.redd.it`

### Imgur
- Host exactly: `i.imgur.com`

---

## 4) Static/CDN Path Heuristics

Recognized patterns:

### Static image path
- Path starts with `/images/`
- And hostname includes `static.` or `ffx.io`

### CloudFront image-like paths
- Host contains `cloudfront.net`
- Path contains one of:
  - `_images`
  - `/images/`
  - `/image/`

---

## 5) Generic CDN Host Heuristics

Host contains one of:
- `images.ctfassets.net`
- `thumbs.`
- `cdn.`
- `img.`
- `image.`

Then treated as image **if either**:
- URL has query hint like `fm=`, `q=`, or `format=`, **or**
- Path does not end with `.html` / `.php` and does not end with `/`.

---

## 6) Query-Param Image Format Fallback

Recognized when:
- URL has `format=jpg|jpeg|png|gif|webp`
- AND path looks media/image-like (`/media/`, `/image/`, `/photo/`, `/pic/`, `/img/`)

This captures URLs without explicit file extension but with explicit image format query.

---

## 7) Additional Card Ingestion Sources

Beyond `isImageUrl()`, card image collection in `getAllImageUrls()` also includes:
- `article.images[]` entries (explicit image list),
- `primaryMedia`/`supportingMedia` items where:
  - `media.type === "image"` **or**
  - `isImageUrl(media.url) === true`,
- legacy `article.media` where `media.type === "image"`,
- `article.media.previewMetadata.imageUrl` (OG image fallback).

So even if type metadata is imperfect, URL pattern matching still allows many image URLs to render.

---

## 8) Non-Image URL Examples (for contrast)

These are **not** image by default unless they match rules above:
- Generic article pages (`https://news.site.com/story/...`)
- Video files (`.mp4`, `.webm`, `.ogg`) -> classified as video
- Documents (`.pdf`, `.docx`, etc.) -> classified as document
- YouTube links (`youtube.com`, `youtu.be`) -> classified as youtube

---

## 9) Practical Sharing Guidance

If another engineer/LLM needs card-media parity, provide:
- This file (`docs/CARD_MEDIA_IMAGE_URL_PATTERNS.md`)
- `src/utils/urlUtils.ts` (exact implementation)
- `src/utils/mediaClassifier.ts` (card ingestion behavior)

These three are sufficient to reproduce current image URL identification behavior.

---

## 10) QA Test URL Checklist (Expected Outcome)

Use these to quickly verify `isImageUrl()`/`detectProviderFromUrl()` behavior.

### Should be recognized as IMAGE
- `https://example.com/photo.jpg` -> IMAGE
- `https://example.com/photo.jpeg?size=1200` -> IMAGE
- `https://example.com/asset.png#hash` -> IMAGE
- `https://example.com/cover.webp?itok=abc` -> IMAGE
- `https://example.com/vector.svg` -> IMAGE
- `https://example.com/vector.svgz?cq=60` -> IMAGE
- `https://host.com/cdn-cgi/imagedelivery/acc/token/w=1200` -> IMAGE
- `https://pbs.twimg.com/media/ABC123?format=jpg&name=large` -> IMAGE
- `https://media.licdn.com/dms/image/C4D22AQ...` -> IMAGE
- `https://i.redd.it/abcd1234xyz.png` -> IMAGE
- `https://preview.redd.it/abcd1234xyz.jpg?width=1080` -> IMAGE
- `https://i.imgur.com/abcdEFG.png` -> IMAGE
- `https://static.ffx.io/images/rs:fill:1200:675/...` -> IMAGE
- `https://d111111abcdef8.cloudfront.net/path/_images/hero` -> IMAGE
- `https://cdn.example.com/resource?id=1&fm=webp&q=70` -> IMAGE
- `https://foo.image-cdn.com/path/file?format=png` -> IMAGE (when path also image-like)

### Should NOT be recognized as IMAGE
- `https://news.example.com/article/markets-update` -> NOT IMAGE
- `https://example.com/index.html` -> NOT IMAGE
- `https://example.com/landing.php` -> NOT IMAGE
- `https://youtube.com/watch?v=dQw4w9WgXcQ` -> YOUTUBE (not image)
- `https://example.com/video.mp4` -> VIDEO (not image)
- `https://example.com/report.pdf` -> DOCUMENT (not image)

### Edge Cases to validate carefully
- `https://cdn.example.com/path/no-ext` -> depends on host/path/query heuristics
- `https://example.com/media/item?format=jpg` -> IMAGE only when path is image-like (`/media/`, `/image/`, `/photo/`, `/pic/`, `/img/`)
- `https://video.twimg.com/...` -> should NOT be treated as image by the Twitter-specific rule
