import { describe, expect, it } from 'vitest';
import {
  decodeSteamIndex, decodeTitleBucket, encodeSteamIndex, encodeTitleBucket, packSnapshotLocation, unpackSnapshotLocation,
} from '../shared/snapshot-codec.mjs';
import { compareNormalizedTitles } from '../shared/title-normalization.mjs';

describe('snapshot binary codec', () => {
  it('round-trips sorted Steam App IDs and packed locations', () => {
    const pairs = [[10, packSnapshotLocation(0, 5)], [2_258_500, packSnapshotLocation(63, 1024)]];
    expect(decodeSteamIndex(encodeSteamIndex(pairs))).toEqual(pairs);
    expect(unpackSnapshotLocation(pairs[1][1])).toEqual({ bucket: 63, rowIndex: 1024 });
  });

  it('rejects unsorted and truncated indexes', () => {
    expect(() => encodeSteamIndex([[10, 1], [9, 2]])).toThrow(/strictly increasing/);
    const valid = encodeSteamIndex([[10, 1]]);
    expect(() => decodeSteamIndex(valid.slice(0, -1))).toThrow(/truncated/);
  });

  it('round-trips front-coded Unicode title rows', () => {
    const rows = [
      ['Pokémon Alpha', 1, 60, 90, 120, 0, { kind: 'delta', minutes: 30 }, { kind: 'new' }, null],
      ['Pokémon Ωmega', 2, null, 90, null, 1, { kind: 'removed', previous: 45 }, null, null],
      ['Щоденник', 3, 30, 45, 60, 2, null, null, null],
    ];
    expect(decodeTitleBucket(encodeTitleBucket(rows))).toEqual(rows);
  });

  it('rejects corrupted title buckets and trailing bytes', () => {
    const encoded = encodeTitleBucket([['Game', 1, 60, null, null, 0, null, null, null]]);
    expect(() => decodeTitleBucket(encoded.slice(0, -1))).toThrow();
    expect(() => decodeTitleBucket(Uint8Array.from([...encoded, 0]))).toThrow(/trailing/);
    expect(() => decodeTitleBucket(Uint8Array.of(0, 1, 2))).toThrow(/magic/);
  });

  it('uses a deterministic UTF-8 title order across runtimes', () => {
    const values = ['Alpha', 'Álpha', 'Щёлк', '游戏', '😀 Game'];
    expect([...values].sort(compareNormalizedTitles)).toEqual([...values].sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right))));
  });
});
