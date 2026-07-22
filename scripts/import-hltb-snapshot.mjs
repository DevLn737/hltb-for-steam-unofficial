import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { buildSnapshot, sha256 } from './snapshot-lib.mjs';
import { readSnapshotSource } from './snapshot-source.mjs';
import { verifySnapshot } from './verify-snapshot.mjs';

const sourceArgument = process.argv[2];
if (!sourceArgument) throw new Error('Usage: npm run snapshot:import -- <path-to-hltb_data.json>');

const sourcePath = path.resolve(sourceArgument);
const outputDirectory = path.resolve('public/data/hltb-snapshot');
const temporaryDirectory = path.resolve(`public/data/.hltb-snapshot-${process.pid}`);
const previousDirectory = path.resolve('public/data/.hltb-snapshot-previous');
const reportDirectory = path.resolve('data/snapshot-reports');
const overridesPath = path.resolve('data/snapshot-overrides.json');

const source = await readSnapshotSource(sourcePath);
const { records, sourceEntryCount, lastGameId, sourceSha256: digest } = source;

const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));
const snapshot = buildSnapshot(records, overrides);
const sourceUpdatedAt = new Date(source.sourceMtimeMs).toISOString().slice(0, 10);

await rm(temporaryDirectory, { recursive: true, force: true });
await mkdir(path.join(temporaryDirectory, 'title'), { recursive: true });
await mkdir(path.join(temporaryDirectory, 'steam'), { recursive: true });

function bucketInfo(name, entries, raw, compressed) {
  return {
    name,
    entries,
    compressedBytes: compressed.length,
    uncompressedBytes: raw.length,
    sha256: sha256(compressed),
    uncompressedSha256: sha256(raw),
  };
}

const titleBuckets = [];
const steamBuckets = [];
for (let index = 0; index < snapshot.titleBuckets.length; index += 1) {
  const name = index.toString(16).padStart(2, '0');
  const titleRaw = Buffer.from(JSON.stringify(snapshot.titleBuckets[index]));
  const titleCompressed = gzipSync(titleRaw, { level: 9, mtime: 0 });
  await writeFile(path.join(temporaryDirectory, 'title', `${name}.json.gz`), titleCompressed);
  titleBuckets.push(bucketInfo(name, snapshot.titleBuckets[index].length, titleRaw, titleCompressed));

  const steamRaw = Buffer.from(snapshot.steamBuckets[index]);
  const steamCompressed = gzipSync(steamRaw, { level: 9, mtime: 0 });
  await writeFile(path.join(temporaryDirectory, 'steam', `${name}.bin.gz`), steamCompressed);
  steamBuckets.push(bucketInfo(name, snapshot.steamBucketEntryCounts[index], steamRaw, steamCompressed));
}

const manifest = {
  ...snapshot.metadata,
  sourceUpdatedAt,
  source: {
    bytes: source.sourceBytes,
    sha256: digest,
    lastGameId,
  },
  sourceEntryCount,
  timedEntryCount: records.length,
  titleBuckets,
  steamBuckets,
};
await writeFile(path.join(temporaryDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// Validate every checksum and cross-reference before replacing the packaged snapshot.
await verifySnapshot(temporaryDirectory);
await rm(previousDirectory, { recursive: true, force: true });
try {
  await rename(outputDirectory, previousDirectory);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
try {
  await rename(temporaryDirectory, outputDirectory);
  await rm(previousDirectory, { recursive: true, force: true });
} catch (error) {
  try { await rename(previousDirectory, outputDirectory); } catch { /* Keep the original error. */ }
  throw error;
}

await mkdir(reportDirectory, { recursive: true });
await writeFile(path.join(reportDirectory, 'collisions.json'), `${JSON.stringify({
  generatedAt: sourceUpdatedAt,
  sourceSha256: digest,
  titleCollisions: snapshot.titleCollisions,
}, null, 2)}\n`);

const compressedBytes = [...titleBuckets, ...steamBuckets].reduce((total, bucket) => total + bucket.compressedBytes, 0);
console.log(`Generated schema v2: ${manifest.entryCount} timed games from ${sourceEntryCount} records (${compressedBytes} compressed bytes).`);
