import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HltbSnapshot } from '../src/snapshot/snapshot';
function localSnapshot(): HltbSnapshot {
  return new HltbSnapshot({
    getUrl: (relative) => path.resolve('public', relative),
    fetch: async (input) => {
      try {
        const content = await readFile(String(input));
        return new Response(new Uint8Array(content), { status: 200 });
      } catch {
        return new Response('', { status: 404 });
      }
    },
  });
}

describe('packaged HLTB snapshot v7', () => {
  it('contains all useful source records in the pruned binary format', async () => {
    const manifest = JSON.parse(await readFile('public/data/hltb-snapshot/snapshot.json', 'utf8')) as {
      schema: number; format: string; sourceEntryCount: number; timedEntryCount: number; entryCount: number;
      originalEntryCount: number; excludedEntryCount: number;
      normalizedTitleCount: number; titleCollisionCount: number; steamMappingCount: number;
    };
    expect(manifest).toMatchObject({
      schema: 7, format: 'front-coded-uleb128-delta-v3', sourceEntryCount: 173_789, timedEntryCount: 59_554,
      originalEntryCount: 173_789, steamMappingCount: 58_927,
    });
  });

  it('retains known HLTB games with no completion times', async () => {
    await expect(localSnapshot().lookup('3181220', 'AV Director Life!')).resolves.toMatchObject({
      gameId: 175_491,
      matchedTitle: 'AV Director Life!',
      mainStory: null,
      mainPlusExtras: null,
      completionist: null,
    });
  });

  it('uses Steam App ID before the page title and returns direct HLTB IDs', async () => {
    await expect(localSnapshot().lookup('2258500', 'Wrong page title')).resolves.toMatchObject({
      gameId: 124_771, matchedTitle: 'CRYMACHINA', mainStory: 918, mainPlusExtras: 1164, completionist: 1726,
      updatedAt: Date.UTC(2026, 6, 22),
    });
  });

  it('returns current acceptance values and never the historical 4.6-hour mismatch', async () => {
    const snapshot = localSnapshot();
    await expect(snapshot.lookup('3375780', 'Trails in the Sky 1st Chapter')).resolves.toMatchObject({
      mainStory: 2381, mainPlusExtras: 3421, completionist: 4487,
    });
    await expect(snapshot.lookup('2680010', 'The First Berserker: Khazan')).resolves.toMatchObject({
      mainStory: 2062, mainPlusExtras: 2813, completionist: 3462,
    });
    await expect(snapshot.lookup('3639650', 'Kotama and Academy Citadel')).resolves.toMatchObject({
      mainStory: 590, mainPlusExtras: 996, completionist: 1126,
    });
    expect((await snapshot.lookup('3375780', 'Trails in the Sky 1st Chapter'))?.completionist).not.toBe(276);
  });

  it('supports exact title fallback and does not invent unknown data', async () => {
    await expect(localSnapshot().lookup('0', 'CRYMACHINA')).resolves.toMatchObject({ gameId: 124_771 });
    await expect(localSnapshot().lookup('0', 'A Dark Room')).resolves.toBeNull();
    await expect(localSnapshot().lookup('4294967295', 'Definitely Not A Real Game 987654')).resolves.toBeNull();
  });
});

