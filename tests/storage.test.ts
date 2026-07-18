import { describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { clearGameCache, getCachedGame, setCachedGame } from '../src/storage/cache';
import { DEFAULT_SETTINGS } from '../src/core/contracts';
import { getSettings, saveSettings } from '../src/storage/settings';

describe('storage', () => {
  it('returns defaults and persists valid settings', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    const settings = { ...DEFAULT_SETTINGS, timeFormat: 'hoursMinutes' as const, cacheDurationDays: 30 as const };
    await saveSettings(settings);
    await expect(getSettings()).resolves.toEqual(settings);
  });

  it('distinguishes fresh and stale cache entries', async () => {
    await setCachedGame({
      appId: '3375780', requestedTitle: 'Trails in the Sky 1st Chapter', matchedTitle: 'Trails in the Sky 1st Chapter',
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480, hltbUrl: 'https://howlongtobeat.com/game/155183',
      imageUrl: 'https://howlongtobeat.com/games/155183_Trails.jpg',
      source: 'network', fetchedAt: 1_000, stale: false,
    });
    await expect(getCachedGame('3375780', 'Trails in the Sky 1st Chapter', 7, 2_000)).resolves.toMatchObject({ fresh: true });
    await expect(getCachedGame('3375780', 'Trails in the Sky 1st Chapter', 1, 90_000_000)).resolves.toMatchObject({ fresh: false, data: { stale: true } });
  });

  it('clears game cache without deleting settings', async () => {
    await browser.storage.local.set({ 'settings:v2': DEFAULT_SETTINGS, 'game:v3:1:test': { schema: 3 } });
    await clearGameCache();
    expect(await browser.storage.local.get(null)).toEqual({ 'settings:v2': DEFAULT_SETTINGS });
  });
});
