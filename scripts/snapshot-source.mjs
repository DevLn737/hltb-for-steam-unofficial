import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Transform } from 'node:stream';
import StreamArray from 'stream-json/streamers/StreamArray.js';
import { extractSnapshotRecord } from './snapshot-lib.mjs';

export async function readSnapshotSource(sourcePath, options = {}) {
  const before = await stat(sourcePath);
  const sourceHash = createHash('sha256');
  const hashingStream = new Transform({
    transform(chunk, _encoding, callback) {
      sourceHash.update(chunk);
      callback(null, chunk);
    },
  });
  const parser = StreamArray.withParser();
  createReadStream(sourcePath, { highWaterMark: 1024 * 1024 }).pipe(hashingStream).pipe(parser);

  const records = [];
  let sourceEntryCount = 0;
  let lastGameId = 0;
  for await (const { value } of parser) {
    sourceEntryCount += 1;
    const sourceGameId = Number(value?.game?.[0]?.game_id);
    if (Number.isSafeInteger(sourceGameId)) lastGameId = Math.max(lastGameId, sourceGameId);
    const record = extractSnapshotRecord(value);
    if (record) records.push(record);
    await options.onEntry?.(value, sourceEntryCount);
  }

  const after = await stat(sourcePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('HLTB source changed during import');
  return {
    records,
    sourceEntryCount,
    lastGameId,
    sourceBytes: after.size,
    sourceMtimeMs: after.mtimeMs,
    sourceSha256: sourceHash.digest('hex'),
  };
}
