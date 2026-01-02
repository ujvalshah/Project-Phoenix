/**
 * Test script for unfurl endpoint
 * 
 * Tests:
 * - YouTube URLs
 * - Twitter/X URLs
 * - Article URLs
 * 
 * Usage: tsx server/scripts/test-unfurl.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(rootPath, '.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

interface TestCase {
  name: string;
  url: string;
  expectedContentType: 'article' | 'video' | 'social' | 'image' | 'document';
}

const testCases: TestCase[] = [
  {
    name: 'YouTube Video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expectedContentType: 'video',
  },
  {
    name: 'YouTube Short URL',
    url: 'https://youtu.be/dQw4w9WgXcQ',
    expectedContentType: 'video',
  },
  {
    name: 'Twitter/X Post',
    url: 'https://twitter.com/user/status/1234567890',
    expectedContentType: 'social',
  },
  {
    name: 'X.com Post',
    url: 'https://x.com/user/status/1234567890',
    expectedContentType: 'social',
  },
  {
    name: 'Article (Medium)',
    url: 'https://medium.com/@user/article-title',
    expectedContentType: 'article',
  },
  {
    name: 'Article (Substack)',
    url: 'https://substack.com/@user/article-title',
    expectedContentType: 'article',
  },
];

async function testUnfurl(testCase: TestCase): Promise<void> {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   URL: ${testCase.url}`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/unfurl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testCase.url }),
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
      return;
    }

    const nugget = await response.json();

    // Validate response structure
    console.log(`   ✅ Response received`);
    console.log(`   - ID: ${nugget.id}`);
    console.log(`   - Domain: ${nugget.domain}`);
    console.log(`   - Content Type: ${nugget.contentType} (expected: ${testCase.expectedContentType})`);
    console.log(`   - Title: ${nugget.title}`);
    console.log(`   - Quality: ${nugget.quality}`);
    
    if (nugget.description) {
      console.log(`   - Description: ${nugget.description.substring(0, 100)}...`);
    }

    if (nugget.media) {
      console.log(`   - Media: ${nugget.media.type}`);
      console.log(`     - Width: ${nugget.media.width}`);
      console.log(`     - Height: ${nugget.media.height}`);
      console.log(`     - Aspect Ratio: ${nugget.media.aspectRatio}`);
      console.log(`     - Estimated: ${nugget.media.isEstimated || false}`);
    }

    if (nugget.source) {
      console.log(`   - Source: ${nugget.source.name}`);
      if (nugget.source.platformColor) {
        console.log(`     - Platform Color: ${nugget.source.platformColor}`);
      }
    }

    // Validate content type
    if (nugget.contentType !== testCase.expectedContentType) {
      console.log(`   ⚠️  Warning: Content type mismatch`);
    }

    // Validate required fields
    const requiredFields = ['id', 'url', 'domain', 'contentType', 'title', 'source'];
    const missingFields = requiredFields.filter(field => !(field in nugget));
    
    if (missingFields.length > 0) {
      console.log(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log(`   ✅ All required fields present`);
    }

    // Validate aspectRatio if media exists
    if (nugget.media && (!nugget.media.aspectRatio || typeof nugget.media.aspectRatio !== 'number')) {
      console.log(`   ❌ Missing or invalid aspectRatio`);
    } else if (nugget.media) {
      console.log(`   ✅ Aspect ratio calculated: ${nugget.media.aspectRatio}`);
    }

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    console.error(error);
  }
}

async function runTests() {
  console.log('🚀 Starting Unfurl API Tests');
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Total tests: ${testCases.length}`);

  for (const testCase of testCases) {
    await testUnfurl(testCase);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✨ Tests completed');
}

// Run tests
runTests().catch(console.error);












