/**
 * MongoDB field profiling for pre-migration validation.
 * Run: npx tsx scripts/validate/mongo-profile.ts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { MongoClient, type Document as MongoDocument } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

const REPORT_PATH = resolve(__dirname, 'output/mongo-profile-report.json');

loadEnv();

const MONGO_URI = process.env.MONGO_URI;
const SAMPLE_FOR_VARIANTS = 100;

/** Canonical migration field keys ↔ possible BSON keys (first match wins per document) */
const CANONICAL = {
  _id: { keys: ['_id'] as const },
  title: { keys: ['title'] as const },
  slug: { keys: ['slug'] as const },
  content: { keys: ['content_markdown', 'body', 'content'] as const },
  excerpt: { keys: ['excerpt'] as const },
  status: { keys: ['status', 'isPublished'] as const },
  content_stream: { keys: ['contentStream', 'content_stream', 'stream', 'type'] as const },
  hero_image: { keys: ['hero_image', 'heroImage', 'hero_url', 'heroUrl'] as const },
  tags: { keys: ['tagIds', 'tags'] as const },
  createdAt: { keys: ['created_at', 'createdAt'] as const },
  publishedAt: { keys: ['publishedAt', 'published_at'] as const },
  updatedAt: { keys: ['updated_at', 'updatedAt'] as const },
} as const;

type CanonicalFieldName = keyof typeof CANONICAL;

type FieldReportEntry = {
  presentCount: number;
  presentPct: number;
  nullCount: number;
  emptyStringCount: number;
  sampleValues: unknown[];
  detectedAs?: string;
};

type ContentStreamBreakdown = {
  standard: number;
  pulse: number;
  both: number;
  missing: number;
};

type MediaSubdocumentShapes = {
  noMedia: number;
  hasHeroFields: number;
  hasMediaArray: number;
  shapeSamples: unknown[];
};

type ProfileReport = {
  collectionName: string;
  totalDocuments: number;
  fields: Record<string, FieldReportEntry>;
  contentStreamBreakdown: ContentStreamBreakdown;
  tagDuplicates: {
    totalTagDocs: number;
    duplicateCanonicalSlugs: Record<string, number>;
  };
  mediaSubdocumentShapes: MediaSubdocumentShapes;
  error?: string;
};

function loadEnv(): void {
  const envPath = resolve(PROJECT_ROOT, '.env');
  const localPath = resolve(PROJECT_ROOT, '.env.local');
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
  if (existsSync(localPath)) {
    config({ path: localPath, override: true });
  }
}

function ensureOutputDir(): void {
  const dir = dirname(REPORT_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeReport(report: ProfileReport | { error: string }): void {
  ensureOutputDir();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
}

function serializeSample(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toHexString' in value && typeof (value as { toHexString: () => string }).toHexString === 'function') {
    try {
      return (value as { toHexString: () => string }).toHexString();
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) {
    return value.map(serializeSample);
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).slice(0, 24)) {
      out[k] = serializeSample(o[k]);
    }
    return out;
  }
  return value;
}

function pct(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 1000) / 10;
}

function hasOwnKey(obj: MongoDocument, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function firstMatchingKey(doc: MongoDocument, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    if (hasOwnKey(doc, k)) return k;
  }
  return undefined;
}

/** Inspect first N docs for variant names (per spec: first 100 hint before full scan) */
function variantsSeenInSample(sampleDocs: MongoDocument[], keys: readonly string[]): string[] {
  const found = new Set<string>();
  for (const doc of sampleDocs) {
    for (const k of keys) {
      if (hasOwnKey(doc, k)) found.add(k);
    }
  }
  return [...keys].filter((k) => found.has(k));
}

function dominantKeyFromHistogram(counts: Record<string, number>): string | undefined {
  let bestKey: string | undefined;
  let bestN = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) {
      bestN = n;
      bestKey = k;
    }
  }
  return bestKey;
}

function detectedAsIfNeeded(canonical: CanonicalFieldName, actual: string | undefined): string | undefined {
  if (!actual) return undefined;
  const mapping: Partial<Record<CanonicalFieldName, string>> = {
    content: 'content',
    status: 'status',
    content_stream: 'content_stream',
    hero_image: 'hero_image',
    tags: 'tags',
    createdAt: 'createdAt',
    publishedAt: 'publishedAt',
    updatedAt: 'updatedAt',
  };
  const expected = mapping[canonical];
  if (!expected) return undefined;
  if (actual === expected) return undefined;
  if (canonical === 'content' && (actual === 'body' || actual === 'content_markdown')) return actual;
  if (canonical === 'status' && actual === 'isPublished') return 'isPublished';
  if (canonical === 'content_stream' && actual !== 'content_stream') return actual;
  if (canonical === 'hero_image' && actual !== 'hero_image') return actual;
  if (canonical === 'tags' && actual === 'tagIds') return 'tagIds';
  if (canonical === 'createdAt' && actual === 'created_at') return 'created_at';
  if (canonical === 'publishedAt' && actual === 'published_at') return 'published_at';
  if (canonical === 'updatedAt' && actual === 'updated_at') return 'updated_at';
  return actual !== expected ? actual : undefined;
}

function categorizeStreamValue(doc: MongoDocument, streamField: string | undefined): 'standard' | 'pulse' | 'both' | 'missing' {
  if (!streamField || !hasOwnKey(doc, streamField)) {
    return 'missing';
  }
  const raw = doc[streamField];
  if (raw === null || raw === undefined) {
    return 'standard';
  }
  const s = String(raw).trim().toLowerCase();
  if (s === 'pulse') return 'pulse';
  if (s === 'both') return 'both';
  if (s === 'standard' || s === '') return 'standard';
  return 'standard';
}

function docHasHeroFields(doc: MongoDocument): boolean {
  for (const k of CANONICAL.hero_image.keys) {
    if (hasOwnKey(doc, k)) {
      const v = doc[k];
      if (v !== undefined && v !== null && v !== '') return true;
    }
  }
  return false;
}

function docHasMediaArray(doc: MongoDocument): boolean {
  const m = doc.media;
  if (Array.isArray(m) && m.length > 0) return true;
  const sm = doc.supportingMedia;
  return Array.isArray(sm) && sm.length > 0;
}

function docHasEmbeddedSingleMedia(doc: MongoDocument): boolean {
  const m = doc.media;
  if (m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m as object).length > 0) return true;
  return false;
}

function docCountsAsNoMedia(doc: MongoDocument): boolean {
  return !docHasHeroFields(doc) && !docHasMediaArray(doc) && !docHasEmbeddedSingleMedia(doc);
}

function extractMediaShapeSample(doc: MongoDocument): unknown {
  if (Array.isArray(doc.media) && doc.media.length > 0) {
    return { source: 'media[]', shape: serializeSample(doc.media[0]) };
  }
  if (Array.isArray(doc.supportingMedia) && doc.supportingMedia.length > 0) {
    return { source: 'supportingMedia[]', shape: serializeSample(doc.supportingMedia[0]) };
  }
  if (doc.media && typeof doc.media === 'object' && !Array.isArray(doc.media)) {
    return { source: 'media', shape: serializeSample(doc.media) };
  }
  for (const k of CANONICAL.hero_image.keys) {
    if (hasOwnKey(doc, k) && doc[k] !== undefined && doc[k] !== null && doc[k] !== '') {
      return { source: `hero:${k}`, shape: serializeSample(doc[k]) };
    }
  }
  return null;
}

async function aggregateTagDuplicates(
  client: MongoClient,
  dbName: string,
  tagsCollectionName: string | undefined
): Promise<{ total: number; dups: Record<string, number> }> {
  if (!tagsCollectionName) return { total: 0, dups: {} };
  const db = client.db(dbName);
  const coll = db.collection(tagsCollectionName);
  const total = await coll.estimatedDocumentCount();
  type AggRow = { _id: string; c: number };
  const agg = await coll
    .aggregate<AggRow>([
      {
        $match: {
          canonicalName: { $exists: true, $type: 'string', $nin: [''] },
        },
      },
      {
        $group: {
          _id: '$canonicalName',
          c: { $sum: 1 },
        },
      },
      { $match: { c: { $gt: 1 } } },
      { $sort: { c: -1 } },
    ])
    .toArray();
  const dups: Record<string, number> = {};
  for (const row of agg) {
    if (row._id != null && String(row._id).length > 0) {
      dups[String(row._id)] = row.c;
    }
  }
  return { total, dups };
}

/** CRITICAL thresholds: canonical field names after resolution */
function isCritical(canonical: CanonicalFieldName): boolean {
  return (
    canonical === 'title' ||
    canonical === '_id' ||
    canonical === 'status' ||
    canonical === 'content_stream' ||
    canonical === 'createdAt'
  );
}

function printSummary(
  report: ProfileReport,
  fail: boolean,
  duplicateSlugLines: ReadonlyArray<readonly [string, number]>
): void {
  console.log(`\nCollection: ${report.collectionName}`);
  console.log(`Total documents: ${report.totalDocuments}\n`);

  console.log('FIELD PRESENCE');
  const order = Object.keys(CANONICAL) as CanonicalFieldName[];
  for (const name of order) {
    const row = report.fields[name];
    if (!row) continue;
    const flags: string[] = [];
    if (row.presentPct < 50) flags.push('CRITICAL');
    else if (row.presentPct < 80) flags.push('WARNING');
    const flagStr = flags.length ? `  [${flags.join(' ')}]` : '';
    console.log(`  ${name}: ${row.presentPct}%${flagStr}`);
  }

  console.log('\nCONTENT STREAM BREAKDOWN');
  const b = report.contentStreamBreakdown;
  console.log(
    `  standard: ${b.standard} | pulse: ${b.pulse} | both: ${b.both} (maps to standard in ETL) | missing: ${b.missing}`
  );

  console.log('\nTAG DUPLICATES');
  const dupCount = Object.keys(report.tagDuplicates.duplicateCanonicalSlugs).length;
  console.log(`  ${dupCount} duplicate canonical slugs found`);
  for (const line of duplicateSlugLines) {
    const [slug, c] = line;
    console.log(`  ${slug}: ${c}`);
  }

  console.log('\nFIELD NAME VARIANTS DETECTED');
  const variants: string[] = [];
  for (const name of order) {
    const row = report.fields[name];
    if (row?.detectedAs) {
      variants.push(`${name}: stored as '${row.detectedAs}'`);
    }
  }
  if (variants.length === 0) {
    console.log('  (none)');
  } else {
    for (const v of variants) console.log(`  ${v}`);
  }

  console.log(`\nRESULT: ${fail ? 'FAIL' : 'PASS'}\n`);
}

async function main(): Promise<void> {
  if (!MONGO_URI) {
    const msg = 'MONGO_URI is not set (.env.local or .env).';
    writeReport({ error: msg });
    console.error(msg);
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();

    let dbFromUri: string | undefined;
    try {
      const u = new URL(MONGO_URI.replace(/^mongodb\+srv/i, 'https').replace(/^mongodb/i, 'http'));
      const path = u.pathname.replace(/^\//, '');
      if (path.length > 0) {
        const segment = path.split(/[/?]/)[0];
        if (segment) dbFromUri = segment;
      }
    } catch {
      /* ignore URI parse quirks */
    }

    interface Best {
      count: bigint;
      dbName: string;
      collName: string;
    }
    let best: Best | null = null;

    function consider(dbName: string, collName: string, count: number): void {
      const countB = BigInt(count);
      if (!best || countB > best.count) {
        best = { count: countB, dbName, collName };
        return;
      }
      if (countB < best.count) return;
      const priority = ['articles', 'nuggets', 'posts'];
      const bp = priority.indexOf(collName);
      const ap = priority.indexOf(best.collName);
      if (bp !== -1 && (ap === -1 || bp < ap)) best = { count: countB, dbName, collName };
      else if (bp === ap && collName.localeCompare(best.collName) < 0) best = { count: countB, dbName, collName };
    }

    async function scanDatabase(dbObj: ReturnType<MongoClient['db']>): Promise<void> {
      const dbn = dbObj.databaseName;
      try {
        const names = (await dbObj.listCollections().toArray())
          .filter((c) => !c.name.startsWith('system.'))
          .map((c) => c.name);
        for (const collName of names) {
          const c = await dbObj.collection(collName).estimatedDocumentCount();
          consider(dbn, collName, c);
        }
      } catch {
        /* collection listing may be restricted */
      }
    }

    const scannedDbs = new Set<string>();
    await scanDatabase(client.db());
    scannedDbs.add(client.db().databaseName);

    try {
      const adminDb = client.db().admin();
      const dblist = await adminDb.listDatabases();
      for (const entry of dblist.databases) {
        const n = entry.name;
        if (['admin', 'local', 'config'].includes(n)) continue;
        if (scannedDbs.has(n)) continue;
        await scanDatabase(client.db(n));
        scannedDbs.add(n);
      }
    } catch {
      if (!best && dbFromUri) {
        await scanDatabase(client.db(dbFromUri));
      }
    }

    async function listAllNamespaces(): Promise<string[]> {
      const out: string[] = [];
      try {
        const adminDb = client.db().admin();
        const dblist = await adminDb.listDatabases();
        for (const d of dblist.databases) {
          if (['admin', 'local', 'config'].includes(d.name)) continue;
          try {
            const cols = (await client.db(d.name).listCollections().toArray())
              .filter((c) => !c.name.startsWith('system.'))
              .map((c) => `${d.name}.${c.name}`);
            out.push(...cols);
          } catch {
            /* noop */
          }
        }
      } catch {
        try {
          const cols = (await client.db().listCollections().toArray())
            .filter((c) => !c.name.startsWith('system.'))
            .map((c) => `${client.db().databaseName}.${c.name}`);
          out.push(...cols);
        } catch {
          /* noop */
        }
      }
      return out;
    }

    async function abortNoPrimaryCollection(): Promise<void> {
      const listing = await listAllNamespaces();
      const msg =
        listing.length > 0
          ? `Could not determine primary collection (no user collections or listing failed). Available collections:\n${listing.join('\n')}`
          : 'Could not determine primary collection and no collections could be listed.';
      console.error(msg);
      writeReport({ error: msg });
      process.exitCode = 1;
    }

    if (best === null) {
      await abortNoPrimaryCollection();
      return;
    }
    /** `consider()` assigns via closure — TS cannot narrow outer `best`; safe after runtime null guard */
    const primaryPick = best as Best;
    if (primaryPick.collName === '') {
      await abortNoPrimaryCollection();
      return;
    }

    const collectionName = primaryPick.collName;
    const dbName = primaryPick.dbName;
    const coll = client.db(dbName).collection(collectionName);
    console.log(`[mongo-profile] Primary content collection: "${collectionName}" (database "${dbName}", ~${primaryPick.count.toString()} documents)`);

    const totalDocs = Number(await coll.estimatedDocumentCount());
    if (totalDocs === 0) {
      const emptyReport: ProfileReport = {
        collectionName,
        totalDocuments: 0,
        fields: {},
        contentStreamBreakdown: { standard: 0, pulse: 0, both: 0, missing: 0 },
        tagDuplicates: { totalTagDocs: 0, duplicateCanonicalSlugs: {} },
        mediaSubdocumentShapes: { noMedia: 0, hasHeroFields: 0, hasMediaArray: 0, shapeSamples: [] },
      };
      writeReport(emptyReport);
      printSummary(emptyReport, true, []);
      process.exitCode = 1;
      return;
    }

    const orderFields = Object.keys(CANONICAL) as CanonicalFieldName[];

    const sampleDocs = (await coll.find({}).limit(SAMPLE_FOR_VARIANTS).toArray()) as MongoDocument[];
    const hintParts: string[] = [];
    for (const name of orderFields) {
      const keys = CANONICAL[name].keys;
      if (keys.length <= 1) continue;
      const seen = variantsSeenInSample(sampleDocs, keys);
      if (seen.length > 0) {
        hintParts.push(`${String(name)}:${seen.join('/')}`);
      }
    }
    const sampleN = Math.min(SAMPLE_FOR_VARIANTS, totalDocs);
    if (hintParts.length > 0) {
      console.log(`[mongo-profile] Variant field names seen in first ${String(sampleN)} doc(s): ${hintParts.join('; ')}`);
    }

    type Acc = Record<
      CanonicalFieldName,
      FieldReportEntry & { seen: Set<string> }
    >;
    const acc = {} as Acc;

    const keyHistogram: Record<CanonicalFieldName, Record<string, number>> = {} as Record<
      CanonicalFieldName,
      Record<string, number>
    >;
    for (const f of orderFields) keyHistogram[f] = {};

    function initRow(): FieldReportEntry & { seen: Set<string> } {
      return {
        presentCount: 0,
        presentPct: 0,
        nullCount: 0,
        emptyStringCount: 0,
        sampleValues: [],
        seen: new Set<string>(),
      };
    }
    for (const f of orderFields) acc[f] = initRow();

    const breakdown: ContentStreamBreakdown = { standard: 0, pulse: 0, both: 0, missing: 0 };

    let noMedia = 0;
    let hasHero = 0;
    let hasMediaArr = 0;
    const shapeSamples: unknown[] = [];
    const shapesSeen = new Set<string>();

    const cursor = coll.find({});
    while (await cursor.hasNext()) {
      const raw = await cursor.next();
      if (!raw) break;
      const doc = raw as MongoDocument;

      for (const canonical of orderFields) {
        const key = firstMatchingKey(doc, CANONICAL[canonical].keys);
        if (!key) continue;
        keyHistogram[canonical][key] = (keyHistogram[canonical][key] ?? 0) + 1;
        const row = acc[canonical];
        row.presentCount += 1;
        const v = doc[key];
        if (v === null) row.nullCount += 1;
        else if (v === '') row.emptyStringCount += 1;
        else if (row.sampleValues.length < 3) {
          const ser = serializeSample(v);
          const sig = typeof ser === 'object' ? JSON.stringify(ser) : String(ser);
          if (!row.seen.has(sig)) {
            row.seen.add(sig);
            row.sampleValues.push(ser);
          }
        }
      }

      const streamKey = firstMatchingKey(doc, CANONICAL.content_stream.keys);
      const bucket = categorizeStreamValue(doc, streamKey);
      breakdown[bucket] += 1;

      if (docCountsAsNoMedia(doc)) noMedia += 1;
      if (docHasHeroFields(doc)) hasHero += 1;
      if (docHasMediaArray(doc)) hasMediaArr += 1;

      if (shapeSamples.length < 3) {
        const samp = extractMediaShapeSample(doc);
        if (samp !== null) {
          const line = JSON.stringify(samp);
          if (!shapesSeen.has(line)) {
            shapesSeen.add(line);
            shapeSamples.push(samp);
          }
        }
      }
    }

    const fieldsOut: Record<string, FieldReportEntry> = {};

    for (const canonical of orderFields) {
      const row = acc[canonical];
      const pctVal = pct(row.presentCount, totalDocs);
      const detected = detectedAsIfNeeded(canonical, dominantKeyFromHistogram(keyHistogram[canonical]));
      fieldsOut[canonical] = {
        presentCount: row.presentCount,
        presentPct: pctVal,
        nullCount: row.nullCount,
        emptyStringCount: row.emptyStringCount,
        sampleValues: row.sampleValues,
        ...(detected ? { detectedAs: detected } : {}),
      };
    }

    const allCollections = (
      await client
        .db(dbName)
        .listCollections()
        .toArray()
    ).map((c) => c.name);
    const tagsCollectionName =
      allCollections.includes('tags') ? 'tags' : allCollections.find((n) => /^tags$/i.test(n));

    const tagDup = await aggregateTagDuplicates(client, dbName, tagsCollectionName);

    const report: ProfileReport = {
      collectionName,
      totalDocuments: totalDocs,
      fields: fieldsOut,
      contentStreamBreakdown: breakdown,
      tagDuplicates: {
        totalTagDocs: tagDup.total,
        duplicateCanonicalSlugs: tagDup.dups,
      },
      mediaSubdocumentShapes: {
        noMedia,
        hasHeroFields: hasHero,
        hasMediaArray: hasMediaArr,
        shapeSamples,
      },
    };

    writeReport(report);

    let fail = false;
    for (const canonical of orderFields) {
      if (!isCritical(canonical)) continue;
      const p = fieldsOut[canonical].presentPct;
      if (p < 50) fail = true;
    }

    const dupSlugLines = Object.entries(tagDup.dups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) as Array<[string, number]>;

    printSummary(report, fail, dupSlugLines);
    process.exitCode = fail ? 1 : 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeReport({ error: `MongoDB connection or query failed: ${message}` });
    console.error(`MongoDB is unreachable or the operation failed:\n${message}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  writeReport({ error: `Unhandled failure: ${message}` });
  console.error(message);
  process.exit(1);
});
