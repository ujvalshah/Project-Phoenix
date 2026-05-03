/**
 * Dimension-tag coverage check.
 *
 * Reports how many Articles have at least one Tag in each dimension
 * (format / domain / subtopic), and lists a sample of articles with
 * NO dimension tagIds at all.
 *
 * Usage:
 *   npx tsx server/src/scripts/checkDimensionCoverage.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';
import { initLogger } from '../utils/logger.js';
import { validateEnv } from '../config/envValidation.js';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
async function main() {
    validateEnv();
    initLogger();
    await connectDB();
    // 1. Load all dimension tag IDs, partitioned by dimension
    const dimensionTags = await Tag.find({
        dimension: { $exists: true, $ne: null },
    })
        .select('_id rawName dimension')
        .lean();
    const formatIds = dimensionTags.filter(t => t.dimension === 'format').map(t => t._id);
    const domainIds = dimensionTags.filter(t => t.dimension === 'domain').map(t => t._id);
    const subtopicIds = dimensionTags.filter(t => t.dimension === 'subtopic').map(t => t._id);
    const allDimensionIds = [...formatIds, ...domainIds, ...subtopicIds];
    // 2. Counts
    const total = await Article.countDocuments({});
    const withAnyDimension = await Article.countDocuments({ tagIds: { $in: allDimensionIds } });
    const withFormat = await Article.countDocuments({ tagIds: { $in: formatIds } });
    const withDomain = await Article.countDocuments({ tagIds: { $in: domainIds } });
    const withSubtopic = await Article.countDocuments({ tagIds: { $in: subtopicIds } });
    const withoutAnyDimension = total - withAnyDimension;
    const withoutFormat = total - withFormat;
    const withoutDomain = total - withDomain;
    const pct = (n) => (total === 0 ? '0%' : `${((n / total) * 100).toFixed(1)}%`);
    // 3. Sample uncovered articles
    const uncoveredSample = await Article.find({
        $or: [
            { tagIds: { $exists: false } },
            { tagIds: { $size: 0 } },
            { tagIds: { $not: { $elemMatch: { $in: allDimensionIds } } } },
        ],
    })
        .select('_id title publishedAt tags tagIds')
        .sort({ publishedAt: -1 })
        .limit(15)
        .lean();
    // 4. Report
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  DIMENSION TAG COVERAGE REPORT');
    console.log('══════════════════════════════════════════════════════════════\n');
    console.log(`Dimension tags in DB:`);
    console.log(`  format    : ${formatIds.length}`);
    console.log(`  domain    : ${domainIds.length}`);
    console.log(`  subtopic  : ${subtopicIds.length}`);
    console.log(`  total     : ${allDimensionIds.length}\n`);
    console.log(`Total articles: ${total}\n`);
    console.log(`Articles WITH at least one dimension tag : ${withAnyDimension}  (${pct(withAnyDimension)})`);
    console.log(`Articles WITHOUT any dimension tag       : ${withoutAnyDimension}  (${pct(withoutAnyDimension)})\n`);
    console.log(`Per-dimension coverage:`);
    console.log(`  with format  : ${withFormat}  (${pct(withFormat)})    missing: ${withoutFormat}`);
    console.log(`  with domain  : ${withDomain}  (${pct(withDomain)})    missing: ${withoutDomain}`);
    console.log(`  with subtopic: ${withSubtopic}  (${pct(withSubtopic)})    [optional]\n`);
    // List articles missing a domain tag
    const domainMissing = await Article.find({
        $or: [
            { tagIds: { $exists: false } },
            { tagIds: { $size: 0 } },
            { tagIds: { $not: { $elemMatch: { $in: domainIds } } } },
        ],
    })
        .select('_id title publishedAt tags tagIds')
        .sort({ publishedAt: -1 })
        .limit(50)
        .lean();
    if (domainMissing.length > 0) {
        console.log(`Articles missing a DOMAIN tag (${domainMissing.length}):`);
        for (const a of domainMissing) {
            const id = a._id.toString();
            const date = a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : '----------';
            const title = (a.title || '(no title)').slice(0, 70);
            const legacyTags = (a.tags || []).slice(0, 4).join(', ');
            console.log(`  ${date}  ${id}  ${title}`);
            if (legacyTags)
                console.log(`              legacy tags: ${legacyTags}`);
        }
        console.log('');
    }
    if (withoutAnyDimension === 0) {
        console.log('✅ COVERAGE IS 100% — every article has at least one dimension tag.\n');
    }
    else {
        console.log(`⚠️  ${withoutAnyDimension} article(s) still uncovered. Sample (most recent):\n`);
        for (const a of uncoveredSample) {
            const id = a._id.toString();
            const date = a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : '----------';
            const title = (a.title || '(no title)').slice(0, 70);
            const legacyTags = (a.tags || []).slice(0, 3).join(', ');
            console.log(`  ${date}  ${id}  ${title}`);
            if (legacyTags)
                console.log(`              legacy tags: ${legacyTags}`);
        }
        if (uncoveredSample.length === 15) {
            console.log(`\n  ... showing 15 of ${withoutAnyDimension}. Run a fuller query to see all.`);
        }
    }
    console.log('\n══════════════════════════════════════════════════════════════\n');
    await mongoose.disconnect();
}
main().catch(err => {
    console.error('Coverage check failed:', err);
    process.exit(1);
});
//# sourceMappingURL=checkDimensionCoverage.js.map