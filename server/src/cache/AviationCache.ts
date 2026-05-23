interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class AviationCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Retrieves data from the cache or dedupes a pending API call promise.
   * Uses Stale-While-Revalidate for background refresh and stale fallback on failure.
   * 
   * @param key Unique key representing the request (e.g. `flights:JFK-LHR:2026-05-21`)
   * @param ttlMs Time-to-Live in milliseconds
   * @param fetcher Async function executing the raw outbound API request
   */
  async getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);

    if (cached) {
      const isExpired = Date.now() >= cached.expiry;
      if (!isExpired) {
        console.log(`⚡ Cache HIT (Fresh): ${key}`);
        return cached.data as T;
      }

      // Expired, but we have stale data! Return stale instantly and trigger background refresh.
      if (!this.pendingRequests.has(key)) {
        console.log(`🔄 Cache EXPIRED. Triggering Background Refresh for: ${key}`);
        this.fetchAndCache(key, ttlMs, fetcher, 2).catch((err) => {
          console.warn(`⚠️ Background refresh failed for ${key}: ${err.message}`);
        });
      } else {
        console.log(`🔗 Background Refresh already pending for: ${key}`);
      }

      console.log(`⚡ Cache HIT (Stale fallback): ${key}`);
      return cached.data as T;
    }

    // No cache entry exists at all: fetch synchronously with retries
    return this.fetchAndCache(key, ttlMs, fetcher, 3);
  }

  /**
   * Internal fetch wrapper that caches data, deletes pending status, and handles stale fallbacks.
   */
  private async fetchAndCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, retries: number): Promise<T> {
    // If a request is already running, deduplicate by returning its promise
    const pending = this.pendingRequests.get(key);
    if (pending) {
      console.log(`🔗 Request Deduplicated: ${key}`);
      return pending as Promise<T>;
    }

    const fetchPromise = this.executeWithRetry(fetcher, retries)
      .then((data) => {
        this.cache.set(key, { data, expiry: Date.now() + ttlMs });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch((err) => {
        this.pendingRequests.delete(key);
        
        // Fallback: If fresh fetch fails but we have stale cache, return it instead of throwing
        const cached = this.cache.get(key);
        if (cached) {
          console.warn(`⚠️ Fetch failed. Returning stale fallback cache for ${key}. Error: ${err.message}`);
          return cached.data as T;
        }
        throw err;
      });

    this.pendingRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Runs the fetcher function, retrying on failure with exponential backoff.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retries: number, delay = 500): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (retries <= 0) throw err;
      
      const isRateLimit = err.message?.includes('429') || err.message?.includes('Too Many Requests');
      const nextDelay = isRateLimit ? delay * 3 : delay * 2;
      
      console.warn(`⚠️ API call failed. Retrying in ${nextDelay}ms... (${retries} retries left). Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, nextDelay));
      return this.executeWithRetry(fn, retries - 1, nextDelay);
    }
  }

  /**
   * Manually invalidate a cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Flush all caches
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

export const aviationCache = new AviationCache();
