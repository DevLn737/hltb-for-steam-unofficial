import { copyFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('.output');
const packageMetadata = JSON.parse(await readFile('package.json', 'utf8'));
const source = path.join(outputDirectory, `${packageMetadata.name}-${packageMetadata.version}-firefox.zip`);
const destination = source.replace(/\.zip$/, '.xpi');
await copyFile(source, destination);
const size = (await stat(destination)).size;
if (size === 0) throw new Error('Firefox XPI is empty');
console.log(`Created ${path.basename(destination)} (${size} bytes).`);
