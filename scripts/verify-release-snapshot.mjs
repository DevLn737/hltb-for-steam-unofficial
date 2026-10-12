import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const maximumAge = 72 * 60 * 60 * 1000;

export function verifyReleaseFreshness(manifest, now = Date.now()) {
  const sourceDate = manifest.sourceUpdatedAt;
  const timestamp = typeof sourceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)
    ? Date.parse(`${sourceDate}T00:00:00Z`) : Number.NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== sourceDate) {
    throw new Error('The packaged snapshot has an invalid source date');
  }
  if (timestamp > now) throw new Error('The packaged snapshot source date is in the future');
  if (now - timestamp > maximumAge) {
    throw new Error(`The packaged snapshot is stale (${sourceDate}); run npm run snapshot:update-packaged before releasing`);
  }
  if (!Array.isArray(manifest.checkedDates) || !manifest.checkedDates.includes(sourceDate)) {
    throw new Error('The packaged snapshot has no successful game checks on its source date');
  }
  if (typeof manifest.origin !== 'string'
    || !/packaged from signed snapshot \d{4}\.\d{2}\.\d{2}\.\d+$/.test(manifest.origin)) {
    throw new Error('Release data must come from the verified signed snapshot channel');
  }
  return sourceDate;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = JSON.parse(await readFile('public/data/hltb-snapshot/snapshot.json', 'utf8'));
  console.log(`Verified release data freshness: ${verifyReleaseFreshness(manifest)} (maximum age 72 hours).`);
}
