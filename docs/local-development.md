# Local development

1. Install dependencies with `npm install`.
2. To run on **another** Cloudflare account, follow [`self-hosting.md`](self-hosting.md) — `npm run setup` creates the D1 database and writes its id into `wrangler.jsonc`. The committed configuration points at this milestone's resources; there is no longer an R2 bucket to create.
3. Run `npm run db:migrate:local`. `npm run dev` starts a local preview with remote bindings, which is the recommended way to validate the MAL fetch; `npm run dev:local` uses the simulator for health and local D1 only.
4. Run `git config core.hooksPath .githooks` once per clone. Git versions the hook but not the setting that points at it, so a fresh clone has `.githooks/commit-msg` on disk and inactive. It strips AI attribution trailers from commit messages, leaving a human `Co-authored-by` alone. Note that `core.hooksPath` **replaces** `.git/hooks` rather than adding to it — harmless here, where that directory holds only Git's `.sample` files, but check before running it in a repo that has hooks of its own.

Local development creates D1 state in the `.wrangler` directory. Do not use `load.json`: this milestone uses public HTML pages only. For a manual check, use `/v1/users/AMayacrab` without turning that name into configuration or hard-coded data.
