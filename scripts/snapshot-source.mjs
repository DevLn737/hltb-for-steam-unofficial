import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import streamArray from 'stream-json/streamers/stream-array.js';
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
  const entries = streamArray.withParserAsStream();
  const pipelineDone = pipeline(
    createReadStream(sourcePath, { highWaterMark: 1024 * 1024 }),
    hashingStream,
    entries,
  );

  const records = [];
  let sourceEntryCount = 0;
  let lastGameId = 0;
  try {
    for await (const { value } of entries) {
      sourceEntryCount += 1;
      const sourceGameId = Number(value?.game?.[0]?.game_id);
      if (Number.isSafeInteger(sourceGameId)) lastGameId = Math.max(lastGameId, sourceGameId);
      const record = extractSnapshotRecord(value);
      if (record) records.push(record);
      await options.onEntry?.(value, sourceEntryCount);
    }
  } finally {
    await pipelineDone;
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
