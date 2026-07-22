import { describe, expect, it } from 'vitest';
import { decodeSteamIndex, encodeSteamIndex, packSnapshotLocation, unpackSnapshotLocation } from '../shared/snapshot-codec.mjs';

describe('snapshot binary codec', () => {
  it('round-trips sorted Steam App IDs and packed locations', () => {
    const pairs = [[10, packSnapshotLocation(0, 5)], [2_258_500, packSnapshotLocation(63, 1024)]];
    expect(decodeSteamIndex(encodeSteamIndex(pairs))).toEqual(pairs);
    expect(unpackSnapshotLocation(pairs[1][1])).toEqual({ bucket: 63, rowIndex: 1024 });
  });

  it('rejects unsorted and truncated indexes', () => {
    expect(() => encodeSteamIndex([[10, 1], [9, 2]])).toThrow(/strictly increasing/);
    expect(() => decodeSteamIndex(Uint8Array.of(0x80))).toThrow(/truncated/);
  });
});
