import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { encodeSteamIndex } from '../shared/snapshot-codec.mjs';
import type { SnapshotManifestV4, SnapshotPackEntry } from '../src/snapshot/contracts';
import { sha256Hex } from '../src/snapshot/crypto';
import { SnapshotUpdateManager, type SnapshotUpdateMetadata, type SnapshotUpdateMetadataStore } from '../src/snapshot/remote-update';
import type { ActiveRemoteSnapshot, RemoteSnapshotStore } from '../src/snapshot/remote-store';

class MemoryMetadata implements SnapshotUpdateMetadataStore {
  value: SnapshotUpdateMetadata | null = null;
  async read(): Promise<SnapshotUpdateMetadata | null> { return this.value; }
  async write(value: SnapshotUpdateMetadata): Promise<void> { this.value = value; }
}

class MemoryStore implements RemoteSnapshotStore {
  active: ActiveRemoteSnapshot | null = null;
  buckets = new Map<string, Uint8Array>();
  async getActive(): Promise<ActiveRemoteSnapshot | null> { return this.active; }
  async getBucket(version: string, path: string): Promise<Uint8Array | null> {
    return this.buckets.get(`${version}:${path}`) ?? null;
  }
  async install(manifest: SnapshotManifestV4, buckets: Map<string, Uint8Array>): Promise<void> {
    const previousVersion = this.active?.activeVersion;
    this.active = { activeVersion: manifest.snapshotVersion, ...(previousVersion ? { previousVersion } : {}), manifest };
    for (const [path, bytes] of buckets) this.buckets.set(`${manifest.snapshotVersion}:${path}`, bytes);
  }
  async clear(): Promise<void> { this.active = null; this.buckets.clear(); }
}

async function remoteFixture(version = '2026.09.01.1') {
  const parts: Uint8Array[] = [];
  const entries: SnapshotPackEntry[] = [];
  let offset = 0;
  for (const kind of ['title', 'steam'] as const) {
    for (let index = 0; index < 64; index += 1) {
      const name = index.toString(16).padStart(2, '0');
      const path = kind === 'title' ? `title/${name}.json.gz` : `steam/${name}.bin.gz`;
      const raw = kind === 'title' ? new TextEncoder().encode('[]') : encodeSteamIndex([]);
      const compressed = new Uint8Array(gzipSync(raw, { level: 9 }));
      parts.push(compressed);
      entries.push({
        path, kind, name, offset, entries: 0, compressedBytes: compressed.length, uncompressedBytes: raw.length,
        sha256: await sha256Hex(compressed), uncompressedSha256: await sha256Hex(raw),
      });
      offset += compressed.length;
    }
  }
  const pack = new Uint8Array(offset);
  let cursor = 0;
  for (const part of parts) { pack.set(part, cursor); cursor += part.length; }
  const manifest: SnapshotManifestV4 = {
    schema: 4, snapshotVersion: version, compression: 'gzip', sourceUpdatedAt: '2026-09-01',
    generatedAt: '2026-09-01T00:00:00.000Z', sourceEntryCount: 0, timedEntryCount: 0, entryCount: 0,
    normalizedTitleCount: 0, titleCollisionCount: 0, titleCollisionRecordCount: 0,
    steamMappingCount: 0, steamCollisionCount: 0, bucketCount: 64, origin: 'test',
    source: { lastGameId: 0, databaseSha256: '1'.repeat(64) },
    pack: { path: 'snapshot.pack', bytes: pack.length, sha256: await sha256Hex(pack) }, entries,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const pointer = {
    schema: 1, snapshotVersion: version, generatedAt: '2026-09-01T00:00:00.000Z',
    manifestPath: `versions/${version}/manifest.json`, manifestSha256: await sha256Hex(manifestBytes),
  };
  const pointerBytes = new TextEncoder().encode(JSON.stringify(pointer));
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, pointerBytes));
  const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey);
  return { manifest, manifestBytes, pack, pointerBytes, signature: Buffer.from(signature).toString('base64'), publicKey };
}

function fixtureFetch(fixture: Awaited<ReturnType<typeof remoteFixture>>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/stable.json')) return new Response(fixture.pointerBytes);
    if (url.endsWith('/stable.sig')) return new Response(fixture.signature);
    if (url.endsWith('/manifest.json')) return new Response(fixture.manifestBytes);
    if (url.endsWith('/snapshot.pack')) return new Response(fixture.pack);
    return new Response('', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('remote snapshot updater', () => {
  it('verifies and atomically activates a signed snapshot', async () => {
    const fixture = await remoteFixture();
    const store = new MemoryStore();
    const metadata = new MemoryMetadata();
    const fetchImpl = fixtureFetch(fixture);
    const manager = new SnapshotUpdateManager(store, {
      fetch: fetchImpl, publicKey: fixture.publicKey, metadata, now: () => 1000,
      baseUrl: 'https://example.test/data/',
    });
    await expect(manager.check()).resolves.toEqual({ status: 'updated', checkedAt: 1000, activeVersion: '2026.09.01.1' });
    expect(store.active?.manifest).toEqual(fixture.manifest);
    expect(store.buckets.size).toBe(128);
    expect(metadata.value?.nextCheckAt).toBeGreaterThan(1000);
    expect(vi.mocked(fetchImpl).mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit', redirect: 'error', cache: 'no-store',
    });
  });

  it('keeps the previous snapshot when the signature is invalid', async () => {
    const fixture = await remoteFixture();
    fixture.signature = Buffer.from('tampered').toString('base64');
    const store = new MemoryStore();
    const metadata = new MemoryMetadata();
    const manager = new SnapshotUpdateManager(store, {
      fetch: fixtureFetch(fixture), publicKey: fixture.publicKey, metadata, now: () => 2000,
      baseUrl: 'https://example.test/data/',
    });
    await expect(manager.check()).resolves.toMatchObject({ status: 'failed', checkedAt: 2000 });
    expect(store.active).toBeNull();
    expect(metadata.value?.nextCheckAt).toBe(2000 + 24 * 60 * 60 * 1000);
  });

  it('does not contact the network more than once per interval', async () => {
    const fixture = await remoteFixture();
    const fetchImpl = fixtureFetch(fixture);
    const metadata = new MemoryMetadata();
    metadata.value = { lastCheckedAt: 900, nextCheckAt: 5000 };
    const manager = new SnapshotUpdateManager(new MemoryStore(), {
      fetch: fetchImpl, publicKey: fixture.publicKey, metadata, now: () => 1000,
      baseUrl: 'https://example.test/data/',
    });
    await expect(manager.check()).resolves.toMatchObject({ status: 'skipped' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects oversized metadata before buffering its body', async () => {
    const fixture = await remoteFixture();
    const store = new MemoryStore();
    const manager = new SnapshotUpdateManager(store, {
      fetch: vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/stable.json')
        ? new Response('{}', { headers: { 'content-length': String(65 * 1024) } })
        : new Response(fixture.signature)) as unknown as typeof fetch,
      publicKey: fixture.publicKey,
      metadata: new MemoryMetadata(),
      now: () => 3000,
      baseUrl: 'https://example.test/data/',
    });
    await expect(manager.check()).resolves.toMatchObject({ status: 'failed', error: expect.stringContaining('size limit') });
    expect(store.active).toBeNull();
  });
});
