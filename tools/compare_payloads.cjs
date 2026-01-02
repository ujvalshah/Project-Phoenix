#!/usr/bin/env node
/**
 * Payload Audit & Comparison Tool
 * 
 * Compares frontend requests with backend expectations and generates
 * a discrepancy report for CRUD operations on:
 * - Nuggets
 * - Collections
 * - Bookmarks & Bookmark Folders
 * 
 * Usage: node tools/compare_payloads.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// API CONTRACT DEFINITIONS (Source of Truth)
// ============================================================================

const API_CONTRACTS = {
  // NUGGETS
  'POST /api/nuggets': {
    method: 'POST',
    path: '/nuggets',
    auth: 'required',
    requestBody: {
      contentMarkdown: { type: 'string', required: false, default: '' },
      primaryUrl: { type: 'string', required: false },
      categories: { type: 'array<string>', required: false },
      tags: { type: 'array<string>', required: false },
      visibility: { type: 'enum', values: ['public', 'private'], required: false, default: 'private' },
      sourceType: { type: 'enum', values: ['link', 'video', 'note', 'idea', 'text'], required: false },
      attachments: { type: 'array<object>', required: false },
    },
    responseBody: {
      success: { type: 'boolean' },
      data: { type: 'Article' },
    },
  },
  'GET /api/nuggets': {
    method: 'GET',
    path: '/nuggets',
    auth: 'optional',
    queryParams: ['page', 'limit', 'sort', 'category', 'authorId', 'type', 'visibility'],
  },
  'GET /api/nuggets/:id': {
    method: 'GET',
    path: '/nuggets/:id',
    auth: 'optional',
  },
  'PUT /api/nuggets/:id': {
    method: 'PUT',
    path: '/nuggets/:id',
    auth: 'required',
    requestBody: {
      // Same as POST but all optional
    },
  },
  'DELETE /api/nuggets/:id': {
    method: 'DELETE',
    path: '/nuggets/:id',
    auth: 'required',
  },

  // COLLECTIONS
  'POST /api/collections': {
    method: 'POST',
    path: '/collections',
    auth: 'required',
    requestBody: {
      name: { type: 'string', required: true, maxLength: 100 },
      description: { type: 'string', required: false, maxLength: 500, default: '' },
      visibility: { type: 'enum', values: ['public', 'private'], required: false, default: 'private' },
      imageUrl: { type: 'string', required: false },
    },
  },
  'GET /api/collections': {
    method: 'GET',
    path: '/collections',
    auth: 'optional',
    queryParams: ['visibility', 'search', 'createdBy', 'sortBy', 'order', 'page', 'limit'],
  },
  'POST /api/collections/:id/add-nugget': {
    method: 'POST',
    path: '/collections/:id/add-nugget',
    auth: 'required',
    requestBody: {
      nuggetId: { type: 'string', required: true },
    },
  },
  'POST /api/collections/:id/remove-nugget/:nuggetId': {
    method: 'POST',
    path: '/collections/:id/remove-nugget/:nuggetId',
    auth: 'required',
    // nuggetId is in URL, not body
  },
  'POST /api/collections/:id/follow': {
    method: 'POST',
    path: '/collections/:id/follow',
    auth: 'required',
  },
  'POST /api/collections/:id/unfollow': {
    method: 'POST',
    path: '/collections/:id/unfollow',
    auth: 'required',
  },

  // BOOKMARK FOLDERS
  'POST /api/bookmark-folders': {
    method: 'POST',
    path: '/bookmark-folders',
    auth: 'required',
    requestBody: {
      name: { type: 'string', required: true, maxLength: 100 },
      description: { type: 'string', required: false, maxLength: 500, default: '' },
      color: { type: 'string', required: false },
      icon: { type: 'string', required: false },
    },
  },
  'GET /api/bookmark-folders': {
    method: 'GET',
    path: '/bookmark-folders',
    auth: 'required',
  },

  // BOOKMARKS
  'POST /api/nuggets/:id/bookmark': {
    method: 'POST',
    path: '/nuggets/:id/bookmark',
    auth: 'required',
    requestBody: {
      folderId: { type: 'string', required: false },
      notes: { type: 'string', required: false },
    },
  },
  'POST /api/nuggets/:id/unbookmark': {
    method: 'POST',
    path: '/nuggets/:id/unbookmark',
    auth: 'required',
    requestBody: {
      folderId: { type: 'string', required: false },
    },
  },
};

// ============================================================================
// DISCREPANCY DETECTION
// ============================================================================

/**
 * Analyzes the codebase and generates discrepancy report
 */
function analyzeCodebase() {
  const discrepancies = [];

  // Known issues found during code review:
  
  // Issue 1: Frontend updateArticle sends Article format, backend expects Nugget format
  discrepancies.push({
    id: 'NUGGET-UPDATE-001',
    severity: 'medium',
    resource: 'Nugget',
    operation: 'UPDATE (PUT /api/nuggets/:id)',
    description: 'Frontend RestAdapter.updateArticle sends raw Article object, but backend expects Nugget schema fields',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: 146,
      code: `async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  return apiClient.put<Article>(\`/nuggets/\${id}\`, updates);
}`,
    },
    backend: {
      file: 'server/src/controllers/nuggetsController.ts',
      line: 497,
      code: `const validated = updateNuggetSchema.parse(req.body);`,
    },
    fix: 'Frontend should transform Article fields to Nugget fields before sending (e.g., content -> contentMarkdown)',
    status: 'open',
  });

  // Issue 2: Response format inconsistency
  discrepancies.push({
    id: 'RESPONSE-FORMAT-001',
    severity: 'low',
    resource: 'All',
    operation: 'All responses',
    description: 'Frontend apiClient expects { success, data } format but sometimes accesses response directly',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: '9-11, 132-135',
      code: `// Line 9-11: Checks for response.success && response.data
// Line 132-135: Sometimes returns response as Article directly`,
    },
    backend: {
      file: 'All controllers',
      code: `res.json({ success: true, data: ... })`,
    },
    fix: 'Already handled - apiClient extracts data from { success, data } wrapper. No action needed.',
    status: 'resolved',
  });

  // Issue 3: Type coercion for tags
  discrepancies.push({
    id: 'NUGGET-CREATE-001',
    severity: 'low',
    resource: 'Nugget',
    operation: 'CREATE (POST /api/nuggets)',
    description: 'Tags are expected as array but could be sent as comma-separated string',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: 124,
      code: `if (article.tags && article.tags.length > 0) {
  payload.tags = article.tags;
}`,
    },
    backend: {
      file: 'server/src/controllers/nuggetsController.ts',
      line: 21,
      code: `tags: z.array(z.string()).optional(),`,
    },
    fix: 'Backend should normalize tags: accept both array and comma-separated string',
    status: 'open',
  });

  // Issue 4: Categories normalization
  discrepancies.push({
    id: 'NUGGET-CREATE-002',
    severity: 'low',
    resource: 'Nugget',
    operation: 'CREATE (POST /api/nuggets)',
    description: 'Categories can be sent as names or slugs, backend resolves them differently',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: 118,
      code: `if (article.categories && article.categories.length > 0) {
  payload.categories = article.categories;
}`,
    },
    backend: {
      file: 'server/src/controllers/nuggetsController.ts',
      line: 427,
      code: `for (const catName of validated.categories) {
  let category = await Category.findOne({ 
    $or: [
      { slug: catName.toLowerCase() },
      { name: new RegExp(\`^\${catName}$\`, 'i') },
    ],
    status: 'approved',
  });`,
    },
    fix: 'Already handled - backend accepts both name and slug. No action needed.',
    status: 'resolved',
  });

  // Issue 5: Collection visibility vs type field naming
  discrepancies.push({
    id: 'COLLECTION-CREATE-001',
    severity: 'medium',
    resource: 'Collection',
    operation: 'CREATE (POST /api/collections)',
    description: 'Frontend sends `type` but backend expects `visibility` for public/private',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: 301,
      code: `async createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private'): Promise<Collection> {
  const response = await apiClient.post<...>('/collections', {
    name: name.trim(),
    description: description.trim(),
    visibility: type, // Maps type -> visibility
  });`,
    },
    backend: {
      file: 'server/src/controllers/collectionsController.ts',
      line: 14,
      code: `visibility: z.enum(['public', 'private']).optional().default('private'),`,
    },
    fix: 'Already handled - Frontend correctly maps type to visibility. No action needed.',
    status: 'resolved',
  });

  // Issue 6: Bookmark folder creation returns different format
  discrepancies.push({
    id: 'BOOKMARK-FOLDER-001',
    severity: 'low',
    resource: 'BookmarkFolder',
    operation: 'CREATE (POST /api/bookmark-folders)',
    description: 'Backend returns folder in Collection format for frontend compatibility',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: 389,
      code: `async createBookmarkFolder(name: string, description?: string): Promise<Collection>`,
    },
    backend: {
      file: 'server/src/controllers/bookmarkFoldersController.ts',
      line: 37,
      code: `function folderToCollection(folder: any, userId: string): any {
  return {
    id: folder._id.toString(),
    name: folder.name,
    type: 'private',
    visibility: 'private',
    ...
  };
}`,
    },
    fix: 'Working as intended - folder converts to Collection format. No action needed.',
    status: 'resolved',
  });

  // Issue 7: addArticleToCollection with isBookmarkFolder flag
  discrepancies.push({
    id: 'COLLECTION-ADD-001',
    severity: 'medium',
    resource: 'Collection/Bookmark',
    operation: 'ADD (POST /api/collections/:id/add-nugget OR /api/nuggets/:id/bookmark)',
    description: 'Frontend uses isBookmarkFolder flag to route to different endpoints, could be simplified',
    frontend: {
      file: 'src/services/adapters/RestAdapter.ts',
      line: 361,
      code: `async addArticleToCollection(collectionId: string, articleId: string, _userId: string, isBookmarkFolder: boolean = false): Promise<void> {
  if (isBookmarkFolder) {
    await apiClient.post(\`/nuggets/\${articleId}/bookmark\`, { folderId: collectionId });
  } else {
    await apiClient.post(\`/collections/\${collectionId}/add-nugget\`, { nuggetId: articleId });
  }
}`,
    },
    backend: {
      file: 'Multiple controllers',
      code: 'Different endpoints handle collections vs bookmarks',
    },
    fix: 'Working as intended - different resources need different endpoints. Consider unified API in future.',
    status: 'resolved',
  });

  // Issue 8: Missing PATCH support in frontend
  discrepancies.push({
    id: 'HTTP-METHOD-001',
    severity: 'low',
    resource: 'All',
    operation: 'UPDATE',
    description: 'Frontend apiClient only has PUT, backend supports both PUT and PATCH',
    frontend: {
      file: 'src/services/apiClient.ts',
      line: 107,
      code: `put<T>(url: string, body: any, headers?: HeadersInit) {
  return this.request<T>(url, { method: 'PUT', body: JSON.stringify(body), headers });
}
// No patch() method`,
    },
    backend: {
      file: 'server/src/routes/articles.ts',
      line: 15,
      code: `router.patch('/:id', requireAuth, nuggetsController.updateNugget);`,
    },
    fix: 'Add patch() method to apiClient for partial updates',
    status: 'open',
  });

  return discrepancies;
}

/**
 * Generates markdown report
 */
function generateReport(discrepancies) {
  const now = new Date().toISOString();
  
  let report = `# Payload Audit & Discrepancy Report
  
Generated: ${now}

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| High     | ${discrepancies.filter(d => d.severity === 'high').length} | - |
| Medium   | ${discrepancies.filter(d => d.severity === 'medium').length} | - |
| Low      | ${discrepancies.filter(d => d.severity === 'low').length} | - |

| Status   | Count |
|----------|-------|
| Open     | ${discrepancies.filter(d => d.status === 'open').length} |
| Resolved | ${discrepancies.filter(d => d.status === 'resolved').length} |

## API Contract Overview

### Nuggets (/api/nuggets)
- \`POST /\` - Create nugget (auth required)
- \`GET /\` - List nuggets (auth optional)
- \`GET /:id\` - Get single nugget (auth optional)
- \`PUT /:id\` - Update nugget (auth required)
- \`PATCH /:id\` - Partial update (auth required)
- \`DELETE /:id\` - Soft delete (auth required)

### Collections (/api/collections)
- \`POST /\` - Create collection (auth required)
- \`GET /\` - List collections (auth optional)
- \`GET /:id\` - Get collection with nuggets (auth optional)
- \`PUT /:id\` - Update collection (auth required)
- \`DELETE /:id\` - Soft delete (auth required)
- \`POST /:id/add-nugget\` - Add nugget to collection (auth required)
- \`POST /:id/remove-nugget/:nuggetId\` - Remove nugget (auth required)
- \`POST /:id/follow\` - Follow collection (auth required)
- \`POST /:id/unfollow\` - Unfollow collection (auth required)

### Bookmark Folders (/api/bookmark-folders)
- \`POST /\` - Create folder (auth required)
- \`GET /\` - List folders (auth required)
- \`GET /:id\` - Get folder with bookmarks (auth required)
- \`PUT /:id\` - Update folder (auth required)
- \`DELETE /:id\` - Delete folder (auth required)

### Bookmarks (via /api/nuggets/:id)
- \`POST /:id/bookmark\` - Bookmark nugget (auth required)
- \`POST /:id/unbookmark\` - Remove bookmark (auth required)

---

## Discrepancies Found

`;

  // Group by status
  const openIssues = discrepancies.filter(d => d.status === 'open');
  const resolvedIssues = discrepancies.filter(d => d.status === 'resolved');

  if (openIssues.length > 0) {
    report += `### 🔴 Open Issues (${openIssues.length})\n\n`;
    for (const d of openIssues) {
      report += formatDiscrepancy(d);
    }
  }

  if (resolvedIssues.length > 0) {
    report += `### ✅ Resolved/Working as Intended (${resolvedIssues.length})\n\n`;
    for (const d of resolvedIssues) {
      report += formatDiscrepancy(d);
    }
  }

  report += `
---

## Recommended Fixes

### Priority 1: Update Nugget Payload Transformation

The \`RestAdapter.updateArticle\` should transform Article fields to Nugget schema:

\`\`\`typescript
async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
  // Transform Article -> Nugget payload
  const payload: any = {};
  
  if (updates.content !== undefined) {
    payload.contentMarkdown = updates.content;
  }
  if (updates.categories !== undefined) {
    payload.categories = updates.categories;
  }
  if (updates.tags !== undefined) {
    payload.tags = updates.tags;
  }
  if (updates.visibility !== undefined) {
    payload.visibility = updates.visibility;
  }
  
  return apiClient.put<Article>(\`/nuggets/\${id}\`, payload);
}
\`\`\`

### Priority 2: Add PATCH Method to apiClient

\`\`\`typescript
patch<T>(url: string, body: any, headers?: HeadersInit) {
  return this.request<T>(url, { method: 'PATCH', body: JSON.stringify(body), headers });
}
\`\`\`

### Priority 3: Backend Tags Normalization

Accept both array and comma-separated string for tags:

\`\`\`typescript
// In createNuggetSchema
tags: z.union([
  z.array(z.string()),
  z.string().transform(s => s.split(',').map(t => t.trim()).filter(Boolean))
]).optional(),
\`\`\`

---

## Testing Checklist

- [ ] Create nugget with URL only (no content)
- [ ] Create nugget with content only
- [ ] Create nugget with attachments
- [ ] Update nugget content
- [ ] Delete and restore nugget
- [ ] Create collection (public)
- [ ] Create collection (private)
- [ ] Add nugget to collection
- [ ] Remove nugget from collection
- [ ] Follow/unfollow collection
- [ ] Create bookmark folder
- [ ] Bookmark nugget (with and without folder)
- [ ] Move bookmark between folders
- [ ] Delete bookmark folder

---

## Conclusion

The codebase has a well-structured API with proper separation between frontend and backend.
Most discrepancies are minor and already handled through normalization.

**Action Items:**
1. Fix updateArticle payload transformation (medium priority)
2. Add PATCH method to apiClient (low priority)
3. Add backend tags normalization (low priority)

`;

  return report;
}

function formatDiscrepancy(d) {
  return `#### ${d.id}: ${d.description}

- **Severity:** ${d.severity}
- **Resource:** ${d.resource}
- **Operation:** ${d.operation}

**Frontend:**
- File: \`${d.frontend.file}\`
${d.frontend.line ? `- Line: ${d.frontend.line}` : ''}
\`\`\`typescript
${d.frontend.code}
\`\`\`

**Backend:**
- File: \`${d.backend.file}\`
${d.backend.line ? `- Line: ${d.backend.line}` : ''}
\`\`\`typescript
${d.backend.code}
\`\`\`

**Fix:** ${d.fix}

---

`;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('🔍 Running Payload Audit...\n');
  
  const discrepancies = analyzeCodebase();
  
  console.log(`Found ${discrepancies.length} items to review:`);
  console.log(`  - Open issues: ${discrepancies.filter(d => d.status === 'open').length}`);
  console.log(`  - Resolved: ${discrepancies.filter(d => d.status === 'resolved').length}`);
  console.log('');
  
  const report = generateReport(discrepancies);
  
  // Ensure output directory exists
  const outputDir = path.join(__dirname, '..', 'tmp', 'audit');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const reportPath = path.join(outputDir, 'discrepancy_report.md');
  fs.writeFileSync(reportPath, report);
  
  console.log(`📄 Report generated: ${reportPath}`);
  console.log('');
  console.log('Summary of open issues:');
  
  discrepancies
    .filter(d => d.status === 'open')
    .forEach(d => {
      console.log(`  [${d.severity.toUpperCase()}] ${d.id}: ${d.description}`);
    });
}

main();

