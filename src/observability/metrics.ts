/** The values `X-Cache-Status` takes — the metric reports the same word the caller received. */
export type CacheStatus = 'hit' | 'miss' | 'stale' | 'local' | 'rate_limited' | 'error' | 'unknown';

interface OperationMetric {
  route: string;
  resourceType: string;
  cacheStatus: CacheStatus;
  stale: boolean;
  upstreamStatus?: number | null;
  upstreamDurationMs?: number;
  parseDurationMs?: number;
  databaseDurationMs?: number;
  responseDurationMs: number;
  responseSizeBytes?: number;
  upstreamSizeBytes?: number;
  parserVersion?: string;
  refreshResult: string;
}

export function logMetric(metric: OperationMetric): void {
  console.log(JSON.stringify({ type: 'operation_metric', ...metric }));
}
