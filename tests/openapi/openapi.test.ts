import { describe, expect, it } from 'vitest';
import { QUERY_CONTRACT } from '../../src/http/query-contract';
import { buildDocument, registeredGetRoutes } from './document';
import { ROUTE_DATA } from './route-schemas';

describe('the OpenAPI document', () => {
  // `site/openapi.json` is generated, never edited. Locally this writes it; in CI (`CI=1`) a missing
  // or drifted file fails, so a schema change that forgot to regenerate the document is a red build.
  it('matches what the schemas generate', async () => {
    await expect(`${JSON.stringify(buildDocument(), null, 2)}\n`).toMatchFileSnapshot('../../site/openapi.json');
  });

  it('documents every GET route the app registers', () => {
    const paths = Object.keys(buildDocument().paths ?? {});
    const missing = registeredGetRoutes()
      .map((path) => path.replace(/:([A-Za-z]+)/g, '{$1}'))
      .filter((path) => !paths.includes(path));
    expect(missing).toEqual([]);
  });

  // The two tables have to agree on the route set, or one of them is describing a route that does
  // not exist.
  it('has a response schema for exactly the routes QUERY_CONTRACT knows', () => {
    const contract = Object.keys(QUERY_CONTRACT)
      .filter((path) => path !== '/health')
      .sort();
    expect(Object.keys(ROUTE_DATA).sort()).toEqual(contract);
  });

  it('declares each route its query parameters, and no others', () => {
    const doc = buildDocument();
    for (const [path, accepted] of Object.entries(QUERY_CONTRACT)) {
      const operation = doc.paths?.[path.replace(/:([A-Za-z]+)/g, '{$1}')]?.get;
      const declared = (operation?.parameters ?? [])
        .filter((parameter) => 'in' in parameter && parameter.in === 'query')
        .map((parameter) => ('name' in parameter ? parameter.name : ''));
      expect(declared.sort(), path).toEqual([...accepted].sort());
    }
  });
});
