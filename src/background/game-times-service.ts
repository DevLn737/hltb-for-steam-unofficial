import type { GameTimes, LookupResult } from '../core/contracts';
import { getLookupTitle } from '../core/aliases';
import { HltbClient } from '../hltb/client';
import { HltbNetworkError, HltbRateLimitError } from '../hltb/errors';
import { getCachedGame, setCachedGame } from '../storage/cache';
import { getSettings } from '../storage/settings';

export class GameTimesService {
  private readonly pending = new Map<string, Promise<LookupResult>>();
  private activeRequests = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly client = new HltbClient(), private readonly maxConcurrent = 2) {}

  getGameTimes(appId: string, title: string): Promise<LookupResult> {
    const key = `${appId}:${title}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.lookup(appId, title).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async lookup(appId: string, requestedTitle: string): Promise<LookupResult> {
    if (!/^\d+$/.test(appId) || !requestedTitle.trim()) return { ok: false, error: 'invalid_request' };
    const settings = await getSettings();
    const cached = await getCachedGame(appId, requestedTitle, settings.cacheDurationDays);
    if (cached?.fresh) return { ok: true, data: cached.data };

    await this.acquire();
    try {
      const lookupTitle = getLookupTitle(appId, requestedTitle.trim());
      const found = await this.client.lookup(lookupTitle);
      if (!found) return { ok: false, error: 'not_found' };
      const data: GameTimes = {
        appId,
        requestedTitle,
        matchedTitle: found.matchedTitle,
        mainStory: found.mainStory,
        mainPlusExtras: found.mainPlusExtras,
        completionist: found.completionist,
        hltbUrl: found.hltbUrl,
        imageUrl: found.imageUrl,
        source: 'network',
        fetchedAt: Date.now(),
        stale: false,
      };
      await setCachedGame(data);
      return { ok: true, data };
    } catch (error) {
      if (cached) return { ok: true, data: { ...cached.data, stale: true } };
      if (error instanceof HltbRateLimitError) return { ok: false, error: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
      if (error instanceof HltbNetworkError) return { ok: false, error: 'network' };
      return { ok: false, error: 'service_error' };
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.activeRequests += 1;
  }

  private release(): void {
    this.activeRequests -= 1;
    this.waiters.shift()?.();
  }
}
