import { copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('.output');
const candidates = (await readdir(outputDirectory))
  .filter((name) => name.endsWith('-firefox.zip') && !name.includes('-sources'));

if (candidates.length !== 1) {
  throw new Error(`Expected one Firefox ZIP, found: ${candidates.join(', ') || 'none'}`);
}

const source = path.join(outputDirectory, candidates[0]);
const destination = source.replace(/\.zip$/, '.xpi');
await copyFile(source, destination);
const size = (await stat(destination)).size;
if (size === 0) throw new Error('Firefox XPI is empty');
console.log(`Created ${path.basename(destination)} (${size} bytes).`);
