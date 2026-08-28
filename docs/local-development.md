# Local development

1. Install dependencies with `npm install`.
2. To run on **another** Cloudflare account, follow [`self-hosting.md`](self-hosting.md) — `npm run setup` creates the D1 database and writes its id into `wrangler.jsonc`. The committed configuration points at this milestone's resources; there is no longer an R2 bucket to create.
3. Run `npm run db:migrate:local`. `npm run dev` starts a local preview with remote bindings, which is the recommended way to validate the MAL fetch; `npm run dev:local` uses the simulator for health and local D1 only.

Local development creates D1 state in the `.wrangler` directory. Do not use `load.json`: this milestone uses public HTML pages only. For a manual check, use `/v1/users/AMayacrab` without turning that name into configuration or hard-coded data.
