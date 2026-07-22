export const SNAPSHOT_BUCKET_COUNT = 64;

export function normalizeTitle(value) {
  return String(value ?? '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

export function snapshotBucket(normalizedTitle) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalizedTitle.length; index += 1) {
    hash ^= normalizedTitle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % SNAPSHOT_BUCKET_COUNT;
}
