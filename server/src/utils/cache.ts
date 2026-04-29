type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const DEFAULT_MAX_ENTRIES = 500;
const store = new Map<string, CacheEntry<unknown>>();

function pruneExpired(now = Date.now()) {
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

function enforceMaxSize() {
  while (store.size > DEFAULT_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
}

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache<T>(key: string, value: T, ttlMs: number): T {
  pruneExpired();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  enforceMaxSize();
  return value;
}

export function deleteCache(key: string) {
  store.delete(key);
}

export function deleteCacheByPrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function stableCacheKey(prefix: string, parts: Record<string, unknown>) {
  const normalized = Object.keys(parts)
    .sort()
    .map((key) => `${key}:${String(parts[key] ?? '')}`)
    .join('|');
  return `${prefix}:${normalized}`;
}

export const TTL = {
  tracking: 60_000,
  analytics: 60_000,
  dashboard: 45_000,
  staticData: 10 * 60_000,
};
