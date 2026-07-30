export type StubBehaviour = 'ok' | 'missing-schema' | 'unreachable';

// D1 surfaces a schema-less database only through the error message, so the stub reproduces the real
// string: `D1_ERROR: no such table: cache_entries: SQLITE_ERROR`.
const FAILURES: Record<Exclude<StubBehaviour, 'ok'>, string> = {
  'missing-schema': 'D1_ERROR: no such table: cache_entries: SQLITE_ERROR',
  unreachable: 'Network connection lost.',
};

export function stubDatabase(behaviour: StubBehaviour): D1Database {
  const answer = async () => {
    if (behaviour !== 'ok') throw new Error(FAILURES[behaviour]);
    return null;
  };
  const statement = { bind: () => statement, first: answer, run: answer, all: answer };
  return { prepare: () => statement } as unknown as D1Database;
}
