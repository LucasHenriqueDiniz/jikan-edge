export interface Env {
  DB: D1Database;
  SNAPSHOTS_BUCKET: R2Bucket;
  API_RATE_LIMIT: RateLimit;
  API_BURST_LIMIT: RateLimit;
  MAL_USER_AGENT?: string;
  PROFILE_TTL_SECONDS?: string;
  LIST_TTL_SECONDS?: string;
  ANIME_TTL_SECONDS?: string;
  CATALOG_TTL_SECONDS?: string;
  SOURCE_TIMEOUT_MS?: string;
  MAX_UPSTREAM_BYTES?: string;
  WORKER_VERSION?: string;
}

export interface RuntimeConfig {
  profileTtlSeconds: number;
  listTtlSeconds: number;
  animeTtlSeconds: number;
  catalogTtlSeconds: number;
  sourceTimeoutMs: number;
  maxUpstreamBytes: number;
  malUserAgent: string;
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function configFrom(env: Env): RuntimeConfig {
  return {
    profileTtlSeconds: numberEnv(env.PROFILE_TTL_SECONDS, 21_600),
    listTtlSeconds: numberEnv(env.LIST_TTL_SECONDS, 7_200),
    animeTtlSeconds: numberEnv(env.ANIME_TTL_SECONDS, 21_600),
    catalogTtlSeconds: numberEnv(env.CATALOG_TTL_SECONDS, 21_600),
    sourceTimeoutMs: numberEnv(env.SOURCE_TIMEOUT_MS, 8_000),
    maxUpstreamBytes: numberEnv(env.MAX_UPSTREAM_BYTES, 2 * 1024 * 1024),
    malUserAgent: env.MAL_USER_AGENT ?? 'jikan-edge/0.1',
  };
}
