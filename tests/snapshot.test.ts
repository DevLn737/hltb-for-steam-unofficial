import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HltbSnapshot } from '../src/snapshot/snapshot';

function localSnapshot(): HltbSnapshot {
  return new HltbSnapshot({
    getUrl: (relative) => path.resolve('public', relative),
    fetch: async (input) => {
      try {
        const content = await readFile(String(input), 'utf8');
        return new Response(content, { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch {
        return new Response('', { status: 404 });
      }
    },
  });
}

describe('packaged HLTB snapshot', () => {
  it('contains the expected compact, collision-safe source', async () => {
    const manifest = JSON.parse(await readFile('public/data/hltb-snapshot/manifest.json', 'utf8')) as {
      sourceEntryCount: number; entryCount: number; collisionCount: number; bucketCount: number;
    };
    expect(manifest).toMatchObject({ sourceEntryCount: 52_518, entryCount: 52_074, collisionCount: 106, bucketCount: 64 });
  });

  it('returns verified overrides and never the historical 4.6-hour mismatch', async () => {
    const snapshot = localSnapshot();
    await expect(snapshot.lookup('Trails in the Sky 1st Chapter')).resolves.toMatchObject({
      mainStory: 2400, mainPlusExtras: 3420, completionist: 3480,
    });
    await expect(snapshot.lookup('CRYMACHINA')).resolves.toMatchObject({
      mainStory: 930, mainPlusExtras: 1170, completionist: 1740,
    });
    await expect(snapshot.lookup('The First Berserker: Khazan')).resolves.toMatchObject({
      mainStory: 2040, mainPlusExtras: 2820, completionist: 3480,
    });
    await expect(snapshot.lookup('Kotama and Academy Citadel')).resolves.toMatchObject({
      mainStory: 600, mainPlusExtras: 990, completionist: 1140,
    });
    expect((await snapshot.lookup('Trails in the Sky 1st Chapter'))?.completionist).not.toBe(276);
  });

  it('does not invent data for an unknown title', async () => {
    await expect(localSnapshot().lookup('Definitely Not A Real Game 987654')).resolves.toBeNull();
  });
});
