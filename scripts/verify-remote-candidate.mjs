import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { decodeSteamIndex, decodeTitleBucket, unpackSnapshotLocation } from '../shared/snapshot-codec.mjs';
import { compareNormalizedTitles, normalizeTitle, snapshotBucket } from '../shared/title-normalization.mjs';
const [candidateArgument, publicKeyArgument] = process.argv.slice(2);
if (!candidateArgument || !publicKeyArgument) {
  throw new Error('Usage: npm run verify:remote-candidate -- <candidate-directory> <public-jwk.json>');
}

const candidate = path.resolve(candidateArgument);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stableBytes = await readFile(path.join(candidate, 'stable.json'));
const signature = Buffer.from((await readFile(path.join(candidate, 'stable.sig'), 'utf8')).trim(), 'base64');
if (signature.byteLength !== 64) throw new Error('stable.sig must contain an ECDSA P-256 P1363 signature');

const publicJwk = JSON.parse(await readFile(path.resolve(publicKeyArgument), 'utf8'));
const publicKey = createPublicKey({ key: publicJwk, format: 'jwk' });
if (!verify('sha256', stableBytes, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)) {
  throw new Error('stable.json signature is invalid');
}

const pointer = JSON.parse(stableBytes);
if (pointer.schema !== 1 || typeof pointer.snapshotVersion !== 'string'
  || pointer.manifestPath !== `versions/${pointer.snapshotVersion}/manifest.json`
  || !/^[a-f0-9]{64}$/.test(pointer.manifestSha256)) {
  throw new Error('stable.json does not match the fixed pointer schema');
}

const manifestBytes = await readFile(path.join(candidate, ...pointer.manifestPath.split('/')));
if (digest(manifestBytes) !== pointer.manifestSha256) throw new Error('Manifest hash mismatch');
const manifest = JSON.parse(manifestBytes);
if (manifest.schema !== 7 || manifest.snapshotVersion !== pointer.snapshotVersion
  || manifest.format !== 'front-coded-uleb128-delta-v3' || manifest.compression !== 'gzip' || manifest.bucketCount !== 16
  || manifest.pack?.path !== 'snapshot.pack' || manifest.entries?.length !== 32) {
  throw new Error('Manifest does not match snapshot schema v7');
}

const versionDirectory = path.join(candidate, 'versions', pointer.snapshotVersion);
const pack = await readFile(path.join(versionDirectory, 'snapshot.pack'));
if (pack.byteLength !== manifest.pack.bytes || digest(pack) !== manifest.pack.sha256) {
  throw new Error('Snapshot pack checksum or size mismatch');
}

let expectedOffset = 0;
const paths = new Set();
const titleRows = new Map();
let timedEntries = 0;
for (const entry of manifest.entries) {
  if ((entry.kind !== 'title' && entry.kind !== 'steam') || entry.offset !== expectedOffset || entry.compressedBytes < 1
    || entry.offset + entry.compressedBytes > pack.byteLength || paths.has(entry.path)) {
    throw new Error(`Invalid pack entry ${entry.path}`);
  }
  const expectedPath = `${entry.kind}/${entry.name}.bin.gz`;
  if (!/^[0-9a-f]$/.test(entry.name) || entry.path !== expectedPath) {
    throw new Error(`Unexpected pack path ${entry.path}`);
  }
  paths.add(entry.path);
  const compressed = pack.subarray(entry.offset, entry.offset + entry.compressedBytes);
  if (digest(compressed) !== entry.sha256) throw new Error(`Compressed checksum mismatch for ${entry.path}`);
  const uncompressed = gunzipSync(compressed);
  if (uncompressed.byteLength !== entry.uncompressedBytes || digest(uncompressed) !== entry.uncompressedSha256) {
    throw new Error(`Uncompressed checksum or size mismatch for ${entry.path}`);
  }
  if (entry.kind === 'title') {
    const rows = decodeTitleBucket(uncompressed);
    if (rows.length !== entry.entries) throw new Error(`Invalid title rows in ${entry.path}`);
    const bucket = Number.parseInt(entry.name, 16);
    let previous = '';
    let previousGameId = 0;
    for (const row of rows) {
      const normalized = normalizeTitle(row[0]);
      if (snapshotBucket(normalized, 16) !== bucket
        || compareNormalizedTitles(normalized, previous) < 0
        || (normalized === previous && row[1] <= previousGameId)) {
        throw new Error(`Invalid title ordering in ${entry.path}`);
      }
      previous = normalized;
      previousGameId = row[1];
      if (row.slice(2, 5).some((value) => value !== null)) timedEntries += 1;
    }
    titleRows.set(bucket, rows);
  } else {
    const pairs = decodeSteamIndex(uncompressed);
    if (pairs.length !== entry.entries) throw new Error(`Invalid Steam index in ${entry.path}`);
    const bucket = Number.parseInt(entry.name, 16);
    for (const [appId, location] of pairs) {
      const target = unpackSnapshotLocation(location);
      if (appId % 16 !== bucket || target.bucket >= 16 || !titleRows.get(target.bucket)?.[target.rowIndex]) {
        throw new Error(`Invalid Steam cross-reference in ${entry.path}`);
      }
    }
  }
  expectedOffset += entry.compressedBytes;
}

if (expectedOffset !== pack.byteLength || paths.size !== 32) throw new Error('Pack contains trailing or missing bytes');
if (timedEntries !== manifest.timedEntryCount) throw new Error('Snapshot timed-entry count mismatch');
console.log(`Verified signed remote snapshot ${pointer.snapshotVersion}: ${manifest.entryCount} records, ${pack.byteLength} bytes`);

