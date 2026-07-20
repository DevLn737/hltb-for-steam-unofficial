import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { verifySnapshot } from './verify-snapshot.mjs';

const root = path.resolve('.output/chrome-mv3');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('Expected Manifest V3');
if (manifest.version !== '2.1.0') throw new Error('Unexpected extension version');
if (manifest.permissions.includes('alarms')) throw new Error('The extension must not use keep-alive alarms');

const required = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.declarative_net_request?.rule_resources ?? []).map((rule) => rule.path),
].filter(Boolean);

for (const relative of required) await access(path.join(root, relative));
await verifySnapshot(path.join(root, 'data/hltb-snapshot'));

async function scan(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await scan(absolute));
    else files.push(absolute);
  }
  return files;
}

const files = await scan(root);
const forbidden = files.find((file) => /fallback-data|scraper|coverage|\.backup/i.test(file));
if (forbidden) throw new Error(`Forbidden legacy artifact in build: ${forbidden}`);
const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
if (totalBytes > 3_500_000) throw new Error(`Extension build is unexpectedly large: ${totalBytes} bytes`);

console.log(`Verified ${files.length} packaged files (${totalBytes} bytes).`);
