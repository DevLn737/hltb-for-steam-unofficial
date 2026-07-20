import { browser } from 'wxt/browser';
import { normalizeTitle } from '../core/title-matcher';

type SnapshotRow = [
  title: string,
  mainStory: number | null,
  mainPlusExtras: number | null,
  completionist: number | null,
  dateIndex?: number,
];

interface SnapshotBucketInfo {
  name: string;
  entries: number;
  bytes: number;
  sha256: string;
}

export interface SnapshotManifest {
  schema: 1;
  sourceUpdatedAt: string;
  dates: string[];
  sourceEntryCount: number;
  entryCount: number;
  collisionCount: number;
  bucketCount: 64;
  origin: string;
  buckets: SnapshotBucketInfo[];
}

export interface SnapshotGameTimes {
  matchedTitle: string;
  mainStory: number | null;
  mainPlusExtras: number | null;
  completionist: number | null;
  updatedAt: number;
}

export function snapshotBucket(normalizedTitle: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalizedTitle.length; index += 1) {
    hash ^= normalizedTitle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 64;
}

export interface SnapshotOptions {
  fetch?: typeof fetch;
  getUrl?: (path: string) => string;
}

export class HltbSnapshot {
  private readonly fetchImpl: typeof fetch;
  private readonly getUrl: (path: string) => string;
  private manifestPromise?: Promise<SnapshotManifest>;
  private readonly bucketPromises = new Map<string, Promise<SnapshotRow[]>>();

  constructor(options: SnapshotOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.getUrl = options.getUrl ?? ((path) => browser.runtime.getURL(path as never));
  }

  async lookup(title: string): Promise<SnapshotGameTimes | null> {
    const normalized = normalizeTitle(title);
    if (!normalized) return null;
    const manifest = await this.getManifest();
    const name = snapshotBucket(normalized).toString(16).padStart(2, '0');
    const rows = await this.getBucket(name, manifest);
    const matches = rows.filter((row) => normalizeTitle(row[0]) === normalized);
    if (matches.length !== 1) return null;
    const row = matches[0]!;
    const updatedAt = manifest.dates[row[4] ?? 0] ?? manifest.sourceUpdatedAt;
    const parsedDate = Date.parse(updatedAt);
    return {
      matchedTitle: row[0],
      mainStory: row[1],
      mainPlusExtras: row[2],
      completionist: row[3],
      updatedAt: Number.isNaN(parsedDate) ? 0 : parsedDate,
    };
  }

  private getManifest(): Promise<SnapshotManifest> {
    this.manifestPromise ??= this.loadJson<SnapshotManifest>('manifest.json').then((manifest) => {
      if (manifest.schema !== 1 || manifest.bucketCount !== 64 || !Array.isArray(manifest.dates)) {
        throw new Error('Unsupported HLTB snapshot manifest');
      }
      return manifest;
    });
    return this.manifestPromise;
  }

  private getBucket(name: string, manifest: SnapshotManifest): Promise<SnapshotRow[]> {
    const metadata = manifest.buckets.find((bucket) => bucket.name === name);
    if (!metadata) return Promise.reject(new Error(`Missing HLTB snapshot bucket ${name}`));
    let pending = this.bucketPromises.get(name);
    if (!pending) {
      pending = this.loadJson<SnapshotRow[]>(`${name}.json`).then((rows) => {
        if (!Array.isArray(rows) || rows.length !== metadata.entries) throw new Error(`Invalid HLTB snapshot bucket ${name}`);
        return rows;
      });
      this.bucketPromises.set(name, pending);
    }
    return pending;
  }

  private async loadJson<T>(file: string): Promise<T> {
    const response = await this.fetchImpl(this.getUrl(`data/hltb-snapshot/${file}`));
    if (!response.ok) throw new Error(`Unable to load HLTB snapshot ${file} (HTTP ${response.status})`);
    return await response.json() as T;
  }
}
