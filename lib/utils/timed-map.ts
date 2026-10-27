/**
 * @name TimedMap
 * @description [Infrastructure]: A Map wrapper that automatically tracks the timestamp
 * of each entry and provides expiration logic. When `.get()` is called on an expired
 * entry, it returns `undefined` — making stale conversation sessions invisible to the
 * business logic without requiring changes to every call site.
 *
 * This solves the WhatsApp conversation timeout requirement: if a user abandons
 * a flow mid-way and returns 3+ minutes later, the stale session is automatically
 * discarded so the bot doesn't respond with incoherent follow-ups.
 */

const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export class TimedMap<V> {
  private store = new Map<string, { value: V; timestamp: number }>();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * @name set
   * @description Stores a value with an automatic timestamp. If the key already
   * exists, the entry and its timestamp are overwritten (refreshed).
   */
  set(key: string, value: V): void {
    this.store.set(key, { value, timestamp: Date.now() });
  }

  /**
   * @name get
   * @description Returns the stored value if it exists AND has not expired.
   * Expired entries return `undefined` (same as non-existent keys) so all
   * existing business logic that checks `if (entry)` works transparently.
   */
  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isEntryExpired(entry)) return undefined;
    return entry.value;
  }

  /**
   * @name delete
   * @description Removes an entry from the store (used on explicit cancel, confirm, etc.)
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * @name has
   * @description Returns true only if the key exists AND is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * @name consumeExpired
   * @description [Timeout Notification]: Checks if the key has an expired entry.
   * If so, deletes it from the store and returns the stale value (so the caller
   * can send a "session expired" notification). Returns `undefined` if the key
   * doesn't exist or is still active.
   *
   * This is a destructive read: after calling this, the expired entry is gone.
   */
  consumeExpired(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isEntryExpired(entry)) {
      this.store.delete(key);
      return entry.value;
    }
    return undefined;
  }

  /**
   * @name cleanup
   * @description Removes all expired entries. Useful for periodic memory hygiene
   * in long-running server processes.
   */
  cleanup(): void {
    for (const [key, entry] of this.store.entries()) {
      if (this.isEntryExpired(entry)) {
        this.store.delete(key);
      }
    }
  }

  private isEntryExpired(entry: { timestamp: number }): boolean {
    return Date.now() - entry.timestamp > this.timeoutMs;
  }
}
