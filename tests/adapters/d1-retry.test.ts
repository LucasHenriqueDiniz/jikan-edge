import { describe, expect, it, vi } from 'vitest';
import {
  backoffDelay,
  type D1RetryPolicy,
  isD1PlatformFailure,
  isTransientD1Failure,
  retryingD1,
} from '../../src/adapters/d1-retry';
import { StoreUnavailableError } from '../../src/domain/errors';
import { OVERLOADED } from '../helpers/stub-database';

// A clock that only moves when the code under test sleeps, or when a fake statement says the database
// kept it waiting. Every number below is therefore exact, not a timing that happened to pass.
function fakeClock(windowMs: number) {
  let now = 0;
  const slept: number[] = [];
  const policy: D1RetryPolicy = {
    windowMs,
    baseDelayMs: 200,
    maxDelayMs: 2_000,
    now: () => now,
    sleep: async (ms) => {
      slept.push(ms);
      now += ms;
    },
    random: () => 0.5,
  };
  return { policy, slept, advance: (ms: number) => (now += ms) };
}

type Outcome = { fail: string; waitMs?: number } | { value: unknown };

// One fake statement shared by every prepare/bind, answering from a script. `batch` records the
// statements it was handed so the test can check it got the binding's own objects back.
function scriptedD1(outcomes: Outcome[], advance: (ms: number) => void) {
  let calls = 0;
  const batches: unknown[][] = [];
  const answer = async () => {
    const next = outcomes[Math.min(calls, outcomes.length - 1)];
    calls += 1;
    if ('fail' in next) {
      advance(next.waitMs ?? 0);
      throw new Error(next.fail);
    }
    return next.value;
  };
  const statement = { bind: () => statement, first: answer, run: answer, all: answer, raw: answer };
  const db = {
    prepare: () => statement,
    batch: async (statements: unknown[]) => {
      batches.push(statements);
      return answer();
    },
  } as unknown as D1Database;
  return { db, statement, batches, calls: () => calls };
}

describe('retryingD1', () => {
  it('retries a read D1 refused as overloaded and returns the row once the database recovers', async () => {
    const clock = fakeClock(12_000);
    const d1 = scriptedD1(
      [{ fail: OVERLOADED }, { fail: OVERLOADED }, { value: { payload_json: '{}' } }],
      clock.advance,
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const row = await retryingD1(d1.db, clock.policy).prepare('SELECT 1').bind('k').first();

    expect(row).toEqual({ payload_json: '{}' });
    expect(d1.calls()).toBe(3);
    expect(clock.slept).toEqual([150, 300]);
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ type: 'd1_retry_recovered', retries: 2, waitedMs: 450 }));
    warn.mockRestore();
  });

  it('gives up with StoreUnavailableError once the window is spent, keeping the D1 error as its cause', async () => {
    const clock = fakeClock(3_000);
    const d1 = scriptedD1([{ fail: OVERLOADED }], clock.advance);

    const failure = await retryingD1(d1.db, clock.policy)
      .prepare('SELECT 1')
      .first()
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StoreUnavailableError);
    expect((failure as Error).message).toBe(OVERLOADED);
    expect(((failure as Error).cause as Error).message).toBe(OVERLOADED);
    // 150 + 300 + 600 + 1200 = 2250; the next step (1500 at the 2000 cap) would end at 3750, past 3000.
    expect(clock.slept).toEqual([150, 300, 600, 1_200]);
    expect(d1.calls()).toBe(5);
  });

  // A refusal can arrive after a long wait in D1's queue. Counted from the refusal, the window would
  // add its full length on top of that wait; counted from the request, it cannot.
  it('counts the window from the start of the request, not from the moment a refusal arrived', async () => {
    const clock = fakeClock(1_000);
    const d1 = scriptedD1([{ fail: OVERLOADED, waitMs: 800 }, { fail: OVERLOADED }], clock.advance);

    await expect(retryingD1(d1.db, clock.policy).prepare('SELECT 1').first()).rejects.toBeInstanceOf(
      StoreUnavailableError,
    );
    // Retry 1 waits 150 ms (800 + 150 < 1000). Retry 2 would wait 300 ms and end at 1250: refused.
    // Anchored at the refusal (800) the window would run to 1800 and allow a third attempt.
    expect(d1.calls()).toBe(2);
    expect(clock.slept).toEqual([150]);
  });

  // The case measured live on 2026-11-16: a read sat ~21 s in D1's queue and succeeded, the write after
  // it was refused, and a window opened at that refusal retried it for 12 s more — 32.4 s in all. Here
  // the request is 11.9 s old when its first refusal arrives; the 150 ms retry would end past 12 s.
  it('gives a late first refusal no fresh window of its own', async () => {
    const clock = fakeClock(12_000);
    const d1 = scriptedD1([{ fail: OVERLOADED }, { value: 'would have recovered' }], clock.advance);
    const db = retryingD1(d1.db, clock.policy);
    clock.advance(11_900);

    await expect(db.prepare('INSERT 1').run()).rejects.toBeInstanceOf(StoreUnavailableError);
    expect(d1.calls()).toBe(1);
    expect(clock.slept).toEqual([]);
  });

  it('does not retry a SQL error, which is a bug a retry would only hide', async () => {
    const clock = fakeClock(12_000);
    const sqlError = 'D1_ERROR: no such column: x: SQLITE_ERROR';
    const d1 = scriptedD1([{ fail: sqlError }, { value: 'never reached' }], clock.advance);

    const failure = await retryingD1(d1.db, clock.policy)
      .prepare('SELECT x')
      .first()
      .catch((error: unknown) => error);

    expect(failure).not.toBeInstanceOf(StoreUnavailableError);
    expect((failure as Error).message).toBe(sqlError);
    expect(d1.calls()).toBe(1);
    expect(clock.slept).toEqual([]);
  });

  it('does not retry a lost connection, where a write may already have committed', async () => {
    const clock = fakeClock(12_000);
    const d1 = scriptedD1([{ fail: 'Network connection lost.' }, { value: 'never reached' }], clock.advance);

    await expect(retryingD1(d1.db, clock.policy).prepare('INSERT 1').run()).rejects.toThrow('Network connection lost.');
    expect(d1.calls()).toBe(1);
  });

  it('hands batch the binding’s own statements back and retries the whole batch', async () => {
    const clock = fakeClock(12_000);
    const d1 = scriptedD1([{ fail: OVERLOADED }, { value: [] }], clock.advance);
    const db = retryingD1(d1.db, clock.policy);

    await db.batch([db.prepare('DELETE 1').bind(1), db.prepare('INSERT 1').bind(2)]);

    expect(d1.batches).toHaveLength(2);
    for (const batch of d1.batches) expect(batch).toEqual([d1.statement, d1.statement]);
    for (const batch of d1.batches) for (const each of batch) expect(each).toBe(d1.statement);
  });

  it('gives one request one window: once spent, the next refusal fails at once instead of opening another', async () => {
    const clock = fakeClock(1_000);
    const d1 = scriptedD1([{ fail: OVERLOADED }], clock.advance);
    const db = retryingD1(d1.db, clock.policy);

    await expect(db.prepare('SELECT 1').first()).rejects.toBeInstanceOf(StoreUnavailableError);
    // The first statement gave up at 450 ms because its next wait would cross 1000. Let the rest of
    // the request's work take the clock past the window, the way a slow upstream fetch would.
    clock.advance(600);
    const callsAfterFirst = d1.calls();
    const sleepsAfterFirst = clock.slept.length;

    await expect(db.prepare('SELECT 2').first()).rejects.toBeInstanceOf(StoreUnavailableError);
    expect(d1.calls() - callsAfterFirst).toBe(1);
    expect(clock.slept.length).toBe(sleepsAfterFirst);
  });
});

describe('isTransientD1Failure', () => {
  it.each([
    'D1_ERROR: D1 DB is overloaded. Requests queued for too long.',
    'D1_ERROR: D1 DB is overloaded. Too many requests queued.',
    'D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window.',
    'D1_ERROR: Internal error while starting up D1 DB storage caused object to be reset; reference = 2dan349j2',
  ])('retries %s, which never reached the database', (message) => {
    expect(isTransientD1Failure(new Error(message))).toBe(true);
  });

  it('looks at the cause too, the way the binding sometimes nests it', () => {
    expect(isTransientD1Failure(new Error('D1_ERROR', { cause: new Error(OVERLOADED) }))).toBe(true);
  });

  it.each([
    'D1_ERROR: Internal error in D1 DB storage caused object to be reset; reference = u624rojg',
    'D1_ERROR: internal error; reference = 266snuice9ovn8g7c47fkh36',
    'Network connection lost.',
    'D1_ERROR: no such table: cache_entries: SQLITE_ERROR',
    'D1_ERROR: string or blob too big: SQLITE_TOOBIG',
  ])('does not retry %s, since it may have run or is a bug', (message) => {
    expect(isTransientD1Failure(new Error(message))).toBe(false);
  });

  it('ignores anything that is not an Error', () => {
    expect(isTransientD1Failure(OVERLOADED)).toBe(false);
  });
});

// The 2026-11-16 19:30 UTC outage answered the first of these in ~10 ms, 88 times, as 500
// INTERNAL_ERROR. They are the database's failures, so they are reported as such — but not retried:
// D1 does not say whether a statement that failed this way ran, and the lease upsert must not run twice.
const INTERNAL_ERRORS = [
  'D1_ERROR: internal error; reference = 266snuice9ovn8g7c47fkh36',
  'D1_ERROR: Internal error in D1 DB storage caused object to be reset; reference = u624rojg0481d46iicg',
];

describe('a D1 internal error', () => {
  it.each(INTERNAL_ERRORS)('becomes StoreUnavailableError on the first attempt, with no retry: %s', async (message) => {
    const clock = fakeClock(12_000);
    const d1 = scriptedD1([{ fail: message }, { value: 'never reached' }], clock.advance);

    const failure = await retryingD1(d1.db, clock.policy)
      .prepare('INSERT 1')
      .run()
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(StoreUnavailableError);
    expect(((failure as Error).cause as Error).message).toBe(message);
    expect(d1.calls()).toBe(1);
    expect(clock.slept).toEqual([]);
  });
});

describe('isD1PlatformFailure', () => {
  it.each(INTERNAL_ERRORS)('recognises %s, also when the binding nests it', (message) => {
    expect(isD1PlatformFailure(new Error(message))).toBe(true);
    expect(isD1PlatformFailure(new Error('D1_ERROR', { cause: new Error(message) }))).toBe(true);
  });

  it.each([
    OVERLOADED,
    'D1_ERROR: Internal error while starting up D1 DB storage caused object to be reset; reference = 2dan349j2',
    'Network connection lost.',
    'D1_ERROR: no such column: x: SQLITE_ERROR',
    'D1_ERROR: string or blob too big: SQLITE_TOOBIG',
  ])('leaves %s to the other paths', (message) => {
    expect(isD1PlatformFailure(new Error(message))).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('keeps half of each step fixed so no retry fires immediately', () => {
    const policy = { baseDelayMs: 200, maxDelayMs: 2_000 };
    expect(backoffDelay(0, policy, 0)).toBe(100);
    expect(backoffDelay(0, policy, 1)).toBe(200);
    expect(backoffDelay(3, policy, 0)).toBe(800);
    expect(backoffDelay(10, policy, 0)).toBe(1_000);
    expect(backoffDelay(10, policy, 1)).toBe(2_000);
  });
});
