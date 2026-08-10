import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { SnapshotManifestV4, SnapshotPackEntry } from '../src/snapshot/contracts';
import { sha256Hex } from '../src/snapshot/crypto';
import { IndexedDbRemoteSnapshotStore } from '../src/snapshot/remote-store';

async function fixture(version: string): Promise<{ manifest: SnapshotManifestV4; buckets: Map<string, Uint8Array> }> {
  const buckets = new Map<string, Uint8Array>();
  const entries: SnapshotPackEntry[] = [];
  let offset = 0;
  for (const kind of ['title', 'steam'] as const) {
    for (let index = 0; index < 64; index += 1) {
      const name = index.toString(16).padStart(2, '0');
      const path = kind === 'title' ? `title/${name}.json.gz` : `steam/${name}.bin.gz`;
      const raw = new Uint8Array(kind === 'title' ? Buffer.from('[]') : Buffer.alloc(0));
      const compressed = new Uint8Array(gzipSync(raw, { level: 9 }));
      buckets.set(path, compressed);
      entries.push({
        path, kind, name, offset, entries: 0,
        compressedBytes: compressed.length,
        uncompressedBytes: raw.length,
        sha256: await sha256Hex(compressed),
        uncompressedSha256: await sha256Hex(raw),
      });
      offset += compressed.length;
    }
  }
  return {
    manifest: {
      schema: 4, snapshotVersion: version, compression: 'gzip', sourceUpdatedAt: '2026-08-10',
      generatedAt: '2026-08-10T00:00:00.000Z', sourceEntryCount: 0, timedEntryCount: 0, entryCount: 0,
      normalizedTitleCount: 0, titleCollisionCount: 0, titleCollisionRecordCount: 0,
      steamMappingCount: 0, steamCollisionCount: 0, bucketCount: 64, origin: 'test',
      source: { lastGameId: 0, databaseSha256: '0'.repeat(64) },
      pack: { path: 'snapshot.pack', bytes: offset, sha256: '0'.repeat(64) }, entries,
    },
    buckets,
  };
}

describe('IndexedDB remote snapshot store', () => {
  beforeEach(() => Object.assign(globalThis, { indexedDB: new IDBFactory() }));

  it('installs atomically and retains only the active and previous versions', async () => {
    const store = new IndexedDbRemoteSnapshotStore('test-snapshot-store');
    const first = await fixture('2026.08.10.1');
    const second = await fixture('2026.09.01.1');
    const third = await fixture('2026.10.01.1');
    await store.install(first.manifest, first.buckets);
    await store.install(second.manifest, second.buckets);
    await store.install(third.manifest, third.buckets);

    await expect(store.getActive()).resolves.toMatchObject({
      activeVersion: '2026.10.01.1', previousVersion: '2026.09.01.1',
    });
    await expect(store.getBucket('2026.10.01.1', 'title/00.json.gz')).resolves.not.toBeNull();
    await expect(store.getBucket('2026.09.01.1', 'title/00.json.gz')).resolves.not.toBeNull();
    await expect(store.getBucket('2026.08.10.1', 'title/00.json.gz')).resolves.toBeNull();
  });

  it('does not switch the active version when the bucket set is incomplete', async () => {
    const store = new IndexedDbRemoteSnapshotStore('test-incomplete-store');
    const first = await fixture('2026.08.10.1');
    const second = await fixture('2026.09.01.1');
    await store.install(first.manifest, first.buckets);
    second.buckets.delete('title/00.json.gz');
    await expect(store.install(second.manifest, second.buckets)).rejects.toThrow('incomplete');
    await expect(store.getActive()).resolves.toMatchObject({ activeVersion: '2026.08.10.1' });
  });
});
