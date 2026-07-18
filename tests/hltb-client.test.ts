import { describe, expect, it, vi } from 'vitest';
import { HltbClient } from '../src/hltb/client';
import { HltbNetworkError, HltbRateLimitError } from '../src/hltb/errors';

const initResponse = () => new Response(JSON.stringify({ token: 'token', hpKey: 'captcha', hpVal: 'pass' }), { status: 200 });
const gameResponse = () => new Response(JSON.stringify({
  data: [{
    game_id: 155183,
    game_name: 'Trails in the Sky 1st Chapter',
    game_alias: '',
    game_image: '/games/155183_Trails.jpg',
    comp_main: 144000,
    comp_plus: 205200,
    comp_100: 208800,
  }],
}), { status: 200 });

describe('HltbClient', () => {
  it('uses init → bleed authentication and converts seconds to minutes', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(gameResponse());
    const result = await new HltbClient({ fetch: fetchMock, now: () => 1000 }).lookup('Trails in the Sky 1st Chapter');
    expect(result).toMatchObject({
      mainStory: 2400,
      mainPlusExtras: 3420,
      completionist: 3480,
      imageUrl: 'https://howlongtobeat.com/games/155183_Trails.jpg',
    });
    expect(result?.completionist).not.toBe(276);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/bleed/init?t=1000');
    const search = fetchMock.mock.calls[1];
    expect(search?.[0]).toBe('https://howlongtobeat.com/api/bleed');
    expect(search?.[1]?.headers).toMatchObject({ 'x-auth-token': 'token', 'x-hp-key': 'captcha', 'x-hp-val': 'pass' });
    expect(JSON.parse(String(search?.[1]?.body))).toMatchObject({ captcha: 'pass' });
  });

  it('refreshes authentication exactly once after an authorization failure', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(gameResponse());
    await expect(new HltbClient({ fetch: fetchMock }).lookup('Trails in the Sky 1st Chapter')).resolves.not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('maps the fixed CRYMACHINA response to 15½ / 19½ / 29 hours', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          game_id: 129922,
          game_name: 'CRYMACHINA',
          game_image: '129922_CRYMACHINA.jpg',
          comp_main: 55_800,
          comp_plus: 70_200,
          comp_100: 104_400,
        }],
      }), { status: 200 }));

    await expect(new HltbClient({ fetch: fetchMock }).lookup('CRYMACHINA')).resolves.toMatchObject({
      matchedTitle: 'CRYMACHINA',
      mainStory: 930,
      mainPlusExtras: 1170,
      completionist: 1740,
      imageUrl: 'https://howlongtobeat.com/games/129922_CRYMACHINA.jpg',
    });
  });

  it('reports rate limits with Retry-After', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '17' } }));
    await expect(new HltbClient({ fetch: fetchMock }).lookup('Game')).rejects.toEqual(new HltbRateLimitError(17));
  });

  it('maps aborted requests to a timeout error', async () => {
    const fetchMock = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(new HltbClient({ fetch: fetchMock, timeoutMs: 1 }).lookup('Game')).rejects.toBeInstanceOf(HltbNetworkError);
  });
});
