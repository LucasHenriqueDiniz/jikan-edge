# Documentation

| Area | Content | State |
| --- | --- | --- |
| [`self-hosting.md`](self-hosting.md) | how to run your own instance on any Cloudflare account: setup, troubleshooting, plan limits and usage policy | active |
| [`routes.md`](routes.md) | the contract for every served route, with its MAL source, TTL and the verified limitations | active |
| `architecture/` | architecture principles and decisions — [`ARCHITECTURE.md`](architecture/ARCHITECTURE.md) is the record of what actually holds in the code, with the dated decisions, the declared divergences and the known gaps. **The ADRs live here**, named `adr-<topic>.md` | active |
| `pitches/` | one document per piece of work, written before it is researched or built | active |
| `plans/` | a directory of numbered vertical slices per pitch. `.kanban.json` mirrors these — the markdown is what decides | active |
| `postmortem/` | what finished work taught, and claims that turned out wrong. A pitch moves here as `pitch-<slug>.md` when its postmortem is written | active |
| `research/` | external research, with sources and dates | started |
| `results/` | probes, benchmarks and audits — the raw measurements the postmortems and decisions are argued from | active |
| `planning/` | scope, risks, experiments and milestones | started |
| `sources/` | how each MAL source delivers its data, with the measurements behind it — today [`mal-list-delivery.md`](sources/mal-list-delivery.md) | active |
| `product/`, `roadmap/` | part of the standard vault; nothing filed yet | empty |

`planning/` and `results/` predate this layout and overlap `plans/` and `postmortem/`. New records go
to the standard folders; the old two stay until a slice moves them together with the links that name
them — see the known gaps in [`ARCHITECTURE.md`](architecture/ARCHITECTURE.md).

## Documentation flow

```text
pitch -> research -> decision -> plan -> implement -> postmortem
```

The house loop, from the `workflow` skill. The API is deployed and serving, so most work now enters at
`pitch` and leaves at `postmortem`; the early research in `research/` and the probes in `results/` are
what the decisions are argued from. Documentation must not describe a solution as implemented when it
is only proposed.
