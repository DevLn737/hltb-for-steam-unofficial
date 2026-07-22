import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readSnapshotSource } from '../scripts/snapshot-source.mjs';

const directories = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

async function fixture(content) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hltb-snapshot-'));
  directories.push(directory);
  const file = path.join(directory, 'source.json');
  await writeFile(file, content);
  return file;
}

describe('streaming snapshot source', () => {
  it('rejects an incomplete top-level array', async () => {
    const file = await fixture('[{"game":[]},');
    await expect(readSnapshotSource(file)).rejects.toThrow();
  });

  it('detects a source whose metadata changes during import', async () => {
    const file = await fixture(JSON.stringify([{ game: [] }, { game: [] }]));
    let changed = false;
    await expect(readSnapshotSource(file, {
      onEntry: async () => {
        if (changed) return;
        changed = true;
        const future = new Date(Date.now() + 60_000);
        await utimes(file, future, future);
      },
    })).rejects.toThrow(/changed during import/);
  });
});
