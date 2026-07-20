import type { ClientContext, GameTimes, LookupResult } from '../core/contracts';
import { getLookupTitle } from '../core/aliases';
import { HltbClient } from '../hltb/client';
import { HltbNetworkError, HltbRateLimitError } from '../hltb/errors';
import { getCachedGame, setCachedGame } from '../storage/cache';
import { getSettings } from '../storage/settings';
import { HltbSnapshot, type SnapshotGameTimes } from '../snapshot/snapshot';

export class GameTimesService {
  private readonly pending = new Map<string, Promise<LookupResult>>();
  private activeRequests = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly client = new HltbClient(),
    private readonly maxConcurrent = 2,
    private readonly snapshot = new HltbSnapshot(),
  ) {}

  getGameTimes(appId: string, title: string, clientContext: ClientContext = 'browser'): Promise<LookupResult> {
    const key = `${clientContext}:${appId}:${title}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const request = this.lookup(appId, title, clientContext).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async lookup(appId: string, requestedTitle: string, clientContext: ClientContext): Promise<LookupResult> {
    if (!/^\d+$/.test(appId) || !requestedTitle.trim()) return { ok: false, error: 'invalid_request' };
    const settings = await getSettings();
    const cached = await getCachedGame(appId, requestedTitle, settings.cacheDurationDays);
    if (cached?.fresh) return { ok: true, data: cached.data };

    const lookupTitle = getLookupTitle(appId, requestedTitle.trim());
    if (clientContext === 'steam') {
      const fallback = await this.getFallback(appId, requestedTitle, lookupTitle, cached?.data);
      return fallback ? { ok: true, data: fallback } : { ok: false, error: 'not_found' };
    }

    await this.acquire();
    try {
      const found = await this.client.lookup(lookupTitle);
      if (!found) {
        const fallback = await this.getFallback(appId, requestedTitle, lookupTitle, cached?.data);
        return fallback ? { ok: true, data: fallback } : { ok: false, error: 'not_found' };
      }
      const data: GameTimes = {
        appId,
        requestedTitle,
        matchedTitle: found.matchedTitle,
        mainStory: found.mainStory,
        mainPlusExtras: found.mainPlusExtras,
        completionist: found.completionist,
        hltbUrl: found.hltbUrl,
        source: 'network',
        updatedAt: Date.now(),
        stale: false,
      };
      await setCachedGame(data);
      return { ok: true, data };
    } catch (error) {
      const fallback = await this.getFallback(appId, requestedTitle, lookupTitle, cached?.data);
      if (fallback) return { ok: true, data: fallback };
      if (error instanceof HltbRateLimitError) return { ok: false, error: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
      if (error instanceof HltbNetworkError) {
        return {
          ok: false,
          error: 'network',
          diagnostic: { stage: error.stage, ...(error.status === undefined ? {} : { status: error.status }) },
        };
      }
      return { ok: false, error: 'service_error' };
    } finally {
      this.release();
    }
  }

  private async getFallback(
    appId: string,
    requestedTitle: string,
    lookupTitle: string,
    cached?: GameTimes,
  ): Promise<GameTimes | null> {
    let snapshot: SnapshotGameTimes | null = null;
    try {
      snapshot = await this.snapshot.lookup(lookupTitle);
    } catch {
      // A packaged-data failure must not hide a usable browser cache or network diagnostic.
    }
    const snapshotData: GameTimes | null = snapshot ? {
      appId,
      requestedTitle,
      matchedTitle: snapshot.matchedTitle,
      mainStory: snapshot.mainStory,
      mainPlusExtras: snapshot.mainPlusExtras,
      completionist: snapshot.completionist,
      hltbUrl: `https://howlongtobeat.com/?q=${encodeURIComponent(snapshot.matchedTitle)}`,
      source: 'snapshot',
      updatedAt: snapshot.updatedAt,
      stale: false,
    } : null;
    if (!cached) return snapshotData;
    if (!snapshotData || cached.updatedAt >= snapshotData.updatedAt) return { ...cached, source: 'cache', stale: true };
    return snapshotData;
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
