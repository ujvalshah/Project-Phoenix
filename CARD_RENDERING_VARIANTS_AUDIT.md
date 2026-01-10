    # CARD RENDERING VARIANTS AUDIT

    **Date**: 2025-01-28  
    **Scope**: Complete mapping of all card rendering variants, conditional logic, and business rules

    ---

    ## 1. CARD COMPONENTS & VARIANTS

    ### 1.1 Main Card Component
    **Location**: `src/components/NewsCard.tsx`

    **Component**: `NewsCard`
    - **Props**: `article`, `viewMode`, `onTagClick`, `onCategoryClick`, `onClick`, `currentUserId`, `isPreview`, `selectionMode`, `isSelected`, `onSelect`
    - **Role**: Orchestrator component that selects variant based on `viewMode` prop
    - **View Modes Supported**: `'grid' | 'feed' | 'masonry' | 'utility'`

    ### 1.2 Layout Variants

    #### 1.2.1 GridVariant
    **Location**: `src/components/card/variants/GridVariant.tsx`
    - **Use Case**: Grid layouts (default responsive grid)
    - **Structure**: 
    - Selection mode support (checkbox overlay)
    - Two-card architecture: Hybrid vs Media-Only
    - Media block → Tags → Title + Content → Footer (Meta + Actions)

    #### 1.2.2 FeedVariant
    **Location**: `src/components/card/variants/FeedVariant.tsx`
    - **Use Case**: Feed/list layouts (mobile-first, vertical stacking)
    - **Structure**:
    - No selection mode
    - Media-first layout
    - Larger padding (`p-6` vs `p-4`)
    - Hover elevation effect

    #### 1.2.3 MasonryVariant
    **Location**: `src/components/card/variants/MasonryVariant.tsx`
    - **Use Case**: Masonry/pinterest-style layouts
    - **Structure**:
    - `break-inside-avoid` for column flow
    - Auto height (`height: auto`)
    - Source badge placement differs from Grid

    #### 1.2.4 UtilityVariant
    **Location**: `src/components/card/variants/UtilityVariant.tsx`
    - **Use Case**: Utility/detail-focused layouts (tags → title → content → media at bottom)
    - **Structure**:
    - Media anchored to bottom (`mt-auto`)
    - Full keyboard navigation support
    - ARIA labels for accessibility

    ### 1.3 Other Card Components

    #### FeedCardCompact
    **Location**: `src/components/feed/FeedCardCompact.tsx`
    - **Use Case**: Mobile-optimized compact feed cards
    - **Structure**: Image preview (4:3) → Title → Metadata → Tags
    - **Independent**: Not a variant of NewsCard, separate component

    #### CollectionCard
    **Location**: `src/components/collections/CollectionCard.tsx`
    - **Use Case**: Collection/nugget group cards
    - **Structure**: Accent bar → Thumbnail grid → Title → Metadata → Actions

    #### ProfileCard
    **Location**: `src/components/profile/ProfileCard.tsx`
    - **Use Case**: User profile display card
    - **Structure**: Avatar → Name → Bio → Stats → Social links → Edit button

    ---

    ## 2. CARD TYPE CLASSIFICATION (Two-Card Architecture)

    **Location**: `src/hooks/useNewsCard.ts` (lines 217-327)

    ### 2.1 Classification Logic

    Cards are classified into two types based on content analysis:

    #### Type A: Hybrid Card (Default)
    - **Structure**: Media block at top → Tags → Title → Body content → Footer
    - **Characteristics**:
    - Supports full body text with truncation
    - Title is rendered separately from body
    - Content area has truncation + fade overlay with "Read more" button

    #### Type B: Media-Only Card
    - **Structure**: Media fills card height → Optional short caption (overlay) → Footer
    - **Characteristics**:
    - Media fills available space (no padding wrapper)
    - Text is rendered as overlay with gradient background
    - No truncation wrapper around text (text is inside media container)
    - Minimal text only (2-3 lines max)

    ### 2.2 Classification Rules

    **Decision Tree**:
    ```
    1. If no media → Always Hybrid
    2. If has media + long text (>3 lines OR >200 chars) → Always Hybrid
    3. If has media + minimal text (≤200 chars AND ≤3 lines) + no user-provided title → Media-Only
    4. If has media + minimal text + user-provided title → Hybrid
    5. If has media + multi-image + long text → Hybrid (special case)
    ```

    **Key Fields Checked**:
    - `article.content` / `article.excerpt` - Text length and line count
    - `article.title` - User-provided title (NOT metadata titles)
    - `hasMedia` - Presence of any media
    - `allImageUrls.length` - Multi-image detection

    **Constants**:
    - `CAPTION_THRESHOLD`: 200 characters
    - `MAX_PREVIEW_LINES`: 3 lines

    **Important Distinction**:
    - **User-provided title** (`article.title`) forces Hybrid
    - **Metadata title** (`article.media?.previewMetadata?.title`) does NOT force Hybrid (allowed in Media-Only)

    ---

    ## 3. MEDIA RENDERING VARIANTS

    **Location**: `src/components/card/atoms/CardMedia.tsx`

    ### 3.1 Media Classification

    **Utility**: `src/utils/mediaClassifier.ts` - `classifyArticleMedia()`

    Media is classified as:
    1. **Primary Media**: Exactly one (or null)
    - Priority: YouTube (3) > Image (2) > Document (1)
    - Used for thumbnail and card representation
    2. **Supporting Media**: Zero or more
    - All other media items
    - Displayed only in detail drawer, never in cards

    ### 3.2 Media Detection Sources

    Media can come from multiple legacy fields:
    1. `article.primaryMedia` (new format)
    2. `article.supportingMedia` (new format)
    3. `article.media` (legacy NuggetMedia)
    4. `article.images[]` (legacy array)
    5. `article.video` (legacy field)

    **Detection Logic**: `hasMedia = hasPrimaryMedia || hasSupportingMedia || hasLegacyMedia || hasLegacyImages || hasLegacyVideo`

    ### 3.3 Media Rendering Modes

    #### MODE 1: Multi-Image Grid
    **Conditions**:
    - Primary media is NOT YouTube
    - More than 1 image available
    - Primary media is image or null

    **Rendering**: `CardThumbnailGrid` component (2x2 grid, up to 4 images)

    #### MODE 2A: Twitter/LinkedIn Embed
    **Conditions**:
    - `article.media.type === 'twitter'` OR `'linkedin'`
    - Rendered via `EmbeddedMedia` component

    #### MODE 2B: Single Thumbnail
    **Sub-variants**:
    - **YouTube Video**: 
    - Thumbnail via YouTube API (`img.youtube.com/vi/{videoId}/hqdefault.jpg`)
    - Bottom overlay with YouTube logo + fetched title
    - `object-cover` styling (fills container)
    - **Single Image**:
    - For Media-Only cards: `object-contain` (no cropping)
    - For Hybrid cards: `object-contain` (preserve full image)
    - Uses `thumbnailUrl` from `getThumbnailUrl()`
    - **Document/PDF**:
    - Fixed height (`h-16`)
    - No aspect ratio constraint
    - Icon-based representation

    #### MODE 3: Fallback (No Media)
    **Rendering**: `CardGradientFallback` component (gradient background with title initials)

    ### 3.4 Thumbnail Selection

    **Utility**: `getThumbnailUrl()`

    **Priority Order**:
    1. `article.primaryMedia.thumbnail` (if exists)
    2. YouTube thumbnail (generated from video ID)
    3. `article.primaryMedia.url` (if type is image)
    4. First legacy image from `article.images[]` (fallback)

    ### 3.5 Image Object Fit Rules

    **Hybrid Cards**:
    - All images: `object-contain` (preserve full image, no cropping)

    **Media-Only Cards**:
    - All images: `object-contain` (preserve full image, no cropping)
    - YouTube: `object-cover` (standard YouTube thumbnail appearance)

    ---

    ## 4. CONDITIONAL LOGIC BASED ON DATA FIELDS

    ### 4.1 Source Type (`source_type`)

    **Location**: `useNewsCard.ts` (line 172)

    **Values**: `'link' | 'note' | 'idea' | undefined`

    **Effects**:
    - `isLink = source_type === 'link'`
    - `isNoteOrIdea = source_type === 'note' || source_type === 'idea'`
    - Title visibility: `shouldShowTitle = !!resolvedTitle && !isNoteOrIdea` (notes/ideas hide title)
    - Source badge: Only shown for `source_type === 'link'` in GridVariant overlay

    ### 4.2 Visibility (`visibility`)

    **Values**: `'public' | 'private' | undefined`

    **Effects**:
    - Lock icon overlay on media (`Lock` icon, top-left, dark background)
    - Private visibility indicator in CardMedia component

    ### 4.3 Provider/Media Type

    **Detection**: `classifyArticleMedia()` result

    **Media Types Supported**:
    - `'youtube'` - YouTube videos
    - `'image'` - Image files
    - `'document'` / `'pdf'` / `'doc'` / `'docx'` - Documents
    - `'twitter'` - Twitter embeds
    - `'linkedin'` - LinkedIn embeds
    - `'link'` - Generic links
    - `'text'` - Text-only

    **Rendering Differences**:
    - YouTube: Special thumbnail + title overlay
    - Images: Standard image rendering (grid or single)
    - Documents: Fixed height, icon-based
    - Twitter/LinkedIn: Embedded via `EmbeddedMedia` component

    ### 4.4 Title Resolution

    **Location**: `useNewsCard.ts` (lines 179-209)

    **Priority Order**:
    1. User-provided title (`article.title`) - Always wins if present and non-empty
    2. Metadata title (`article.media?.previewMetadata?.title`) - Fallback for rich links
    3. Empty string (no title)

    **Key Distinction**:
    - **User-provided title** (`article.title`) forces Hybrid card type
    - **Metadata title** does NOT force Hybrid (allowed in Media-Only cards)

    **Title Display Rules**:
    - `shouldShowTitle = !!resolvedTitle && !isNoteOrIdea`
    - Notes/ideas (`source_type === 'note' || 'idea'`) never show title

    ### 4.5 Text Content

    **Fields**: `article.content`, `article.excerpt`

    **Effects on Card Type**:
    - Length threshold: 200 characters (`CAPTION_THRESHOLD`)
    - Line threshold: 3 lines (`MAX_PREVIEW_LINES`)
    - Long text → Always Hybrid (enforcement rule)
    - Minimal text + no user title → Media-Only

    **Truncation Logic**:
    - Hybrid cards: Truncation wrapper with max-height (180px or 200px for tables)
    - Media-Only cards: No truncation wrapper (text in overlay)
    - "Read more" button appears when content overflows (measurement-based)

    ### 4.6 Categories/Tags

    **Fields**: `article.categories[]`, `article.tags[]`

    **Effects**:
    - Category tags rendered via `CardTags` component
    - Variant-specific styling:
    - Grid: Max 3, muted pills
    - Feed: 1-2 max, visually demoted
    - Masonry: Standard rendering
    - Tag popover for overflow (when many tags)

    ### 4.7 Author/Contributor

    **Fields**: `article.author`, `article.addedBy`

    **Effects**:
    - `showContributor = !!(article.addedBy && article.addedBy.userId !== article.author.id)`
    - Contributor badge shown at bottom if different from author
    - Author avatar/initials in CardMeta component

    ### 4.8 Selection Mode

    **Props**: `selectionMode`, `isSelected`, `onSelect`

    **Effects**:
    - Only supported in GridVariant
    - Checkbox overlay (top-right)
    - Selected state: `border-primary-500 ring-1 ring-primary-500`
    - Disables footer actions (`opacity-50 pointer-events-none`)

    ### 4.9 Preview Mode

    **Props**: `isPreview`

    **Effects**:
    - Disables mutation handlers (delete, edit, report, add to collection)
    - Allows UI-only interactions (menu toggle, tag popover)
    - Prevents API calls

    ---

    ## 5. BUSINESS RULES EMBEDDED IN RENDERING

    ### 5.1 Two-Card Architecture Enforcement

    **Rule**: Cards MUST be either Hybrid or Media-Only, never both.

    **Enforcement**:
    - Classification in `useNewsCard.ts` is deterministic
    - Once classified, variant respects `data.cardType`
    - Warning logged if Media-Only card has long text (audit)

    ### 5.2 Promotion Rule (Long Text → Hybrid)

    **Rule**: "If text needs truncation, it is not a Media-Only card."

    **Enforcement**:
    - Any text > 3 lines → MUST be Hybrid
    - Any text > 200 chars → MUST be Hybrid
    - Multi-image + long text → MUST be Hybrid

    **Rationale**: Media-Only cards are for visual content with minimal text only.

    ### 5.3 Media Priority Rules

    **Rule**: Exactly one primary media per nugget.

    **Priority Order**:
    1. YouTube videos (highest)
    2. Images (medium)
    3. Documents (lowest)

    **Enforcement**: `classifyArticleMedia()` applies strict priority rules.

    ### 5.4 Thumbnail Stability

    **Rule**: Thumbnails are stable and predictable.

    **Implementation**:
    - Thumbnail derived from primary media ONLY
    - Supporting media never influences thumbnail
    - Deterministic thumbnail URL generation

    ### 5.5 Title Hierarchy

    **Rule**: User-provided titles always win over metadata titles.

    **Implementation**:
    - `resolveCardTitle()` checks user title first
    - Metadata titles only used when user title is empty/absent
    - Classification uses user title only (not metadata) for card type decision

    ### 5.6 Media Supports Analysis

    **Principle**: "Media supports analysis, never competes with text."

    **Manifestation**:
    - Cards show SOURCE representation, not visual appeal
    - Primary media only (never supporting media in cards)
    - Thumbnails are stable and predictable

    ### 5.7 Truncation Rules

    **Rule**: Truncation applies to Hybrid cards only (by default).

    **Exception**: Media-Only cards with overflowing caption text can also show "Read more" (if `allowExpansion={true}`).

    **Measurement**:
    - Overflow detection via `scrollHeight > clientHeight + 1`
    - Minimum visible lines: 2.5 (prevents truncation for very short content)
    - Tables get taller max-height (200px vs 180px)

    ### 5.8 Click Behavior

    **Rules**:
    - Card body click → Opens article drawer/modal
    - Media click → Opens source URL (new tab) OR lightbox (if images)
    - Footer actions → Do NOT open drawer (event propagation stopped)
    - Selection mode → Card click toggles selection (if `selectionMode={true}`)

    ### 5.9 Visibility Rules

    **Rules**:
    - Private nuggets show lock icon overlay
    - Owner can toggle visibility (via menu)
    - Visibility change is optimistic update with rollback on error

    ### 5.10 Preview Metadata Display

    **Rules**:
    - Metadata titles displayed in Media-Only cards (overlay)
    - Metadata titles do NOT force Hybrid classification
    - YouTube titles fetched via oEmbed API (with backend fallback)

    ---

    ## 6. DATA FIELDS THAT INFLUENCE PRESENTATION

    ### Core Fields

    | Field | Type | Effect on Rendering |
    |-------|------|---------------------|
    | `id` | `string` | Unique identifier, used in keys |
    | `title` | `string?` | User-provided title (forces Hybrid if present) |
    | `content` | `string` | Body text (length affects card type) |
    | `excerpt` | `string` | Fallback for content, used in truncation |
    | `source_type` | `'link' \| 'note' \| 'idea' \| undefined` | Affects title visibility, badge display |
    | `visibility` | `'public' \| 'private' \| undefined` | Lock icon overlay |

    ### Media Fields

    | Field | Type | Effect on Rendering |
    |-------|------|---------------------|
    | `primaryMedia` | `PrimaryMedia?` | Primary media for thumbnail (YouTube/Image/Document) |
    | `supportingMedia` | `SupportingMediaItem[]?` | Shown in drawer only, "+N sources" badge |
    | `media` | `NuggetMedia?` | Legacy media field (Twitter/LinkedIn embeds) |
    | `images` | `string[]?` | Legacy images array (fallback) |
    | `video` | `string?` | Legacy video field |

    ### Metadata Fields

    | Field | Type | Effect on Rendering |
    |-------|------|---------------------|
    | `media.previewMetadata.title` | `string?` | Metadata title (fallback, doesn't force Hybrid) |
    | `media.previewMetadata.url` | `string?` | Source URL (opens on media click) |
    | `media.previewMetadata.imageUrl` | `string?` | OG image URL (fallback thumbnail) |
    | `media.previewMetadata.siteName` | `string?` | Site name for badges |

    ### Classification Fields

    | Field | Type | Effect on Rendering |
    |-------|------|---------------------|
    | `categories` | `string[]` | Category tags (variant-specific styling) |
    | `tags` | `string[]` | Additional tags |
    | `author` | `{id, name, avatar_url?}` | Author metadata, avatar display |
    | `addedBy` | `{userId, name}?` | Contributor badge if different from author |
    | `publishedAt` | `string` | Date formatting (relative or absolute) |

    ### Computed Fields (from useNewsCard)

    | Field | Type | Effect on Rendering |
    |-------|------|---------------------|
    | `cardType` | `'hybrid' \| 'media-only'` | Determines card layout structure |
    | `hasMedia` | `boolean` | Shows media block or gradient fallback |
    | `isLink` | `boolean` | Source badge display |
    | `isNoteOrIdea` | `boolean` | Hides title |
    | `isTextNugget` | `boolean` | Text-only nugget styling |
    | `shouldShowTitle` | `boolean` | Title visibility (user title OR metadata title, not notes/ideas) |

    ---

    ## 7. VARIANT-SPECIFIC DIFFERENCES

    ### 7.1 GridVariant
    - **Selection mode**: Supported (checkbox overlay)
    - **Media placement**: Top
    - **Tag display**: Max 3, muted pills
    - **Source badge**: Overlay on media (top-left)
    - **Spacing**: `p-4` (16px), `gap-2` (8px)

    ### 7.2 FeedVariant
    - **Selection mode**: Not supported
    - **Media placement**: Top (larger padding)
    - **Tag display**: 1-2 max, visually demoted
    - **Source badge**: Not shown
    - **Spacing**: `p-6` (24px), `gap-4` (16px)
    - **Hover effect**: Elevation (`-translate-y-0.5`)

    ### 7.3 MasonryVariant
    - **Selection mode**: Not supported
    - **Media placement**: Top
    - **Tag display**: Standard rendering
    - **Source badge**: Inline (below tags)
    - **Spacing**: `p-4` (16px)
    - **Layout**: `break-inside-avoid`, `height: auto`

    ### 7.4 UtilityVariant
    - **Selection mode**: Not supported
    - **Media placement**: Bottom (anchored with `mt-auto`)
    - **Tag display**: Standard rendering
    - **Source badge**: Inline (right side of header)
    - **Spacing**: `p-5` (20px), `gap-4` (16px)
    - **Accessibility**: Full keyboard navigation, ARIA labels

    ---

    ## 8. CONDITIONAL RENDERING SUMMARY

    ### 8.1 Card Type Selection
    ```
    IF no media → Hybrid
    ELSE IF long text (>3 lines OR >200 chars) → Hybrid
    ELSE IF minimal text (≤200 chars AND ≤3 lines) AND no user title → Media-Only
    ELSE → Hybrid
    ```

    ### 8.2 Media Rendering Selection
    ```
    IF primaryMedia is YouTube → Single thumbnail (YouTube)
    ELSE IF more than 1 image AND primaryMedia is NOT YouTube → Multi-image grid
    ELSE IF media.type === 'twitter' OR 'linkedin' → Embed
    ELSE IF primaryMedia is image → Single thumbnail
    ELSE IF primaryMedia is document → Document icon
    ELSE → Gradient fallback
    ```

    ### 8.3 Title Display
    ```
    IF (user title OR metadata title) AND NOT (note OR idea) → Show title
    ELSE → Hide title
    ```

    ### 8.4 Source Badge Display
    ```
    IF source_type === 'link' AND variant === 'grid' → Show overlay badge
    ELSE IF source_type === 'link' AND variant === 'utility' → Show inline badge
    ELSE → Hide badge
    ```

    ### 8.5 Contributor Badge
    ```
    IF addedBy exists AND addedBy.userId !== author.id → Show badge
    ELSE → Hide badge
    ```

    ---

    ## 9. AUDIT NOTES

    ### 9.1 Classification Warnings
    - Media-Only cards with long text trigger console warnings
    - Classification reason logged for debugging

    ### 9.2 Truncation Measurement
    - Overflow detection is measurement-based (not heuristic)
    - Requires max-height constraint for accurate measurement
    - Double RAF for layout stabilization

    ### 9.3 Legacy Support
    - Supports both new media architecture (`primaryMedia`/`supportingMedia`) and legacy fields (`media`, `images`, `video`)
    - Legacy fields used as fallback when new fields not present
    - Classification function handles both formats

    ---

    ## 10. FILES REFERENCED

    ### Core Components
    - `src/components/NewsCard.tsx` - Main orchestrator
    - `src/hooks/useNewsCard.ts` - Logic hook (classification, data transformation)
    - `src/components/card/variants/*.tsx` - Layout variants

    ### Atomic Components
    - `src/components/card/atoms/CardMedia.tsx` - Media rendering
    - `src/components/card/atoms/CardContent.tsx` - Text content with truncation
    - `src/components/card/atoms/CardBadge.tsx` - Source badge
    - `src/components/card/atoms/CardTags.tsx` - Category tags
    - `src/components/card/atoms/CardMeta.tsx` - Author/date metadata
    - `src/components/card/atoms/CardActions.tsx` - Action buttons

    ### Utilities
    - `src/utils/mediaClassifier.ts` - Media classification logic
    - `src/utils/urlUtils.ts` - URL parsing and provider detection

    ### Other Cards
    - `src/components/feed/FeedCardCompact.tsx` - Compact feed cards
    - `src/components/collections/CollectionCard.tsx` - Collection cards
    - `src/components/profile/ProfileCard.tsx` - Profile cards

    ---

    **END OF AUDIT**



