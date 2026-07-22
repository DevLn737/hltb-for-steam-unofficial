import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { decodeSteamIndex, unpackSnapshotLocation } from '../shared/snapshot-codec.mjs';
import { normalizeTitle, snapshotBucket } from '../shared/title-normalization.mjs';

const EXPECTED = {
  sourceBytes: 755_986_614,
  sourceEntries: 171_889,
  timedEntries: 58_820,
  normalizedTitles: 58_131,
  titleCollisions: 604,
  titleCollisionRecords: 1_293,
  steamMappings: 34_245,
  steamCollisions: 182,
  lastGameId: 189_049,
};

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateBucketInfo(info, name, compressed, raw) {
  if (info.name !== name
    || info.compressedBytes !== compressed.length
    || info.uncompressedBytes !== raw.length
    || info.sha256 !== digest(compressed)
    || info.uncompressedSha256 !== digest(raw)) {
    throw new Error(`Snapshot bucket ${name} does not match its manifest`);
  }
}

export async function verifySnapshot(root = path.resolve('public/data/hltb-snapshot')) {
  const packagedFiles = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort();
  const allowedFiles = [
    'manifest.json',
    ...Array.from({ length: 64 }, (_, index) => `steam/${index.toString(16).padStart(2, '0')}.bin.gz`),
    ...Array.from({ length: 64 }, (_, index) => `title/${index.toString(16).padStart(2, '0')}.json.gz`),
  ].sort();
  if (JSON.stringify(packagedFiles) !== JSON.stringify(allowedFiles)) {
    throw new Error('Snapshot contains missing or forbidden files');
  }

  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 2 || manifest.compression !== 'gzip' || manifest.bucketCount !== 64
    || manifest.titleBuckets?.length !== 64 || manifest.steamBuckets?.length !== 64) {
    throw new Error('Invalid HLTB snapshot v2 manifest');
  }
  if (manifest.source?.bytes !== EXPECTED.sourceBytes
    || manifest.source?.lastGameId !== EXPECTED.lastGameId
    || !/^[a-f0-9]{64}$/.test(manifest.source?.sha256 ?? '')
    || manifest.sourceEntryCount !== EXPECTED.sourceEntries
    || manifest.timedEntryCount !== EXPECTED.timedEntries
    || manifest.entryCount !== EXPECTED.timedEntries
    || manifest.normalizedTitleCount !== EXPECTED.normalizedTitles
    || manifest.titleCollisionCount !== EXPECTED.titleCollisions
    || manifest.titleCollisionRecordCount !== EXPECTED.titleCollisionRecords
    || manifest.steamMappingCount !== EXPECTED.steamMappings
    || manifest.steamCollisionCount !== EXPECTED.steamCollisions) {
    throw new Error('Unexpected HLTB snapshot coverage');
  }

  const titleRows = [];
  const normalizedCounts = new Map();
  let entries = 0;
  let compressedBytes = 0;
  for (let index = 0; index < 64; index += 1) {
    const name = index.toString(16).padStart(2, '0');
    const info = manifest.titleBuckets[index];
    const compressed = await readFile(path.join(root, 'title', `${name}.json.gz`));
    const raw = gunzipSync(compressed);
    validateBucketInfo(info, name, compressed, raw);
    const rows = JSON.parse(raw.toString('utf8'));
    if (!Array.isArray(rows) || rows.length !== info.entries || rows.length > 0xffff) throw new Error(`Invalid title bucket ${name}`);
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 5 || typeof row[0] !== 'string' || !Number.isSafeInteger(row[1])
        || row.slice(2).some((value) => value !== null && (!Number.isInteger(value) || value <= 0))) {
        throw new Error(`Invalid title row in bucket ${name}`);
      }
      const normalized = normalizeTitle(row[0]);
      if (snapshotBucket(normalized) !== index) throw new Error(`Misplaced title row in bucket ${name}`);
      normalizedCounts.set(normalized, (normalizedCounts.get(normalized) ?? 0) + 1);
    }
    titleRows[index] = rows;
    entries += rows.length;
    compressedBytes += (await stat(path.join(root, 'title', `${name}.json.gz`))).size;
  }

  let steamMappings = 0;
  for (let index = 0; index < 64; index += 1) {
    const name = index.toString(16).padStart(2, '0');
    const info = manifest.steamBuckets[index];
    const compressed = await readFile(path.join(root, 'steam', `${name}.bin.gz`));
    const raw = gunzipSync(compressed);
    validateBucketInfo(info, name, compressed, raw);
    const pairs = decodeSteamIndex(raw);
    if (pairs.length !== info.entries) throw new Error(`Invalid Steam bucket ${name}`);
    for (const [appId, location] of pairs) {
      if (appId % 64 !== index) throw new Error(`Misplaced Steam App ID ${appId}`);
      const target = unpackSnapshotLocation(location);
      if (!titleRows[target.bucket]?.[target.rowIndex]) throw new Error(`Invalid Steam target for App ID ${appId}`);
    }
    steamMappings += pairs.length;
    compressedBytes += (await stat(path.join(root, 'steam', `${name}.bin.gz`))).size;
  }

  const collisions = [...normalizedCounts.values()].filter((count) => count > 1);
  if (entries !== manifest.entryCount || steamMappings !== manifest.steamMappingCount
    || collisions.length !== manifest.titleCollisionCount
    || collisions.reduce((total, count) => total + count, 0) !== manifest.titleCollisionRecordCount) {
    throw new Error('Snapshot cross-reference count mismatch');
  }
  if (compressedBytes > 1_600_000) throw new Error(`Snapshot is unexpectedly large: ${compressedBytes} bytes`);
  return { entries, compressedBytes, steamMappings, collisionCount: collisions.length };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await verifySnapshot();
  console.log(`Verified HLTB snapshot v2: ${result.entries} games, ${result.steamMappings} Steam mappings (${result.compressedBytes} bytes).`);
}
