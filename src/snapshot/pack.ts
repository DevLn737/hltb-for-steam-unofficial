import { decodeSteamIndex } from '../../shared/snapshot-codec.mjs';
import type { SnapshotManifestV4 } from './contracts';
import { sha256Hex } from './crypto';

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const body = new Response(buffer).body;
  if (!body) throw new Error('Unable to create gzip input stream');
  const stream = body.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function validateTitleRows(bytes: Uint8Array, expectedEntries: number): void {
  const rows = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  if (!Array.isArray(rows) || rows.length !== expectedEntries) throw new Error('Invalid title bucket row count');
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 5 || typeof row[0] !== 'string' || !Number.isSafeInteger(row[1])
      || row.slice(2).some((value) => value !== null && (!Number.isInteger(value) || value <= 0))) {
      throw new Error('Invalid title bucket row');
    }
  }
}

export async function validateAndExtractPack(
  manifest: SnapshotManifestV4,
  pack: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  if (pack.byteLength !== manifest.pack.bytes || await sha256Hex(pack) !== manifest.pack.sha256) {
    throw new Error('Remote snapshot pack checksum mismatch');
  }
  const buckets = new Map<string, Uint8Array>();
  for (const entry of manifest.entries) {
    const compressed = pack.slice(entry.offset, entry.offset + entry.compressedBytes);
    if (compressed.byteLength !== entry.compressedBytes || await sha256Hex(compressed) !== entry.sha256) {
      throw new Error(`Remote snapshot bucket checksum mismatch: ${entry.path}`);
    }
    const raw = await decompressGzip(compressed);
    if (raw.byteLength !== entry.uncompressedBytes || await sha256Hex(raw) !== entry.uncompressedSha256) {
      throw new Error(`Remote snapshot uncompressed checksum mismatch: ${entry.path}`);
    }
    if (entry.kind === 'title') validateTitleRows(raw, entry.entries);
    else if (decodeSteamIndex(raw).length !== entry.entries) throw new Error(`Invalid Steam bucket ${entry.path}`);
    buckets.set(entry.path, compressed);
  }
  return buckets;
}
