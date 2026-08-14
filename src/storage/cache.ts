import { browser } from 'wxt/browser';
import type { GameTimes } from '../core/contracts';
import { normalizeTitle } from '../core/title-matcher';

const CACHE_PREFIX = 'game:v6:';
const V5_CACHE_PREFIX = 'game:v5:';
const V4_CACHE_PREFIX = 'game:v4:';
const LEGACY_CACHE_PREFIX = 'game:v3:';

interface CacheEntry {
  schema: 6;
  data: Omit<GameTimes, 'source' | 'stale' | 'changes' | 'baselineUpdatedAt'>;
}

interface V5CacheEntry {
  schema: 5;
  data: Omit<GameTimes, 'source' | 'stale' | 'gameId' | 'changes' | 'baselineUpdatedAt'>;
}

interface V4CacheEntry {
  schema: 4;
  data: Omit<GameTimes, 'source' | 'stale' | 'availability' | 'gameId' | 'changes' | 'baselineUpdatedAt'>;
}

interface LegacyCacheEntry {
  schema: 3;
  data: Omit<GameTimes, 'source' | 'stale' | 'updatedAt' | 'availability' | 'gameId' | 'changes' | 'baselineUpdatedAt'> & {
    fetchedAt: number;
    imageUrl?: string | null;
  };
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

function v4CacheKey(appId: string, title: string): string {
  return `${V4_CACHE_PREFIX}${appId}:${normalizeTitle(title)}`;
}

function v5CacheKey(appId: string, title: string): string {
  return `${V5_CACHE_PREFIX}${appId}:${normalizeTitle(title)}`;
}

function gameIdFromUrl(value: string): number | null {
  const match = /^https:\/\/howlongtobeat\.com\/game\/(\d+)\/?$/.exec(value);
  const gameId = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(gameId) && gameId > 0 ? gameId : null;
}

function availability(data: Pick<GameTimes, 'mainStory' | 'mainPlusExtras' | 'completionist'>): GameTimes['availability'] {
  return [data.mainStory, data.mainPlusExtras, data.completionist].every((value) => value === null)
    ? 'known_without_times'
    : 'timed';
}

export async function getCachedGame(appId: string, title: string, ttlDays: number, now = Date.now()): Promise<CachedGame | null> {
  const key = cacheKey(appId, title);
  const v5Key = v5CacheKey(appId, title);
  const previousKey = v4CacheKey(appId, title);
  const legacyKey = legacyCacheKey(appId, title);
  const stored = await browser.storage.local.get([key, v5Key, previousKey, legacyKey]);
  let value = stored[key] as CacheEntry | undefined;
  if (!value) {
    const previous = stored[v5Key] as V5CacheEntry | undefined;
    const gameId = previous?.data ? gameIdFromUrl(previous.data.hltbUrl) : null;
    if (previous?.schema === 5 && previous.data?.appId === appId && gameId) {
      value = { schema: 6, data: { ...previous.data, gameId } };
      await browser.storage.local.set({ [key]: value });
      await browser.storage.local.remove(v5Key);
    }
  }
  if (!value) {
    const previous = stored[previousKey] as V4CacheEntry | undefined;
    if (previous?.schema === 4 && previous.data?.appId === appId) {
      const gameId = gameIdFromUrl(previous.data.hltbUrl);
      if (!gameId) return null;
      value = { schema: 6, data: { ...previous.data, gameId, availability: availability(previous.data) } };
      await browser.storage.local.set({ [key]: value });
      await browser.storage.local.remove(previousKey);
    }
  }
  if (!value) {
    const legacy = stored[legacyKey] as LegacyCacheEntry | undefined;
    if (legacy?.schema === 3 && legacy.data?.appId === appId) {
      const { fetchedAt, imageUrl: _imageUrl, ...rest } = legacy.data;
      void _imageUrl;
      const migrated = { ...rest, updatedAt: fetchedAt };
      const gameId = gameIdFromUrl(migrated.hltbUrl);
      if (!gameId) return null;
      value = { schema: 6, data: { ...migrated, gameId, availability: availability(migrated) } };
      await browser.storage.local.set({ [key]: value });
      await browser.storage.local.remove(legacyKey);
    }
  }
  if (!value || value.schema !== 6 || !value.data || value.data.appId !== appId) return null;
  const fresh = now - value.data.updatedAt <= ttlDays * 24 * 60 * 60 * 1000;
  return { data: {
    ...value.data,
    changes: { mainStory: null, mainPlusExtras: null, completionist: null },
    baselineUpdatedAt: null,
    source: 'cache', stale: !fresh,
  }, fresh };
}

export async function setCachedGame(data: GameTimes): Promise<void> {
  const key = cacheKey(data.appId, data.requestedTitle);
  const storedData: CacheEntry['data'] = {
    appId: data.appId,
    gameId: data.gameId,
    requestedTitle: data.requestedTitle,
    matchedTitle: data.matchedTitle,
    mainStory: data.mainStory,
    mainPlusExtras: data.mainPlusExtras,
    completionist: data.completionist,
    availability: data.availability,
    hltbUrl: data.hltbUrl,
    updatedAt: data.updatedAt,
  };
  await browser.storage.local.set({ [key]: { schema: 6, data: storedData } satisfies CacheEntry });
}

export async function clearGameCache(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith('game:v'));
  if (keys.length > 0) await browser.storage.local.remove(keys);
}
