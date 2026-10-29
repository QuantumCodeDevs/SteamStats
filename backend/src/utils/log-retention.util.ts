import fs from 'node:fs/promises';
import path from 'node:path';

/** Hard ceiling on how long request logs may be kept (see the Privacy Policy). */
export const LOG_RETENTION_DAYS = 9;

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * A daily log file can hold entries up to a day older than its last write, so
 * files are removed once their mtime is one day short of the retention limit.
 * That keeps the oldest entry in any file at or under LOG_RETENTION_DAYS.
 */
export const LOG_FILE_MAX_AGE_MS = (LOG_RETENTION_DAYS - 1) * DAY_MS;

/** Deletes `.log` files in `dir` last modified more than `maxAgeMs` ago. Returns deleted names. */
export async function pruneOldLogs(
  dir: string,
  maxAgeMs = LOG_FILE_MAX_AGE_MS,
  now = Date.now(),
): Promise<string[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }

  const deleted: string[] = [];
  for (const name of names) {
    if (!name.endsWith('.log')) {
      continue;
    }

    const filePath = path.join(dir, name);
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
        await fs.unlink(filePath);
        deleted.push(name);
      }
    } catch {
      // File vanished or is unreadable; the next pass will retry.
    }
  }

  return deleted;
}
