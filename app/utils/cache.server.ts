/**
 * Simple in-memory cache with TTL support
 */

interface CacheEntry<T> {
	value: T;
	expiry: number;
}

class Cache {
	private cache: Map<string, CacheEntry<unknown>> = new Map();

	/**
	 * Get a value from the cache
	 * @param key The cache key
	 * @returns The cached value or undefined if not found or expired
	 */
	get<T>(key: string): T | undefined {
		const entry = this.cache.get(key);

		if (!entry) {
			return undefined;
		}

		// Check if entry has expired
		if (entry.expiry < Date.now()) {
			this.cache.delete(key);
			return undefined;
		}

		return entry.value as T;
	}

	/**
	 * Set a value in the cache with a TTL
	 * @param key The cache key
	 * @param value The value to cache
	 * @param ttlMs Time to live in milliseconds
	 */
	set<T>(key: string, value: T, ttlMs: number): void {
		this.cache.set(key, {
			value,
			expiry: Date.now() + ttlMs,
		});
	}

	/**
	 * Delete a specific key from the cache
	 * @param key The cache key to delete
	 * @returns true if the key was deleted, false if it was not found
	 */
	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear the entire cache
	 */
	clear(): void {
		this.cache.clear();
	}
}

// Create a singleton cache instance
const globalCache = new Cache();
export default globalCache;
