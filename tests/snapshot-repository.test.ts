import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import type { SnapshotManifestV4, SnapshotLookupManifest, SnapshotPackEntry } from '../src/snapshot/contracts';
import type { RemoteSnapshotStore } from '../src/snapshot/remote-store';
import { SnapshotRepository, type SnapshotSource } from '../src/snapshot/snapshot';

const digest = '0'.repeat(64);
const emptyTitle = new Uint8Array(gzipSync(Buffer.from('[]')));
const emptySteam = new Uint8Array(gzipSync(new Uint8Array()));
const packagedTitle = new Uint8Array(gzipSync(Buffer.from(JSON.stringify([
  ['Packaged Game', 123, 60, 120, 180],
]))));

function bucketEntries(kind: 'title' | 'steam', count: number): SnapshotPackEntry[] {
  return Array.from({ length: 64 }, (_, index) => {
    const name = index.toString(16).padStart(2, '0');
    const compressed = kind === 'title' ? emptyTitle : emptySteam;
    return {
      name,
      path: `${kind}/${name}.${kind === 'title' ? 'json' : 'bin'}.gz`,
      kind,
      offset: 0,
      entries: count,
      compressedBytes: compressed.byteLength,
      uncompressedBytes: kind === 'title' ? 2 : 0,
      sha256: digest,
      uncompressedSha256: digest,
    };
  });
}

function remoteManifest(): SnapshotManifestV4 {
  return {
    schema: 4,
    snapshotVersion: '2026.09.01.1',
    compression: 'gzip',
    sourceUpdatedAt: '2026-09-01',
    generatedAt: '2026-09-01T00:00:00Z',
    sourceEntryCount: 0,
    timedEntryCount: 0,
    entryCount: 0,
    normalizedTitleCount: 0,
    titleCollisionCount: 0,
    titleCollisionRecordCount: 0,
    steamMappingCount: 0,
    steamCollisionCount: 0,
    bucketCount: 64,
    origin: 'test',
    source: { lastGameId: 0, databaseSha256: digest },
    pack: { path: 'snapshot.pack', bytes: 0, sha256: digest },
    entries: [...bucketEntries('title', 0), ...bucketEntries('steam', 0)],
  };
}

function packagedSource(): SnapshotSource {
  const buckets = Array.from({ length: 64 }, (_, index) => ({
    name: index.toString(16).padStart(2, '0'),
    entries: 1,
    compressedBytes: packagedTitle.byteLength,
    uncompressedBytes: 39,
    sha256: digest,
    uncompressedSha256: digest,
  }));
  const manifest: SnapshotLookupManifest = {
    schema: 3,
    compression: 'gzip',
    sourceUpdatedAt: '2026-07-22',
    bucketCount: 64,
    titleBuckets: buckets,
    steamBuckets: buckets.map((bucket) => ({ ...bucket, entries: 0 })),
  };
  return {
    getManifest: async () => manifest,
    loadCompressed: async (path) => path.startsWith('title/') ? packagedTitle : emptySteam,
  };
}

function remoteStore(getBucket: RemoteSnapshotStore['getBucket']): RemoteSnapshotStore {
  return {
    getActive: async () => ({ activeVersion: '2026.09.01.1', manifest: remoteManifest() }),
    getBucket,
    install: vi.fn(),
    clear: vi.fn(),
  };
}

describe('SnapshotRepository', () => {
  it('treats a valid remote miss as authoritative', async () => {
    const repository = new SnapshotRepository(
      remoteStore(async (_version, path) => path.startsWith('title/') ? emptyTitle : emptySteam),
      { source: packagedSource() },
    );

    await expect(repository.lookup('0', 'Packaged Game')).resolves.toBeNull();
  });

  it('falls back to the packaged snapshot when the remote store is corrupt', async () => {
    const repository = new SnapshotRepository(
      remoteStore(async () => { throw new Error('corrupt IndexedDB record'); }),
      { source: packagedSource() },
    );

    await expect(repository.lookup('0', 'Packaged Game')).resolves.toMatchObject({
      gameId: 123,
      mainStory: 60,
      mainPlusExtras: 120,
      completionist: 180,
    });
  });
});
