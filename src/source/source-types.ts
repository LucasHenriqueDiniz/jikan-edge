export interface SourceMetadata {
  url: string;
  status: number | null;
  contentType: string | null;
  durationMs: number;
  sizeBytes: number;
}

export type SourceResult<T> =
  | { kind: 'success'; value: T; metadata: SourceMetadata }
  | { kind: 'not_found' | 'private' | 'rate_limited' | 'suspicious' | 'upstream_error' | 'timeout'; reason?: string; metadata: SourceMetadata };
