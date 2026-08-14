import { decodeSteamIndex, decodeTitleBucket, unpackSnapshotLocation } from '../../shared/snapshot-codec.mjs';
import { compareNormalizedTitles, normalizeTitle, snapshotBucket } from '../../shared/title-normalization.mjs';
import type { SnapshotTitleRow } from '../../shared/snapshot-codec.mjs';
import type { SnapshotManifestV7 } from './contracts';
import { sha256Hex } from './crypto';

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const body = new Response(buffer).body;
  if (!body) throw new Error('Unable to create gzip input stream');
  const stream = body.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function validateAndExtractPack(
  manifest: SnapshotManifestV7,
  pack: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  if (pack.byteLength !== manifest.pack.bytes || await sha256Hex(pack) !== manifest.pack.sha256) {
    throw new Error('Remote snapshot pack checksum mismatch');
  }
  const compressedBuckets = new Map<string, Uint8Array>();
  const rawBuckets = new Map<string, Uint8Array>();
  for (const entry of manifest.entries) {
    const compressed = pack.slice(entry.offset, entry.offset + entry.compressedBytes);
    if (compressed.byteLength !== entry.compressedBytes || await sha256Hex(compressed) !== entry.sha256) {
      throw new Error(`Remote snapshot bucket checksum mismatch: ${entry.path}`);
    }
    const raw = await decompressGzip(compressed);
    if (raw.byteLength !== entry.uncompressedBytes || await sha256Hex(raw) !== entry.uncompressedSha256) {
      throw new Error(`Remote snapshot uncompressed checksum mismatch: ${entry.path}`);
    }
    compressedBuckets.set(entry.path, compressed);
    rawBuckets.set(entry.path, raw);
  }

  const titleRows = new Map<number, SnapshotTitleRow[]>();
  let timedEntries = 0;
  for (const entry of manifest.entries.filter((candidate) => candidate.kind === 'title')) {
    const raw = rawBuckets.get(entry.path)!;
    const rows = decodeTitleBucket(raw);
    if (rows.length !== entry.entries) throw new Error(`Invalid title bucket ${entry.path}`);
    const bucket = Number.parseInt(entry.name, 16);
    let previous = '';
    let previousGameId = 0;
    for (const row of rows) {
      const normalized = normalizeTitle(row[0]);
      if (snapshotBucket(normalized, manifest.bucketCount) !== bucket
        || compareNormalizedTitles(normalized, previous) < 0
        || (normalized === previous && row[1] <= previousGameId)) {
        throw new Error(`Invalid title ordering in ${entry.path}`);
      }
      previous = normalized;
      previousGameId = row[1];
      if (row.slice(2, 5).some((value) => value !== null)) timedEntries += 1;
    }
    titleRows.set(bucket, rows);
  }
  if (timedEntries !== manifest.timedEntryCount) throw new Error('Remote snapshot timed-entry count mismatch');

  let steamMappings = 0;
  for (const entry of manifest.entries.filter((candidate) => candidate.kind === 'steam')) {
    const pairs = decodeSteamIndex(rawBuckets.get(entry.path)!);
    if (pairs.length !== entry.entries) throw new Error(`Invalid Steam bucket ${entry.path}`);
    const bucket = Number.parseInt(entry.name, 16);
    for (const [appId, location] of pairs) {
      const target = unpackSnapshotLocation(location);
      if (appId % manifest.bucketCount !== bucket || target.bucket >= manifest.bucketCount
        || !titleRows.get(target.bucket)?.[target.rowIndex]) {
        throw new Error(`Invalid Steam cross-reference in ${entry.path}`);
      }
    }
    steamMappings += pairs.length;
  }
  if (steamMappings !== manifest.steamMappingCount) throw new Error('Remote snapshot Steam mapping count mismatch');
  return compressedBuckets;
}
