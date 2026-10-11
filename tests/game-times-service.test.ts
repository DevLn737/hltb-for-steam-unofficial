import { describe, expect, it } from 'vitest';
import { GameTimesService } from '../src/background/game-times-service';
import { HltbClient, type HltbGameTimes } from '../src/hltb/client';
import { HltbNetworkError } from '../src/hltb/errors';
import { setCachedGame } from '../src/storage/cache';
import { HltbSnapshot, type SnapshotGameTimes } from '../src/snapshot/snapshot';

class StubClient extends HltbClient {
  constructor(private readonly result: HltbGameTimes | null | Error) {
    super({ fetch: async () => new Response() });
  }

  override async lookup(): Promise<HltbGameTimes | null> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

class StubSnapshot extends HltbSnapshot {
  constructor(private readonly result: SnapshotGameTimes | null = null) {
    super({ fetch: async () => new Response() });
  }

  override async lookup(): Promise<SnapshotGameTimes | null> {
    return this.result;
  }
}

const found: HltbGameTimes = {
  gameId: 155183,
  matchedTitle: 'Trails in the Sky 1st Chapter',
  mainStory: 2400,
  mainPlusExtras: 3420,
  completionist: 3480,
  hltbUrl: 'https://howlongtobeat.com/game/155183',
};

describe('GameTimesService', () => {
  it('starts a fresh lookup after snapshot activation and preserves it when the old lookup finishes', async () => {
    const oldSnapshot: SnapshotGameTimes = {
      gameId: 94_122, matchedTitle: 'Crimson Desert', mainStory: 60, mainPlusExtras: 120, completionist: 180,
      changes: { mainStory: null, mainPlusExtras: null, completionist: null },
      baselineUpdatedAt: Date.UTC(2026, 6, 22), updatedAt: Date.UTC(2026, 6, 22),
    };
    let resolveOld!: (value: SnapshotGameTimes) => void;
    let resolveNew!: (value: SnapshotGameTimes) => void;
    const oldLookup = new Promise<SnapshotGameTimes>((resolve) => { resolveOld = resolve; });
    const newLookup = new Promise<SnapshotGameTimes>((resolve) => { resolveNew = resolve; });
    let lookupCount = 0;
    const service = new GameTimesService(new StubClient(null), 2, {
      lookup: () => ++lookupCount === 1 ? oldLookup : newLookup,
    });

    const oldRequest = service.getGameTimes('3321460', 'Crimson Desert', 'steam');
    service.invalidatePendingLookups();
    const newRequest = service.getGameTimes('3321460', 'Crimson Desert', 'steam');
    expect(newRequest).not.toBe(oldRequest);
    resolveOld(oldSnapshot);
    await oldRequest;
    expect(service.getGameTimes('3321460', 'Crimson Desert', 'steam')).toBe(newRequest);

    resolveNew({ ...oldSnapshot, mainStory: 4149, updatedAt: Date.UTC(2026, 8, 5) });
    await expect(newRequest).resolves.toMatchObject({ ok: true, data: { mainStory: 4149 } });
    expect(lookupCount).toBe(2);
  });

  it('stores a successful network result', async () => {
    const result = await new GameTimesService(new StubClient(found)).getGameTimes('3375780', 'Trails in the Sky 1st Chapter');
    expect(result).toMatchObject({ ok: true, data: { source: 'network', mainStory: 2400, stale: false } });
  });

  it('returns an expired cached result only after a network failure', async () => {
    await setCachedGame({
      appId: '3375780', gameId: 123, requestedTitle: 'Trails in the Sky 1st Chapter', matchedTitle: found.matchedTitle,
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480, hltbUrl: found.hltbUrl,
      availability: 'timed',
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null, source: 'network', updatedAt: 1, stale: false,
    });
    const result = await new GameTimesService(new StubClient(new HltbNetworkError('offline')), 2, new StubSnapshot()).getGameTimes('3375780', 'Trails in the Sky 1st Chapter');
    expect(result).toMatchObject({ ok: true, data: { source: 'cache', stale: true, completionist: 3480 } });
  });

  it('does not invent a result on a cold network failure', async () => {
    await expect(new GameTimesService(new StubClient(new HltbNetworkError('offline')), 2, new StubSnapshot()).getGameTimes('10', 'Unknown Game'))
      .resolves.toEqual({ ok: false, error: 'network', diagnostic: { stage: 'initialization' } });
  });

  it('exposes only the failed HLTB stage and HTTP status', async () => {
    const error = new HltbNetworkError('blocked', 403, undefined, 'search');
    await expect(new GameTimesService(new StubClient(error), 2, new StubSnapshot()).getGameTimes('10', 'Unknown Game'))
      .resolves.toEqual({ ok: false, error: 'network', diagnostic: { stage: 'search', status: 403 } });
  });

  it('limits concurrent HLTB requests', async () => {
    let active = 0;
    let maximum = 0;
    class SlowClient extends HltbClient {
      override async lookup(title: string): Promise<HltbGameTimes> {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return { ...found, matchedTitle: title };
      }
    }
    const service = new GameTimesService(new SlowClient(), 2, new StubSnapshot());
    await Promise.all([
      service.getGameTimes('1', 'Game One'),
      service.getGameTimes('2', 'Game Two'),
      service.getGameTimes('3', 'Game Three'),
    ]);
    expect(maximum).toBe(2);
  });

  it('uses the local snapshot in Steam without calling HLTB', async () => {
    let networkCalls = 0;
    class CountingClient extends StubClient {
      override async lookup(): Promise<HltbGameTimes | null> {
        networkCalls += 1;
        return found;
      }
    }
    const snapshot = new StubSnapshot({
      gameId: 124_771,
      matchedTitle: 'CRYMACHINA', mainStory: 930, mainPlusExtras: 1170, completionist: 1740,
      updatedAt: Date.UTC(2026, 6, 20),
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: Date.UTC(2026, 5, 22),
    });
    const result = await new GameTimesService(new CountingClient(found), 2, snapshot)
      .getGameTimes('2258500', 'CRYMACHINA', 'steam');
    expect(networkCalls).toBe(0);
    expect(result).toMatchObject({ ok: true, data: { source: 'snapshot', mainStory: 930, completionist: 1740 } });
  });

  it('uses only the snapshot in Steam even when a fresh network cache exists', async () => {
    await setCachedGame({
      appId: '2258500', gameId: 123, requestedTitle: 'CRYMACHINA', matchedTitle: 'Old cached title',
      mainStory: 1, mainPlusExtras: 1, completionist: 1, availability: 'timed',
      hltbUrl: 'https://howlongtobeat.com/game/1', changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: null, source: 'network', updatedAt: Date.now(), stale: false,
    });
    const snapshot = new StubSnapshot({
      gameId: 124_771, matchedTitle: 'CRYMACHINA', mainStory: 930, mainPlusExtras: 1170, completionist: 1740,
      updatedAt: Date.UTC(2026, 6, 22),
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: Date.UTC(2026, 5, 22),
    });
    const result = await new GameTimesService(new StubClient(found), 2, snapshot)
      .getGameTimes('2258500', 'CRYMACHINA', 'steam');
    expect(result).toMatchObject({ ok: true, data: { source: 'snapshot', mainStory: 930 } });
  });

  it('returns a typed known-without-times snapshot result', async () => {
    const snapshot = new StubSnapshot({
      gameId: 175_491, matchedTitle: 'AV Director Life!', mainStory: null, mainPlusExtras: null, completionist: null,
      updatedAt: Date.UTC(2026, 6, 22),
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: Date.UTC(2026, 5, 22),
    });
    const result = await new GameTimesService(new StubClient(null), 2, snapshot)
      .getGameTimes('3181220', 'AV Director Life!', 'steam');
    expect(result).toMatchObject({
      ok: true,
      data: { availability: 'known_without_times', hltbUrl: 'https://howlongtobeat.com/game/175491' },
    });
  });

  it('prefers a browser network result over the snapshot', async () => {
    const snapshot = new StubSnapshot({
      gameId: 124_771,
      matchedTitle: 'CRYMACHINA', mainStory: 870, mainPlusExtras: 1164, completionist: 1704,
      updatedAt: Date.UTC(2025, 9, 23),
      changes: { mainStory: null, mainPlusExtras: null, completionist: null }, baselineUpdatedAt: Date.UTC(2025, 8, 23),
    });
    const result = await new GameTimesService(new StubClient(found), 2, snapshot)
      .getGameTimes('2258500', 'CRYMACHINA', 'browser');
    expect(result).toMatchObject({ ok: true, data: { source: 'network', mainStory: 2400 } });
  });
});
