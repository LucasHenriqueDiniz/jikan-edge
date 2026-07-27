# Guia do projeto para agentes

## Estado e objetivo

`jikan-edge` possui o vertical slice inicial do **JikanV2** para o WeebProfile: Cloudflare Workers, Hono, D1, R2 e parsing de HTML público do MyAnimeList. O objetivo é validar a viabilidade no plano Free sem tentar reproduzir as 100 rotas do Jikan.

O código de produção do milestone está autorizado para perfil, estatísticas e listas de usuário, e — por decisão documentada em `docs/planning/jikan-v4-route-validation.md` ("Decisão de expansão (2026-07-26)") — para o catálogo P0 de anime: detalhe, gêneros, top e temporada atual. Preserve a separação entre cliente de fonte, parser puro, domínio, D1, serviços e HTTP.

**Decisão de paridade total (2026-07-26):** o usuário decidiu explicitamente ampliar o escopo para todas as rotas do Jikan (registrado em `docs/planning/jikan-v4-route-validation.md`, seção "Decisão de paridade total"). Isso substitui a limitação anterior de escopo — novos grupos de rotas (manga, personagens, pessoas, clubes, produtores, temporadas, watch, recomendações, reviews, magazines, schedules, busca) estão agora autorizados para implementação incremental, seguindo o mesmo padrão de qualidade por rota (probe real da página, fixture, parser, testes, contrato) já usado no catálogo de anime. Trabalho em andamento, por lotes.

## Ordem de leitura

1. `README.md`
2. `docs/architecture.md`
3. `docs/planning/jikan-v4-route-validation.md`
4. `docs/results/initial-viability.md`
5. A pesquisa aplicável em `docs/research/`

## Regras de trabalho

- Trate o Jikan como referência funcional, não como requisito de compatibilidade total.
- Use refresh controlado, D1 e stale fallback; nunca substitua dado válido por documento suspeito.
- Somente use `https://myanimelist.net`; URLs ficam centralizadas em `src/source/mal-urls.ts`.
- Não use browser headless, endpoints internos, scraping massivo ou URLs fornecidas pelo cliente.
- Não amplie o escopo para todas as rotas Jikan sem decisão documentada. A decisão de paridade total (linha acima) já cobre os grupos implementados: anime, manga, personagens, produtores, clubes, pessoas, temporadas, watch, recomendações, reviews, magazines, schedules e busca de anime/manga.
- Busca de anime/manga (`GET /v1/anime?q=`, `GET /v1/manga?q=`) implementada em 2026-07-26 — ver `docs/routes.md` para o contrato e a nota sobre o comportamento de fallback do MAL para queries sem match.
- Rotas derivadas por título de anime/manga (`relations`, `external`, `streaming`, `characters`, `staff`, `statistics`, `pictures`, `news`, `forum`, e `episodes` só para anime) estão implementadas — ver `docs/routes.md`. `episodes` busca só a primeira página do MAL (paginação de séries longas não confirmada).
- `GET /v1/characters/:id/pictures`, `GET /v1/people/:id/pictures` e `GET /v1/people/:id/news` implementados em 2026-07-26 — ver `docs/routes.md`. Personagens não têm página de notícias/fórum no MAL; pessoas não têm fórum (confirmado pelos links reais da página de detalhe, não suposição).
- `GET /v1/users?q=&page=` implementada em 2026-07-26 — ver `docs/routes.md`.
- **Busca de clubes está bloqueada por design do MAL, não por falta de implementação**: `clubs.php?q=` não filtra no servidor (confirmado, mesma lista para qualquer query); a busca real depende de um endpoint interno via JS que a regra abaixo já proíbe acessar. Não tente implementar sem antes revisitar `docs/planning/jikan-v4-route-validation.md`.
- `GET /v1/clubs/:id/staff` (derivado do detalhe, sem fetch novo), `GET /v1/clubs/:id/members?page=` e `GET /v1/clubs?page=` (índice sem busca) implementados em 2026-07-26 — ver `docs/routes.md`. A URL de membros usa `clubs.php?id=` (não `cid=` como o detalhe); o índice reaproveita `clubs.php` sem `q=`.
- `GET /v1/producers/:id/full` e `GET /v1/producers/:id/external` implementados em 2026-07-26 — ver `docs/routes.md`. Nota de bug real corrigido: hrefs nas seções "Available At"/"Resources" da página de produtor às vezes têm um `\r` literal colado antes da aspa de fechamento; o parser agora sanitiza isso.
- `GET /v1/characters?q=&page=` e `GET /v1/people?q=&page=` implementados em 2026-07-26 — ver `docs/routes.md`. Ao contrário de `clubs.php`, essas buscas filtram de verdade no servidor. Zero resultados: `character.php` responde 404; `people.php` responde 200 com "No results returned".
- `GET /v1/anime/:id/full` e `GET /v1/manga/:id/full` implementados em 2026-07-26 — ver `docs/routes.md`. `AnimeDetail`/`MangaDetail` já tinham relations/external(/streaming) desde o início, então `full` de anime só precisou adicionar `themeSongs` (openings/endings); `full` de manga é um alias puro do detalhe (não há mais nada real para adicionar).
- `GET /v1/characters/:id/anime`, `/manga` e `/voices` implementados em 2026-07-26 — ver `docs/routes.md`. Derivados da mesma URL de detalhe do personagem (um fetch só, três campos). Resta só `full` para o grupo de personagens.
- `GET /v1/people/:id/anime`, `/manga` e `/voices` implementados em 2026-07-26 — ver `docs/routes.md`. Também derivados da mesma URL de detalhe (um fetch só, três campos). Restam `top/people` e `full` para o grupo de pessoas.
- `GET /v1/characters/:id/full` e `GET /v1/people/:id/full` implementados em 2026-07-26 — ver `docs/routes.md`. Combinam detalhe + anime + manga + voices num fetch só, reaproveitando parsers já existentes (sem campo novo). **Grupo de personagens completo (7/7)**.
- `GET /v1/top/people?page=` implementado em 2026-07-26 — ver `docs/routes.md`. `people.php` sem `q=` é um ranking real (mesma classe `ranking-list` de `topanime.php`/`topmanga.php`), diferente da tentativa de busca (`?q=`, bloqueada) que usa a mesma URL base. **Grupo de pessoas completo (7/7)**.
- `GET /v1/top/characters?page=` implementado em 2026-07-26 — ver `docs/routes.md`. Mesmo padrão de `top/people` (`character.php` sem `q=`).
- **`/v1/top/reviews` investigado e recusado, não é falta de implementação**: `reviews.php` não tem sort por utilidade/votos, e a granularidade de data (só o dia, sem hora) impede intercalar de forma confiável os feeds de anime/mangá. Implementar seria um alias redundante de `/v1/reviews/anime`/`/v1/reviews/manga`. Não reabrir sem evidência nova de um mecanismo de ranking real no MAL.
- `GET /v1/anime/:id/recommendations`, `/v1/manga/:id/recommendations`, `/v1/anime/:id/reviews` e `/v1/manga/:id/reviews` implementados em 2026-07-26 — ver `docs/routes.md`. **Não reaproveite os parsers globais** (`recommendations.parser.ts`, `reviews.parser.ts`) para essas rotas — a estrutura por título é diferente o bastante (recomendações têm só um lado do par; reviews não linkam de volta pro título) que reaproveitar sem ajuste quebra silenciosamente. Usam `title-recommendations.parser.ts`/`title-reviews.parser.ts` dedicados.
- `GET /v1/anime/:id/moreinfo` e `GET /v1/manga/:id/moreinfo` implementados em 2026-07-26 — ver `docs/routes.md`. Texto livre de curadoria, ausente na maioria dos títulos (retorna `{ text: null }`, não erro).
- **`/v1/anime/:id/userupdates` e `/v1/manga/:id/userupdates` estão bloqueados por não existirem no MAL, não por falta de implementação**: comparação de bytes confirmou que esse sub-caminho cai no fallback silencioso da página de detalhe (mesmo comportamento de sub-caminhos inválidos). Não reabrir sem evidência nova de uma página real.
- Grupo de Usuários completo em 2026-07-26: `full`, `about`, `friends`, `clubs`, `reviews`, `recommendations` implementados (reviews/recs reutilizam os parsers globais com tolerância a vazio). `history` não implementado — página do MAL vazia sem login; `userupdates` cobre o equivalente público. `external` não implementado — sem fonte real no perfil.
- Grupo Random implementado em 2026-07-26 com política local documentada: sorteia só entre entidades já persistidas no D1 (`ORDER BY RANDOM()`), 404 `NO_LOCAL_ENTRIES` quando o catálogo local daquele tipo está vazio. Não faz varredura de IDs do MAL.
- Lote de paridade final (2026-07-26): `producers?q=` (diretório de ~895 em `/anime/producer`), `seasons` (arquivo), `anime/:id/videos` (+`/videos/episodes`), `anime/:id/episodes/:episode`, `anime/:id/themes` (projeção do `full`), `clubs/:id/relations`, e `anime|manga/:id/userupdates` — este último reverteu a exclusão anterior: a página própria não existe mesmo, mas o dado é público na página `/stats` (markup difere entre anime e manga; parser tolera os dois). Fórum por episódio individual segue fora.
- Paridade funcional (2026-07-27): filtros de busca server-side em `anime`/`manga` (`type`/`status`/`rating`/`score`/`genres`/`order_by`, todos verificados contra o comportamento real do MAL; busca só por filtros sem `q` é válida), paginação em `reviews/*?page=` (`p=` nativo) e `recommendations/*?page=` (`show=` nativo, 100/página), `magazines?q=` (filtro local), e `schedules` agrupado por dia com `?filter=monday..sunday|other|unknown` — **mudança de contrato**: sem filtro retorna objeto por dia, não mais lista achatada.
- Rate limit endurecido em 2026-07-27 (pré-divulgação): chave por IP **global** (a antiga `IP:rota` multiplicava o orçamento pelo nº de rotas), dois bindings — burst 30/10s + sustentado 60/60s, com `Retry-After` no 429. Ver `docs/routes.md` seção "Rate limiting".
- Landing page pública adicionada em 2026-07-27 (decisão: mesmo repo, não repo separado): `site/index.html` estático servido pelo próprio Worker via `assets` no `wrangler.jsonc` (asset-first: `/` serve o site, `/v1/*` e `/health` seguem no Worker). Sem build step; o demo ao vivo da página usa fetch relativo à própria origem. Ao adicionar/remover grupos de rotas, atualize a grade de rotas e a tabela de limitações do site junto com o `docs/routes.md`.
- Para limites, preços e APIs de plataforma, pesquise documentação oficial atual antes de afirmar algo.

## Rotas não implementadas (lista consolidada)

Cada uma foi investigada contra as páginas reais do MAL; a evidência detalhada está em `docs/routes.md`. **Não reabrir nenhuma sem evidência nova** — a razão de cada bloqueio está registrada:

| Rota Jikan | Estado | Motivo |
| --- | --- | --- |
| `genres/anime`, `genres/manga` | registradas, retornam 500 | MAL serve barra de gêneros truncada (~12 de 40+/300+) para a rede da Cloudflare; recusamos cachear dado incompleto como completo |
| `clubs?q=` (busca de clubes) | `q` ignorado (só índice) | `clubs.php?q=` não filtra no servidor; a busca real é endpoint interno JS, proibido pela política de fonte |
| `top/reviews` | não servida | MAL não tem ranking de reviews (sem sort por utilidade, data com granularidade de dia); seria alias disfarçado de `reviews/anime` |
| `users/:u/history` | não servida | página de histórico vazia sem login; `users/:u/userupdates` cobre o equivalente público |
| `users/:u/external` | não servida | perfil do MAL não expõe links externos estruturados |
| `users/userbyid/:id` | não servida | depende de mecanismo interno do Jikan, sem página pública do MAL por trás |
| fórum por episódio | não servida | sem página pública dedicada confiável por episódio |

Limitações conhecidas em rotas servidas: `anime/:id/episodes` só primeira página do MAL; `anime/:id/streaming` pode vir vazio em produção (geo-dependente); `random/*` sorteia só do catálogo local D1; busca textual sem match reflete o fallback do próprio MAL (títulos populares), não lista vazia.

## Estado de validação

O slice está publicado e as medições pontuais estão registradas. Antes de ampliar o produto, adicione fixtures sanitizadas, benchmark de corpus (p50/p95), testes de stale/leases e contrato da nova rota.

Corpus real de produção medido em duas rodadas em 2026-07-26 via `wrangler tail` — ver `docs/results/2026-07-26-catalog-corpus-benchmark.md`. A remedição pós-paridade (49 misses cobrindo todas as famílias, plano Workers Paid) fechou em **p50 7ms / p95 27ms / máx 48ms** de cpuTime; a cauda pesada é explicável pelo tamanho do documento (One Piece manga characters 48ms, pessoa prolífica full 41ms, magazines 27ms) e está confortável no teto de 30s do plano pago. Uma tentativa anterior de otimizar `MalClient` para ler só um prefixo do corpo foi revertida (picos apareciam igualmente na versão original; causa externa ao código, irrelevante após o upgrade de plano). Follow-up conhecido: clube inexistente (`clubs.php?cid=` inválido) hoje vira 500 `UPSTREAM_SUSPICIOUS` — deveria mapear para 404.
