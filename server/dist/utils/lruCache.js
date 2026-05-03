/**
 * Simple LRU (Least Recently Used) Cache Implementation
 *
 * Prevents memory leaks by evicting least recently used entries
 * when cache size exceeds MAX_SIZE.
 *
 * Features:
 * - O(1) get and set operations
 * - Automatic eviction of oldest entries
 * - TTL support for cache expiration
 */
export class LRUCache {
    cache;
    maxSize;
    ttl; // Time to live in milliseconds
    constructor(maxSize = 5000, ttl = 24 * 60 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }
    /**
     * Get value from cache
     * Returns null if not found or expired
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if entry has expired
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }
    /**
     * Set value in cache
     * Evicts oldest entry if cache is full
     */
    set(key, value) {
        // If key already exists, remove it first
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // If cache is full, remove oldest entry (first in Map)
        else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        // Add new entry at end (most recently used)
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });
    }
    /**
     * Delete entry from cache
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all entries
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get current cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Check if expired
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
}
//# sourceMappingURL=lruCache.js.map