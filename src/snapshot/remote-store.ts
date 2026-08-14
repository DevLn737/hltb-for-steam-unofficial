import type { SnapshotManifestV7 } from './contracts';

const DATABASE_NAME = 'hltb-remote-snapshots';
const DATABASE_VERSION = 4;
const META_STORE = 'meta';
const MANIFEST_STORE = 'manifests';
const BUCKET_STORE = 'buckets';
const ACTIVE_KEY = 'active';

interface ActiveRecord {
  key: typeof ACTIVE_KEY;
  activeVersion: string;
  previousVersion?: string;
}

interface BucketRecord {
  id: string;
  version: string;
  path: string;
  bytes: ArrayBuffer;
}

export interface ActiveRemoteSnapshot {
  activeVersion: string;
  previousVersion?: string;
  manifest: SnapshotManifestV7;
}

export interface RemoteSnapshotStore {
  getActive(): Promise<ActiveRemoteSnapshot | null>;
  getBucket(version: string, path: string): Promise<Uint8Array | null>;
  install(manifest: SnapshotManifestV7, buckets: Map<string, Uint8Array>): Promise<void>;
  clear(): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed')), { once: true });
  });
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export class IndexedDbRemoteSnapshotStore implements RemoteSnapshotStore {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(private readonly databaseName = DATABASE_NAME) {}

  async getActive(): Promise<ActiveRemoteSnapshot | null> {
    const database = await this.open();
    const metaTransaction = database.transaction(META_STORE, 'readonly');
    const active = await requestResult(metaTransaction.objectStore(META_STORE).get(ACTIVE_KEY)) as ActiveRecord | undefined;
    await transactionDone(metaTransaction);
    if (!active?.activeVersion) return null;
    const manifestTransaction = database.transaction(MANIFEST_STORE, 'readonly');
    const manifest = await requestResult(manifestTransaction.objectStore(MANIFEST_STORE).get(active.activeVersion)) as SnapshotManifestV7 | undefined;
    await transactionDone(manifestTransaction);
    if (!manifest) throw new Error(`Missing active remote snapshot manifest ${active.activeVersion}`);
    return {
      activeVersion: active.activeVersion,
      ...(active.previousVersion ? { previousVersion: active.previousVersion } : {}),
      manifest,
    };
  }

  async getBucket(version: string, path: string): Promise<Uint8Array | null> {
    const database = await this.open();
    const transaction = database.transaction(BUCKET_STORE, 'readonly');
    const record = await requestResult(transaction.objectStore(BUCKET_STORE).get(`${version}:${path}`)) as BucketRecord | undefined;
    await transactionDone(transaction);
    return record ? new Uint8Array(record.bytes) : null;
  }

  async install(manifest: SnapshotManifestV7, buckets: Map<string, Uint8Array>): Promise<void> {
    if (buckets.size !== manifest.entries.length) throw new Error('Remote snapshot bucket set is incomplete');
    const current = await this.getActive();
    const database = await this.open();
    const transaction = database.transaction([META_STORE, MANIFEST_STORE, BUCKET_STORE], 'readwrite');
    const manifests = transaction.objectStore(MANIFEST_STORE);
    const storedBuckets = transaction.objectStore(BUCKET_STORE);
    manifests.put(manifest);
    for (const entry of manifest.entries) {
      const bytes = buckets.get(entry.path);
      if (!bytes || bytes.byteLength !== entry.compressedBytes) {
        transaction.abort();
        throw new Error(`Remote snapshot bucket ${entry.path} is missing`);
      }
      storedBuckets.put({
        id: `${manifest.snapshotVersion}:${entry.path}`,
        version: manifest.snapshotVersion,
        path: entry.path,
        bytes: exactArrayBuffer(bytes),
      } satisfies BucketRecord);
    }
    transaction.objectStore(META_STORE).put({
      key: ACTIVE_KEY,
      activeVersion: manifest.snapshotVersion,
      ...(current?.activeVersion && current.activeVersion !== manifest.snapshotVersion
        ? { previousVersion: current.activeVersion }
        : current?.previousVersion ? { previousVersion: current.previousVersion } : {}),
    } satisfies ActiveRecord);
    await transactionDone(transaction);
    await this.removeOldVersions(new Set([
      manifest.snapshotVersion,
      ...(current?.activeVersion && current.activeVersion !== manifest.snapshotVersion ? [current.activeVersion] : []),
    ]));
  }

  async clear(): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction([META_STORE, MANIFEST_STORE, BUCKET_STORE], 'readwrite');
    transaction.objectStore(META_STORE).clear();
    transaction.objectStore(MANIFEST_STORE).clear();
    transaction.objectStore(BUCKET_STORE).clear();
    await transactionDone(transaction);
  }

  private async removeOldVersions(keep: Set<string>): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction([MANIFEST_STORE, BUCKET_STORE], 'readwrite');
    const manifests = transaction.objectStore(MANIFEST_STORE);
    const buckets = transaction.objectStore(BUCKET_STORE);
    for (const key of await requestResult(manifests.getAllKeys())) {
      if (typeof key === 'string' && !keep.has(key)) manifests.delete(key);
    }
    for (const key of await requestResult(buckets.getAllKeys())) {
      if (typeof key === 'string' && ![...keep].some((version) => key.startsWith(`${version}:`))) buckets.delete(key);
    }
    await transactionDone(transaction);
  }

  private open(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.addEventListener('upgradeneeded', (event) => {
        const database = request.result;
        const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
        if (oldVersion > 0 && oldVersion < DATABASE_VERSION) {
          for (const name of [META_STORE, MANIFEST_STORE, BUCKET_STORE]) {
            if (database.objectStoreNames.contains(name)) database.deleteObjectStore(name);
          }
        }
        if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath: 'key' });
        if (!database.objectStoreNames.contains(MANIFEST_STORE)) database.createObjectStore(MANIFEST_STORE, { keyPath: 'snapshotVersion' });
        if (!database.objectStoreNames.contains(BUCKET_STORE)) database.createObjectStore(BUCKET_STORE, { keyPath: 'id' });
      });
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error ?? new Error('Unable to open snapshot database')), { once: true });
      request.addEventListener('blocked', () => reject(new Error('Snapshot database upgrade is blocked')), { once: true });
    });
    return this.databasePromise;
  }
}
