export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

export function parsePagination(pageValue: string | undefined, limitValue: string | undefined): Pick<Pagination, 'page' | 'limit'> {
  const page = Math.max(1, Number.parseInt(pageValue ?? '1', 10) || 1);
  const requestedLimit = Number.parseInt(limitValue ?? '100', 10) || 100;
  return { page, limit: Math.min(300, Math.max(1, requestedLimit)) };
}
