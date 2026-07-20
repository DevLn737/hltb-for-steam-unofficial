import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/contracts';
import { isClearCacheResponse, isLookupResult, isSettingsResponse } from '../src/core/runtime-validation';

describe('runtime response validation', () => {
  it('rejects undefined and malformed responses', () => {
    expect(isLookupResult(undefined)).toBe(false);
    expect(isSettingsResponse(undefined)).toBe(false);
    expect(isLookupResult({ ok: true })).toBe(false);
    expect(isSettingsResponse({ ok: true })).toBe(false);
  });

  it('accepts valid settings and clear-cache responses', () => {
    expect(isSettingsResponse({ ok: true, settings: DEFAULT_SETTINGS })).toBe(true);
    expect(isClearCacheResponse({ ok: true, cleared: true })).toBe(true);
  });

  it('accepts valid lookup success and failure responses', () => {
    expect(isLookupResult({ ok: false, error: 'network' })).toBe(true);
    expect(isLookupResult({ ok: false, error: 'network', diagnostic: { stage: 'initialization', status: 403 } })).toBe(true);
    expect(isLookupResult({ ok: false, error: 'network', diagnostic: { stage: 'token', status: '403' } })).toBe(false);
    expect(isLookupResult({
      ok: true,
      data: {
        appId: '2258500', requestedTitle: 'CRYMACHINA', matchedTitle: 'CRYMACHINA',
        mainStory: 780, mainPlusExtras: 1020, completionist: 1500,
        hltbUrl: 'https://howlongtobeat.com/game/123', source: 'snapshot', updatedAt: 1, stale: false,
      },
    })).toBe(true);
  });
});
