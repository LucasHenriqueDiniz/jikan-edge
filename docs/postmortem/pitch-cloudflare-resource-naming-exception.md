---
status: closed
epic: naming
---

> **Closed 2026-09-03.** Moved here from `docs/pitches/` so the pair reads as one thing: this is what
> was promised, [[cloudflare-resource-naming-exception]] is what happened. The decision it asked for
> is [[adr-cloudflare-resource-names]] — *accepted as an exception, the names do not change*.

# Cloudflare resource names, and the rename that is not a `git mv`

## The problem

The `naming` skill asks for `<owner>-<project>-<resource>-<env>`. The deployed resources carry
neither an owner prefix nor an environment suffix:

- `wrangler.jsonc:3` — `"name": "jikan-edge"`
- `wrangler.jsonc:35` — `"database_name": "jikan-edge"`

Under the convention these would be something like `lucashdo-jikan-edge-worker-prod` and
`lucashdo-jikan-edge-d1-prod`.

## Why this is the asymmetric case the skill warns about

The Worker name is the `*.workers.dev` hostname. `README.md:21` makes a promise about it:

> the previous hostname, `https://jikan-edge.lucas-hdo.workers.dev`, still serves the same Worker
> and is not scheduled for removal — existing integrations keep working without a change.

Renaming the Worker breaks that promise for anyone still on the old hostname. The custom domain
`jikan.lucashdo.com` (`wrangler.jsonc:11`) survives a rename; the workers.dev hostname does not.

The D1 rename is worse than a config edit. `database_id` `71f8a596-…` identifies the existing
database; a differently-named database is a different database, so the rename is a data migration
plus a deploy, executed against a live Cloudflare account.

## Why it sits on the board anyway

Not to be done — to stop being rediscovered. Every audit of this repo will find the naming gap
again unless the reasoning for keeping the names is written down somewhere an audit reads. That, and
not the rename, is what this epic delivers.
