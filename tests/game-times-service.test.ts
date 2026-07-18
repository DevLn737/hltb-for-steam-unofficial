import { describe, expect, it } from 'vitest';
import { GameTimesService } from '../src/background/game-times-service';
import { HltbClient, type HltbGameTimes } from '../src/hltb/client';
import { HltbNetworkError } from '../src/hltb/errors';
import { setCachedGame } from '../src/storage/cache';

class StubClient extends HltbClient {
  constructor(private readonly result: HltbGameTimes | null | Error) {
    super({ fetch: async () => new Response() });
  }

  override async lookup(): Promise<HltbGameTimes | null> {
    if (this.result instanceof Error) throw this.result;
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
  it('stores a successful network result', async () => {
    const result = await new GameTimesService(new StubClient(found)).getGameTimes('3375780', 'Trails in the Sky 1st Chapter');
    expect(result).toMatchObject({ ok: true, data: { source: 'network', mainStory: 2400, stale: false } });
  });

  it('returns an expired cached result only after a network failure', async () => {
    await setCachedGame({
      appId: '3375780', requestedTitle: 'Trails in the Sky 1st Chapter', matchedTitle: found.matchedTitle,
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480, hltbUrl: found.hltbUrl,
      source: 'network', fetchedAt: 1, stale: false,
    });
    const result = await new GameTimesService(new StubClient(new HltbNetworkError('offline'))).getGameTimes('3375780', 'Trails in the Sky 1st Chapter');
    expect(result).toMatchObject({ ok: true, data: { source: 'cache', stale: true, completionist: 3480 } });
  });

  it('does not invent a result on a cold network failure', async () => {
    await expect(new GameTimesService(new StubClient(new HltbNetworkError('offline'))).getGameTimes('10', 'Unknown Game'))
      .resolves.toEqual({ ok: false, error: 'network' });
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
    const service = new GameTimesService(new SlowClient(), 2);
    await Promise.all([
      service.getGameTimes('1', 'Game One'),
      service.getGameTimes('2', 'Game Two'),
      service.getGameTimes('3', 'Game Three'),
    ]);
    expect(maximum).toBe(2);
  });
});

