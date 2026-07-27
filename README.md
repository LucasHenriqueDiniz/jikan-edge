# jikan-edge

Cloudflare-native para o WeebProfile, com o objetivo de paridade total com o Jikan (decisão registrada em `docs/planning/jikan-v4-route-validation.md`). Coleta somente HTML público do MyAnimeList, normaliza os dados e mantém no D1 com cache stale-while-revalidate.

Escopo atual: `GET /health`, perfil/estatísticas/favoritos/updates/listas de usuário, catálogo de anime (detalhe, top, temporada atual/por ano/futura), catálogo de manga (detalhe, top), personagens, produtores e clubes. `genres/anime` e `genres/manga` estão bloqueados por uma restrição de rede do MAL (ver `docs/routes.md`). Ainda não implementa busca de anime/manga, pessoas, watch, recomendações, reviews, magazines, schedules ou scraping massivo/endpoints internos do MAL. Trabalho em andamento por lotes — ver `docs/planning/jikan-v4-route-validation.md`.

## Desenvolvimento

```powershell
npm install
npx wrangler d1 create jikan-edge
npx wrangler r2 bucket create jikan-edge-snapshots
npm run db:migrate:local
npm run dev
```

`npm run dev` abre um preview local com bindings remotas, permitindo validar o fetch externo real; `npm run dev:local` usa o simulador. Use `npm test`, `npm run typecheck`, `npm run build` e `npm run benchmark`. Para aplicar no D1 remoto, rode `npm run db:migrate:remote`; deploy é `npm run deploy`.

Consulte [arquitetura](docs/architecture.md), [API](docs/api.md), [desenvolvimento local](docs/local-development.md), [política de fonte](docs/source-policy.md) e o [relatório inicial](docs/results/initial-viability.md).
