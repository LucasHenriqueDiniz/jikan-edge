export interface StatusStats {
  inProgress: number | null;
  completed: number | null;
  onHold: number | null;
  dropped: number | null;
  planned: number | null;
  total: number | null;
}

export interface ScoreStat {
  score: number;
  votes: number;
  percentage: number;
}

export interface EntryStatistics {
  status: StatusStats;
  scores: ScoreStat[];
  fetchedAt: string;
}

export const STATISTICS_PARSER_VERSION = 'statistics-html-v2';
