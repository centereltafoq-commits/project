export interface AppEnvConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  redisUrl: string;
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresInDays: number;
  rateLimitTtlMs: number;
  rateLimitMax: number;
}

const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function validateAndLoadEnv(rawEnv: Record<string, unknown>): AppEnvConfig {
  for (const key of REQUIRED_ENV_KEYS) {
    const val = rawEnv[key];
    if (typeof val !== 'string' || val.trim().length < 12) {
      throw new Error(`Missing or insecure required environment variable: ${key}`);
    }
  }

  return {
    nodeEnv: String(rawEnv.NODE_ENV || 'development'),
    port: Number(rawEnv.PORT || 4000),
    corsOrigin: String(rawEnv.CORS_ORIGIN || 'http://localhost:5173'),
    databaseUrl: String(rawEnv.DATABASE_URL),
    redisUrl: String(rawEnv.REDIS_URL || ''),
    jwtAccessSecret: String(rawEnv.JWT_ACCESS_SECRET),
    jwtAccessExpiresIn: String(rawEnv.JWT_ACCESS_EXPIRES_IN || '30m'),
    jwtRefreshSecret: String(rawEnv.JWT_REFRESH_SECRET),
    jwtRefreshExpiresInDays: Number(rawEnv.JWT_REFRESH_EXPIRES_IN_DAYS || 7),
    rateLimitTtlMs: Number(rawEnv.RATE_LIMIT_TTL_MS || 60000),
    rateLimitMax: Number(rawEnv.RATE_LIMIT_MAX || 180),
  };
}

