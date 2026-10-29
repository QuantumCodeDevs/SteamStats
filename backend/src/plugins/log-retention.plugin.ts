import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { pruneOldLogs } from '../utils/log-retention.util';

const PRUNE_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Enforces the log retention limit by age. pino-roll only limits by file
 * count, which can leave stale files behind after downtime.
 */
const logRetentionPlugin: FastifyPluginAsync = async (fastify) => {
  const logDir = fastify.config.logDir;
  if (!logDir) {
    return;
  }

  const prune = async () => {
    const deleted = await pruneOldLogs(logDir);
    if (deleted.length > 0) {
      fastify.log.info({ deleted }, 'Pruned expired log files');
    }
  };

  await prune();
  const timer = setInterval(() => void prune(), PRUNE_INTERVAL_MS);
  timer.unref();

  fastify.addHook('onClose', async () => {
    clearInterval(timer);
  });
};

export default fp(logRetentionPlugin, { name: 'log-retention', dependencies: ['config'] });
