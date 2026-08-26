import { createHash, createPublicKey, verify } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { verifySnapshot } from './verify-snapshot.mjs';

const baseUrl = new URL(process.argv[2] ?? 'https://devln737.github.io/hltb-for-steam-data/');
const target = path.resolve('public/data/hltb-snapshot');
const temporary = path.resolve('public/data', `.hltb-snapshot.next-${process.pid}`);
const backup = path.resolve('public/data', `.hltb-snapshot.backup-${process.pid}`);
const publicKey = createPublicKey({
  key: {
    kty: 'EC',
    crv: 'P-256',
    x: 'DoAI6ekg6mzGS-JV1--swocaIj5dirgUWQXQpT1-H2w',
    y: '8_cDANXlU-7HNIdwVS4qrFqUlEiQ4sOnzfi2T_-9JGQ',
    ext: true,
  },
  format: 'jwk',
});

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function download(relativePath) {
  const response = await fetch(new URL(relativePath, baseUrl));
  if (!response.ok) throw new Error(`Unable to download ${relativePath} (HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

function bucketInfo(entry) {
  return {
    name: entry.name,
    entries: entry.entries,
    compressedBytes: entry.compressedBytes,
    uncompressedBytes: entry.uncompressedBytes,
    sha256: entry.sha256,
    uncompressedSha256: entry.uncompressedSha256,
  };
}

await rm(temporary, { recursive: true, force: true });
await rm(backup, { recursive: true, force: true });

try {
  const stableBytes = await download('stable.json');
  const signature = Buffer.from((await download('stable.sig')).toString('utf8').trim(), 'base64');
  if (signature.byteLength !== 64 || !verify('sha256', stableBytes, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)) {
    throw new Error('Remote snapshot pointer signature is invalid');
  }

  const pointer = JSON.parse(stableBytes);
  if (pointer.schema !== 1 || !/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(pointer.snapshotVersion)
    || pointer.manifestPath !== `versions/${pointer.snapshotVersion}/manifest.json`
    || !/^[a-f0-9]{64}$/.test(pointer.manifestSha256)) {
    throw new Error('Remote snapshot pointer has an invalid schema');
  }

  const manifestBytes = await download(pointer.manifestPath);
  if (digest(manifestBytes) !== pointer.manifestSha256) throw new Error('Remote snapshot manifest checksum mismatch');
  const manifest = JSON.parse(manifestBytes);
  if (manifest.schema !== 7 || manifest.snapshotVersion !== pointer.snapshotVersion
    || manifest.format !== 'front-coded-uleb128-delta-v3' || manifest.compression !== 'gzip'
    || manifest.bucketCount !== 16 || manifest.pack?.path !== 'snapshot.pack'
    || !Array.isArray(manifest.entries) || manifest.entries.length !== 32) {
    throw new Error('Remote snapshot manifest is incompatible');
  }

  const packPath = `versions/${pointer.snapshotVersion}/${manifest.pack.path}`;
  const pack = await download(packPath);
  if (pack.byteLength !== manifest.pack.bytes || digest(pack) !== manifest.pack.sha256) {
    throw new Error('Remote snapshot pack checksum or size mismatch');
  }

  await mkdir(path.join(temporary, 'title'), { recursive: true });
  await mkdir(path.join(temporary, 'steam'), { recursive: true });
  const sortedEntries = [...manifest.entries].sort((left, right) => left.offset - right.offset);
  let expectedOffset = 0;
  const paths = new Set();
  for (const entry of sortedEntries) {
    const expectedPath = `${entry.kind}/${entry.name}.bin.gz`;
    if ((entry.kind !== 'title' && entry.kind !== 'steam') || !/^[0-9a-f]$/.test(entry.name)
      || entry.path !== expectedPath || paths.has(entry.path) || entry.offset !== expectedOffset
      || !Number.isSafeInteger(entry.compressedBytes) || entry.compressedBytes < 1) {
      throw new Error(`Invalid remote snapshot entry ${entry.path}`);
    }
    const compressed = pack.subarray(entry.offset, entry.offset + entry.compressedBytes);
    if (compressed.byteLength !== entry.compressedBytes || digest(compressed) !== entry.sha256) {
      throw new Error(`Compressed checksum mismatch for ${entry.path}`);
    }
    const uncompressed = gunzipSync(compressed);
    if (uncompressed.byteLength !== entry.uncompressedBytes || digest(uncompressed) !== entry.uncompressedSha256) {
      throw new Error(`Uncompressed checksum mismatch for ${entry.path}`);
    }
    await writeFile(path.join(temporary, ...entry.path.split('/')), compressed);
    paths.add(entry.path);
    expectedOffset += entry.compressedBytes;
  }
  if (expectedOffset !== pack.byteLength || paths.size !== 32) throw new Error('Remote snapshot pack layout is invalid');

  const packagedManifest = {
    schema: 7,
    format: 'front-coded-uleb128-delta-v3',
    compression: 'gzip',
    sourceUpdatedAt: manifest.sourceUpdatedAt,
    baselineUpdatedAt: manifest.baselineUpdatedAt,
    checkedDates: manifest.checkedDates,
    sourceEntryCount: manifest.sourceEntryCount,
    timedEntryCount: manifest.timedEntryCount,
    entryCount: manifest.entryCount,
    originalEntryCount: manifest.originalEntryCount,
    excludedEntryCount: manifest.excludedEntryCount,
    normalizedTitleCount: manifest.normalizedTitleCount,
    titleCollisionCount: manifest.titleCollisionCount,
    titleCollisionRecordCount: manifest.titleCollisionRecordCount,
    steamMappingCount: manifest.steamMappingCount,
    steamCollisionCount: manifest.steamCollisionCount,
    bucketCount: 16,
    origin: `${manifest.origin}; packaged from signed snapshot ${manifest.snapshotVersion}`,
    titleBuckets: sortedEntries.filter((entry) => entry.kind === 'title').map(bucketInfo),
    steamBuckets: sortedEntries.filter((entry) => entry.kind === 'steam').map(bucketInfo),
  };
  await writeFile(path.join(temporary, 'snapshot.json'), `${JSON.stringify(packagedManifest, null, 2)}\n`, 'utf8');
  const verified = await verifySnapshot(temporary);

  await rename(target, backup);
  try {
    await rename(temporary, target);
  } catch (error) {
    await rename(backup, target);
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
  console.log(`Installed signed snapshot ${manifest.snapshotVersion}: ${verified.entries} games, ${verified.steamMappings} Steam mappings (${verified.compressedBytes} bytes).`);
} finally {
  await rm(temporary, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
}
