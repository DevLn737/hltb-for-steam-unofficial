import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { verifySnapshot } from './verify-snapshot.mjs';

const root = path.resolve('.output/firefox-mv3');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const packageManifest = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'));

if (manifest.manifest_version !== 3) throw new Error('Expected Firefox Manifest V3');
if (manifest.version !== packageManifest.version) throw new Error('Unexpected Firefox extension version');
if (manifest.default_locale !== 'en'
  || manifest.name !== '__MSG_extensionName__'
  || manifest.description !== '__MSG_extensionDescription__') {
  throw new Error('Firefox manifest localization is incomplete');
}
if (manifest.browser_specific_settings?.gecko?.id !== 'hltb-for-steam-unofficial@devln737.github.io') {
  throw new Error('Firefox add-on ID is missing');
}
if (manifest.browser_specific_settings?.gecko?.strict_min_version !== '140.0') {
  throw new Error('Firefox desktop minimum version is incorrect');
}
if (manifest.browser_specific_settings?.gecko_android) {
  throw new Error('Firefox for Android must not be declared for a desktop-only release');
}
if (!manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.includes('websiteContent')) {
  throw new Error('Firefox website-content disclosure is missing');
}
if (manifest.icons?.['64'] !== 'icons/icon64.png'
  || manifest.action?.default_icon?.['64'] !== 'icons/icon64.png') {
  throw new Error('Firefox Retina icon is missing');
}

const required = [
  ...(manifest.background?.scripts ?? []),
  manifest.action?.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...(manifest.declarative_net_request?.rule_resources ?? []).map((rule) => rule.path),
  ...['en', 'ru', 'de', 'fr', 'es', 'pt_BR', 'it', 'pl', 'uk', 'tr', 'ja', 'ko', 'zh_CN', 'zh_TW']
    .map((locale) => `_locales/${locale}/messages.json`),
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
const forbidden = files.find((file) => /fallback-data|hltb_data|scraper|collision|coverage|\.backup|[\\/]_metadata[\\/]/i.test(file));
if (forbidden) throw new Error(`Forbidden legacy artifact in Firefox build: ${forbidden}`);
const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
if (totalBytes > 2_097_152) throw new Error(`Firefox build is unexpectedly large: ${totalBytes} bytes`);
console.log(`Verified Firefox build: ${files.length} files (${totalBytes} bytes).`);
