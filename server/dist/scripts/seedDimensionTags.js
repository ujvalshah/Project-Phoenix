/**
 * Seed Dimension Tags Migration (v2 — Three-Axis Taxonomy)
 *
 * Creates the three-axis taxonomy tags:
 *   Dimension 1: FORMAT    (Podcast, Report / Insights, Documentary, Knowledge Bytes)
 *   Dimension 2: DOMAIN    (Markets & Investments, Technology, Geopolitics, etc.)
 *   Dimension 3: SUB-TOPIC (AI, Gold & Silver, India, PE/VC, etc. — cross-cutting)
 *
 * Phase A: Create/update dimension tags (idempotent — safe to re-run)
 * Phase B: Deprecate old dimension tags that are no longer in the taxonomy
 *
 * Usage: tsx server/src/scripts/seedDimensionTags.ts [--dry-run] [--deprecate-old]
 *
 * Flags:
 *   --dry-run        Log what would happen without writing to DB
 *   --deprecate-old  Deprecate dimension tags that aren't in the new taxonomy
 */
import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';
import { initLogger } from '../utils/logger.js';
import { connectDB } from '../utils/db.js';
import { Tag, canonicalize } from '../models/Tag.js';
const TAXONOMY = [
    // ── DIMENSION 1: FORMAT ──────────────────────────────────────────────────
    {
        dimension: 'format',
        tags: [
            { rawName: 'Podcast', aliases: ['Podcasts'], sortOrder: 1 },
            { rawName: 'Report / Insights', aliases: ['Report', 'Reports', 'Insights'], sortOrder: 2 },
            { rawName: 'Documentary', aliases: ['Documentary & Short Films', 'Documentaries'], sortOrder: 3 },
            { rawName: 'Knowledge Bytes', aliases: ['Knowledge Byte', 'KB'], sortOrder: 4 },
        ],
    },
    // ── DIMENSION 2: DOMAIN ──────────────────────────────────────────────────
    {
        dimension: 'domain',
        tags: [
            { rawName: 'Markets & Investments', aliases: ['Investing', 'Investment', 'Financial', 'Finance'], sortOrder: 1 },
            { rawName: 'Technology', aliases: ['Tech'], sortOrder: 2 },
            { rawName: 'Macro / Economics', aliases: ['Macros', 'Economics', 'Macroeconomics'], sortOrder: 3 },
            { rawName: 'Geopolitics', aliases: ['Geopolitical'], sortOrder: 4 },
            { rawName: 'History', aliases: ['Historical'], sortOrder: 5 },
            { rawName: 'Leaders, Investors & Entrepreneurs', aliases: ['Leaders', 'Investors & Entrepreneurs', 'Biographical', 'Biography'], sortOrder: 6 },
            { rawName: 'Self-Development', aliases: ['Self-Improvement', 'Self Improvement'], sortOrder: 7 },
        ],
    },
    // ── DIMENSION 3: SUB-TOPIC (cross-cutting) ───────────────────────────────
    {
        dimension: 'subtopic',
        tags: [
            // Geographic
            { rawName: 'US', aliases: ['USA', 'United States'], sortOrder: 1 },
            { rawName: 'India', aliases: ['India Focused'], sortOrder: 2 },
            { rawName: 'China', aliases: ['China Focused'], sortOrder: 3 },
            { rawName: 'Japan', sortOrder: 4 },
            { rawName: 'Korea', aliases: ['South Korea'], sortOrder: 5 },
            { rawName: 'Europe', aliases: ['EU'], sortOrder: 6 },
            { rawName: 'Emerging Markets', aliases: ['EM'], sortOrder: 7 },
            { rawName: 'LATAM', aliases: ['Latin America'], sortOrder: 8 },
            { rawName: 'US / West', aliases: ['West', 'Western'], sortOrder: 9 },
            { rawName: 'Middle East', sortOrder: 10 },
            { rawName: 'Russia', sortOrder: 11 },
            // Asset classes & markets
            { rawName: 'Equity', aliases: ['Equities', 'Stocks'], sortOrder: 12 },
            { rawName: 'Gold & Silver', aliases: ['Gold', 'Precious Metals'], sortOrder: 13 },
            { rawName: 'Private Credit', sortOrder: 14 },
            { rawName: 'Alternatives', aliases: ['Alternative Investments', 'Crypto'], sortOrder: 15 },
            { rawName: 'Currencies & FX', aliases: ['FX', 'Currency', 'Dollar, Money & Currency', 'Dollar'], sortOrder: 16 },
            { rawName: 'Fixed Income', aliases: ['Bonds', 'Debt'], sortOrder: 17 },
            // Industry & thematic
            { rawName: 'AI', aliases: ['Artificial Intelligence', 'AI & Tech', 'AI, Tech & VCs'], sortOrder: 18 },
            { rawName: 'Semiconductors', aliases: ['Semiconductor', 'Chips'], sortOrder: 19 },
            { rawName: 'PE/VC', aliases: ['PE / VC', 'Private Equity', 'Venture Capital', 'Private Equity & Wall Street'], sortOrder: 20 },
            { rawName: 'Monetary Policy', aliases: ['Central Banks', 'Fed', 'Federal Reserve'], sortOrder: 21 },
            { rawName: 'Commodities', sortOrder: 22 },
            { rawName: 'Crude Oil & Energy', aliases: ['Oil & Energy', 'Energy', 'Oil', 'Crude Oil'], sortOrder: 23 },
        ],
    },
];
// ─── Phase A: Seed Dimension Tags ───────────────────────────────────────────
async function seedDimensionTags(dryRun) {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const { dimension, tags } of TAXONOMY) {
        console.log(`\n  [${dimension.toUpperCase()}]`);
        for (const seed of tags) {
            await upsertTag(seed, dimension);
        }
    }
    async function upsertTag(seed, dimension) {
        const canonical = canonicalize(seed.rawName);
        const existing = await Tag.findOne({ canonicalName: canonical });
        if (existing) {
            const needsUpdate = existing.dimension !== dimension ||
                existing.sortOrder !== seed.sortOrder ||
                existing.parentTagId != null || // Clear old parentTagId
                JSON.stringify(existing.aliases?.sort()) !== JSON.stringify((seed.aliases || []).sort());
            if (needsUpdate) {
                if (!dryRun) {
                    await Tag.updateOne({ _id: existing._id }, {
                        $set: {
                            dimension,
                            sortOrder: seed.sortOrder,
                            parentTagId: null, // Clear — no longer using parent-child
                            isOfficial: true,
                            status: 'active',
                        },
                        $addToSet: { aliases: { $each: seed.aliases || [] } },
                    });
                }
                console.log(`    ${dryRun ? '[DRY] ' : ''}Updated: ${seed.rawName} (${dimension}, order=${seed.sortOrder})`);
                updated++;
            }
            else {
                skipped++;
            }
            return;
        }
        // Create new tag
        if (!dryRun) {
            await Tag.create({
                rawName: seed.rawName,
                canonicalName: canonical,
                aliases: seed.aliases || [],
                dimension,
                parentTagId: null,
                sortOrder: seed.sortOrder,
                type: 'tag',
                status: 'active',
                isOfficial: true,
                usageCount: 0,
            });
        }
        console.log(`    ${dryRun ? '[DRY] Would create' : 'Created'}: ${seed.rawName} (${dimension}, order=${seed.sortOrder})`);
        created++;
    }
    console.log(`\n  Phase A summary: ${created} created, ${updated} updated, ${skipped} unchanged`);
}
// ─── Phase B: Deprecate old tags not in new taxonomy ────────────────────────
async function deprecateOldTags(dryRun) {
    // Build canonical name set from new taxonomy
    const canonicalNames = new Set();
    for (const { tags } of TAXONOMY) {
        for (const t of tags) {
            canonicalNames.add(canonicalize(t.rawName));
        }
    }
    // Find dimension tags not in the new taxonomy
    const allDimensionTags = await Tag.find({
        dimension: { $exists: true, $ne: null },
        status: 'active',
    }).lean();
    let deprecated = 0;
    for (const tag of allDimensionTags) {
        if (!canonicalNames.has(tag.canonicalName)) {
            if (!dryRun) {
                await Tag.updateOne({ _id: tag._id }, { $set: { status: 'deprecated' } });
            }
            console.log(`  ${dryRun ? '[DRY] Would deprecate' : 'Deprecated'}: "${tag.rawName}" (was ${tag.dimension})`);
            deprecated++;
        }
    }
    console.log(`\n  Phase B summary: ${deprecated} tags deprecated`);
}
// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const doDeprecate = args.includes('--deprecate-old');
    try {
        validateEnv();
        initLogger();
        console.log('Connecting to database...');
        await connectDB();
        console.log('Database connected.\n');
        if (dryRun) {
            console.log('=== DRY RUN MODE — no changes will be written ===\n');
        }
        // Phase A: Seed tags
        console.log('Phase A: Seeding dimension tags (3-axis taxonomy)...');
        await seedDimensionTags(dryRun);
        console.log('Phase A complete.\n');
        // Phase B: Deprecate old tags (optional)
        if (doDeprecate) {
            console.log('Phase B: Deprecating old dimension tags not in new taxonomy...');
            await deprecateOldTags(dryRun);
            console.log('Phase B complete.\n');
        }
        console.log('Done!');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=seedDimensionTags.js.map