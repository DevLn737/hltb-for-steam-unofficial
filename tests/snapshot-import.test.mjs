import { describe, expect, it } from 'vitest';
import { buildSnapshot, extractSnapshotRecord, secondsToMinutes } from '../scripts/snapshot-lib.mjs';

function record(gameId, title, times, steamAppIds = []) {
  return { gameId, title, mainStory: times[0], mainPlusExtras: times[1], completionist: times[2], steamAppIds };
}

describe('snapshot v2 importer', () => {
  it('extracts only useful fields and converts seconds to minutes', () => {
    expect(secondsToMinutes(55_066)).toBe(918);
    expect(secondsToMinutes(1)).toBe(1);
    expect(extractSnapshotRecord({ game: [{
      game_id: 124_771, game_name: 'CRYMACHINA', comp_main: 55_066, comp_plus: 69_820, comp_100: 103_541,
      profile_steam: 2_258_500, profile_steam_alt: 0,
    }] })).toEqual(record(124_771, 'CRYMACHINA', [918, 1164, 1726], [2_258_500]));
    expect(extractSnapshotRecord({ game: [{ game_id: 2, game_name: 'Empty', comp_main: 0 }] })).toBeNull();
  });

  it('keeps colliding titles but excludes ambiguous App IDs', () => {
    const result = buildSnapshot([
      record(1, 'Collision™', [60, null, null], [10]),
      record(2, 'Collision', [120, null, null], [10, 11]),
      record(3, 'Safe Game', [90, 120, 180], [12]),
    ]);
    expect(result.metadata).toMatchObject({
      entryCount: 3, normalizedTitleCount: 2, titleCollisionCount: 1, titleCollisionRecordCount: 2,
      steamCandidateCount: 3, steamMappingCount: 2, steamCollisionCount: 1,
    });
    expect(result.titleBuckets.flat()).toContainEqual(['Safe Game', 3, 90, 120, 180]);
  });

  it('uses mapping-only overrides and rejects conflicting duplicate HLTB IDs', () => {
    const records = [record(1, 'One', [60, null, null], [10]), record(2, 'Two', [120, null, null], [10])];
    const result = buildSnapshot(records, { schema: 2, origin: 'test', entries: [{ appId: '10', hltbGameId: 2 }] });
    expect(result.metadata).toMatchObject({ steamMappingCount: 1, steamCollisionCount: 0 });
    expect(() => buildSnapshot([...records, record(1, 'Changed', [60, null, null])])).toThrow(/Conflicting duplicate/);
  });
});
