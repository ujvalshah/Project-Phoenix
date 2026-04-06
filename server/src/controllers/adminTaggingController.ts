import { Request, Response } from 'express';
import { Article } from '../models/Article.js';
import { Tag, canonicalize } from '../models/Tag.js';
import { Collection } from '../models/Collection.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import { z } from 'zod';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';

// ─── Collection → Tag Mapping (v2: three-axis taxonomy) ────────────────────
// Maps old collection names to the new format/domain/subtopic tags.

interface TagMapping {
  formatTag?: string;
  domainTags?: string[];
  subtopicTags?: string[];
}

const COLLECTION_TO_TAG_MAP: Record<string, TagMapping> = {
  // Format collections
  'podcasts': { formatTag: 'Podcast' },
  'reports': { formatTag: 'Report / Insights' },
  'blogs & article': { formatTag: 'Report / Insights' },
  'documentary & short films': { formatTag: 'Documentary' },
  'knowledge bytes': { formatTag: 'Knowledge Bytes' },
  // Domain + subtopic collections
  'ai': { domainTags: ['Technology'], subtopicTags: ['AI'] },
  'china': { domainTags: ['Geopolitics'], subtopicTags: ['China'] },
  'japan': { domainTags: ['Geopolitics'], subtopicTags: ['Japan'] },
  'crude oil & energy': { domainTags: ['Macro / Economics'], subtopicTags: ['Crude Oil & Energy'] },
  'geopolitics': { domainTags: ['Geopolitics'] },
  'commodities': { domainTags: ['Macro / Economics'], subtopicTags: ['Commodities'] },
  'economics': { domainTags: ['Macro / Economics'] },
  'macros': { domainTags: ['Macro / Economics'] },
  'history': { domainTags: ['History'] },
  'gold': { domainTags: ['Markets & Investments'], subtopicTags: ['Gold & Silver'] },
  'wall street': { domainTags: ['Markets & Investments'], subtopicTags: ['PE/VC'] },
  'investing': { domainTags: ['Markets & Investments'] },
  'dollar, money & currency': { domainTags: ['Macro / Economics'], subtopicTags: ['Currencies & FX'] },
  'pe/vc': { domainTags: ['Markets & Investments'], subtopicTags: ['PE/VC'] },
  'self-improvement': { domainTags: ['Self-Development'] },
  'biographical': { domainTags: ['Leaders, Investors & Entrepreneurs'] },
  'india': { domainTags: ['Geopolitics'], subtopicTags: ['India'] },
  // Hybrid collections
  'ai & tech podcast': { formatTag: 'Podcast', domainTags: ['Technology'], subtopicTags: ['AI'] },
  'ai, tech & vcs': { formatTag: 'Report / Insights', domainTags: ['Technology'], subtopicTags: ['AI'] },
  'india focused': { domainTags: ['Geopolitics'], subtopicTags: ['India'] },
  'china focused': { domainTags: ['Geopolitics'], subtopicTags: ['China'] },
  'markets & macros (p)': { formatTag: 'Podcast', domainTags: ['Macro / Economics'] },
  'markets & macros (r)': { formatTag: 'Report / Insights', domainTags: ['Macro / Economics'] },
  'private equity & wall street': { domainTags: ['Markets & Investments'], subtopicTags: ['PE/VC'] },
  'leaders, investors & entrepreneurs': { domainTags: ['Leaders, Investors & Entrepreneurs'] },
};

// ─── GET /api/admin/tagging/export ──────────────────────────────────────────

/**
 * Export all nuggets with their current collections and suggested dimension tags
 * as an XLSX file for manual review.
 */
export const exportTagMapping = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);

  try {
    // 1. Build article → collection names map
    const collections = await Collection.find({ type: 'public' })
      .select('rawName canonicalName entries')
      .lean();

    const articleCollections = new Map<string, string[]>();
    for (const col of collections) {
      for (const entry of col.entries || []) {
        if (!articleCollections.has(entry.articleId)) {
          articleCollections.set(entry.articleId, []);
        }
        articleCollections.get(entry.articleId)!.push(col.rawName || '');
      }
    }

    // 2. Load dimension tags for lookup
    const dimensionTags = await Tag.find({
      dimension: { $exists: true, $ne: null },
      status: 'active',
    }).lean();

    // 3. Load all articles (include media/link fields for source URL)
    const articles = await Article.find({})
      .select('_id title tags tagIds publishedAt source_type primaryMedia media externalLinks')
      .sort({ publishedAt: -1 })
      .lean();

    // 4. Build rows
    const rows = articles.map(article => {
      const id = article._id.toString();
      const colNames = articleCollections.get(id) || [];

      // Derive suggestions from collection mappings
      const suggestedFormats = new Set<string>();
      const suggestedDomains = new Set<string>();
      const suggestedSubtopics = new Set<string>();

      for (const colName of colNames) {
        const mapping = COLLECTION_TO_TAG_MAP[colName.toLowerCase().trim()];
        if (!mapping) continue;
        if (mapping.formatTag) suggestedFormats.add(mapping.formatTag);
        if (mapping.domainTags) {
          for (const dt of mapping.domainTags) suggestedDomains.add(dt);
        }
        if (mapping.subtopicTags) {
          for (const st of mapping.subtopicTags) suggestedSubtopics.add(st);
        }
      }

      // Check existing dimension tagIds
      const existingDimTags = (article.tagIds || [])
        .map(tid => dimensionTags.find(dt => dt._id.toString() === tid.toString()))
        .filter(Boolean)
        .map(t => t!.rawName);

      // Extract best source URL: primary external link > primaryMedia > legacy media
      const primaryLink = (article.externalLinks || []).find((l: any) => l.isPrimary);
      const sourceUrl =
        primaryLink?.url ||
        (article.primaryMedia as any)?.url ||
        (article.media as any)?.url ||
        '';

      return {
        nugget_id: id,
        title: article.title || '',
        source_url: sourceUrl,
        source_type: article.source_type || '',
        published_at: article.publishedAt || '',
        current_tags: (article.tags || []).join('; '),
        current_collections: colNames.join('; '),
        existing_dimension_tags: existingDimTags.join('; '),
        suggested_format: Array.from(suggestedFormats).join('; '),
        suggested_domain: Array.from(suggestedDomains).join('; '),
        suggested_subtopic: Array.from(suggestedSubtopics).join('; '),
      };
    });

    // 5. Build valid tag name lists for instructions
    const formatNames = dimensionTags
      .filter(t => t.dimension === 'format')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(t => t.rawName);

    const domainNames = dimensionTags
      .filter(t => t.dimension === 'domain')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(t => t.rawName);

    const subtopicNames = dimensionTags
      .filter(t => t.dimension === 'subtopic')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(t => t.rawName);

    // 6. Create XLSX with 3 sheets
    const workbook = XLSX.utils.book_new();

    // ── Sheet 1: Tag Mapping (main data) ────────────────────────────────
    const dataSheet = XLSX.utils.json_to_sheet(rows);
    dataSheet['!cols'] = [
      { wch: 26 }, // nugget_id
      { wch: 60 }, // title
      { wch: 55 }, // source_url
      { wch: 10 }, // source_type
      { wch: 12 }, // published_at
      { wch: 30 }, // current_tags
      { wch: 40 }, // current_collections
      { wch: 30 }, // existing_dimension_tags
      { wch: 20 }, // suggested_format
      { wch: 30 }, // suggested_domain
      { wch: 30 }, // suggested_subtopic
    ];
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Tag Mapping');

    // ── Sheet 2: Instructions ───────────────────────────────────────────
    const instructionRows = [
      ['BULK TAG MAPPING — INSTRUCTIONS'],
      [''],
      ['PURPOSE'],
      ['This file lets you review and assign three-axis tags (Format + Domain + Sub-topic) to every nugget.'],
      ['After editing, upload the file back via Admin > Bulk Tagging to apply changes.'],
      [''],
      ['COLUMNS IN "Tag Mapping" SHEET'],
      ['Column', 'Description', 'Editable?'],
      ['nugget_id', 'Unique ID of the nugget (do NOT change)', 'No'],
      ['title', 'Nugget title for reference', 'No'],
      ['source_url', 'Primary source URL (website, YouTube, etc.) — helps AI classify', 'No'],
      ['source_type', 'Content type hint (link, video, document, etc.)', 'No'],
      ['published_at', 'Publication date', 'No'],
      ['current_tags', 'Legacy string tags on this nugget', 'No'],
      ['current_collections', 'Collections this nugget belongs to', 'No'],
      ['existing_dimension_tags', 'Dimension tags already assigned', 'No'],
      ['suggested_format', 'Content format (edit if wrong)', 'YES'],
      ['suggested_domain', 'Subject domain (edit if wrong)', 'YES'],
      ['suggested_subtopic', 'Cross-cutting sub-topic (edit if wrong)', 'YES'],
      [''],
      ['RULES'],
      ['1. Tag names must match EXACTLY (case-sensitive) from the lists below.'],
      ['2. Use semicolons to separate multiple values: e.g. "Markets & Investments; Technology"'],
      ['3. Each nugget should have exactly ONE format tag.'],
      ['4. Each nugget can have one or more domain tags.'],
      ['5. Each nugget can have one or more sub-topics (they are cross-cutting, not tied to a specific domain).'],
      ['6. Empty cells = no change (existing tags are preserved).'],
      ['7. Only the "suggested_" columns are read on import. Other columns are ignored.'],
      [''],
      ['VALID FORMAT TAGS (pick exactly one per nugget)'],
      ...formatNames.map(n => [`  ${n}`]),
      [''],
      ['VALID DOMAIN TAGS (pick one or more per nugget)'],
      ...domainNames.map(n => [`  ${n}`]),
      [''],
      ['VALID SUB-TOPIC TAGS (pick zero or more per nugget)'],
      ...subtopicNames.map(n => [`  ${n}`]),
      [''],
      ['TIPS'],
      ['- YouTube videos are usually Podcasts or Documentaries — check the title.'],
      ['- "link" source_type items are usually Report / Insights.'],
      ['- Sub-topics are cross-cutting: "AI" can pair with Technology, Markets & Investments, etc.'],
      ['- If a nugget truly belongs to multiple domains, list them all.'],
      ['- The "AI Prompt" sheet has a ready-to-paste prompt for AI-assisted classification.'],
    ];
    const instrSheet = XLSX.utils.aoa_to_sheet(instructionRows);
    instrSheet['!cols'] = [{ wch: 30 }, { wch: 65 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, instrSheet, 'Instructions');

    // ── Sheet 3: AI Classification Prompt ───────────────────────────────
    const aiPromptText = `You are a content classification assistant. I have a spreadsheet of content nuggets (articles, podcasts, reports, etc.) that need to be tagged across three dimensions:

DIMENSION 1 — CONTENT FORMAT (pick exactly one):
${formatNames.map(n => `- ${n}`).join('\n')}

DIMENSION 2 — SUBJECT DOMAIN (pick one or more):
${domainNames.map(n => `- ${n}`).join('\n')}

DIMENSION 3 — SUB-TOPIC (pick zero or more, cross-cutting):
${subtopicNames.map(n => `- ${n}`).join('\n')}

RULES:
1. Each nugget gets exactly ONE format tag.
2. Each nugget gets one or more domain tags.
3. Each nugget gets zero or more sub-topics. Sub-topics are cross-cutting — "AI" can pair with Technology, Markets & Investments, etc.
4. Use source_url as a STRONG signal:
   - YouTube URLs → likely Podcast, Documentary, or Knowledge Bytes (check title to decide)
   - bloomberg.com, ft.com, economist.com → likely Report / Insights about Macro / Economics
   - substack.com, medium.com → likely Report / Insights
   - PDF/document links → likely Report / Insights
5. Use source_type as a hint: "video" = Podcast/Documentary, "link" = Report / Insights, "document" = Report / Insights.
6. Use "current_collections" and "current_tags" columns as additional context, but override if they seem wrong.
7. Separate multiple values with semicolons: e.g. "Markets & Investments; Technology"
8. Leave cells empty if you truly cannot determine the tag.

I will paste the data below. For each row, fill in the three columns:
- suggested_format
- suggested_domain
- suggested_subtopic

Return the results as a table with columns: nugget_id, suggested_format, suggested_domain, suggested_subtopic.

DATA:
[Paste rows from the "Tag Mapping" sheet here — include nugget_id, title, source_url, source_type, current_tags, current_collections columns]`;

    const aiRows = [
      ['AI CLASSIFICATION PROMPT'],
      [''],
      ['Copy the prompt below and paste it into Claude, ChatGPT, or any AI assistant.'],
      ['Then paste a batch of rows (50-100 at a time) from the "Tag Mapping" sheet.'],
      ['Copy the AI\'s output back into the suggested_format/domain/subtopic columns.'],
      [''],
      ['TIP: For best results, include the nugget_id, title, current_tags, and current_collections columns.'],
      ['TIP: Process in batches of 50-100 rows to avoid context limits.'],
      ['TIP: Always spot-check the AI\'s suggestions before uploading.'],
      [''],
      ['─── PROMPT (copy everything below this line) ───'],
      [''],
      [aiPromptText],
    ];
    const aiSheet = XLSX.utils.aoa_to_sheet(aiRows);
    aiSheet['!cols'] = [{ wch: 120 }];
    XLSX.utils.book_append_sheet(workbook, aiSheet, 'AI Prompt');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=nugget_tag_mapping.xlsx');
    res.send(buffer);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    requestLogger.error({ msg: '[AdminTagging] Export error', error: { message: err.message, stack: err.stack } });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /api/admin/tagging/import ─────────────────────────────────────────

const importRowSchema = z.object({
  nugget_id: z.string().min(1),
  suggested_format: z.string().optional().default(''),
  suggested_domain: z.string().optional().default(''),
  suggested_subtopic: z.string().optional().default(''),
});

/**
 * Import reviewed tag mapping from XLSX.
 * Expects columns: nugget_id, suggested_format, suggested_domain, suggested_subtopic
 * Tag values are matched by rawName against the Tag collection.
 */
export const importTagMapping = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Send an XLSX file as multipart/form-data with field name "file".' });
    }

    // Parse the uploaded XLSX
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ message: 'XLSX file has no sheets' });
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName]);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Sheet is empty' });
    }

    // Load all dimension tags for name→ID lookup
    const dimensionTags = await Tag.find({
      dimension: { $exists: true, $ne: null },
      status: 'active',
    }).lean();

    const tagNameToId = new Map<string, mongoose.Types.ObjectId>();
    for (const t of dimensionTags) {
      tagNameToId.set(canonicalize(t.rawName), t._id);
      for (const alias of t.aliases || []) {
        tagNameToId.set(canonicalize(alias), t._id);
      }
    }

    // Process rows
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const validationErrors: Array<{ row: number; error: string }> = [];

    const BATCH_SIZE = 100;
    const bulkOps: Array<{
      updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> };
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = importRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        validationErrors.push({ row: i + 2, error: parsed.error.message });
        errors++;
        continue;
      }

      const { nugget_id, suggested_format, suggested_domain, suggested_subtopic } = parsed.data;

      // Resolve tag names to IDs
      const resolvedIds = new Set<string>();

      const resolveNames = (raw: string) => {
        if (!raw.trim()) return;
        const names = raw.split(';').map(s => s.trim()).filter(Boolean);
        for (const name of names) {
          const id = tagNameToId.get(canonicalize(name));
          if (id) {
            resolvedIds.add(id.toString());
          } else {
            validationErrors.push({ row: i + 2, error: `Unknown tag: "${name}"` });
          }
        }
      };

      resolveNames(suggested_format);
      resolveNames(suggested_domain);
      resolveNames(suggested_subtopic);

      if (resolvedIds.size === 0) {
        skipped++;
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: nugget_id },
          update: {
            $addToSet: {
              tagIds: { $each: Array.from(resolvedIds).map(id => new mongoose.Types.ObjectId(id)) },
            },
          },
        },
      });
    }

    // Execute in batches
    for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
      const batch = bulkOps.slice(i, i + BATCH_SIZE);
      try {
        const result = await Article.bulkWrite(batch);
        updated += result.modifiedCount;
      } catch (err: unknown) {
        const batchErr = err instanceof Error ? err : new Error(String(err));
        requestLogger.error({ msg: '[AdminTagging] Batch import error', offset: i, error: batchErr.message });
        errors++;
      }
    }

    requestLogger.info({
      msg: '[AdminTagging] Import complete',
      totalRows: rows.length,
      updated,
      skipped,
      errors,
    });

    res.json({
      message: 'Import complete',
      totalRows: rows.length,
      updated,
      skipped,
      errors,
      validationErrors: validationErrors.slice(0, 50),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    requestLogger.error({ msg: '[AdminTagging] Import error', error: { message: err.message, stack: err.stack } });
    captureException(err, { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};
