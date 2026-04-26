type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class ShortTtlCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const now = Date.now()
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt <= now) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: T): void {
    this.cleanup()
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) this.store.delete(key)
    }
  }
}
