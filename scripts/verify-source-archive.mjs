import { readFile } from 'node:fs/promises';
import path from 'node:path';

const packageMetadata = JSON.parse(await readFile('package.json', 'utf8'));
const archivePath = path.resolve(
  '.output',
  `${packageMetadata.name}-${packageMetadata.version}-sources.zip`,
);
const archive = await readFile(archivePath);

const endSignature = 0x06054b50;
const centralSignature = 0x02014b50;
const minimumEndOffset = Math.max(0, archive.length - 65_557);
let endOffset = -1;

for (let offset = archive.length - 22; offset >= minimumEndOffset; offset -= 1) {
  if (archive.readUInt32LE(offset) === endSignature) {
    endOffset = offset;
    break;
  }
}

if (endOffset < 0) throw new Error('Source archive has no ZIP end-of-central-directory record');

const entryCount = archive.readUInt16LE(endOffset + 10);
const centralSize = archive.readUInt32LE(endOffset + 12);
const centralOffset = archive.readUInt32LE(endOffset + 16);
if (centralOffset + centralSize > endOffset) throw new Error('Source archive central directory is invalid');

const entries = [];
let cursor = centralOffset;
for (let index = 0; index < entryCount; index += 1) {
  if (archive.readUInt32LE(cursor) !== centralSignature) {
    throw new Error(`Invalid central-directory entry at byte ${cursor}`);
  }

  const nameLength = archive.readUInt16LE(cursor + 28);
  const extraLength = archive.readUInt16LE(cursor + 30);
  const commentLength = archive.readUInt16LE(cursor + 32);
  const nameStart = cursor + 46;
  const name = archive.subarray(nameStart, nameStart + nameLength).toString('utf8').replaceAll('\\', '/');
  entries.push(name);
  cursor = nameStart + nameLength + extraLength + commentLength;
}

const forbidden = [
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)\.git(?:\/|$)/,
  /(^|\/)\.output(?:\/|$)/,
  /(^|\/)data\/snapshot-reports(?:\/|$)/,
  /(^|\/)hltb_data\.json$/,
  /(^|\/)live-smoke(?:\/|$)/,
  /(^|\/)node_modules(?:\/|$)/,
  /(^|\/)steam-debug-logs(?:\/|$)/,
  /\.(?:crx|key|log|pem|xpi)$/i,
];

for (const entry of entries) {
  if (entry.startsWith('/') || entry.split('/').includes('..')) {
    throw new Error(`Unsafe source archive path: ${entry}`);
  }
  if (forbidden.some((pattern) => pattern.test(entry))) {
    throw new Error(`Forbidden source archive entry: ${entry}`);
  }
}

for (const required of [
  'package.json',
  'package-lock.json',
  'SOURCE_BUILD.md',
  'wxt.config.ts',
  'entrypoints/background.ts',
  'src/background/game-times-service.ts',
  'public/data/hltb-snapshot/manifest.json',
]) {
  if (!entries.includes(required)) throw new Error(`Missing required source archive entry: ${required}`);
}

console.log(`Verified clean reviewer source archive: ${entries.length} entries (${archive.length} bytes).`);
