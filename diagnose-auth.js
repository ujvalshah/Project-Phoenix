/**
 * Diagnose Auth Token Issues
 * Run: node diagnose-auth.js
 */

import { createClient } from 'redis';

const client = createClient({ url: 'redis://localhost:6379' });

try {
  await client.connect();
  console.log('✅ Redis Connected\n');

  // Check for refresh tokens
  const keys = await client.keys('rt:*');
  console.log(`📊 Found ${keys.length} refresh token entries in Redis`);
  
  if (keys.length > 0) {
    console.log('\nSample refresh tokens:');
    for (const key of keys.slice(0, 5)) {
      const data = await client.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        console.log(`  ${key}:`);
        console.log(`    User: ${parsed.userId}`);
        console.log(`    Created: ${parsed.createdAt}`);
        console.log(`    Expires: ${parsed.expiresAt}`);
      }
    }
  }

  // Check for session sets
  const sessionKeys = await client.keys('sess:*');
  console.log(`\n📊 Found ${sessionKeys.length} session sets`);
  
  // Check for lockout entries
  const lockoutKeys = await client.keys('lock:*');
  console.log(`📊 Found ${lockoutKeys.length} lockout entries`);

  await client.quit();
  console.log('\n✅ Diagnosis complete');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
