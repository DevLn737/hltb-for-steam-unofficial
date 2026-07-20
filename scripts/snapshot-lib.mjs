import { createHash } from 'node:crypto';

export const SNAPSHOT_SCHEMA = 1;
export const BUCKET_COUNT = 64;

export function normalizeSnapshotTitle(value) {
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
  return (hash >>> 0) % BUCKET_COUNT;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hoursToMinutes(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value * 60)
    : null;
}

function validMinutes(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function buildSnapshot(source, overrides) {
  if (!source || !Array.isArray(source.games)) throw new Error('Snapshot source must contain a games array');
  if (!overrides || !Array.isArray(overrides.entries)) throw new Error('Overrides must contain an entries array');

  const dates = [source.lastUpdated || '2025-10-23'];
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const candidates = new Map();
  let emptyEntries = 0;

  for (const game of source.games) {
    const title = typeof game?.title === 'string' ? game.title.trim() : '';
    const normalized = normalizeSnapshotTitle(title);
    const row = [
      title,
      hoursToMinutes(game?.data?.mainStory),
      hoursToMinutes(game?.data?.mainExtra),
      hoursToMinutes(game?.data?.completionist),
    ];
    if (!normalized || row.slice(1).every((value) => value === null)) {
      emptyEntries += 1;
      continue;
    }
    const existing = candidates.get(normalized) ?? [];
    existing.push(row);
    candidates.set(normalized, existing);
  }

  for (const override of overrides.entries) {
    const title = typeof override?.title === 'string' ? override.title.trim() : '';
    const normalized = normalizeSnapshotTitle(title);
    const updatedAt = override?.updatedAt || dates[0];
    if (!dateIndex.has(updatedAt)) {
      dateIndex.set(updatedAt, dates.length);
      dates.push(updatedAt);
    }
    const row = [
      title,
      validMinutes(override?.mainStory),
      validMinutes(override?.mainPlusExtras),
      validMinutes(override?.completionist),
      dateIndex.get(updatedAt),
    ];
    if (!normalized || row.slice(1, 4).every((value) => value === null)) throw new Error(`Invalid snapshot override: ${title || '<untitled>'}`);
    candidates.set(normalized, [row]);
  }

  const buckets = Array.from({ length: BUCKET_COUNT }, () => []);
  const collisions = [];
  for (const [normalized, rows] of candidates) {
    const distinct = new Map(rows.map((row) => [JSON.stringify(row.slice(0, 4)), row]));
    if (distinct.size !== 1) {
      collisions.push({ normalized, titles: [...distinct.values()].map((row) => row[0]) });
      continue;
    }
    buckets[snapshotBucket(normalized)].push([...distinct.values()][0]);
  }
  for (const bucket of buckets) bucket.sort((left, right) => normalizeSnapshotTitle(left[0]).localeCompare(normalizeSnapshotTitle(right[0]), 'en'));

  return {
    buckets,
    collisions,
    metadata: {
      schema: SNAPSHOT_SCHEMA,
      sourceVersion: source.version || 'unknown',
      sourceUpdatedAt: dates[0],
      dates,
      sourceEntryCount: source.games.length,
      entryCount: buckets.reduce((total, bucket) => total + bucket.length, 0),
      emptyEntries,
      collisionCount: collisions.length,
      bucketCount: BUCKET_COUNT,
      origin: overrides.origin,
    },
  };
}
