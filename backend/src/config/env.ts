/**
 * Application configuration, loaded and validated from environment
 * variables. This is the single source of truth for all runtime config -
 * no other module should read from `process.env` directly.
 */
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

// In local (non-Docker) development, `.env` lives at the monorepo root, one
// level up from `backend/`. In Docker, env vars are injected directly via
// `docker-compose.yml` and no `.env` file is present - both calls below are
// no-ops in that case (dotenv silently ignores missing files).
loadDotenv();
loadDotenv({ path: resolve(process.cwd(), '..', '.env') });

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  host: string;
  port: number;
  steamApiKey: string;
  frontendOrigin: string;
  adminApiKey?: string;
  /** When set, logs go to daily-rotated files here instead of stdout. */
  logDir?: string;
  rateLimit: {
    max: number;
    timeWindowMs: number;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

export function loadConfig(): AppConfig {
  const nodeEnv = optionalEnv('NODE_ENV', 'development') as AppConfig['nodeEnv'];

  return {
    nodeEnv,
    host: optionalEnv('HOST', '0.0.0.0'),
    port: Number(optionalEnv('PORT', '3000')),
    steamApiKey: requireEnv('STEAM_API_KEY'),
    frontendOrigin: optionalEnv('FRONTEND_ORIGIN', 'http://localhost:4200'),
    adminApiKey: optionalEnv('ADMIN_API_KEY', '') || undefined,
    logDir: optionalEnv('LOG_DIR', '') || undefined,
    rateLimit: {
      max: Number(optionalEnv('RATE_LIMIT_MAX', '30')),
      timeWindowMs: Number(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000')),
    },
  };
}
