/**
 * Quick Redis Connection Test
 * Run: node verify-redis.js
 */

import { createClient } from 'redis';

const client = createClient({ url: 'redis://localhost:6379' });

client.on('error', (err) => {
  console.error('❌ Redis Connection Failed:', err.message);
  console.log('\n💡 Make sure Redis is installed and running:');
  console.log('   - Memurai: Check Windows Services');
  console.log('   - Docker: docker ps (should show redis container)');
  process.exit(1);
});

try {
  await client.connect();
  console.log('✅ Redis Connected Successfully!');
  console.log('✅ Your app should work now.');
  
  // Test a simple operation
  await client.set('test', 'hello');
  const value = await client.get('test');
  console.log(`✅ Test operation successful: ${value}`);
  
  await client.quit();
  console.log('\n🎉 Redis is ready! You can now start your server with: npm run dev:all');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
