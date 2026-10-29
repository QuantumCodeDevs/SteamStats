import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyServerOptions,
} from 'fastify';
import { join } from 'node:path';
import { TypeBoxValidatorCompiler, type TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import sensible from '@fastify/sensible';
import type { AppConfig } from './config/env';
import { configPlugin } from './plugins/config.plugin';
import corsPlugin from './plugins/cors.plugin';
import rateLimitPlugin from './plugins/rate-limit.plugin';
import steamServicePlugin from './plugins/steam.plugin';
import v1Routes from './routes';
import { SteamApiError } from './types/error.types';
import { SteamNotFoundError } from './types/error.types';
import cachePlugin from './plugins/cache.plugin';
import swaggerPlugin from './plugins/swagger.plugin';
import helmetPlugin from './plugins/helmet.plugin';
import logRetentionPlugin from './plugins/log-retention.plugin';
import { LOG_RETENTION_DAYS } from './utils/log-retention.util';

function buildLoggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  if (config.nodeEnv === 'test') {
    return false;
  }

  const level = config.nodeEnv === 'production' ? 'info' : 'debug';
  if (!config.logDir) {
    return { level };
  }

  // One file per day; keep the active file plus LOG_RETENTION_DAYS - 1 rotated ones.
  // log-retention.plugin also prunes by age in case the process was down.
  return {
    level,
    transport: {
      target: 'pino-roll',
      options: {
        file: join(config.logDir, 'backend'),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        mkdir: true,
        limit: { count: LOG_RETENTION_DAYS - 1, removeOtherLogFiles: true },
      },
    },
  };
}

/** Builds (but does not start) a fully configured Fastify instance. */
export function buildApp(config: AppConfig): FastifyInstance {
  const fastify = Fastify({
    trustProxy: true,
    logger: buildLoggerOptions(config),
  })
    .setValidatorCompiler(TypeBoxValidatorCompiler)
    .withTypeProvider<TypeBoxTypeProvider>();

  fastify.register(configPlugin(config));
  fastify.register(logRetentionPlugin);
  fastify.register(helmetPlugin);
  fastify.register(sensible);
  fastify.register(corsPlugin);
  fastify.register(rateLimitPlugin);
  fastify.register(cachePlugin);
  fastify.register(swaggerPlugin);
  fastify.register(steamServicePlugin);
  fastify.register(v1Routes, { prefix: '/api/v1' });

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof SteamNotFoundError) {
      reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: error.message,
      });
      return;
    }

    if (error instanceof SteamApiError) {
      reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: 'Bad Gateway',
        message: error.message,
      });
      return;
    }

    if (error.validation) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    fastify.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: 'Internal Server Error',
      message: config.nodeEnv === 'production' ? 'Something went wrong' : error.message,
    });
  });

  return fastify;
}
