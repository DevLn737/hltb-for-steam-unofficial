import { browser } from 'wxt/browser';
import type { RemoteSnapshotPointer, SnapshotUpdateState } from './contracts';
import { sha256Hex, verifyPointerSignature } from './crypto';
import { parseRemoteSnapshotPointer, parseSnapshotManifestV7, resolveSnapshotUrl } from './manifest';
import { validateAndExtractPack } from './pack';
import { REMOTE_SNAPSHOT_BASE_URL, REMOTE_SNAPSHOT_PUBLIC_KEY } from './remote-config';
import type { RemoteSnapshotStore } from './remote-store';

const UPDATE_STATE_KEY = 'snapshot:update:v1';
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SnapshotUpdateMetadata {
  lastCheckedAt: number;
  nextCheckAt: number;
  activeVersion?: string;
  lastError?: string;
}

export interface SnapshotUpdateMetadataStore {
  read(): Promise<SnapshotUpdateMetadata | null>;
  write(value: SnapshotUpdateMetadata): Promise<void>;
}

class BrowserSnapshotUpdateMetadataStore implements SnapshotUpdateMetadataStore {
  async read(): Promise<SnapshotUpdateMetadata | null> {
    const result = await browser.storage.local.get(UPDATE_STATE_KEY);
    const value = result[UPDATE_STATE_KEY] as SnapshotUpdateMetadata | undefined;
    return value && typeof value.lastCheckedAt === 'number' && typeof value.nextCheckAt === 'number' ? value : null;
  }

  async write(value: SnapshotUpdateMetadata): Promise<void> {
    await browser.storage.local.set({ [UPDATE_STATE_KEY]: value });
  }
}

export interface SnapshotUpdateOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  publicKey?: JsonWebKey;
  metadata?: SnapshotUpdateMetadataStore;
  now?: () => number;
  intervalMs?: number;
}

function parseJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function responseBytes(response: Response, label: string, maximumBytes: number): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximumBytes) throw new Error(`${label} exceeds its size limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new Error(`${label} exceeds its size limit`);
  return bytes;
}

export class SnapshotUpdateManager {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly publicKey: JsonWebKey;
  private readonly metadata: SnapshotUpdateMetadataStore;
  private readonly now: () => number;
  private readonly intervalMs: number;
  private pending: Promise<SnapshotUpdateState> | undefined;

  constructor(private readonly store: RemoteSnapshotStore, options: SnapshotUpdateOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? REMOTE_SNAPSHOT_BASE_URL;
    this.publicKey = options.publicKey ?? REMOTE_SNAPSHOT_PUBLIC_KEY;
    this.metadata = options.metadata ?? new BrowserSnapshotUpdateMetadataStore();
    this.now = options.now ?? Date.now;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  check(force = false): Promise<SnapshotUpdateState> {
    this.pending ??= this.run(force).finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async run(force: boolean): Promise<SnapshotUpdateState> {
    const checkedAt = this.now();
    const previous = await this.metadata.read();
    const active = await this.store.getActive().catch(() => null);
    if (!force && previous && checkedAt < previous.nextCheckAt) {
      return { status: 'skipped', checkedAt, ...(active ? { activeVersion: active.activeVersion } : {}) };
    }
    try {
      const pointerUrl = resolveSnapshotUrl(this.baseUrl, 'stable.json');
      const signatureUrl = resolveSnapshotUrl(this.baseUrl, 'stable.sig');
      const [pointerResponse, signatureResponse] = await Promise.all([
        this.fetchImpl(pointerUrl, { cache: 'no-store', credentials: 'omit', redirect: 'error' }),
        this.fetchImpl(signatureUrl, { cache: 'no-store', credentials: 'omit', redirect: 'error' }),
      ]);
      const [pointerBytes, signatureBytes] = await Promise.all([
        responseBytes(pointerResponse, 'Snapshot pointer', 64 * 1024),
        responseBytes(signatureResponse, 'Snapshot signature', 4 * 1024),
      ]);
      if (!await verifyPointerSignature(pointerBytes, new TextDecoder().decode(signatureBytes), this.publicKey)) {
        throw new Error('Remote snapshot pointer signature is invalid');
      }
      const pointer: RemoteSnapshotPointer = parseRemoteSnapshotPointer(parseJson(pointerBytes));
      if (active?.activeVersion === pointer.snapshotVersion) {
        await this.metadata.write({ lastCheckedAt: checkedAt, nextCheckAt: checkedAt + this.intervalMs, activeVersion: active.activeVersion });
        return { status: 'current', checkedAt, activeVersion: active.activeVersion };
      }

      const manifestUrl = resolveSnapshotUrl(this.baseUrl, pointer.manifestPath);
      const manifestBytes = await responseBytes(
        await this.fetchImpl(manifestUrl, { cache: 'no-store', credentials: 'omit', redirect: 'error' }),
        'Snapshot manifest', 2 * 1024 * 1024,
      );
      if (await sha256Hex(manifestBytes) !== pointer.manifestSha256) throw new Error('Remote snapshot manifest checksum mismatch');
      const manifest = parseSnapshotManifestV7(parseJson(manifestBytes), pointer.snapshotVersion);
      const packUrl = resolveSnapshotUrl(new URL('.', manifestUrl).toString(), manifest.pack.path);
      const pack = await responseBytes(
        await this.fetchImpl(packUrl, { cache: 'no-store', credentials: 'omit', redirect: 'error' }),
        'Snapshot pack', manifest.pack.bytes,
      );
      const buckets = await validateAndExtractPack(manifest, pack);
      await this.store.install(manifest, buckets);
      await this.metadata.write({
        lastCheckedAt: checkedAt,
        nextCheckAt: checkedAt + this.intervalMs,
        activeVersion: manifest.snapshotVersion,
      });
      return { status: 'updated', checkedAt, activeVersion: manifest.snapshotVersion };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown snapshot update error';
      await this.metadata.write({
        lastCheckedAt: checkedAt,
        nextCheckAt: checkedAt + this.intervalMs,
        ...(active ? { activeVersion: active.activeVersion } : {}),
        lastError: message,
      });
      return { status: 'failed', checkedAt, ...(active ? { activeVersion: active.activeVersion } : {}), error: message };
    }
  }
}
