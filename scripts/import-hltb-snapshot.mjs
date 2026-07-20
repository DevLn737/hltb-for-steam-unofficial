import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSnapshot, sha256 } from './snapshot-lib.mjs';

const sourceArgument = process.argv[2] ?? 'upstream/master:src/background/services/fallback-data.json';
const outputDirectory = path.resolve('public/data/hltb-snapshot');
const overridesPath = path.resolve('data/snapshot-overrides.json');

async function readSource(argument) {
  if (!argument.includes(':') && argument.endsWith('.json')) return JSON.parse(await readFile(path.resolve(argument), 'utf8'));
  const content = execFileSync('git', ['show', argument], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(content);
}

const [source, overrides] = await Promise.all([
  readSource(sourceArgument),
  readFile(overridesPath, 'utf8').then(JSON.parse),
]);
const snapshot = buildSnapshot(source, overrides);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const bucketMetadata = [];
for (let index = 0; index < snapshot.buckets.length; index += 1) {
  const name = index.toString(16).padStart(2, '0');
  const content = JSON.stringify(snapshot.buckets[index]);
  await writeFile(path.join(outputDirectory, `${name}.json`), content);
  bucketMetadata.push({ name, entries: snapshot.buckets[index].length, bytes: Buffer.byteLength(content), sha256: sha256(content) });
}

const manifest = { ...snapshot.metadata, buckets: bucketMetadata };
await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(outputDirectory, 'collisions.json'), `${JSON.stringify(snapshot.collisions, null, 2)}\n`);

const totalBytes = bucketMetadata.reduce((total, bucket) => total + bucket.bytes, 0);
console.log(`Generated ${manifest.entryCount} entries in ${manifest.bucketCount} buckets (${totalBytes} bytes, ${manifest.collisionCount} excluded collisions).`);
