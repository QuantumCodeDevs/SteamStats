import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../config/env';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('loadConfig', () => {
  it('loads config from environment with defaults', () => {
    process.env.STEAM_API_KEY = 'secret-key';
    delete process.env.HOST;
    delete process.env.PORT;
    delete process.env.FRONTEND_ORIGIN;
    delete process.env.ADMIN_API_KEY;
    delete process.env.LOG_DIR;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    process.env.NODE_ENV = 'test';

    const config = loadConfig();

    expect(config).toMatchObject({
      nodeEnv: 'test',
      host: '0.0.0.0',
      port: 3000,
      steamApiKey: 'secret-key',
      frontendOrigin: 'http://localhost:4200',
      rateLimit: {
        max: 30,
        timeWindowMs: 60_000,
      },
    });
    expect(config.adminApiKey).toBeUndefined();
    expect(config.logDir).toBeUndefined();
  });

  it('loads LOG_DIR when set', () => {
    process.env.STEAM_API_KEY = 'secret-key';
    process.env.LOG_DIR = '/app/logs';
    process.env.NODE_ENV = 'test';

    expect(loadConfig().logDir).toBe('/app/logs');
  });

  it('loads ADMIN_API_KEY when set', () => {
    process.env.STEAM_API_KEY = 'secret-key';
    process.env.ADMIN_API_KEY = 'admin-secret';
    process.env.NODE_ENV = 'test';

    expect(loadConfig().adminApiKey).toBe('admin-secret');
  });

  it('throws when STEAM_API_KEY is missing', () => {
    delete process.env.STEAM_API_KEY;

    expect(() => loadConfig()).toThrow('Missing required environment variable: STEAM_API_KEY');
  });

  it('throws when STEAM_API_KEY is blank', () => {
    process.env.STEAM_API_KEY = '   ';

    expect(() => loadConfig()).toThrow('Missing required environment variable: STEAM_API_KEY');
  });
});
