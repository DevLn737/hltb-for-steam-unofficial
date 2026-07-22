import { createHash } from 'node:crypto';
import { encodeSteamIndex, packSnapshotLocation } from '../shared/snapshot-codec.mjs';
import { normalizeTitle, SNAPSHOT_BUCKET_COUNT, snapshotBucket } from '../shared/title-normalization.mjs';

export const SNAPSHOT_SCHEMA = 2;
export const BUCKET_COUNT = SNAPSHOT_BUCKET_COUNT;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function secondsToMinutes(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value / 60))
    : null;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function extractSnapshotRecord(sourceEntry) {
  const game = Array.isArray(sourceEntry?.game) ? sourceEntry.game[0] : null;
  const gameId = positiveInteger(game?.game_id);
  const title = typeof game?.game_name === 'string' ? game.game_name.trim() : '';
  const times = [
    secondsToMinutes(game?.comp_main),
    secondsToMinutes(game?.comp_plus),
    secondsToMinutes(game?.comp_100),
  ];
  if (!gameId || !title || times.every((value) => value === null)) return null;
  const steamAppIds = [...new Set([game?.profile_steam, game?.profile_steam_alt]
    .map(positiveInteger)
    .filter((value) => value !== null))];
  return {
    gameId,
    title,
    mainStory: times[0],
    mainPlusExtras: times[1],
    completionist: times[2],
    steamAppIds,
  };
}

function sameRecord(left, right) {
  return left.title === right.title
    && left.mainStory === right.mainStory
    && left.mainPlusExtras === right.mainPlusExtras
    && left.completionist === right.completionist
    && JSON.stringify(left.steamAppIds) === JSON.stringify(right.steamAppIds);
}

function collisionReport(normalized, gameIds, records) {
  return {
    normalized,
    games: [...gameIds].sort((left, right) => left - right).map((gameId) => ({
      gameId,
      title: records.get(gameId)?.title ?? '<missing>',
    })),
  };
}

export function buildSnapshot(records, overrides = { schema: 2, origin: 'unknown', entries: [] }) {
  if (!Array.isArray(records)) throw new Error('Snapshot records must be an array');
  if (overrides?.schema !== 2 || !Array.isArray(overrides.entries)) throw new Error('Snapshot overrides must use schema 2');

  const recordsById = new Map();
  const titleCandidates = new Map();
  const steamCandidates = new Map();
  let duplicateEntries = 0;

  for (const record of records) {
    const normalized = normalizeTitle(record?.title);
    if (!positiveInteger(record?.gameId)) throw new Error('Invalid compact snapshot record');
    const existing = recordsById.get(record.gameId);
    if (existing) {
      if (!sameRecord(existing, record)) throw new Error(`Conflicting duplicate HLTB game ID: ${record.gameId}`);
      duplicateEntries += 1;
      continue;
    }
    recordsById.set(record.gameId, record);
    const titleIds = titleCandidates.get(normalized) ?? new Set();
    titleIds.add(record.gameId);
    titleCandidates.set(normalized, titleIds);
    for (const appId of record.steamAppIds) {
      const appIds = steamCandidates.get(appId) ?? new Set();
      appIds.add(record.gameId);
      steamCandidates.set(appId, appIds);
    }
  }

  for (const override of overrides.entries) {
    const appId = positiveInteger(override?.appId);
    const gameId = positiveInteger(override?.hltbGameId);
    if (!appId || !gameId || !recordsById.has(gameId)) throw new Error(`Invalid snapshot mapping override: ${override?.appId ?? '<missing>'}`);
    steamCandidates.set(appId, new Set([gameId]));
  }

  const titleBuckets = Array.from({ length: BUCKET_COUNT }, () => []);
  for (const record of recordsById.values()) {
    const normalized = normalizeTitle(record.title);
    titleBuckets[snapshotBucket(normalized)].push({ normalized, record });
  }
  for (const bucket of titleBuckets) {
    bucket.sort((left, right) => left.normalized.localeCompare(right.normalized, 'en') || left.record.gameId - right.record.gameId);
  }

  const locations = new Map();
  const rows = titleBuckets.map((bucket, bucketIndex) => bucket.map(({ record }, rowIndex) => {
    locations.set(record.gameId, packSnapshotLocation(bucketIndex, rowIndex));
    return [record.title, record.gameId, record.mainStory, record.mainPlusExtras, record.completionist];
  }));

  const titleCollisions = [...titleCandidates]
    .filter(([, gameIds]) => gameIds.size > 1)
    .map(([normalized, gameIds]) => collisionReport(normalized, gameIds, recordsById))
    .sort((left, right) => left.normalized.localeCompare(right.normalized, 'en'));
  const steamCollisionCount = [...steamCandidates.values()].filter((gameIds) => gameIds.size > 1).length;
  const steamPairs = [...steamCandidates]
    .filter(([, gameIds]) => gameIds.size === 1)
    .map(([appId, gameIds]) => {
      const gameId = [...gameIds][0];
      const location = locations.get(gameId);
      if (location === undefined) throw new Error(`Missing snapshot location for HLTB game ${gameId}`);
      return [appId, location];
    });
  const steamBuckets = Array.from({ length: BUCKET_COUNT }, () => []);
  for (const pair of steamPairs) steamBuckets[pair[0] % BUCKET_COUNT].push(pair);
  for (const bucket of steamBuckets) bucket.sort((left, right) => left[0] - right[0]);

  return {
    titleBuckets: rows,
    steamBuckets: steamBuckets.map(encodeSteamIndex),
    steamBucketEntryCounts: steamBuckets.map((bucket) => bucket.length),
    titleCollisions,
    metadata: {
      schema: SNAPSHOT_SCHEMA,
      compression: 'gzip',
      entryCount: recordsById.size,
      normalizedTitleCount: titleCandidates.size,
      titleCollisionCount: titleCollisions.length,
      titleCollisionRecordCount: titleCollisions.reduce((total, collision) => total + collision.games.length, 0),
      steamCandidateCount: steamCandidates.size,
      steamMappingCount: steamPairs.length,
      steamCollisionCount,
      duplicateEntries,
      bucketCount: BUCKET_COUNT,
      origin: overrides.origin,
    },
  };
}
