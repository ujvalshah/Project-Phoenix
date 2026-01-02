# Tag System Flow Diagrams

## Before Fix - Broken Flow ❌

```
┌─────────────────────────────────────────────────────────────────┐
│                     CREATE NUGGET FLOW                          │
└─────────────────────────────────────────────────────────────────┘

User selects "AI"
      │
      ↓
POST /api/categories { name: "AI" }
      │
      ↓
Backend creates:
  Tag {
    rawName: "AI",
    canonicalName: "ai" ← Lowercase for uniqueness
  }
      │
      ↓
Article created:
  { categories: ["AI"] } ← Stores exact string
      │
      ↓
✅ Nugget saved successfully


┌─────────────────────────────────────────────────────────────────┐
│                   ADMIN RENAMES TAG                             │
└─────────────────────────────────────────────────────────────────┘

Admin renames "AI" → "Ai"
      │
      ↓
PUT /api/categories/:id { name: "Ai" }
      │
      ↓
Backend updates:
  Tag {
    rawName: "Ai",          ← Changed
    canonicalName: "ai"     ← Unchanged
  }
      │
      ↓
Cascade update all articles:
  { categories: ["AI"] } → { categories: ["Ai"] }
      │
      ↓
✅ Tag renamed globally


┌─────────────────────────────────────────────────────────────────┐
│              EDIT NUGGET FLOW (BEFORE FIX) ❌                   │
└─────────────────────────────────────────────────────────────────┘

User clicks "Edit" on nugget
      │
      ↓
Modal opens with initialData.categories = ["Ai"]
      │
      ↓
GET /api/categories?format=simple
  → Returns: ["Ai", "Blockchain", "PE/VC"] (rawName values)
      │
      ↓
TagSelector renders:
  selected = ["Ai"]
  options = [
    { id: "Ai", label: "Ai" },
    { id: "Blockchain", label: "Blockchain" },
    { id: "PE/VC", label: "PE/VC" }
  ]
      │
      ↓
SelectableDropdown checks selection:
  selected.includes("Ai") → ✅ true
      │
      ↓
✅ "Ai" displays as selected


BUT IF USER EDITED BEFORE RENAME:

Article has: categories: ["AI"] ← Old casing
Available: ["Ai", ...] ← New casing
      │
      ↓
SelectableDropdown checks:
  selected.includes("Ai") → ❌ false
  // "AI" !== "Ai" → Exact string match fails!
      │
      ↓
❌ "Ai" displays as UNSELECTED even though it's the same tag!


┌─────────────────────────────────────────────────────────────────┐
│               TAG DESELECTION (BEFORE FIX) ❌                   │
└─────────────────────────────────────────────────────────────────┘

User clicks "×" on "Ai" chip
      │
      ↓
handleDeselect("Ai") called
      │
      ↓
selected.filter(id => id !== "Ai")
  // ["AI", "Blockchain"].filter(id => id !== "Ai")
  // Returns: ["AI", "Blockchain"] ← Nothing removed!
      │
      ↓
❌ Tag appears to stay selected
```

---

## After Fix - Working Flow ✅

```
┌─────────────────────────────────────────────────────────────────┐
│              EDIT NUGGET FLOW (AFTER FIX) ✅                    │
└─────────────────────────────────────────────────────────────────┘

User clicks "Edit" on nugget
      │
      ↓
Modal opens with initialData.categories = ["AI"] ← Old casing
      │
      ↓
GET /api/categories?format=simple
  → Returns: ["Ai", "Blockchain", "PE/VC"] ← New casing
      │
      ↓
TagSelector renders:
  selected = ["AI"]
  options = [
    { id: "Ai", label: "Ai" },
    { id: "Blockchain", label: "Blockchain" }
  ]
      │
      ↓
SelectableDropdown checks selection (NEW LOGIC):
  tagsInclude(["AI"], "Ai")
    │
    ├─→ normalize("AI") = "ai"
    ├─→ normalize("Ai") = "ai"
    └─→ "ai" === "ai" → ✅ true
      │
      ↓
✅ "Ai" displays as SELECTED correctly!


┌─────────────────────────────────────────────────────────────────┐
│               TAG DESELECTION (AFTER FIX) ✅                    │
└─────────────────────────────────────────────────────────────────┘

User clicks "×" on "Ai" chip
      │
      ↓
handleDeselect("Ai") called
      │
      ↓
removeTag(["AI", "Blockchain"], "Ai")
  │
  ├─→ normalize("Ai") = "ai"
  │
  └─→ filter: normalize("AI") !== "ai" ? keep : remove
      └─→ "ai" === "ai" → ❌ Remove "AI"
      │
      ↓
Returns: ["Blockchain"]
      │
      ↓
✅ Tag correctly removed!
```

---

## Data Flow Comparison

### Tag Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│                    BACKEND (Always Correct)                    │
└────────────────────────────────────────────────────────────────┘

    CREATE TAG                     RENAME TAG
         ↓                              ↓
  ┌──────────────┐              ┌──────────────┐
  │ rawName: AI  │  Admin rename│ rawName: Ai  │
  │ canonical: ai│  ────────────→│ canonical: ai│
  └──────────────┘              └──────────────┘
         │                              │
         └──────────┬───────────────────┘
                    ↓
         UNIQUE INDEX on canonicalName
         (Prevents "AI" and "Ai" coexisting)


┌────────────────────────────────────────────────────────────────┐
│                FRONTEND (Before vs After Fix)                  │
└────────────────────────────────────────────────────────────────┘

BEFORE FIX ❌:
  Article: ["AI"]
  Options: ["Ai"]
  Check: "AI" === "Ai" → false
  Result: Appears unselected

AFTER FIX ✅:
  Article: ["AI"]
  Options: ["Ai"]
  Check: normalize("AI") === normalize("Ai")
         "ai" === "ai" → true
  Result: Appears selected
```

---

## Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CreateNuggetModal (Edit Mode)                │
└─────────────────────────────────────────────────────────────────┘
          │
          │ initialData.categories = ["AI", "Blockchain"]
          ↓
┌─────────────────────────────────────────────────────────────────┐
│                       TagSelector                               │
│  Props:                                                         │
│    - selected = ["AI", "Blockchain"]                            │
│    - availableCategories = ["Ai", "Blockchain", "PE/VC"]        │
└─────────────────────────────────────────────────────────────────┘
          │
          │ Transforms to options:
          │   [
          │     { id: "Ai", label: "Ai" },
          │     { id: "Blockchain", label: "Blockchain" },
          │     { id: "PE/VC", label: "PE/VC" }
          │   ]
          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SelectableDropdown                           │
│  Props:                                                         │
│    - selected = ["AI", "Blockchain"]                            │
│    - options = [{ id: "Ai", ... }, ...]                         │
└─────────────────────────────────────────────────────────────────┘
          │
          │ For each option:
          ├─→ Option "Ai"
          │     │
          │     ↓ BEFORE FIX ❌
          │     selected.includes("Ai")
          │     → ["AI", "Blockchain"].includes("Ai")
          │     → false (❌ Wrong!)
          │
          │     ↓ AFTER FIX ✅
          │     tagsInclude(selected, "Ai")
          │     → tagsInclude(["AI", "Blockchain"], "Ai")
          │     → normalize("AI") === normalize("Ai")
          │     → "ai" === "ai"
          │     → true (✅ Correct!)
          │
          └─→ Option "Blockchain"
                → Similar logic (always matches in both cases)


┌─────────────────────────────────────────────────────────────────┐
│                   Rendered UI (After Fix)                       │
└─────────────────────────────────────────────────────────────────┘

  Tags: [Ai ×] [Blockchain ×]     ← Chips with remove buttons
            ↓
  Dropdown:
    ☑ Ai                          ← ✅ Selected (matches "AI")
    ☑ Blockchain                  ← ✅ Selected
    ☐ PE/VC                       ← Not selected
```

---

## Normalization Function Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    normalizeTag()                               │
└─────────────────────────────────────────────────────────────────┘

Input: "  AI  "
  │
  ├─→ .trim()      → "AI"
  │
  └─→ .toLowerCase() → "ai"

Output: "ai"


┌─────────────────────────────────────────────────────────────────┐
│                      tagsMatch()                                │
└─────────────────────────────────────────────────────────────────┘

Input: tagsMatch("AI", "Ai")
  │
  ├─→ normalizeTag("AI")   → "ai"
  │
  ├─→ normalizeTag("Ai")   → "ai"
  │
  └─→ "ai" === "ai"       → true

Output: true


┌─────────────────────────────────────────────────────────────────┐
│                     tagsInclude()                               │
└─────────────────────────────────────────────────────────────────┘

Input: tagsInclude(["AI", "Blockchain"], "Ai")
  │
  ├─→ normalized = normalizeTag("Ai") → "ai"
  │
  └─→ tags.some(tag => 
        normalizeTag(tag) === normalized
      )
      │
      ├─→ normalizeTag("AI") === "ai"       → true ✅
      └─→ Return true

Output: true


┌─────────────────────────────────────────────────────────────────┐
│                       removeTag()                               │
└─────────────────────────────────────────────────────────────────┘

Input: removeTag(["AI", "Blockchain"], "Ai")
  │
  ├─→ normalized = normalizeTag("Ai") → "ai"
  │
  └─→ tags.filter(tag => 
        normalizeTag(tag) !== normalized
      )
      │
      ├─→ normalizeTag("AI") !== "ai"       → false → Remove
      └─→ normalizeTag("Blockchain") !== "ai" → true → Keep
      │
      └─→ ["Blockchain"]

Output: ["Blockchain"]
```

---

## Test Coverage Map

```
┌─────────────────────────────────────────────────────────────────┐
│                   Test Suite Structure                          │
│                  (29 tests, all passing)                        │
└─────────────────────────────────────────────────────────────────┘

normalizeTag() [3 tests]
  ├─✅ should lowercase and trim tags
  ├─✅ should handle empty and whitespace strings
  └─✅ should preserve special characters

tagsMatch() [3 tests]
  ├─✅ should match tags case-insensitively
  ├─✅ should return false for non-matching tags
  └─✅ should handle empty strings

findTagIndex() [3 tests]
  ├─✅ should find tag index case-insensitively
  ├─✅ should return -1 for non-existent tags
  └─✅ should handle empty arrays

tagsInclude() [3 tests]
  ├─✅ should check tag existence case-insensitively
  ├─✅ should return false for non-existent tags
  └─✅ should handle empty arrays

removeTag() [6 tests]
  ├─✅ should remove tag case-insensitively
  ├─✅ should return unchanged array for non-existent tags
  ├─✅ should remove all case variants
  ├─✅ should handle empty arrays
  └─✅ should not mutate original array

findTag() [3 tests]
  ├─✅ should find tag with original casing
  ├─✅ should return undefined for non-existent tags
  └─✅ should handle empty arrays

deduplicateTags() [5 tests]
  ├─✅ should remove case-insensitive duplicates
  ├─✅ should keep first occurrence
  ├─✅ should handle arrays without duplicates
  ├─✅ should handle empty arrays
  └─✅ should not mutate original array

Real-world scenarios [4 tests]
  ├─✅ should handle edit modal tag matching
  ├─✅ should handle tag deselection with casing differences
  ├─✅ should handle duplicate prevention
  └─✅ should handle tag data from multiple sources
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
└─────────────────────────────────────────────────────────────────┘

  MongoDB                   Express API              Response
    │                           │                        │
    ↓                           ↓                        ↓
┌─────────┐              ┌──────────┐           ┌─────────────┐
│ Tag {   │              │ GET      │           │ {           │
│  _id,   │──normalize─→ │ /api/    │─────────→ │  data: [    │
│  raw,   │              │ categories│           │   "Ai",     │
│  canon  │              │          │           │   "PE/VC"   │
└─────────┘              └──────────┘           │  ]          │
    ↑                                            └─────────────┘
    │                                                    │
    └────────────────────────────────────────────────────┘
         Unique index on canonicalName                  │
         prevents case duplicates                       │
                                                         ↓

┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
└─────────────────────────────────────────────────────────────────┘

  API Response          tagUtils.ts         UI Components
       │                     │                    │
       ↓                     ↓                    ↓
  ┌──────────┐        ┌──────────┐       ┌───────────────┐
  │ ["Ai",   │────→   │normalize │───→   │SelectableDropd│
  │  "PE/VC"]│        │tagsMatch │       │               │
  └──────────┘        │tagsInclude       │ Uses case-    │
       │              │removeTag │       │ insensitive   │
       │              └──────────┘       │ comparison    │
       ↓                                  └───────────────┘
  ┌──────────┐                                  │
  │ Article  │                                  │
  │ {        │                                  │
  │  categor-│←─────────────────────────────────┘
  │  ies: [] │         User edits
  │ }        │         (with fixes applied)
  └──────────┘
```

---

**Legend:**
- ✅ = Working correctly
- ❌ = Broken behavior
- → = Data flow direction
- ↓ = Process step

**Created:** January 1, 2026  
**Status:** Reference documentation for Tag System Fix



