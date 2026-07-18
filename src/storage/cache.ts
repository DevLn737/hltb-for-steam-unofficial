import { browser } from 'wxt/browser';
import type { GameTimes } from '../core/contracts';
import { normalizeTitle } from '../core/title-matcher';

const CACHE_PREFIX = 'game:v3:';

interface CacheEntry {
  schema: 3;
  data: Omit<GameTimes, 'source' | 'stale'>;
}

export interface CachedGame {
  data: GameTimes;
  fresh: boolean;
}

function cacheKey(appId: string, title: string): string {
  return `${CACHE_PREFIX}${appId}:${normalizeTitle(title)}`;
}

export async function getCachedGame(appId: string, title: string, ttlDays: number, now = Date.now()): Promise<CachedGame | null> {
  const key = cacheKey(appId, title);
  const value = (await browser.storage.local.get(key))[key] as CacheEntry | undefined;
  if (!value || value.schema !== 3 || !value.data || value.data.appId !== appId) return null;
  const fresh = now - value.data.fetchedAt <= ttlDays * 24 * 60 * 60 * 1000;
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
    imageUrl: data.imageUrl,
    fetchedAt: data.fetchedAt,
  };
  await browser.storage.local.set({ [key]: { schema: 3, data: storedData } satisfies CacheEntry });
}

export async function clearGameCache(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith(CACHE_PREFIX));
  if (keys.length > 0) await browser.storage.local.remove(keys);
}
