import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOG_FILE_MAX_AGE_MS, pruneOldLogs } from '../../utils/log-retention.util';

const DAY_MS = 1000 * 60 * 60 * 24;

describe('pruneOldLogs', () => {
  let dir: string;
  const now = Date.now();

  async function writeFileAged(name: string, ageMs: number): Promise<void> {
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, 'x');
    const time = new Date(now - ageMs);
    await fs.utimes(filePath, time, time);
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'steamstats-logs-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('keeps log files at most 9 days of entries', () => {
    // Last write + up to one day of earlier entries in the same daily file.
    expect(LOG_FILE_MAX_AGE_MS + DAY_MS).toBe(9 * DAY_MS);
  });

  it('deletes only expired .log files', async () => {
    await writeFileAged('app.old.log', LOG_FILE_MAX_AGE_MS + 1000);
    await writeFileAged('app.recent.log', DAY_MS);
    await writeFileAged('notes.txt', 30 * DAY_MS);

    const deleted = await pruneOldLogs(dir, LOG_FILE_MAX_AGE_MS, now);

    expect(deleted).toEqual(['app.old.log']);
    expect((await fs.readdir(dir)).sort()).toEqual(['app.recent.log', 'notes.txt']);
  });

  it('returns an empty list when the directory does not exist', async () => {
    expect(await pruneOldLogs(path.join(dir, 'missing'))).toEqual([]);
  });
});
