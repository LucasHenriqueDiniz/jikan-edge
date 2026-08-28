# Documentation

| Area | Content | State |
| --- | --- | --- |
| [`self-hosting.md`](self-hosting.md) | how to run your own instance on any Cloudflare account: setup, troubleshooting, plan limits and usage policy | active |
| [`routes.md`](routes.md) | the contract for every served route, with its MAL source, TTL and the verified limitations | active |
| `research/` | external research, with sources and dates | started |
| `architecture/` | architecture principles and decisions | started |
| `planning/` | scope, risks, experiments and milestones | started |
| `sources/` | how each MAL source delivers its data, with the measurements behind it — today [`mal-list-delivery.md`](sources/mal-list-delivery.md) | active |
| `adr/` | formal architecture decisions once there are mature alternatives | reserved |

## Documentation flow

```text
Verifiable research -> hypothesis -> experiment -> decision -> implementation
```

The project is still in the first three stages. Documentation must not describe a solution as implemented when it is only proposed.
