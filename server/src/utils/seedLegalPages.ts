import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LegalPage } from '../models/LegalPage.js';
import { isMongoConnected } from './db.js';
import { getLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve path to public/legal/ from server/src/utils/ */
function getMarkdownPath(slug: string): string {
  return resolve(__dirname, '../../../public/legal', `${slug}.md`);
}

/** Read markdown file content, return empty string if missing */
function readMarkdown(slug: string): string {
  try {
    return readFileSync(getMarkdownPath(slug), 'utf-8');
  } catch {
    return '';
  }
}

const DEFAULT_LEGAL_PAGES = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    enabled: true,
    noindex: false,
    lastUpdated: '2026-03-28T00:00:00.000Z',
    effectiveDate: '2026-03-28T00:00:00.000Z',
    showInFooter: true,
    description: 'How we collect, use, and protect your personal information.',
    order: 1,
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    enabled: true,
    noindex: false,
    lastUpdated: '2026-03-28T00:00:00.000Z',
    effectiveDate: '2026-03-28T00:00:00.000Z',
    showInFooter: true,
    description: 'The terms and conditions governing your use of our platform.',
    order: 2,
  },
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    enabled: true,
    noindex: false,
    lastUpdated: '2026-03-28T00:00:00.000Z',
    effectiveDate: '2026-03-28T00:00:00.000Z',
    showInFooter: true,
    description: 'Important disclaimers about the content and services provided.',
    order: 3,
  },
  {
    slug: 'copyright',
    title: 'Copyright Notice',
    enabled: true,
    noindex: false,
    lastUpdated: '2026-03-28T00:00:00.000Z',
    effectiveDate: '2026-03-28T00:00:00.000Z',
    showInFooter: true,
    description: 'Copyright information and intellectual property rights.',
    order: 4,
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    enabled: true,
    noindex: false,
    lastUpdated: '2026-03-28T00:00:00.000Z',
    effectiveDate: '2026-03-28T00:00:00.000Z',
    showInFooter: true,
    description: 'How we use cookies and similar tracking technologies.',
    order: 5,
  },
  {
    slug: 'guidelines',
    title: 'Community & Content Guidelines',
    enabled: true,
    noindex: false,
    lastUpdated: '2026-03-28T00:00:00.000Z',
    effectiveDate: '2026-03-28T00:00:00.000Z',
    showInFooter: true,
    description: 'Rules and expectations for community participation and content.',
    order: 6,
  },
];

export async function seedLegalPages(): Promise<void> {
  const logger = getLogger();

  if (!isMongoConnected()) {
    logger.info({ msg: '[SeedLegal] Skipped — MongoDB not connected' });
    return;
  }

  try {
    const existingCount = await LegalPage.countDocuments();
    if (existingCount > 0) {
      logger.info({ msg: '[SeedLegal] Skipped — legal pages already exist', count: existingCount });
      return;
    }

    // Read markdown content from public/legal/ files
    const pagesWithContent = DEFAULT_LEGAL_PAGES.map((page) => ({
      ...page,
      content: readMarkdown(page.slug),
    }));

    await LegalPage.insertMany(pagesWithContent);
    logger.info({ msg: '[SeedLegal] Seeded legal pages', count: pagesWithContent.length });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({
      msg: '[SeedLegal] Error seeding legal pages',
      error: { message: err.message, stack: err.stack },
    });
  }
}
