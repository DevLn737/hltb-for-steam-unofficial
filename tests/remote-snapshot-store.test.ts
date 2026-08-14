import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { encodeSteamIndex, encodeTitleBucket } from '../shared/snapshot-codec.mjs';
import type { SnapshotManifestV7, SnapshotPackEntry } from '../src/snapshot/contracts';
import { sha256Hex } from '../src/snapshot/crypto';
import { IndexedDbRemoteSnapshotStore } from '../src/snapshot/remote-store';
async function fixture(version: string): Promise<{ manifest: SnapshotManifestV7; buckets: Map<string, Uint8Array> }> {
  const buckets = new Map<string, Uint8Array>();
  const entries: SnapshotPackEntry[] = [];
  let offset = 0;
  for (const kind of ['title', 'steam'] as const) {
    for (let index = 0; index < 16; index += 1) {
      const name = index.toString(16);
      const path = `${kind}/${name}.bin.gz`;
      const raw = kind === 'title' ? encodeTitleBucket([]) : encodeSteamIndex([]);
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
      schema: 7, snapshotVersion: version, format: 'front-coded-uleb128-delta-v3', compression: 'gzip', sourceUpdatedAt: '2026-08-10', baselineUpdatedAt: '2026-07-22', checkedDates: ['2026-08-10'],
      generatedAt: '2026-08-10T00:00:00.000Z', sourceEntryCount: 0, timedEntryCount: 0, entryCount: 0, originalEntryCount: 0, excludedEntryCount: 0,
      normalizedTitleCount: 0, titleCollisionCount: 0, titleCollisionRecordCount: 0,
      steamMappingCount: 0, steamCollisionCount: 0, bucketCount: 16, origin: 'test',
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
    await expect(store.getBucket('2026.10.01.1', 'title/0.bin.gz')).resolves.not.toBeNull();
    await expect(store.getBucket('2026.09.01.1', 'title/0.bin.gz')).resolves.not.toBeNull();
    await expect(store.getBucket('2026.08.10.1', 'title/0.bin.gz')).resolves.toBeNull();
  });

  it('does not switch the active version when the bucket set is incomplete', async () => {
    const store = new IndexedDbRemoteSnapshotStore('test-incomplete-store');
    const first = await fixture('2026.08.10.1');
    const second = await fixture('2026.09.01.1');
    await store.install(first.manifest, first.buckets);
    second.buckets.delete('title/0.bin.gz');
    await expect(store.install(second.manifest, second.buckets)).rejects.toThrow('incomplete');
    await expect(store.getActive()).resolves.toMatchObject({ activeVersion: '2026.08.10.1' });
  });

  it('clears incompatible pre-v7 remote snapshots during the database upgrade', async () => {
    const name = 'test-schema-upgrade-store';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 3);
      request.addEventListener('upgradeneeded', () => {
        request.result.createObjectStore('meta', { keyPath: 'key' }).put({ key: 'active', activeVersion: '2026.08.12.1' });
        request.result.createObjectStore('manifests', { keyPath: 'snapshotVersion' });
        request.result.createObjectStore('buckets', { keyPath: 'id' });
      });
      request.addEventListener('success', () => { request.result.close(); resolve(); });
      request.addEventListener('error', () => reject(request.error));
    });
    const store = new IndexedDbRemoteSnapshotStore(name);
    await expect(store.getActive()).resolves.toBeNull();
  });
});

