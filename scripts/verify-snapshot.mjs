import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function verifySnapshot(root = path.resolve('public/data/hltb-snapshot')) {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.bucketCount !== 64 || manifest.buckets?.length !== 64) {
    throw new Error('Invalid HLTB snapshot manifest');
  }
  if (manifest.sourceEntryCount !== 52_518 || manifest.entryCount < 50_000) {
    throw new Error(`Unexpected HLTB snapshot coverage: ${manifest.entryCount}/${manifest.sourceEntryCount}`);
  }

  let entries = 0;
  let bytes = 0;
  const names = new Set();
  for (const bucket of manifest.buckets) {
    if (!/^[0-3][0-9a-f]$/.test(bucket.name) || names.has(bucket.name)) throw new Error(`Invalid snapshot bucket name: ${bucket.name}`);
    names.add(bucket.name);
    const file = path.join(root, `${bucket.name}.json`);
    const content = await readFile(file, 'utf8');
    const rows = JSON.parse(content);
    const checksum = createHash('sha256').update(content).digest('hex');
    if (!Array.isArray(rows) || rows.length !== bucket.entries || checksum !== bucket.sha256 || Buffer.byteLength(content) !== bucket.bytes) {
      throw new Error(`Snapshot bucket ${bucket.name} does not match its manifest`);
    }
    if (rows.some((row) => !Array.isArray(row) || typeof row[0] !== 'string' || row.length < 4)) {
      throw new Error(`Snapshot bucket ${bucket.name} contains an invalid row`);
    }
    entries += rows.length;
    bytes += (await stat(file)).size;
  }
  if (entries !== manifest.entryCount) throw new Error(`Snapshot entry count mismatch: ${entries}`);
  if (bytes > 2_200_000) throw new Error(`Snapshot is unexpectedly large: ${bytes} bytes`);
  return { entries, bytes, collisionCount: manifest.collisionCount };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const result = await verifySnapshot();
  console.log(`Verified HLTB snapshot: ${result.entries} entries (${result.bytes} bytes, ${result.collisionCount} excluded collisions).`);
}
