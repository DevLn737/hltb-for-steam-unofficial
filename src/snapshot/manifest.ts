import { isSha256 } from './crypto';
import type {
  RemoteSnapshotPointer,
  SnapshotLookupManifest,
  SnapshotManifestV4,
  SnapshotPackEntry,
} from './contracts';

const VERSION = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MANIFEST_PATH = /^versions\/\d{4}\.\d{2}\.\d{2}\.\d+\/manifest\.json$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function parseRemoteSnapshotPointer(value: unknown): RemoteSnapshotPointer {
  if (!isRecord(value) || !exactKeys(value, ['schema', 'snapshotVersion', 'generatedAt', 'manifestPath', 'manifestSha256'])
    || value.schema !== 1
    || typeof value.snapshotVersion !== 'string' || !VERSION.test(value.snapshotVersion)
    || typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))
    || typeof value.manifestPath !== 'string' || !MANIFEST_PATH.test(value.manifestPath)
    || !isSha256(value.manifestSha256)) {
    throw new Error('Invalid remote snapshot pointer');
  }
  return value as unknown as RemoteSnapshotPointer;
}

function parsePackEntry(value: unknown): SnapshotPackEntry {
  if (!isRecord(value) || !exactKeys(value, [
    'path', 'kind', 'name', 'offset', 'entries', 'compressedBytes', 'uncompressedBytes', 'sha256', 'uncompressedSha256',
  ])) throw new Error('Invalid snapshot pack entry');
  const kind = value.kind;
  const name = value.name;
  const expectedPath = kind === 'title' ? `title/${name}.json.gz` : `steam/${name}.bin.gz`;
  if ((kind !== 'title' && kind !== 'steam')
    || typeof name !== 'string' || !/^[a-f0-9]{2}$/.test(name)
    || value.path !== expectedPath
    || !nonNegativeInteger(value.offset)
    || !nonNegativeInteger(value.entries)
    || !positiveInteger(value.compressedBytes)
    || !nonNegativeInteger(value.uncompressedBytes)
    || !isSha256(value.sha256)
    || !isSha256(value.uncompressedSha256)) {
    throw new Error('Invalid snapshot pack entry');
  }
  return value as unknown as SnapshotPackEntry;
}

export function parseSnapshotManifestV4(value: unknown, expectedVersion?: string): SnapshotManifestV4 {
  const keys = [
    'schema', 'snapshotVersion', 'compression', 'sourceUpdatedAt', 'generatedAt', 'sourceEntryCount',
    'timedEntryCount', 'entryCount', 'normalizedTitleCount', 'titleCollisionCount', 'titleCollisionRecordCount',
    'steamMappingCount', 'steamCollisionCount', 'bucketCount', 'origin', 'source', 'pack', 'entries',
  ];
  if (!isRecord(value) || !exactKeys(value, keys)
    || value.schema !== 4 || value.compression !== 'gzip' || value.bucketCount !== 64
    || typeof value.snapshotVersion !== 'string' || !VERSION.test(value.snapshotVersion)
    || (expectedVersion !== undefined && value.snapshotVersion !== expectedVersion)
    || typeof value.sourceUpdatedAt !== 'string' || !DATE.test(value.sourceUpdatedAt)
    || typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))
    || typeof value.origin !== 'string' || value.origin.length === 0
    || !nonNegativeInteger(value.sourceEntryCount) || !nonNegativeInteger(value.timedEntryCount)
    || !nonNegativeInteger(value.entryCount) || !nonNegativeInteger(value.normalizedTitleCount)
    || !nonNegativeInteger(value.titleCollisionCount) || !nonNegativeInteger(value.titleCollisionRecordCount)
    || !nonNegativeInteger(value.steamMappingCount) || !nonNegativeInteger(value.steamCollisionCount)
    || !isRecord(value.source) || !exactKeys(value.source, ['lastGameId', 'databaseSha256'])
    || !nonNegativeInteger(value.source.lastGameId) || !isSha256(value.source.databaseSha256)
    || !isRecord(value.pack) || !exactKeys(value.pack, ['path', 'bytes', 'sha256'])
    || value.pack.path !== 'snapshot.pack' || !positiveInteger(value.pack.bytes) || !isSha256(value.pack.sha256)
    || !Array.isArray(value.entries) || value.entries.length !== 128) {
    throw new Error('Invalid remote snapshot manifest');
  }
  const entries = value.entries.map(parsePackEntry).sort((left, right) => left.offset - right.offset);
  let offset = 0;
  const paths = new Set<string>();
  for (const entry of entries) {
    if (entry.offset !== offset || paths.has(entry.path)) throw new Error('Invalid snapshot pack layout');
    paths.add(entry.path);
    offset += entry.compressedBytes;
  }
  if (offset !== value.pack.bytes) throw new Error('Snapshot pack size does not match its entries');
  for (const kind of ['title', 'steam'] as const) {
    for (let index = 0; index < 64; index += 1) {
      const name = index.toString(16).padStart(2, '0');
      const path = kind === 'title' ? `title/${name}.json.gz` : `steam/${name}.bin.gz`;
      if (!paths.has(path)) throw new Error(`Missing snapshot pack entry ${path}`);
    }
  }
  return { ...(value as unknown as SnapshotManifestV4), entries };
}

export function toLookupManifest(manifest: SnapshotManifestV4): SnapshotLookupManifest {
  const titleBuckets = manifest.entries.filter((entry) => entry.kind === 'title')
    .sort((left, right) => left.name.localeCompare(right.name));
  const steamBuckets = manifest.entries.filter((entry) => entry.kind === 'steam')
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    schema: 4,
    compression: 'gzip',
    sourceUpdatedAt: manifest.sourceUpdatedAt,
    bucketCount: 64,
    titleBuckets,
    steamBuckets,
  };
}

export function resolveSnapshotUrl(baseUrl: string, relativePath: string): string {
  const base = new URL(baseUrl);
  const resolved = new URL(relativePath, base);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) {
    throw new Error('Remote snapshot URL escaped its configured origin');
  }
  return resolved.toString();
}
