export const SNAPSHOT_BUCKET_COUNT = 16;

export function normalizeTitleLegacy(value) {
  return String(value ?? '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

export function normalizeTitle(value) {
  return String(value ?? '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

export function snapshotBucket(normalizedTitle, bucketCount = SNAPSHOT_BUCKET_COUNT) {
  if (!Number.isInteger(bucketCount) || bucketCount <= 0 || bucketCount > 64) {
    throw new Error(`Invalid snapshot bucket count: ${bucketCount}`);
  }
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalizedTitle.length; index += 1) {
    hash ^= normalizedTitle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % bucketCount;
}

export function compareNormalizedTitles(left, right) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return leftBytes.length - rightBytes.length;
}
