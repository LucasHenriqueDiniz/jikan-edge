/**
 * The message for a path no route answers — and, for a Jikan v4 path, where the route lives instead.
 *
 * Why the Jikan case has its own text (2026-11-17): `/v4/*` drew ~17.1k requests a day for a week,
 * 99.9% of them one client polling a fixed list of 1,162 anime ids, plus about eight one-off
 * attempts a day from other clients — people pointing a Jikan client at this host. They all got
 * `Route not found.`, which says nothing about why.
 *
 * What it deliberately does NOT do is alias `/v4` to `/v1`. The paths match Jikan's, the shapes do
 * not (camelCase, `{ data, meta }`, `images.{small,medium,large}`, `aired.{from,to,string}`), so a
 * Jikan client served `/v1` would read `undefined` in silence — worse than a 404 that says why. A real
 * `/v4` adapter is a separate decision: docs/research/2026-07-19-jikan-compatibility-market-scope.md
 * recommends one only for a few routes, and only once demand is measured.
 */
const JIKAN_V4_PATH = /^\/v4(?:\/|$)/;

export function notFoundMessage(url: string): string {
  const { origin, pathname } = new URL(url);
  if (!JIKAN_V4_PATH.test(pathname)) return 'Route not found.';
  const native = pathname.replace(/^\/v4/, '/v1');
  return (
    `This API is not a drop-in replacement for Jikan v4. Routes live under /v1 (try ${native}), and ` +
    'responses use a different shape: camelCase fields, a { data, meta } envelope, and different image ' +
    `and date objects. Migration guide: ${origin}/#migrate`
  );
}
