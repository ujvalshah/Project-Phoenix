/**
 * Comprehensive Token Storage Verification
 * Run: node verify-token-storage.js
 * 
 * This script verifies:
 * 1. Redis connection
 * 2. TTL is set correctly on refresh tokens
 * 3. Token data structure is correct
 * 4. Persistence configuration
 */

import { createClient } from 'redis';
import crypto from 'crypto';

const client = createClient({ url: 'redis://localhost:6379' });

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function verifyTokenStorage() {
  try {
    await client.connect();
    console.log('✅ Redis Connected\n');

    // 1. Check all refresh tokens
    const refreshKeys = await client.keys('rt:*');
    console.log(`📊 Found ${refreshKeys.length} refresh token(s) in Redis\n`);

    if (refreshKeys.length === 0) {
      console.log('⚠️  WARNING: No refresh tokens found!');
      console.log('   This means either:');
      console.log('   - No users have logged in since Redis was installed');
      console.log('   - Refresh tokens are not being stored');
      console.log('   - Tokens were deleted/expired\n');
    }

    // 2. Verify TTL on each token
    const issues = [];
    for (const key of refreshKeys) {
      const ttl = await client.ttl(key);
      const pttl = await client.pttl(key);
      const dataStr = await client.get(key);
      
      console.log(`🔑 Key: ${key}`);
      console.log(`   TTL: ${ttl} seconds`);
      console.log(`   PTTL: ${pttl} milliseconds`);
      
      if (ttl === -1) {
        issues.push(`❌ ${key}: NO TTL SET (will never expire)`);
        console.log('   ⚠️  CRITICAL: No TTL set!');
      } else if (ttl === -2) {
        issues.push(`❌ ${key}: KEY DOES NOT EXIST`);
        console.log('   ⚠️  CRITICAL: Key doesn\'t exist!');
      } else if (ttl < 0) {
        issues.push(`❌ ${key}: INVALID TTL (${ttl})`);
        console.log(`   ⚠️  CRITICAL: Invalid TTL: ${ttl}`);
      } else {
        const daysRemaining = Math.floor(ttl / 86400);
        const hoursRemaining = Math.floor((ttl % 86400) / 3600);
        console.log(`   ✅ Valid TTL: ${daysRemaining}d ${hoursRemaining}h remaining`);
      }

      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          console.log(`   User ID: ${data.userId}`);
          console.log(`   Created: ${data.createdAt}`);
          console.log(`   Expires: ${data.expiresAt}`);
          
          // Verify expiration date matches TTL
          const expiresAt = new Date(data.expiresAt);
          const now = new Date();
          const expectedTtl = Math.floor((expiresAt - now) / 1000);
          
          if (Math.abs(expectedTtl - ttl) > 60) {
            issues.push(`⚠️  ${key}: TTL mismatch (expected ~${expectedTtl}s, got ${ttl}s)`);
            console.log(`   ⚠️  TTL mismatch: Expected ~${expectedTtl}s, got ${ttl}s`);
          }
        } catch (e) {
          issues.push(`❌ ${key}: Invalid JSON data`);
          console.log('   ⚠️  Invalid JSON data');
        }
      } else {
        issues.push(`❌ ${key}: No data stored`);
        console.log('   ⚠️  No data stored');
      }
      console.log('');
    }

    // 3. Check session sets
    const sessionKeys = await client.keys('sess:*');
    console.log(`📊 Found ${sessionKeys.length} session set(s)\n`);
    
    for (const key of sessionKeys) {
      const members = await client.sMembers(key);
      const ttl = await client.ttl(key);
      console.log(`🔑 Session: ${key}`);
      console.log(`   Members: ${members.length}`);
      console.log(`   TTL: ${ttl} seconds`);
      if (ttl === -1) {
        issues.push(`⚠️  ${key}: Session set has no TTL`);
      }
      console.log('');
    }

    // 4. Check persistence
    console.log('💾 Persistence Configuration:');
    try {
      const saveConfig = await client.configGet('save');
      const appendonly = await client.configGet('appendonly');
      const maxmemory = await client.configGet('maxmemory');
      const maxmemoryPolicy = await client.configGet('maxmemory-policy');
      
      console.log(`   RDB Save: ${saveConfig.save || 'Not configured'}`);
      console.log(`   AOF: ${appendonly.appendonly || 'Not configured'}`);
      console.log(`   Max Memory: ${maxmemory.maxmemory === '0' ? 'Unlimited' : maxmemory.maxmemory + ' bytes'}`);
      console.log(`   Eviction Policy: ${maxmemoryPolicy['maxmemory-policy'] || 'Not configured'}`);
      
      if (saveConfig.save === '' && appendonly.appendonly === 'no') {
        issues.push('⚠️  CRITICAL: No persistence enabled - tokens will be lost on restart');
        console.log('   ⚠️  CRITICAL: No persistence enabled!');
      }
      
      if (maxmemoryPolicy['maxmemory-policy'] && 
          ['allkeys-lru', 'volatile-lru', 'allkeys-random', 'volatile-random'].includes(maxmemoryPolicy['maxmemory-policy'])) {
        issues.push(`⚠️  Eviction policy ${maxmemoryPolicy['maxmemory-policy']} may delete active tokens`);
        console.log(`   ⚠️  Eviction policy may delete tokens: ${maxmemoryPolicy['maxmemory-policy']}`);
      }
    } catch (e) {
      console.log('   ⚠️  Could not read config (may require admin privileges)');
    }
    console.log('');

    // 5. Summary
    console.log('📋 SUMMARY:');
    if (issues.length === 0) {
      console.log('✅ No issues found!');
    } else {
      console.log(`⚠️  Found ${issues.length} issue(s):\n`);
      issues.forEach(issue => console.log(`   ${issue}`));
    }

    await client.quit();
    console.log('\n✅ Verification complete');
    
    if (issues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyTokenStorage();
