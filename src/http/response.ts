export function success<T>(data: T, meta: Record<string, unknown>): { data: T; meta: Record<string, unknown> } { return { data, meta }; }
