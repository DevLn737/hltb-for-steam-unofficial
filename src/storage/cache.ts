import { browser } from 'wxt/browser';
import type { GameTimes } from '../core/contracts';
import { normalizeTitle } from '../core/title-matcher';

const CACHE_PREFIX = 'game:v4:';
const LEGACY_CACHE_PREFIX = 'game:v3:';

interface CacheEntry {
  schema: 4;
  data: Omit<GameTimes, 'source' | 'stale'>;
}

interface LegacyCacheEntry {
  schema: 3;
  data: Omit<GameTimes, 'source' | 'stale' | 'updatedAt'> & { fetchedAt: number; imageUrl?: string | null };
}

export interface CachedGame {
  data: GameTimes;
  fresh: boolean;
}

function cacheKey(appId: string, title: string): string {
  return `${CACHE_PREFIX}${appId}:${normalizeTitle(title)}`;
}

function legacyCacheKey(appId: string, title: string): string {
  return `${LEGACY_CACHE_PREFIX}${appId}:${normalizeTitle(title)}`;
}

export async function getCachedGame(appId: string, title: string, ttlDays: number, now = Date.now()): Promise<CachedGame | null> {
  const key = cacheKey(appId, title);
  const legacyKey = legacyCacheKey(appId, title);
  const stored = await browser.storage.local.get([key, legacyKey]);
  let value = stored[key] as CacheEntry | undefined;
  if (!value) {
    const legacy = stored[legacyKey] as LegacyCacheEntry | undefined;
    if (legacy?.schema === 3 && legacy.data?.appId === appId) {
      const { fetchedAt, imageUrl: _imageUrl, ...rest } = legacy.data;
      void _imageUrl;
      value = { schema: 4, data: { ...rest, updatedAt: fetchedAt } };
      await browser.storage.local.set({ [key]: value });
      await browser.storage.local.remove(legacyKey);
    }
  }
  if (!value || value.schema !== 4 || !value.data || value.data.appId !== appId) return null;
  const fresh = now - value.data.updatedAt <= ttlDays * 24 * 60 * 60 * 1000;
  return { data: { ...value.data, source: 'cache', stale: !fresh }, fresh };
}

export async function setCachedGame(data: GameTimes): Promise<void> {
  const key = cacheKey(data.appId, data.requestedTitle);
  const storedData: CacheEntry['data'] = {
    appId: data.appId,
    requestedTitle: data.requestedTitle,
    matchedTitle: data.matchedTitle,
    mainStory: data.mainStory,
    mainPlusExtras: data.mainPlusExtras,
    completionist: data.completionist,
    hltbUrl: data.hltbUrl,
    updatedAt: data.updatedAt,
  };
  await browser.storage.local.set({ [key]: { schema: 4, data: storedData } satisfies CacheEntry });
}

export async function clearGameCache(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith('game:v'));
  if (keys.length > 0) await browser.storage.local.remove(keys);
}
