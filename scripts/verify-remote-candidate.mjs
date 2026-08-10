import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

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
if (manifest.schema !== 4 || manifest.snapshotVersion !== pointer.snapshotVersion
  || manifest.compression !== 'gzip' || manifest.bucketCount !== 64
  || manifest.pack?.path !== 'snapshot.pack' || manifest.entries?.length !== 128) {
  throw new Error('Manifest does not match snapshot schema v4');
}

const versionDirectory = path.join(candidate, 'versions', pointer.snapshotVersion);
const pack = await readFile(path.join(versionDirectory, 'snapshot.pack'));
if (pack.byteLength !== manifest.pack.bytes || digest(pack) !== manifest.pack.sha256) {
  throw new Error('Snapshot pack checksum or size mismatch');
}

let expectedOffset = 0;
const paths = new Set();
for (const entry of manifest.entries) {
  if (entry.offset !== expectedOffset || entry.compressedBytes < 1
    || entry.offset + entry.compressedBytes > pack.byteLength || paths.has(entry.path)) {
    throw new Error(`Invalid pack entry ${entry.path}`);
  }
  const expectedPath = `${entry.kind}/${entry.name}.${entry.kind === 'title' ? 'json' : 'bin'}.gz`;
  if (!/^[0-3][0-9a-f]$/.test(entry.name) || entry.path !== expectedPath) {
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
    const rows = JSON.parse(uncompressed);
    if (!Array.isArray(rows) || rows.length !== entry.entries) throw new Error(`Invalid title rows in ${entry.path}`);
  }
  expectedOffset += entry.compressedBytes;
}

if (expectedOffset !== pack.byteLength) throw new Error('Pack contains trailing or missing bytes');
console.log(`Verified signed remote snapshot ${pointer.snapshotVersion}: ${manifest.entryCount} records, ${pack.byteLength} bytes`);
