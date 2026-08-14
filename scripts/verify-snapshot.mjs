import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { decodeSteamIndex, decodeTitleBucket, unpackSnapshotLocation } from '../shared/snapshot-codec.mjs';
import { compareNormalizedTitles, normalizeTitle, snapshotBucket } from '../shared/title-normalization.mjs';
const EXPECTED = {
  sourceBytes: 755_986_614,
  sourceEntries: 171_889,
  originalEntries: 171_888,
  timedEntries: 58_820,
  steamMappings: 58_288,
  lastGameId: 189_049,
};

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateBucketInfo(info, name, compressed, raw) {
  if (info.name !== name || info.compressedBytes !== compressed.length || info.uncompressedBytes !== raw.length
    || info.sha256 !== digest(compressed) || info.uncompressedSha256 !== digest(raw)) {
    throw new Error(`Snapshot bucket ${name} does not match its manifest`);
  }
}

export async function verifySnapshot(root = path.resolve('public/data/hltb-snapshot')) {
  const names = Array.from({ length: 16 }, (_, index) => index.toString(16));
  const packagedFiles = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort();
  const allowedFiles = ['snapshot.json', ...names.map((name) => `steam/${name}.bin.gz`), ...names.map((name) => `title/${name}.bin.gz`)].sort();
  if (JSON.stringify(packagedFiles) !== JSON.stringify(allowedFiles)) throw new Error('Snapshot contains missing or forbidden files');

  const manifest = JSON.parse(await readFile(path.join(root, 'snapshot.json'), 'utf8'));
  if (manifest.schema !== 7 || manifest.format !== 'front-coded-uleb128-delta-v3' || manifest.compression !== 'gzip'
    || manifest.bucketCount !== 16 || manifest.titleBuckets?.length !== 16 || manifest.steamBuckets?.length !== 16) {
    throw new Error('Invalid HLTB snapshot v7 manifest');
  }
  if (!Array.isArray(manifest.checkedDates) || manifest.checkedDates.length === 0
    || manifest.checkedDates.some((date, index) => typeof date !== 'string' || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
      || (index > 0 && date <= manifest.checkedDates[index - 1]))) throw new Error('Invalid HLTB snapshot checked dates');
  if (manifest.source?.bytes !== EXPECTED.sourceBytes || manifest.source?.lastGameId !== EXPECTED.lastGameId
    || !/^[a-f0-9]{64}$/.test(manifest.source?.sha256 ?? '') || manifest.sourceEntryCount !== EXPECTED.sourceEntries
    || manifest.originalEntryCount !== EXPECTED.originalEntries || manifest.timedEntryCount !== EXPECTED.timedEntries
    || manifest.steamMappingCount !== EXPECTED.steamMappings
    || manifest.entryCount + manifest.excludedEntryCount !== manifest.originalEntryCount) {
    throw new Error('Unexpected HLTB snapshot coverage');
  }

  const titleRows = [];
  const normalizedCounts = new Map();
  let entries = 0;
  let timedEntries = 0;
  let compressedBytes = 0;
  for (let index = 0; index < 16; index += 1) {
    const name = names[index];
    const compressed = await readFile(path.join(root, 'title', `${name}.bin.gz`));
    const raw = gunzipSync(compressed);
    const info = manifest.titleBuckets[index];
    validateBucketInfo(info, name, compressed, raw);
    const rows = decodeTitleBucket(raw);
    if (rows.length !== info.entries || rows.length > 0xffff) throw new Error(`Invalid title bucket ${name}`);
    let previous = '';
    let previousGameId = 0;
    for (const row of rows) {
      const normalized = normalizeTitle(row[0]);
      // Symbol-only HLTB titles normalize to an empty key. They remain valid for
      // Steam App ID lookup, but runtime title fallback deliberately ignores them.
      if (snapshotBucket(normalized, 16) !== index) throw new Error(`Misplaced title row in bucket ${name}`);
      if (compareNormalizedTitles(normalized, previous) < 0 || (normalized === previous && row[1] <= previousGameId)) {
        throw new Error(`Unsorted title row in bucket ${name}`);
      }
      previous = normalized;
      previousGameId = row[1];
      if (!Number.isSafeInteger(row[5]) || row[5] < 0 || row[5] >= manifest.checkedDates.length) throw new Error(`Invalid checked date in bucket ${name}`);
      normalizedCounts.set(normalized, (normalizedCounts.get(normalized) ?? 0) + 1);
      if (row.slice(2, 5).some((value) => value !== null)) timedEntries += 1;
    }
    titleRows[index] = rows;
    entries += rows.length;
    compressedBytes += compressed.length;
  }

  let steamMappings = 0;
  for (let index = 0; index < 16; index += 1) {
    const name = names[index];
    const compressed = await readFile(path.join(root, 'steam', `${name}.bin.gz`));
    const raw = gunzipSync(compressed);
    const info = manifest.steamBuckets[index];
    validateBucketInfo(info, name, compressed, raw);
    const pairs = decodeSteamIndex(raw);
    if (pairs.length !== info.entries) throw new Error(`Invalid Steam bucket ${name}`);
    for (const [appId, location] of pairs) {
      if (appId % 16 !== index) throw new Error(`Misplaced Steam App ID ${appId}`);
      const target = unpackSnapshotLocation(location);
      if (target.bucket >= 16 || !titleRows[target.bucket]?.[target.rowIndex]) throw new Error(`Invalid Steam target for App ID ${appId}`);
    }
    steamMappings += pairs.length;
    compressedBytes += compressed.length;
  }

  const collisions = [...normalizedCounts.values()].filter((count) => count > 1);
  if (entries !== manifest.entryCount || timedEntries !== manifest.timedEntryCount || steamMappings !== manifest.steamMappingCount
    || normalizedCounts.size !== manifest.normalizedTitleCount || collisions.length !== manifest.titleCollisionCount
    || collisions.reduce((total, count) => total + count, 0) !== manifest.titleCollisionRecordCount) {
    throw new Error('Snapshot cross-reference count mismatch');
  }
  if (compressedBytes > 1_750_000) throw new Error(`Snapshot is unexpectedly large: ${compressedBytes} bytes`);
  return { entries, compressedBytes, steamMappings, collisionCount: collisions.length };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await verifySnapshot();
  console.log(`Verified HLTB snapshot v7: ${result.entries} games, ${result.steamMappings} Steam mappings (${result.compressedBytes} bytes).`);
}

