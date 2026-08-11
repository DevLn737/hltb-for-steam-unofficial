import { browser } from 'wxt/browser';
import { decodeSteamIndex, type SteamIndexPair, unpackSnapshotLocation } from '../../shared/snapshot-codec.mjs';
import { normalizeTitle, normalizeTitleLegacy, snapshotBucket } from '../../shared/title-normalization.mjs';
import type { SnapshotLookupManifest } from './contracts';
import { toLookupManifest } from './manifest';
import type { RemoteSnapshotStore } from './remote-store';

type SnapshotRow = [
  title: string,
  gameId: number,
  mainStory: number | null,
  mainPlusExtras: number | null,
  completionist: number | null,
];

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
  source?: SnapshotSource;
}

export interface SnapshotSource {
  getManifest(): Promise<SnapshotLookupManifest>;
  loadCompressed(path: string): Promise<Uint8Array>;
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
  private readonly source: SnapshotSource;
  private manifestPromise?: Promise<SnapshotLookupManifest>;
  private readonly titleBucketPromises = new Map<string, Promise<SnapshotRow[]>>();
  private readonly steamBucketPromises = new Map<string, Promise<SteamIndexPair[]>>();

  constructor(options: SnapshotOptions = {}) {
    const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    const getUrl = options.getUrl ?? ((path: string) => browser.runtime.getURL(path as never));
    this.source = options.source ?? {
      getManifest: async () => {
        const response = await fetchImpl(getUrl('data/hltb-snapshot/snapshot.json'));
        if (!response.ok) throw new Error(`Unable to load packaged HLTB snapshot manifest (HTTP ${response.status})`);
        return await response.json() as SnapshotLookupManifest;
      },
      loadCompressed: async (path) => {
        const response = await fetchImpl(getUrl(`data/hltb-snapshot/${path}`));
        if (!response.ok) throw new Error(`Unable to load packaged HLTB snapshot ${path} (HTTP ${response.status})`);
        return new Uint8Array(await response.arrayBuffer());
      },
    };
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

    const normalize = manifest.schema === 3 ? normalizeTitleLegacy : normalizeTitle;
    const normalized = normalize(title);
    if (!normalized) return null;
    const rows = await this.getTitleBucket(bucketName(snapshotBucket(normalized)), manifest);
    const matches = rows.filter((row) => normalize(row[0]) === normalized);
    return matches.length === 1 ? this.toResult(matches[0]!, manifest) : null;
  }

  private toResult(row: SnapshotRow, manifest: SnapshotLookupManifest): SnapshotGameTimes {
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

  private getManifest(): Promise<SnapshotLookupManifest> {
    this.manifestPromise ??= this.source.getManifest().then((manifest) => {
      if ((manifest.schema !== 3 && manifest.schema !== 4) || manifest.compression !== 'gzip' || manifest.bucketCount !== 64
        || manifest.titleBuckets.length !== 64 || manifest.steamBuckets.length !== 64) {
        throw new Error('Unsupported HLTB snapshot manifest');
      }
      return manifest;
    });
    return this.manifestPromise;
  }

  private getTitleBucket(name: string, manifest: SnapshotLookupManifest): Promise<SnapshotRow[]> {
    const metadata = manifest.titleBuckets.find((bucket) => bucket.name === name);
    if (!metadata) return Promise.reject(new Error(`Missing HLTB title bucket ${name}`));
    let pending = this.titleBucketPromises.get(name);
    if (!pending) {
      pending = this.loadGzip(`title/${name}.json.gz`).then((bytes) => {
        const rows = JSON.parse(new TextDecoder().decode(bytes)) as SnapshotRow[];
        if (!Array.isArray(rows) || rows.length !== metadata.entries || rows.some((row) =>
          !Array.isArray(row) || row.length !== 5 || typeof row[0] !== 'string' || row[0].length === 0
          || !Number.isSafeInteger(row[1]) || row[1] <= 0
          || [row[2], row[3], row[4]].some((value) => value !== null && (!Number.isSafeInteger(value) || value <= 0)))) {
          throw new Error(`Invalid HLTB title bucket ${name}`);
        }
        return rows;
      });
      this.titleBucketPromises.set(name, pending);
    }
    return pending;
  }

  private getSteamBucket(name: string, manifest: SnapshotLookupManifest): Promise<SteamIndexPair[]> {
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
    const compressed = await this.source.loadCompressed(file);
    const buffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
    const body = new Response(buffer).body;
    if (!body) throw new Error(`Unable to create HLTB snapshot stream for ${file}`);
    const decompressed = body.pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(decompressed).arrayBuffer());
  }
}

export class SnapshotRepository {
  private readonly packaged: HltbSnapshot;
  private remoteVersion: string | undefined;
  private remote: HltbSnapshot | undefined;

  constructor(
    private readonly store: RemoteSnapshotStore,
    packagedOptions: SnapshotOptions = {},
  ) {
    this.packaged = new HltbSnapshot(packagedOptions);
  }

  async lookup(appId: string, title: string): Promise<SnapshotGameTimes | null> {
    try {
      const active = await this.store.getActive();
      if (active) {
        if (!this.remote || this.remoteVersion !== active.activeVersion) {
          const version = active.activeVersion;
          const manifest = toLookupManifest(active.manifest);
          this.remote = new HltbSnapshot({
            source: {
              getManifest: async () => manifest,
              loadCompressed: async (path) => {
                const bytes = await this.store.getBucket(version, path);
                if (!bytes) throw new Error(`Missing remote snapshot bucket ${path}`);
                return bytes;
              },
            },
          });
          this.remoteVersion = version;
        }
        try {
          return await this.remote.lookup(appId, title);
        } catch {
          this.remote = undefined;
          this.remoteVersion = undefined;
        }
      }
    } catch {
      // IndexedDB may be unavailable (for example in a restricted private context).
    }
    return await this.packaged.lookup(appId, title);
  }
}
