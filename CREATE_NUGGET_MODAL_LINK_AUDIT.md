# CreateNuggetModal.tsx Link Data Contract Audit

**Date:** 2026-01-10  
**Scope:** Link-related state symmetry between create/edit, form state/API payload, API response/form hydration  
**Focus:** External links refactor impact on data contract

---

## Executive Summary

**Root Cause Classification:** **One-way mapping / Missing hydration**

The external links refactor introduced a data contract asymmetry where `externalLinks` are always sent in update payloads (violating edit mode partial update semantics), and there is no migration logic to populate `externalLinks` from legacy fields. While hydration exists from `initialData.externalLinks`, the unconditional payload assignment means that if an article lacks `externalLinks` in the database (pre-refactor articles), editing and saving will overwrite any legacy link data with an empty array.

---

## 1️⃣ All Link-Related State

### State Variables

| Variable | Line | Initialization | Source of Truth |
|----------|------|----------------|-----------------|
| `externalLinks` | 142 | `useState<ExternalLink[]>([])` | Form state (`externalLinks` state variable) |
| `urls` | 94 | `useState<string[]>([])` | Form state (media URLs - separate from externalLinks) |
| `detectedLink` | 96 | `useState<string \| null>(null)` | Derived from `urls` (media URL detection) |
| `linkMetadata` | 97 | `useState<NuggetMedia \| null>(null)` | Metadata for media URLs (separate from externalLinks) |

### Key Observations

- **Two separate link systems exist:**
  - `urls` / `detectedLink` / `linkMetadata` → Media URLs (content sources)
  - `externalLinks` → External Links (card "Link" button, separate field)
- **`externalLinks` is initialized as empty array** (line 142)
- **No computed/derived values** for `externalLinks` - it's directly managed state

---

## 2️⃣ Edit Mode Hydration Audit

### Edit Mode Detection

**Location:** Line 186  
**Condition:** `mode === 'edit' && initialData && initializedFromDataRef.current !== initialData.id`

### Hydration Logic

**Location:** Lines 204-209

```tsx
setVisibility(initialData.visibility || 'public');
// Initialize externalLinks and layoutVisibility from initialData
setExternalLinks(initialData.externalLinks || []);
setLayoutVisibility(initialData.layoutVisibility || {
  grid: true,
  masonry: true,
  utility: true,
  feed: true,
});
```

### Answer to Key Question

**Q: Is any link-related field populated from `article.externalLinks`?**

**A: YES** - Line 209: `setExternalLinks(initialData.externalLinks || []);`

**However, there is a critical gap:**

- ✅ `externalLinks` state IS hydrated from `initialData.externalLinks`
- ❌ There is **NO migration logic** to populate `externalLinks` from legacy fields
- ❌ If `initialData.externalLinks` is `undefined` or `null` (pre-refactor articles), it defaults to `[]`
- ❌ This means old articles without `externalLinks` field will have empty array in form state

### Additional Context

**Lines 217-234** show that `urls` and `detectedLink` are hydrated from `initialData.media?.url` or `initialData.media?.previewMetadata?.url`, but this is for **media URLs**, not external links. These are separate systems.

---

## 3️⃣ Submit Payload Construction Audit

### Submit Handler

**Function:** `handleSubmit`  
**Location:** Line 1265

### Edit Mode Payload (UPDATE)

**Location:** Lines 1424-1472

```tsx
// Line 1425-1426: Comment states "CRITICAL: Only include fields that have changed (EDIT mode semantics)"
const updatePayload: Partial<Article> = {
  title: normalizedInput.title,
  content: normalizedInput.content,
  visibility: normalizedInput.visibility,
  readTime: normalizedInput.readTime,
  excerpt: normalizedInput.excerpt,
  tags: normalizedInput.tags,
};

// Lines 1436-1468: Most fields are CONDITIONALLY included
if (normalizedInput.images !== undefined) {
  updatePayload.images = normalizedInput.images;
}
if (normalizedInput.mediaIds !== undefined) {
  updatePayload.mediaIds = normalizedInput.mediaIds;
}
// ... other conditional fields ...

// Line 1470-1471: ⚠️ VIOLATION OF EDIT MODE SEMANTICS
// Add externalLinks and layoutVisibility to updatePayload
updatePayload.externalLinks = externalLinks;
updatePayload.layoutVisibility = layoutVisibility;
```

### Create Mode Payload

**Location:** Lines 1681-1704

```tsx
const createPayload = {
  title: normalized.title,
  content: normalized.content,
  excerpt: normalized.excerpt,
  // ... other fields ...
  externalLinks: (() => {
    // debug log
    return externalLinks;
  })(),
  layoutVisibility: layoutVisibility,
};
```

### Answers to Key Questions

**Q: Are externalLinks always sent?**  
**A: YES** - In both create and update modes, `externalLinks` is always included in the payload.

**Q: Are they conditionally sent?**  
**A: NO** - Unlike other optional fields (images, mediaIds, documents, media, supportingMedia) which use conditional checks, `externalLinks` is **unconditionally assigned** on line 1471.

**Q: Are they replaced with [] when a link field is empty?**  
**A: YES** - If `externalLinks` state is `[]` (which happens if `initialData.externalLinks` is undefined/null), the payload will contain `externalLinks: []`, which may overwrite existing database values.

**Q: Is create logic different from update logic?**  
**A: NO** - Both create and update use identical logic: `externalLinks: externalLinks` (or `updatePayload.externalLinks = externalLinks`). However, create mode always sends all fields, while update mode is supposed to use partial updates (but `externalLinks` violates this).

---

## 4️⃣ Round-Trip Safety Check

### Binary Question

**If a user opens an existing nugget with an external link, makes no changes, and clicks save — will the link survive?**

**Answer: DEPENDS**

**Scenario A: Article has `externalLinks` in database (post-refactor)**
- ✅ Hydration: Line 209 sets `externalLinks = initialData.externalLinks`
- ✅ Submit: Line 1471 sends `externalLinks: initialData.externalLinks`
- ✅ **Links will survive** (assuming backend doesn't treat empty array as "clear")

**Scenario B: Article lacks `externalLinks` in database (pre-refactor article)**
- ❌ Hydration: Line 209 sets `externalLinks = []` (because `initialData.externalLinks` is undefined)
- ❌ Submit: Line 1471 sends `externalLinks: []`
- ❌ **Links will be lost** - Empty array overwrites any legacy link data

### Exact Lines Causing Link Loss

**Line 209:** `setExternalLinks(initialData.externalLinks || []);`
- If `initialData.externalLinks` is undefined/null, defaults to `[]`
- No migration from legacy fields

**Line 1471:** `updatePayload.externalLinks = externalLinks;`
- Unconditionally assigns `externalLinks` state (which may be `[]`)
- Violates edit mode partial update semantics (should be conditional like other fields)

---

## 5️⃣ Canonical Source of Truth Decision

### Current State

**Domain Field:** `externalLinks[]` (as defined in Article interface, line 250 of `src/types/index.ts`)

**Form State:** `externalLinks` state variable (line 142 of CreateNuggetModal.tsx)

### Analysis

- ✅ `externalLinks[]` IS the canonical domain field (defined in Article interface)
- ✅ Form state uses `externalLinks` variable (matches domain field name)
- ✅ Create payload uses `externalLinks` field
- ✅ Update payload uses `externalLinks` field

**However, there is a split-brain issue:**

- ❌ `urls` array (media URLs) is a separate form state field
- ❌ There is no migration logic between legacy link fields and `externalLinks`
- ⚠️ If an article has links stored in `media.url` or other legacy fields, they are NOT migrated to `externalLinks`

### Conclusion

There is **NO split-brain state** in the current implementation - `externalLinks` is consistently used. However, there is a **migration gap** where legacy articles may have links in old fields that are not migrated to `externalLinks`.

---

## 6️⃣ Minimal Fix Recommendation

### Root Cause

The issue is that `externalLinks` is unconditionally sent in update payloads, violating the edit mode partial update semantics. Additionally, there's no migration logic for pre-refactor articles.

### Minimal Patch Strategy

**Option 1: Conditional Inclusion (Recommended)**

Make `externalLinks` conditional in update payload, matching other optional fields:

```tsx
// Line 1470-1472: Change from unconditional to conditional
// Only include if explicitly set (not just default empty array)
if (initialData?.externalLinks !== undefined || externalLinks.length > 0) {
  updatePayload.externalLinks = externalLinks;
}
updatePayload.layoutVisibility = layoutVisibility; // Keep this unconditional if needed
```

**Option 2: Preserve Existing Value**

Only send `externalLinks` if form state differs from initial data:

```tsx
// Line 1470-1472: Only update if changed
const externalLinksChanged = JSON.stringify(initialData?.externalLinks || []) !== JSON.stringify(externalLinks);
if (externalLinksChanged) {
  updatePayload.externalLinks = externalLinks;
}
```

**Option 3: Migration on Hydration (Additional Fix)**

Add migration logic to populate `externalLinks` from legacy fields:

```tsx
// Line 209: Add migration logic
const migratedExternalLinks = initialData.externalLinks || [];
if (!migratedExternalLinks.length && initialData.media?.url) {
  // Migrate from legacy media.url to externalLinks
  const legacyUrl = initialData.media.url;
  migratedExternalLinks.push({
    id: crypto.randomUUID(),
    url: legacyUrl,
    isPrimary: true,
    // ... other fields
  });
}
setExternalLinks(migratedExternalLinks);
```

**⚠️ Note:** Option 3 requires understanding the migration strategy. If backend handles migration, frontend may not need this.

### Recommended Approach

**Primary Fix:** Option 1 (conditional inclusion) - simplest and matches existing pattern for other optional fields.

**Secondary Fix (if migration needed):** Option 3 - only if backend doesn't handle migration from legacy fields.

---

## 7️⃣ Final Output Format

### Root Cause Classification

**One-way mapping / Missing hydration**

### Exact Variables Involved

- `externalLinks` (state variable, line 142)
- `initialData.externalLinks` (props, line 45)
- `updatePayload.externalLinks` (payload field, line 1471)

### Exact Functions Involved

- `handleSubmit` (line 1265)
- Edit mode hydration effect (lines 180-239, specifically line 209)
- `resetForm` (line 364, line 394 - resets externalLinks to [])

### Exact Line Numbers

- **Line 142:** `const [externalLinks, setExternalLinks] = useState<ExternalLink[]>([]);` - Initialization
- **Line 209:** `setExternalLinks(initialData.externalLinks || []);` - Hydration (no migration)
- **Line 1471:** `updatePayload.externalLinks = externalLinks;` - Unconditional payload assignment
- **Line 1701:** `return externalLinks;` - Create payload (always included)

### One-Paragraph Explanation

The external links refactor introduced a data contract asymmetry where `externalLinks` is always unconditionally included in update payloads (line 1471), violating the edit mode partial update semantics stated in the comment on line 1425. While hydration exists from `initialData.externalLinks` (line 209), it defaults to an empty array if the field is undefined (pre-refactor articles). This means that when editing an article that lacks `externalLinks` in the database, the form state becomes `[]`, and on save, `updatePayload.externalLinks = []` is sent, which may overwrite any legacy link data. The fix is to make `externalLinks` conditional in update payloads (matching the pattern used for other optional fields like `images`, `mediaIds`, etc.) and optionally add migration logic to populate `externalLinks` from legacy fields during hydration.

### Minimal Patch Strategy

**File:** `src/components/CreateNuggetModal.tsx`

**Change Line 1470-1472 from:**
```tsx
// Add externalLinks and layoutVisibility to updatePayload
updatePayload.externalLinks = externalLinks;
updatePayload.layoutVisibility = layoutVisibility;
```

**To:**
```tsx
// Add externalLinks and layoutVisibility to updatePayload (conditional to match edit mode semantics)
if (initialData?.externalLinks !== undefined || externalLinks.length > 0) {
  updatePayload.externalLinks = externalLinks;
}
updatePayload.layoutVisibility = layoutVisibility;
```

This ensures `externalLinks` is only sent when:
1. The article already had `externalLinks` (preserve edit semantics), OR
2. The user added new links (`externalLinks.length > 0`)

This prevents empty arrays from overwriting existing database values for pre-refactor articles.

---

**Report Generated:** 2026-01-10  
**Audit Scope:** CreateNuggetModal.tsx link-related state symmetry  
**Methodology:** Static code analysis, data flow tracing, contract comparison
