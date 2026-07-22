import { browser } from 'wxt/browser';
import { decodeSteamIndex, type SteamIndexPair, unpackSnapshotLocation } from '../../shared/snapshot-codec.mjs';
import { normalizeTitle, snapshotBucket } from '../../shared/title-normalization.mjs';

type SnapshotRow = [
  title: string,
  gameId: number,
  mainStory: number | null,
  mainPlusExtras: number | null,
  completionist: number | null,
];

interface SnapshotBucketInfo {
  name: string;
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
  sha256: string;
  uncompressedSha256: string;
}

export interface SnapshotManifest {
  schema: 2;
  compression: 'gzip';
  sourceUpdatedAt: string;
  sourceEntryCount: number;
  timedEntryCount: number;
  entryCount: number;
  normalizedTitleCount: number;
  titleCollisionCount: number;
  steamMappingCount: number;
  steamCollisionCount: number;
  bucketCount: 64;
  origin: string;
  titleBuckets: SnapshotBucketInfo[];
  steamBuckets: SnapshotBucketInfo[];
}

export interface SnapshotGameTimes {
  gameId: number;
  matchedTitle: string;
  mainStory: number | null;
  mainPlusExtras: number | null;
  completionist: number | null;
  updatedAt: number;
}

export interface SnapshotOptions {
  fetch?: typeof fetch;
  getUrl?: (path: string) => string;
}

function bucketName(index: number): string {
  return index.toString(16).padStart(2, '0');
}

function findAppLocation(pairs: SteamIndexPair[], appId: number): number | null {
  let low = 0;
  let high = pairs.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const pair = pairs[middle];
    if (!pair) return null;
    if (pair[0] === appId) return pair[1];
    if (pair[0] < appId) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}

export class HltbSnapshot {
  private readonly fetchImpl: typeof fetch;
  private readonly getUrl: (path: string) => string;
  private manifestPromise?: Promise<SnapshotManifest>;
  private readonly titleBucketPromises = new Map<string, Promise<SnapshotRow[]>>();
  private readonly steamBucketPromises = new Map<string, Promise<SteamIndexPair[]>>();

  constructor(options: SnapshotOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.getUrl = options.getUrl ?? ((path) => browser.runtime.getURL(path as never));
  }

  async lookup(appId: string, title: string): Promise<SnapshotGameTimes | null> {
    const manifest = await this.getManifest();
    const numericAppId = /^\d+$/.test(appId) ? Number(appId) : 0;
    if (Number.isSafeInteger(numericAppId) && numericAppId > 0) {
      const steamBucket = numericAppId % manifest.bucketCount;
      const pairs = await this.getSteamBucket(bucketName(steamBucket), manifest);
      const packedLocation = findAppLocation(pairs, numericAppId);
      if (packedLocation !== null) {
        const location = unpackSnapshotLocation(packedLocation);
        const rows = await this.getTitleBucket(bucketName(location.bucket), manifest);
        const row = rows[location.rowIndex];
        if (!row) throw new Error(`Invalid HLTB snapshot location for Steam App ${appId}`);
        return this.toResult(row, manifest);
      }
    }

    const normalized = normalizeTitle(title);
    if (!normalized) return null;
    const rows = await this.getTitleBucket(bucketName(snapshotBucket(normalized)), manifest);
    const matches = rows.filter((row) => normalizeTitle(row[0]) === normalized);
    return matches.length === 1 ? this.toResult(matches[0]!, manifest) : null;
  }

  private toResult(row: SnapshotRow, manifest: SnapshotManifest): SnapshotGameTimes {
    const parsedDate = Date.parse(manifest.sourceUpdatedAt);
    return {
      gameId: row[1],
      matchedTitle: row[0],
      mainStory: row[2],
      mainPlusExtras: row[3],
      completionist: row[4],
      updatedAt: Number.isNaN(parsedDate) ? 0 : parsedDate,
    };
  }

  private getManifest(): Promise<SnapshotManifest> {
    this.manifestPromise ??= this.loadJson<SnapshotManifest>('manifest.json').then((manifest) => {
      if (manifest.schema !== 2 || manifest.compression !== 'gzip' || manifest.bucketCount !== 64
        || manifest.titleBuckets.length !== 64 || manifest.steamBuckets.length !== 64) {
        throw new Error('Unsupported HLTB snapshot manifest');
      }
      return manifest;
    });
    return this.manifestPromise;
  }

  private getTitleBucket(name: string, manifest: SnapshotManifest): Promise<SnapshotRow[]> {
    const metadata = manifest.titleBuckets.find((bucket) => bucket.name === name);
    if (!metadata) return Promise.reject(new Error(`Missing HLTB title bucket ${name}`));
    let pending = this.titleBucketPromises.get(name);
    if (!pending) {
      pending = this.loadGzip(`title/${name}.json.gz`).then((bytes) => {
        const rows = JSON.parse(new TextDecoder().decode(bytes)) as SnapshotRow[];
        if (!Array.isArray(rows) || rows.length !== metadata.entries) throw new Error(`Invalid HLTB title bucket ${name}`);
        return rows;
      });
      this.titleBucketPromises.set(name, pending);
    }
    return pending;
  }

  private getSteamBucket(name: string, manifest: SnapshotManifest): Promise<SteamIndexPair[]> {
    const metadata = manifest.steamBuckets.find((bucket) => bucket.name === name);
    if (!metadata) return Promise.reject(new Error(`Missing HLTB Steam bucket ${name}`));
    let pending = this.steamBucketPromises.get(name);
    if (!pending) {
      pending = this.loadGzip(`steam/${name}.bin.gz`).then((bytes) => {
        const pairs = decodeSteamIndex(bytes);
        if (pairs.length !== metadata.entries) throw new Error(`Invalid HLTB Steam bucket ${name}`);
        return pairs;
      });
      this.steamBucketPromises.set(name, pending);
    }
    return pending;
  }

  private async loadGzip(file: string): Promise<Uint8Array> {
    const response = await this.fetchImpl(this.getUrl(`data/hltb-snapshot/${file}`));
    if (!response.ok || !response.body) throw new Error(`Unable to load HLTB snapshot ${file} (HTTP ${response.status})`);
    const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(decompressed).arrayBuffer());
  }

  private async loadJson<T>(file: string): Promise<T> {
    const response = await this.fetchImpl(this.getUrl(`data/hltb-snapshot/${file}`));
    if (!response.ok) throw new Error(`Unable to load HLTB snapshot ${file} (HTTP ${response.status})`);
    return await response.json() as T;
  }
}
