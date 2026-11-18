export type StubBehaviour = 'ok' | 'missing-schema' | 'unreachable' | 'overloaded';

// D1 surfaces a schema-less database only through the error message, so the stub reproduces the real
// string: `D1_ERROR: no such table: cache_entries: SQLITE_ERROR`. `overloaded` is the exact message
// production logged for the 2026-11-16 incident (requestId 6348a36f-f8d9-45a3-bffa-b77a968223ff).
export const OVERLOADED = 'D1_ERROR: D1 DB is overloaded. Requests queued for too long.';
const FAILURES: Record<Exclude<StubBehaviour, 'ok'>, string> = {
  'missing-schema': 'D1_ERROR: no such table: cache_entries: SQLITE_ERROR',
  unreachable: 'Network connection lost.',
  overloaded: OVERLOADED,
};

// D1's all() always resolves to `{ results }`, never to null; the stubs answer it the same way.
function rows(answer: () => Promise<null>) {
  return async () => {
    await answer();
    return { results: [] };
  };
}

/**
 * A database that refuses its first `failures` statements as overloaded and then answers like the
 * empty `ok` stub — a stall that clears while the request is still retrying.
 */
export function flakyDatabase(failures: number): D1Database {
  let refused = 0;
  const answer = async () => {
    if (refused < failures) {
      refused += 1;
      throw new Error(OVERLOADED);
    }
    return null;
  };
  const statement = { bind: () => statement, first: answer, run: answer, all: rows(answer) };
  return { prepare: () => statement } as unknown as D1Database;
}

export function stubDatabase(behaviour: StubBehaviour): D1Database {
  const answer = async () => {
    if (behaviour !== 'ok') throw new Error(FAILURES[behaviour]);
    return null;
  };
  const statement = { bind: () => statement, first: answer, run: answer, all: rows(answer) };
  return { prepare: () => statement } as unknown as D1Database;
}
