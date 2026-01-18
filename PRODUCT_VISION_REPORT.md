# Product Vision Report
## Project Nuggets - Source of Truth Document

**Generated:** 2026-01-10  
**Status:** Authoritative Reference  
**Purpose:** Long-term product understanding for engineering, design, and business alignment

---

## 1. Product Overview

### 1.1 Core Product Idea

**Project Nuggets** is a **knowledge management and content curation platform** that enables users to collect, organize, and share "nuggets" of information—articles, links, notes, and ideas—in a structured, discoverable format.

**Problem Being Solved:**
- **Information Overload:** Users struggle to organize and retrieve valuable content from the web
- **Knowledge Fragmentation:** Important insights are scattered across bookmarks, notes, and social media
- **Discovery Gap:** No unified way to discover curated content from trusted sources
- **Context Loss:** Links and articles lose context when saved without metadata and organization

**Core Value Proposition:**
Transform scattered information into a structured knowledge base with rich metadata, intelligent organization, and social discovery.

### 1.2 Target Users and Primary User Personas

**Inferred from codebase analysis:**

#### Persona 1: The Knowledge Curator
- **Primary Use Case:** Collects and organizes articles/links on specific topics
- **Behavior Patterns:**
  - Creates multiple collections (thematic lists)
  - Tags content extensively
  - Shares public collections
  - Follows other curators' collections
- **Evidence:** Collection system, tag management, public/private visibility, follower counts

#### Persona 2: The Content Creator
- **Primary Use Case:** Publishes original nuggets (notes, ideas, analysis)
- **Behavior Patterns:**
  - Creates nuggets with rich content (markdown support)
  - Uses multiple media types (images, videos, documents)
  - Organizes by tags/categories
  - Tracks engagement metrics
- **Evidence:** Rich text editor, media upload, markdown rendering, engagement tracking

#### Persona 3: The Admin/Moderator
- **Primary Use Case:** Manages platform content quality and user behavior
- **Behavior Patterns:**
  - Reviews reports and moderation requests
  - Manages tags/categories
  - Monitors user activity
  - Handles feedback
- **Evidence:** Admin panel, moderation system, report management, audit logs

#### Persona 4: The Casual Browser
- **Primary Use Case:** Discovers and consumes curated content
- **Behavior Patterns:**
  - Browses public feed
  - Searches by tags/categories
  - Views collections
  - Bookmarks interesting content
- **Evidence:** Public feed, search functionality, collection browsing, bookmark system (removed but evidence remains)

**User Role Hierarchy:**
- **Admin:** Full system access, moderation capabilities
- **User:** Standard content creation and curation

### 1.3 Jobs-to-be-Done

**JTBD 1: "Save and organize valuable content I find online"**
- **Solution:** Create nuggets from URLs with automatic metadata extraction
- **Evidence:** URL unfurling, preview metadata, external links system

**JTBD 2: "Find content on specific topics quickly"**
- **Solution:** Tag-based filtering, search, category organization
- **Evidence:** Tag system, search query support, category filtering

**JTBD 3: "Share curated knowledge with others"**
- **Solution:** Public collections, profile pages, social features
- **Evidence:** Public/private visibility, collections, profile pages, follower system

**JTBD 4: "Keep my personal notes and ideas organized"**
- **Solution:** Private nuggets, personal collections, My Space page
- **Evidence:** Private visibility, My Space page, personal collections

**JTBD 5: "Discover quality content from trusted curators"**
- **Solution:** Public feed, collection following, user profiles
- **Evidence:** Home feed, collection detail pages, user profiles

### 1.4 What Differentiates This Product

**Key Differentiators (Inferred):**

1. **Rich Metadata Extraction**
   - Automatic URL unfurling with preview metadata
   - Support for multiple media types (images, videos, documents, YouTube)
   - External links separate from content media

2. **Flexible Organization**
   - Dual classification: Tags (mandatory) + Collections (optional)
   - Multiple layout views (Grid, Masonry, Utility)
   - Layout visibility controls (show/hide in specific views)

3. **Content-First Design**
   - Multiple media items per nugget (primary + supporting)
   - Masonry layout for visual content
   - Rich text editor with markdown support

4. **Social Curation**
   - Public collections with follower system
   - Profile pages showcasing user's curated content
   - Community moderation and reporting

5. **Privacy Controls**
   - Public/private visibility per nugget
   - Private collections
   - User-controlled content sharing

**Competitive Positioning:**
- **vs. Pocket/Instapaper:** More social, better organization, richer metadata
- **vs. Notion:** Simpler, focused on curation, better discovery
- **vs. Pinterest:** More text-focused, better for articles/links, structured organization

---

## 2. Product Principles

### 2.1 Implied Product Values

**Inferred from code patterns and UX decisions:**

1. **User Control**
   - **Evidence:** Public/private visibility, layout visibility controls, manual title generation (no auto-modification)
   - **Tradeoff:** More complexity for users, but respects their intent

2. **Data Integrity**
   - **Evidence:** Content truncation detection, external links recovery system, migration safeguards
   - **Tradeoff:** Slower development, but prevents data loss

3. **Backward Compatibility**
   - **Evidence:** Legacy field support (categories alongside tags), virtual fields for name mapping, migration scripts
   - **Tradeoff:** Technical debt, but smooth user experience during transitions

4. **Progressive Enhancement**
   - **Evidence:** Fallback to in-memory data when MongoDB unavailable, graceful degradation
   - **Tradeoff:** More complex code, but resilient system

5. **Explicit User Intent**
   - **Evidence:** No auto-title generation, manual link promotion, explicit layout visibility
   - **Tradeoff:** More clicks, but prevents accidental changes

### 2.2 UX Philosophy

**Inferred from UI patterns:**

1. **Modal-First Interactions**
   - Create/Edit nuggets in modal overlays
   - Article details in modal overlays
   - **Rationale:** Keeps context, doesn't navigate away

2. **Infinite Scroll**
   - Primary navigation pattern for feeds
   - **Rationale:** Seamless content consumption

3. **Multi-View Support**
   - Grid, Masonry, Utility layouts
   - **Rationale:** Different content types need different presentations

4. **Progressive Disclosure**
   - Collapsible sections in create modal
   - Tab-based navigation in profile pages
   - **Rationale:** Reduces cognitive load

5. **Immediate Feedback**
   - Toast notifications for actions
   - Optimistic UI updates
   - **Rationale:** Perceived performance

### 2.3 Tradeoffs the Product Makes

**Explicit Tradeoffs (from code comments and patterns):**

1. **Complexity vs. Flexibility**
   - **Choice:** Complex media system (primary + supporting + external links)
   - **Benefit:** Handles diverse content types
   - **Cost:** Higher cognitive load, more bugs

2. **Performance vs. Features**
   - **Choice:** Client-side filtering for some features (e.g., "Today" filter)
   - **Benefit:** Faster iteration, no backend changes
   - **Cost:** Pagination semantics break, approximate results

3. **Data Consistency vs. Speed**
   - **Choice:** Dual-write pattern during migrations (tags + categoryIds)
   - **Benefit:** Smooth transition, no data loss
   - **Cost:** Temporary inconsistency, cleanup needed

4. **Security vs. Usability**
   - **Choice:** JWT tokens in localStorage (not httpOnly cookies)
   - **Benefit:** Simpler implementation, works across subdomains
   - **Cost:** XSS vulnerability risk

5. **Backend Simplicity vs. Frontend Flexibility**
   - **Choice:** Backend doesn't enforce all business rules (e.g., admin checks)
   - **Benefit:** Faster development, flexible frontend
   - **Cost:** Security risk, inconsistent behavior

---

## 3. Feature Set (Current State)

### 3.1 Major User-Facing Features

#### Content Creation & Management
- **Create Nuggets:** Rich text editor, URL input, media upload, tag assignment
- **Edit Nuggets:** Full edit capability with partial update semantics
- **Delete Nuggets:** User can delete own content
- **Media Management:** 
  - Primary media (thumbnail representation)
  - Supporting media (additional images/videos)
  - External links (separate from content media)
  - Masonry layout visibility controls
- **Layout Visibility:** Control which views display each nugget

#### Content Discovery
- **Home Feed:** Infinite scroll with pagination
- **Search:** Full-text search with query parameter
- **Tag Filtering:** Filter by tags (client-side for some, backend for others)
- **Category Filtering:** Legacy category support (being phased out)
- **Sort Options:** Latest, Oldest, Title (A-Z, Z-A)
- **View Modes:** Grid, Masonry, Utility layouts

#### Organization
- **Collections:** Thematic lists of nuggets
  - Public/private collections
  - Follower system
  - Entry flagging (mark irrelevant)
- **Tags:** Mandatory classification system
  - Case-insensitive matching
  - Stable ID references (tagIds)
  - Official tag designation
- **My Space:** Personal content management page
  - Public/private nugget filtering
  - Collection management
  - Bulk actions (delete, add to collection)

#### Social Features
- **User Profiles:** Public profile pages
- **Collection Following:** Follow public collections
- **Content Sharing:** Public/private visibility controls
- **Reporting:** Report inappropriate content (nuggets, users, collections)

#### Admin Features
- **Admin Panel:** Comprehensive management interface
  - User management
  - Nugget management
  - Collection management
  - Tag management
  - Moderation (reports, feedback)
  - System configuration
  - Legal pages management
- **Moderation Actions:** Resolve/dismiss reports with audit trail
- **Statistics:** Dashboard with counts and metrics

### 3.2 Hidden or Partially Implemented Features

**Partially Implemented:**

1. **Bookmark System**
   - **Status:** Removed (evidence in codebase)
   - **Evidence:** `BOOKMARK_REMOVAL_REPORT.md`, `bookmarks/` directory references
   - **Reason:** Replaced by collections system

2. **Feed Layout**
   - **Status:** Removed (redirects to home)
   - **Evidence:** Route redirects in `App.tsx`
   - **Reason:** Unified into home page with view modes

3. **Batch Import**
   - **Status:** Removed
   - **Evidence:** `BATCH_IMPORT_REMOVAL_*` reports
   - **Reason:** Not actively used, maintenance burden

4. **AI Creation**
   - **Status:** Fully removed
   - **Evidence:** `AI_CREATION_REMOVAL_SUMMARY.md`, 410 Gone responses for `/api/ai/*`
   - **Reason:** Replaced by manual creation flow

5. **Preferences System**
   - **Status:** Partially implemented
   - **Evidence:** User model has preferences, but limited UI
   - **Gap:** Theme preference exists but not all preferences exposed in UI

6. **Email Verification**
   - **Status:** Routes exist, but flow incomplete
   - **Evidence:** `VerifyEmailPage.tsx` exists, but no email sending logic visible

7. **Password Reset**
   - **Status:** Routes exist, but flow incomplete
   - **Evidence:** `ResetPasswordPage.tsx` exists, but no email sending logic visible

**Hidden Features (Not Exposed in UI):**

1. **Custom Creation Date**
   - **Status:** Admin-only, backend supports it
   - **Evidence:** `customCreatedAt` field in Article model, `isCustomCreatedAt` flag
   - **Use Case:** Backdating content for historical accuracy

2. **Display Author**
   - **Status:** Supported in data model, limited UI exposure
   - **Evidence:** `displayAuthor` field in Article type
   - **Use Case:** Mask real author (admin feature)

3. **Layout Visibility Per Nugget**
   - **Status:** Implemented but not prominently featured
   - **Evidence:** `LayoutVisibilitySection` in create modal
   - **Use Case:** Hide nuggets from specific views

4. **Masonry Titles**
   - **Status:** Supported but optional
   - **Evidence:** `masonryTitle` field in media items
   - **Use Case:** Captions for masonry tiles

### 3.3 Feature Maturity Assessment

**Stable (Production-Ready):**
- ✅ User authentication (JWT, email/password)
- ✅ Nugget creation and editing
- ✅ Media upload and management
- ✅ Tag system (case-insensitive, stable IDs)
- ✅ Collections (CRUD, entries, following)
- ✅ Home feed with infinite scroll
- ✅ Search functionality
- ✅ Admin panel (users, nuggets, collections, tags, moderation)
- ✅ Public/private visibility
- ✅ Profile pages
- ✅ Moderation and reporting

**Experimental (Working but May Change):**
- ⚠️ Layout visibility controls (new feature, limited usage)
- ⚠️ External links system (recent refactor, migration pending)
- ⚠️ Masonry layout (complex media handling)
- ⚠️ Multi-view switching (Grid/Masonry/Utility)

**Incomplete (Partially Implemented):**
- ❌ Email verification flow
- ❌ Password reset flow
- ❌ User preferences UI (data model exists, limited UI)
- ❌ Social features (following, notifications)
- ❌ Analytics/engagement tracking (data collected, limited UI)

---

## 4. User Flows

### 4.1 Key End-to-End Flows

#### Flow 1: Create a Nugget from URL
1. User clicks "Create Nugget" button
2. Modal opens with empty form
3. User pastes URL into URL input
4. System unfurls URL, extracts metadata (title, description, image)
5. User edits title/content if needed
6. User selects tags (mandatory)
7. User optionally adds to collections
8. User sets visibility (public/private)
9. User optionally uploads additional media
10. User clicks "Create"
11. System validates (tags required, content not empty)
12. System saves to database
13. Modal closes, feed refreshes
14. New nugget appears in feed

**Edge Cases:**
- URL unfurling fails → User can still create with manual entry
- Invalid URL → Validation error, user must fix
- Duplicate URL → No prevention, user can create duplicate
- No tags selected → Validation error, creation blocked

#### Flow 2: Edit Existing Nugget
1. User opens nugget detail (modal or page)
2. User clicks "Edit" button (if owner)
3. Edit modal opens with pre-filled data
4. System detects legacy links (if any) and shows "Detected Links" section
5. User can promote legacy links to external links
6. User modifies fields (title, content, tags, visibility, etc.)
7. User clicks "Save"
8. System sends partial update (only changed fields)
9. Backend validates and updates
10. Modal closes, UI updates optimistically
11. Changes reflected immediately

**Edge Cases:**
- User not owner → Edit button hidden/disabled
- Concurrent edits → Last write wins (no conflict resolution)
- External links migration → Conditional inclusion prevents data loss
- Empty content → Validation error (content required)

#### Flow 3: Discover Content via Tags
1. User views home feed
2. User sees tag filter bar with counts
3. User clicks a tag
4. System filters articles client-side (if backend doesn't support)
5. Feed updates to show only tagged articles
6. User can click same tag again to deselect
7. User can select different tag (replaces current selection)

**Edge Cases:**
- No articles with tag → Empty state shown
- Tag casing mismatch → Handled by case-insensitive matching
- Tag renamed → Stable IDs prevent breakage

#### Flow 4: Create and Share Collection
1. User navigates to Collections page
2. User clicks "Create Collection"
3. Modal opens with name/description fields
4. User enters collection details
5. User sets visibility (public/private)
6. User clicks "Create"
7. System creates collection (idempotent for "General Bookmarks")
8. User can add nuggets to collection
9. Public collections appear in collections feed
10. Other users can follow collection

**Edge Cases:**
- Duplicate name → Idempotent creation for "General Bookmarks", error for others
- Private collection → Only creator can see
- Empty collection → Allowed, can add entries later

#### Flow 5: Admin Moderation
1. User reports inappropriate content
2. Report saved with status "open"
3. Admin views moderation page
4. Admin sees report in "Open" tab
5. Admin reviews report details
6. Admin clicks "Take Action" → Confirmation modal
7. Admin resolves or dismisses report
8. System updates report status, creates audit log
9. Report moves to "Resolved" or "Dismissed" tab
10. Counts update optimistically

**Edge Cases:**
- Duplicate reports → Multiple reports allowed, admin can resolve all
- Already resolved → Idempotent, returns 200
- Resolve dismissed report → Returns 409 conflict

### 4.2 State Transitions

**Nugget Visibility:**
- `public` → `private`: Immediate, no confirmation
- `private` → `public`: Immediate, no confirmation
- **Gap:** No bulk visibility change

**Collection Type:**
- `public` → `private`: Allowed, followers remain
- `private` → `public`: Allowed, becomes discoverable
- **Gap:** No migration of followers when changing type

**Tag Status:**
- `active` → `deprecated`: Admin action, affects all articles
- `deprecated` → `active`: Admin action
- **Gap:** No cascade update of article tags when tag deprecated

**Report Status:**
- `open` → `resolved`: Admin action, idempotent
- `open` → `dismissed`: Admin action, idempotent
- `resolved` → `open`: Not supported
- `dismissed` → `open`: Not supported

### 4.3 Where Users Can Get Stuck or Confused

**High Confusion Risk Areas:**

1. **Tag vs. Category Confusion**
   - **Issue:** Legacy "categories" terminology mixed with "tags"
   - **Evidence:** Code comments mention "CATEGORY PHASE-OUT"
   - **Impact:** Users may not understand which to use
   - **Recommendation:** Complete migration, remove category references

2. **External Links vs. Media URLs**
   - **Issue:** Two separate systems for links (media.url vs externalLinks)
   - **Evidence:** External links recovery system, detected links section
   - **Impact:** Users may not understand when to use which
   - **Recommendation:** Clear UI distinction, better documentation

3. **Layout Visibility Controls**
   - **Issue:** Hidden feature, not prominently displayed
   - **Evidence:** LayoutVisibilitySection in create modal
   - **Impact:** Users may not know they can control visibility per view
   - **Recommendation:** More prominent UI, tooltips

4. **Masonry Media Selection**
   - **Issue:** Complex system (primary + supporting + showInMasonry flags)
   - **Evidence:** MasonryMediaToggle component, multiple media fields
   - **Impact:** Users may not understand which media shows where
   - **Recommendation:** Visual preview, clearer labels

5. **Collection Entry Flagging**
   - **Issue:** Feature exists but purpose unclear
   - **Evidence:** Flag endpoint in collections API
   - **Impact:** Users may not understand when to flag entries
   - **Recommendation:** UI tooltips, documentation

6. **Private vs. Public Confusion**
   - **Issue:** Visibility controls in multiple places
   - **Evidence:** Visibility toggle in create modal, My Space page
   - **Impact:** Users may not understand scope of privacy
   - **Recommendation:** Consistent UI, clear labels

---

## 5. Data & Knowledge Model (Product View)

### 5.1 Core Entities and Relationships

**Entity: Nugget (Article)**
- **Identity:** `id` (MongoDB ObjectId)
- **Ownership:** `authorId` (User reference)
- **Classification:** `tags[]` (Tag references, mandatory), `tagIds[]` (stable IDs)
- **Organization:** Can belong to multiple Collections (via Collection.entries)
- **Visibility:** `visibility: 'public' | 'private'`
- **Content:** `title`, `content`, `excerpt`, `media`, `primaryMedia`, `supportingMedia[]`
- **Metadata:** `publishedAt`, `readTime`, `engagement` (views, bookmarks, shares)
- **Presentation:** `layoutVisibility`, `displayImageIndex`, `externalLinks[]`

**Entity: User**
- **Identity:** `id` (MongoDB ObjectId)
- **Authentication:** `auth.email`, `auth.provider`, `password` (hashed)
- **Profile:** `profile.displayName`, `profile.username`, `profile.bio`, `profile.avatarUrl`
- **Preferences:** `preferences.theme`, `preferences.interestedCategories[]`
- **State:** `appState.onboardingCompleted`, `appState.lastLoginAt`
- **Role:** `role: 'admin' | 'user'`

**Entity: Collection**
- **Identity:** `id` (MongoDB ObjectId)
- **Ownership:** `creatorId` (User reference)
- **Content:** `entries[]` (Nugget references via articleId)
- **Social:** `followers[]` (User IDs), `followersCount`
- **Visibility:** `type: 'public' | 'private'`
- **Naming:** `rawName` (display), `canonicalName` (lookup)

**Entity: Tag**
- **Identity:** `id` (MongoDB ObjectId)
- **Naming:** `rawName` (display), `canonicalName` (lookup, unique)
- **Metadata:** `usageCount`, `type: 'category' | 'tag'`, `status: 'active' | 'pending' | 'deprecated'`, `isOfficial`
- **Relationships:** Referenced by Nuggets via `tagIds[]`

**Entity: Report**
- **Identity:** `id` (MongoDB ObjectId)
- **Target:** `targetId`, `targetType: 'nugget' | 'user' | 'collection'`
- **Reporter:** `reporter.id`, `reporter.name`
- **Status:** `status: 'open' | 'resolved' | 'dismissed'`
- **Audit:** `resolvedAt`, `dismissedAt`, `actionedBy`, `actionReason`

### 5.2 What is Treated as "Source of Truth"

**Backend as Source of Truth:**
- ✅ User authentication and authorization
- ✅ Nugget content and metadata
- ✅ Tag definitions and usage counts
- ✅ Collection membership and follower counts
- ✅ Report status and moderation actions

**Frontend as Source of Truth (Temporary):**
- ⚠️ Some filtering logic (e.g., "Today" filter, tag filtering in some cases)
- ⚠️ View mode state (Grid/Masonry/Utility)
- ⚠️ UI preferences (not persisted)

**Database as Source of Truth:**
- ✅ All persistent data (MongoDB)
- ✅ Media files (Cloudinary, referenced by URL)
- ✅ User sessions (JWT tokens, not stored server-side)

### 5.3 Where Duplication or Ambiguity Exists

**Duplication Issues:**

1. **Tag Name Storage**
   - **Location 1:** `Tag.rawName` (display name)
   - **Location 2:** `Tag.canonicalName` (normalized, for matching)
   - **Location 3:** `Article.tags[]` (string array, legacy)
   - **Location 4:** `Article.tagIds[]` (ObjectId references, new)
   - **Issue:** Four places to store/retrieve tag information
   - **Impact:** Casing issues, rename complexity
   - **Status:** Migration in progress (tagIds being adopted)

2. **Category vs. Tag**
   - **Legacy:** `Article.categories[]` (being phased out)
   - **New:** `Article.tags[]` + `Article.tagIds[]`
   - **Issue:** Two classification systems during migration
   - **Impact:** User confusion, code complexity
   - **Status:** Migration in progress, categories deprecated

3. **Media URL Storage**
   - **Location 1:** `Article.media.url` (legacy primary media)
   - **Location 2:** `Article.primaryMedia.url` (new primary media)
   - **Location 3:** `Article.supportingMedia[].url` (supporting media)
   - **Location 4:** `Article.externalLinks[].url` (external links, separate purpose)
   - **Issue:** Multiple places for URLs with different purposes
   - **Impact:** External links recovery needed, user confusion
   - **Status:** External links system recently added, migration ongoing

4. **Collection Name Storage**
   - **Location 1:** `Collection.rawName` (display)
   - **Location 2:** `Collection.canonicalName` (lookup)
   - **Location 3:** `Collection.name` (virtual, maps to rawName)
   - **Issue:** Three ways to access the same data
   - **Impact:** Code complexity, but necessary for backward compatibility
   - **Status:** Virtual field for compatibility, acceptable

5. **User Name Storage**
   - **Location 1:** `User.profile.displayName` (primary)
   - **Location 2:** `User.profile.username` (unique identifier)
   - **Location 3:** `Article.authorName` (denormalized)
   - **Issue:** Author name stored in both User and Article
   - **Impact:** Rename requires update of all articles
   - **Status:** Denormalization for performance, acceptable tradeoff

**Ambiguity Issues:**

1. **"Category" Terminology**
   - **Ambiguity:** Code uses "category" but system uses "tags"
   - **Evidence:** `selectedCategories` prop name, but represents tags
   - **Impact:** Developer confusion, potential user confusion
   - **Recommendation:** Complete terminology migration

2. **Media Type Classification**
   - **Ambiguity:** `media.type` vs `previewMetadata.mediaType`
   - **Issue:** Two fields for similar purpose
   - **Impact:** Potential inconsistency
   - **Status:** `media.type` is primary, `previewMetadata.mediaType` is metadata

3. **Visibility vs. Type**
   - **Ambiguity:** `Article.visibility` (public/private) vs `Collection.type` (public/private)
   - **Issue:** Different field names for same concept
   - **Impact:** Code inconsistency
   - **Recommendation:** Standardize terminology (use "visibility" everywhere)

---

## 6. Non-Functional Product Concerns

### 6.1 Performance Expectations Implied by UX

**Inferred from UI patterns:**

1. **Feed Loading**
   - **Expectation:** Initial load < 2 seconds
   - **Evidence:** Infinite scroll, pagination (25 items per page)
   - **Reality:** Depends on backend query performance, network speed

2. **Search Response**
   - **Expectation:** Results appear as user types (no debouncing visible)
   - **Evidence:** Search query triggers immediate API call
   - **Reality:** May cause excessive API calls, performance issues
   - **Gap:** No debouncing implemented

3. **Modal Opening**
   - **Expectation:** Instant (optimistic)
   - **Evidence:** Modal opens immediately, data loads in background
   - **Reality:** Good UX, but may show loading states

4. **Image Loading**
   - **Expectation:** Progressive loading, thumbnails first
   - **Evidence:** Thumbnail URLs, aspect ratio preservation
   - **Reality:** Depends on Cloudinary/CDN performance

5. **Infinite Scroll**
   - **Expectation:** Seamless, no loading breaks
   - **Evidence:** `isFetchingNextPage` state, loading indicators
   - **Reality:** Good UX pattern, but depends on backend pagination

### 6.2 Accessibility Considerations

**Present:**
- ✅ Dark mode support (theme preference)
- ✅ Keyboard navigation (some components)
- ✅ ARIA labels (some components, e.g., DetectedLinksSection)
- ✅ Error messages (user-friendly formatting)

**Missing:**
- ❌ Screen reader testing not evident
- ❌ Focus management in modals (not consistently implemented)
- ❌ Keyboard shortcuts (not documented)
- ❌ High contrast mode (not tested)
- ❌ Alt text for images (not consistently required)

**Recommendation:** Accessibility audit needed, especially for modals and forms

### 6.3 Internationalization / Extensibility Assumptions

**Current State:**
- ❌ No i18n framework (hardcoded English strings)
- ❌ No locale support
- ❌ Date formatting uses ISO strings (not localized)
- ❌ Number formatting not localized

**Assumptions:**
- English-only user base
- US date/time formats acceptable
- No RTL language support needed

**Recommendation:** If international expansion planned, i18n should be early priority

### 6.4 Offline / Sync Assumptions

**Current State:**
- ❌ No offline support
- ❌ No service worker
- ❌ No local caching strategy (beyond React Query)
- ❌ No sync mechanism

**Assumptions:**
- Always-online usage
- Network connectivity required for all operations
- No offline reading/writing

**Recommendation:** If mobile usage expected, consider offline support

---

## 7. Product Gaps & Risks

### 7.1 Missing Flows

**Critical Missing Flows:**

1. **Email Verification**
   - **Status:** Routes exist, but no email sending
   - **Impact:** Users can't verify emails, security risk
   - **Priority:** High (security)

2. **Password Reset**
   - **Status:** Routes exist, but no email sending
   - **Impact:** Users can't reset passwords, support burden
   - **Priority:** High (user experience)

3. **User Onboarding**
   - **Status:** `onboardingCompleted` flag exists, but no flow
   - **Impact:** New users may be confused
   - **Priority:** Medium (user experience)

4. **Content Export**
   - **Status:** No export functionality
   - **Impact:** Users can't backup their data
   - **Priority:** Medium (data portability)

5. **Bulk Operations**
   - **Status:** Limited bulk operations (delete in My Space)
   - **Impact:** Users can't efficiently manage large amounts of content
   - **Priority:** Low (power users)

### 7.2 UX Inconsistencies

**Identified Inconsistencies:**

1. **Terminology**
   - "Category" vs "Tag" (migration in progress)
   - "Nugget" vs "Article" (both used)
   - **Impact:** User confusion

2. **Modal Behavior**
   - Some modals close on outside click, others don't
   - Some modals have escape key handling, others don't
   - **Impact:** Inconsistent user experience

3. **Error Handling**
   - Some errors show toasts, others show inline
   - Some errors are user-friendly, others are technical
   - **Impact:** Inconsistent error experience

4. **Loading States**
   - Some operations show loading spinners, others don't
   - Some operations are optimistic, others are not
   - **Impact:** Inconsistent feedback

5. **Confirmation Dialogs**
   - Some destructive actions confirm, others don't
   - **Impact:** Accidental deletions possible

### 7.3 Conceptual Mismatches

**UI vs. Data Model Mismatches:**

1. **Tag Selection UI**
   - **UI:** Single tag selection in filter bar
   - **Data Model:** Articles can have multiple tags
   - **Mismatch:** UI suggests single tag, but data supports multiple
   - **Impact:** Users may not understand they can filter by multiple tags

2. **Collection Entry Display**
   - **UI:** Shows "Added by" information
   - **Data Model:** `addedByUserId` stored, but not always displayed
   - **Mismatch:** Data exists but not consistently shown
   - **Impact:** Users may not see who added what

3. **Media Display**
   - **UI:** Shows primary media in cards
   - **Data Model:** Supports multiple media types (primary + supporting)
   - **Mismatch:** Supporting media not visible in cards
   - **Impact:** Users may not know additional media exists

### 7.4 Areas Likely to Cause User Confusion

**High Risk Areas:**

1. **External Links vs. Media URLs**
   - **Confusion:** When to use external links vs. media URLs
   - **Evidence:** External links recovery system needed
   - **Recommendation:** Clear UI distinction, help text

2. **Layout Visibility**
   - **Confusion:** What does "hide in masonry" mean?
   - **Evidence:** Feature exists but not prominently displayed
   - **Recommendation:** Visual preview, tooltips

3. **Tag vs. Collection**
   - **Confusion:** When to use tags vs. collections
   - **Evidence:** Both systems exist, overlap in purpose
   - **Recommendation:** Clear guidance, examples

4. **Public vs. Private**
   - **Confusion:** What's the difference, who can see what?
   - **Evidence:** Visibility controls in multiple places
   - **Recommendation:** Consistent UI, clear labels

5. **Masonry Media Selection**
   - **Confusion:** Which media shows in masonry layout?
   - **Evidence:** Complex system (primary + supporting + flags)
   - **Recommendation:** Visual preview, clearer labels

---

## 8. Product Roadmap Suggestions (High-Level)

### 8.1 Immediate Fixes (High Leverage, Low Effort)

1. **Complete Tag/Category Migration**
   - **Effort:** Medium (1-2 weeks)
   - **Impact:** High (removes confusion, simplifies code)
   - **Action:** Remove all category references, complete tag migration

2. **Add Search Debouncing**
   - **Effort:** Low (1 day)
   - **Impact:** Medium (reduces API calls, improves performance)
   - **Action:** Add 300ms debounce to search input

3. **Standardize Error Messages**
   - **Effort:** Low (2-3 days)
   - **Impact:** Medium (better user experience)
   - **Action:** Create error message utility, use consistently

4. **Add Confirmation Dialogs**
   - **Effort:** Low (1-2 days)
   - **Impact:** Medium (prevents accidental deletions)
   - **Action:** Add confirmations for all destructive actions

5. **Complete External Links Migration**
   - **Effort:** Medium (1 week)
   - **Impact:** High (prevents data loss, simplifies system)
   - **Action:** Run migration script, remove legacy link handling

### 8.2 Structural Improvements

1. **Implement Email System**
   - **Effort:** High (2-3 weeks)
   - **Impact:** High (enables verification, password reset)
   - **Action:** Choose email provider, implement sending, add templates

2. **Unify Terminology**
   - **Effort:** Medium (1 week)
   - **Impact:** Medium (reduces confusion)
   - **Action:** Audit all user-facing text, standardize terms

3. **Improve Accessibility**
   - **Effort:** High (2-3 weeks)
   - **Impact:** High (legal compliance, broader user base)
   - **Action:** Audit with screen readers, fix issues, add ARIA labels

4. **Add User Onboarding**
   - **Effort:** Medium (1-2 weeks)
   - **Impact:** Medium (improves new user experience)
   - **Action:** Design flow, implement tour/tooltips

5. **Implement Offline Support**
   - **Effort:** High (3-4 weeks)
   - **Impact:** Medium (improves mobile experience)
   - **Action:** Add service worker, implement caching strategy

### 8.3 Strategic Expansions

1. **Social Features**
   - **Effort:** High (4-6 weeks)
   - **Impact:** High (increases engagement)
   - **Features:** Following users, notifications, activity feed

2. **Advanced Search**
   - **Effort:** Medium (2-3 weeks)
   - **Impact:** Medium (improves discovery)
   - **Features:** Filters (date range, author, tags), saved searches

3. **Content Export**
   - **Effort:** Medium (1-2 weeks)
   - **Impact:** Medium (data portability)
   - **Features:** Export to JSON, Markdown, PDF

4. **Analytics Dashboard**
   - **Effort:** High (3-4 weeks)
   - **Impact:** Medium (helps users understand their content)
   - **Features:** Views, engagement, tag usage, collection stats

5. **Mobile App**
   - **Effort:** Very High (3-6 months)
   - **Impact:** High (broader reach)
   - **Features:** Native iOS/Android apps with offline support

---

**End of Product Vision Report**
