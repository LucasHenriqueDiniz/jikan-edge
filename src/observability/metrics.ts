export interface OperationMetric {
  route: string;
  resourceType: string;
  cacheStatus: 'hit' | 'miss' | 'stale';
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
