# 🧭 External Links Refactor — Recovery & Stabilization Plan

**Context**

A refactor introduced `externalLinks[]` as the canonical field for card link buttons.
During this refactor, edit-mode semantics were violated, causing silent link deletion on update for pre-refactor articles. The issue presents as "links not being retrieved," but is in fact conditional data loss.

**Last Updated:** 2026-01-10  
**Status:** Phase 0 - In Progress

---

## PHASE 0 — Stop Further Damage (Immediate Hotfix)

### Goal

Prevent any further accidental deletion of links during edits.

### Actions

1. Patch `CreateNuggetModal.tsx` to restore partial update semantics:

```tsx
// Change from unconditional assignment to conditional inclusion
if (
  initialData?.externalLinks !== undefined ||
  externalLinks.length > 0
) {
  updatePayload.externalLinks = externalLinks;
}
```

**Rationale:** This ensures `externalLinks` is only sent when:
- The article already had `externalLinks` (preserve edit semantics), OR
- The user added new links (`externalLinks.length > 0`)

This prevents empty arrays from overwriting existing database values for pre-refactor articles.

2. Deploy frontend hotfix.

3. Avoid any backend migrations at this stage.

### Exit Criteria

- ✅ Editing an article without touching links does not modify link data.
- ✅ No new link loss occurs.
- ✅ Hotfix deployed and verified.

### Rollback Plan

If Phase 0 hotfix causes issues:
- Revert frontend hotfix commit
- Redeploy previous version
- Monitor for 1 hour before re-attempting

---

## PHASE 1 — Establish Ground Truth in the Database

### Goal

Determine whether link data still exists and where.

### Actions

1. Query the database for all historical link locations:
   - `externalLinks[]`
   - `media.url`
   - `media.previewMetadata.url`
   - Any legacy URL fields (if they existed)

2. Classify articles into three buckets:

| Bucket | Condition | Meaning |
|--------|-----------|---------|
| A | `externalLinks[]` populated | Already migrated |
| B | `externalLinks[]` empty but legacy URL exists | Recoverable |
| C | No URL anywhere | Lost |

3. Quantify how many articles fall into each bucket.

4. Set up monitoring alerts for:
   - Articles with `externalLinks: []` being updated
   - Update payloads containing `externalLinks`
   - Failed migrations in Phase 2

### Database Query Example

```javascript
// MongoDB aggregation for assessment
db.articles.aggregate([
  {
    $project: {
      _id: 1,
      title: 1,
      hasExternalLinks: { $gt: [{ $size: { $ifNull: ["$externalLinks", []] } }, 0] },
      hasMediaUrl: { $ne: ["$media.url", null] },
      hasPreviewMetadataUrl: { $ne: ["$media.previewMetadata.url", null] },
      externalLinksCount: { $size: { $ifNull: ["$externalLinks", []] } },
      mediaUrl: "$media.url",
      previewMetadataUrl: "$media.previewMetadata.url"
    }
  },
  {
    $group: {
      _id: null,
      bucketA: {
        $sum: { $cond: ["$hasExternalLinks", 1, 0] }
      },
      bucketB: {
        $sum: {
          $cond: [
            {
              $and: [
                { $not: "$hasExternalLinks" },
                { $or: ["$hasMediaUrl", "$hasPreviewMetadataUrl"] }
              ]
            },
            1,
            0
          ]
        }
      },
      bucketC: {
        $sum: {
          $cond: [
            {
              $and: [
                { $not: "$hasExternalLinks" },
                { $not: "$hasMediaUrl" },
                { $not: "$hasPreviewMetadataUrl" }
              ]
            },
            1,
            0
          ]
        }
      },
      total: { $sum: 1 }
    }
  }
]);
```

### Exit Criteria

- ✅ You know how much data is intact, recoverable, or lost.
- ✅ No assumptions remain.
- ✅ Monitoring alerts configured (see Phase 4 for implementation).

### Implementation Status

- ✅ Assessment script created: `server/scripts/assessExternalLinksPhase1.ts`
- ✅ Instructions document created: `PHASE1_ASSESSMENT_INSTRUCTIONS.md`
- ✅ **Assessment Complete:** Results in `PHASE1_ASSESSMENT_RESULTS.md`
- ✅ **Results:** 0 migrated, 122 recoverable (67%), 60 lost (33%)

---

## PHASE 2 — One-Time Migration for Recoverable Articles

### Goal

Bring all recoverable articles onto the new canonical model.

### Actions

1. Write a one-time backend migration script:

**For each Bucket B article:**
   - Extract legacy URL from `media.url` or `media.previewMetadata.url`
   - Create:
     ```javascript
     externalLinks = [{
       id: uuid(),
       url: legacyUrl,
       isPrimary: true
     }]
     ```
   - Update article with new `externalLinks` field

2. Migration script requirements:
   - **Dry-run mode** (`--dry-run` flag for testing)
   - **Batch processing** (process in batches of 100 to avoid memory issues)
   - **Idempotency** (skip if already migrated)
   - **Auditability** (log all affected article IDs)
   - **Rollback script** (store original state in migration log)

3. Constraints:
   - Do not perform migration on read or edit.
   - Do not rely on frontend logic for data repair.
   - Migration is backend-only operation.

4. Run migration once (after dry-run validation).

5. Log affected article IDs for auditability.

### Migration Script Structure

```javascript
// Example structure (pseudo-code)
async function migrateExternalLinks(options = { dryRun: false }) {
  const cursor = Article.find({ /* Bucket B conditions */ }).cursor();
  const batch = [];
  const BATCH_SIZE = 100;
  const affectedIds = [];

  for await (const article of cursor) {
    // Skip if already migrated (idempotent)
    if (article.externalLinks && article.externalLinks.length > 0) {
      console.log(`Article ${article._id} already migrated, skipping`);
      continue;
    }

    batch.push(article);
    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch, affectedIds, options.dryRun);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    await processBatch(batch, affectedIds, options.dryRun);
  }

  console.log(`Migration complete. Affected articles: ${affectedIds.length}`);
  return affectedIds;
}
```

### Exit Criteria

- ✅ All recoverable articles now have populated `externalLinks[]`.
- ✅ No legacy-only link data remains.
- ✅ Migration log created with affected article IDs.
- ✅ Rollback script tested and ready.

---

## PHASE 3 — Accept & Handle Irrecoverable Loss (If Any)

### Goal

Handle already-lost data responsibly.

### Actions

1. Identify Bucket C articles (no URL anywhere).

2. Decide on approach:
   - **Accept loss** (most common)
   - **Restore from backups** (if available and cost-effective)
   - **Manual re-entry** (for high-value content only)

3. Document impact and resolution:
   - Number of articles affected
   - Decision rationale
   - Any restoration attempts made

### Exit Criteria

- ✅ Team alignment on how lost data is handled.
- ✅ No uncertainty about remaining risk.
- ✅ Impact documented.

---

## PHASE 4 — Lock the Contract (Prevent Regression)

### Goal

Ensure this class of bug cannot happen again.

### Actions

1. Declare single source of truth:
   - All card links live in `externalLinks[]`.
   - Media URLs are not external links.

2. Add regression tests:

**Primary Test:**
```typescript
test('edit mode preserves externalLinks when unchanged', async () => {
  const article = await createArticle({ 
    externalLinks: [{ id: '1', url: 'https://example.com', isPrimary: true }] 
  });
  await editArticle(article.id, { title: 'Updated Title' }); // No link changes
  const updated = await getArticle(article.id);
  expect(updated.externalLinks).toEqual(article.externalLinks);
});
```

**Edge Case Tests:**
```typescript
// Empty array preservation
test('edit mode preserves explicit empty externalLinks array', async () => {
  const article = await createArticle({ externalLinks: [] });
  await editArticle(article.id, { title: 'Updated Title' });
  const updated = await getArticle(article.id);
  expect(updated.externalLinks).toEqual([]);
});

// Pre-refactor article (undefined field)
test('edit mode does not modify externalLinks for pre-refactor articles', async () => {
  const article = await createArticle({ /* no externalLinks field */ });
  await editArticle(article.id, { title: 'Updated Title' });
  const updated = await getArticle(article.id);
  expect(updated.externalLinks).toBeUndefined(); // Field should remain undefined
});

// Adding links to pre-refactor article
test('adding links to pre-refactor article works', async () => {
  const article = await createArticle({ /* no externalLinks field */ });
  await editArticle(article.id, {
    externalLinks: [{ id: '1', url: 'https://example.com', isPrimary: true }]
  });
  const updated = await getArticle(article.id);
  expect(updated.externalLinks).toHaveLength(1);
});

// Full round-trip
test('full round-trip: create → edit → fetch', async () => {
  const created = await createArticle({
    externalLinks: [{ id: '1', url: 'https://example.com', isPrimary: true }]
  });
  await editArticle(created.id, { title: 'Updated' });
  const fetched = await getArticle(created.id);
  expect(fetched.externalLinks).toEqual(created.externalLinks);
});
```

3. Optionally add backend guard:
   - Prevent silent link clearing without explicit intent.

### Exit Criteria

- ✅ Tests enforce edit-mode safety.
- ✅ Future refactors cannot reintroduce the bug silently.
- ✅ Contract documented in code comments.

---

## PHASE 5 — Optional UX Hardening (Nice to Have)

### Goal

Improve transparency and trust (optional phase).

### Actions

**Decision: Keep migration transparent to users.**

- Migration is backend-only operation
- User doesn't need to know about internal data structure
- Less confusing than showing technical messages

**Alternative (if needed):**
- Show migration status only in dev/staging environments
- Hide in production

### Exit Criteria

- ✅ Decision documented.
- ✅ No user-visible impact (recommended approach).

---

## Final State (What "Done" Looks Like)

✅ No silent data loss  
✅ All links live in `externalLinks[]`  
✅ Edit mode is safe and idempotent  
✅ Legacy data either migrated or consciously accepted as lost  
✅ Contract enforced by code, not convention  
✅ Tests prevent regression  

---

## One-Line Summary for Stakeholders

"A refactor caused links to be cleared on edit for older articles; we stopped the issue, recovered all remaining data, and hardened the system to prevent recurrence."

---

## Execution Timeline

- **Phase 0:** IMMEDIATE (today) - Stop damage
- **Phase 1:** THIS WEEK - Assess damage
- **Phase 2:** NEXT WEEK - Recover data
- **Phase 3:** NEXT WEEK (parallel with Phase 2) - Handle loss
- **Phase 4:** THIS SPRINT - Prevent regression
- **Phase 5:** OPTIONAL - UX polish (defer if needed)

---

**Plan Status:** Phase 0 - In Progress  
**Last Updated:** 2026-01-10
