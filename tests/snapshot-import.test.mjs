import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '../scripts/snapshot-lib.mjs';

describe('snapshot importer', () => {
  it('converts hours to minutes and excludes ambiguous normalized titles', () => {
    const source = {
      version: 'test', lastUpdated: '2025-10-23', games: [
        { title: 'Safe Game', data: { mainStory: 1.5, mainExtra: 2, completionist: 3 } },
        { title: 'Collision™', data: { mainStory: 1 } },
        { title: 'Collision', data: { mainStory: 2 } },
        { title: 'Empty', data: { mainStory: null, mainExtra: null, completionist: null } },
      ],
    };
    const result = buildSnapshot(source, { origin: 'test', entries: [] });
    expect(result.metadata).toMatchObject({ sourceEntryCount: 4, entryCount: 1, emptyEntries: 1, collisionCount: 1 });
    expect(result.buckets.flat()).toContainEqual(['Safe Game', 90, 120, 180]);
  });
});
