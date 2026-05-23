/**
 * LocalStorage Utility Wrapper with Safe JSON parsing, versioning, expiry handling, and a sync queue.
 */

export interface StorageOptions {
  expiryMs?: number; // expiration duration in milliseconds
  version?: string; // versioning key
}

interface StoragePayload<T> {
  value: T;
  version?: string;
  expiresAt?: number;
}

export class SafeLocalStorage {
  private static DEFAULT_VERSION = 'v1';

  /**
   * Safe set item with optional expiry and versioning
   */
  static setItem<T>(key: string, value: T, options?: StorageOptions): void {
    if (typeof window === 'undefined') return;

    try {
      const payload: StoragePayload<T> = {
        value,
        version: options?.version || this.DEFAULT_VERSION,
      };

      if (options?.expiryMs) {
        payload.expiresAt = Date.now() + options.expiryMs;
      }

      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.error(`❌ Error setting item in localStorage for key "${key}":`, error);
    }
  }

  /**
   * Safe get item with expiration check and version validation
   */
  static getItem<T>(key: string, options?: StorageOptions): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      const payload: StoragePayload<T> = JSON.parse(raw);
      const expectedVersion = options?.version || this.DEFAULT_VERSION;

      // Check version match
      if (payload.version && payload.version !== expectedVersion) {
        console.warn(`⚠️ Storage version mismatch for key "${key}". Expected: "${expectedVersion}", Found: "${payload.version}". Clearing key.`);
        this.removeItem(key);
        return null;
      }

      // Check expiry
      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        console.log(`🕒 Storage key "${key}" has expired. Clearing key.`);
        this.removeItem(key);
        return null;
      }

      return payload.value;
    } catch (error) {
      console.error(`❌ Error parsing key "${key}" from localStorage:`, error);
      return null;
    }
  }

  /**
   * Safe remove item
   */
  static removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`❌ Error removing key "${key}" from localStorage:`, error);
    }
  }

  /**
   * Clear all localStorage
   */
  static clear(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.clear();
    } catch (error) {
      console.error('❌ Error clearing localStorage:', error);
    }
  }
}

/**
 * Sync Queue for managing offline drafts and pending updates to Supabase
 */
export interface SyncItem<T> {
  id: string;
  action: 'insert' | 'update' | 'delete';
  table: string;
  data: T;
  timestamp: number;
}

export class StorageSyncQueue {
  private static QUEUE_KEY = 'aeroglide-sync-queue';

  /**
   * Enqueue a pending data synchronization item
   */
  static enqueue<T>(item: Omit<SyncItem<T>, 'timestamp'>): void {
    const queue = this.getQueue<T>();
    const newItem: SyncItem<T> = {
      ...item,
      timestamp: Date.now()
    };
    queue.push(newItem);
    SafeLocalStorage.setItem(this.QUEUE_KEY, queue);
  }

  /**
   * Get all items in the sync queue
   */
  static getQueue<T>(): SyncItem<T>[] {
    return SafeLocalStorage.getItem<SyncItem<T>[]>(this.QUEUE_KEY) || [];
  }

  /**
   * Dequeue/remove items after successful synchronization
   */
  static dequeue(ids: string[]): void {
    const queue = this.getQueue();
    const updated = queue.filter(item => !ids.includes(item.id));
    SafeLocalStorage.setItem(this.QUEUE_KEY, updated);
  }

  /**
   * Clear the queue
   */
  static clearQueue(): void {
    SafeLocalStorage.removeItem(this.QUEUE_KEY);
  }
}
