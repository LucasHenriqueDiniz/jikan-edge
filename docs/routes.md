# Rotas do jikan-edge

Base publicada: `https://jikan-edge.lucas-hdo.workers.dev`.

| Método | Rota | Fonte quando há refresh | Cache D1 | TTL |
| --- | --- | --- | --- | --- |
| GET | `/health` | nenhuma | nenhuma | — |
| GET | `/v1/users/:username` | `https://myanimelist.net/profile/:username` | `users`, `user_statistics`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/statistics` | a mesma rota de perfil | `users`, `user_statistics`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/favorites` | a mesma rota de perfil | `user_favorites`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/userupdates` | a mesma rota de perfil | `user_updates`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/animelist?page=&limit=` | `https://myanimelist.net/animelist/:username` | `user_media_list_entries`, `cache_entries` | 2 h |
| GET | `/v1/users/:username/mangalist?page=&limit=` | `https://myanimelist.net/mangalist/:username` | `user_media_list_entries`, `cache_entries` | 2 h |
| GET | `/v1/users/:username/full` | combina perfil + estatísticas + favoritos + updates (mesma página de perfil) | as mesmas dos componentes | 6 h |
| GET | `/v1/users/:username/about` | campo derivado do perfil (sem fetch novo) | `users`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/friends` | `https://myanimelist.net/profile/:username/friends` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/clubs` | `https://myanimelist.net/profile/:username/clubs` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/reviews` | `https://myanimelist.net/profile/:username/reviews` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/users/:username/recommendations` | `https://myanimelist.net/profile/:username/recommendations` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/users?q=&page=` | `https://myanimelist.net/users.php?q=` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/random/anime` | nenhuma (sorteio do catálogo local D1 — ver nota) | `anime` | — |
| GET | `/v1/random/manga` | nenhuma (sorteio do catálogo local D1) | `manga` | — |
| GET | `/v1/random/characters` | nenhuma (sorteio do catálogo local D1) | `characters` | — |
| GET | `/v1/random/people` | nenhuma (sorteio do catálogo local D1) | `people` | — |
| GET | `/v1/random/users` | sorteia um perfil já salvo e devolve via fluxo normal de perfil | `users`, `cache_entries` | 6 h |
| GET | `/v1/anime?q=&page=` | `https://myanimelist.net/anime.php?q=` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id` | `https://myanimelist.net/anime/:id` | `anime`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/full` | mesma URL de detalhe, parse mais rico (openings/endings) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/relations` | mesma rota de detalhe (campo derivado, sem fetch novo) | `anime`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/external` | mesma rota de detalhe (campo derivado, sem fetch novo) | `anime`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/streaming` | mesma rota de detalhe (campo derivado, sem fetch novo) | `anime`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/characters` | `https://myanimelist.net/anime/:id/x/characters` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/staff` | mesma rota de personagens (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/statistics` | `https://myanimelist.net/anime/:id/x/stats` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/pictures` | `https://myanimelist.net/anime/:id/x/pics` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/news` | `https://myanimelist.net/anime/:id/x/news` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/forum` | `https://myanimelist.net/anime/:id/x/forum` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/episodes` | `https://myanimelist.net/anime/:id/x/episode` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/episodes/:episode` | `https://myanimelist.net/anime/:id/x/episode/:episode` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/videos` | `https://myanimelist.net/anime/:id/x/video` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/videos/episodes` | mesma rota de videos (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/userupdates` | `https://myanimelist.net/anime/:id/x/stats` (mesma página de statistics) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/themes` | campo derivado de `/v1/anime/:id/full` (sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/recommendations` | `https://myanimelist.net/anime/:id/x/userrecs` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/reviews?page=` | `https://myanimelist.net/anime/:id/x/reviews` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/anime/:id/moreinfo` | `https://myanimelist.net/anime/:id/x/moreinfo` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/genres/anime` | `https://myanimelist.net/anime/genre/1/Action` (barra lateral de gêneros) | `catalog_lists`, `cache_entries` | **bloqueado (500)** — ver nota abaixo |
| GET | `/v1/top/anime?page=` | `https://myanimelist.net/topanime.php` (paginação nativa do MAL, 50/página) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/seasons` | `https://myanimelist.net/anime/season/archive` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/seasons/now` | `https://myanimelist.net/anime/season` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/seasons/:year/:season` | `https://myanimelist.net/anime/season/:year/:season` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/seasons/upcoming` | `https://myanimelist.net/anime/season/later` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga?q=&page=` | `https://myanimelist.net/manga.php?q=` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id` | `https://myanimelist.net/manga/:id` | `manga`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/full` | alias de `/v1/manga/:id` (mesmo dado, sem fetch novo — ver nota abaixo) | `manga`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/relations` | mesma rota de detalhe (campo derivado, sem fetch novo) | `manga`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/external` | mesma rota de detalhe (campo derivado, sem fetch novo) | `manga`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/characters` | `https://myanimelist.net/manga/:id/x/characters` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/statistics` | `https://myanimelist.net/manga/:id/x/stats` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/pictures` | `https://myanimelist.net/manga/:id/x/pics` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/news` | `https://myanimelist.net/manga/:id/x/news` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/forum` | `https://myanimelist.net/manga/:id/x/forum` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/recommendations` | `https://myanimelist.net/manga/:id/x/userrecs` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/reviews?page=` | `https://myanimelist.net/manga/:id/x/reviews` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/moreinfo` | `https://myanimelist.net/manga/:id/x/moreinfo` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/manga/:id/userupdates` | `https://myanimelist.net/manga/:id/x/stats` (mesma página de statistics) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/genres/manga` | `https://myanimelist.net/manga/genre/1/Action` | `catalog_lists`, `cache_entries` | **bloqueado (500)** — ver nota abaixo |
| GET | `/v1/top/manga?page=` | `https://myanimelist.net/topmanga.php` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/top/people?page=` | `https://myanimelist.net/people.php` (paginação nativa `limit=`, 50/página) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/top/characters?page=` | `https://myanimelist.net/character.php` (paginação nativa `limit=`, 50/página) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/characters?q=&page=` | `https://myanimelist.net/character.php?q=` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/characters/:id` | `https://myanimelist.net/character/:id` | `characters`, `cache_entries` | 6 h |
| GET | `/v1/characters/:id/full` | mesma URL de detalhe, combina detalhe + anime + manga + voices | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/characters/:id/anime` | mesma URL de detalhe (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/characters/:id/manga` | mesma URL de detalhe (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/characters/:id/voices` | mesma URL de detalhe (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/characters/:id/pictures` | `https://myanimelist.net/character/:id/x/pics` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/producers?q=` | `https://myanimelist.net/anime/producer` (diretório completo; filtro `q` local) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/producers/:id` | `https://myanimelist.net/anime/producer/:id` | `producers`, `cache_entries` | 6 h |
| GET | `/v1/producers/:id/full` | mesma URL de detalhe, parse mais rico | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/producers/:id/external` | mesma rota de `full` (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/clubs?page=` | `https://myanimelist.net/clubs.php` (sem busca — ver nota sobre busca de clubes) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/clubs/:id` | `https://myanimelist.net/clubs.php?cid=:id` | `clubs`, `cache_entries` | 6 h |
| GET | `/v1/clubs/:id/staff` | mesma rota de detalhe (campo derivado, sem fetch novo) | `clubs`, `cache_entries` | 6 h |
| GET | `/v1/clubs/:id/relations` | mesma página de detalhe do clube (fetch próprio, cache separado) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/clubs/:id/members?page=` | `https://myanimelist.net/clubs.php?id=:id&action=view&t=members` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people?q=&page=` | `https://myanimelist.net/people.php?q=` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people/:id` | `https://myanimelist.net/people/:id` | `people`, `cache_entries` | 6 h |
| GET | `/v1/people/:id/full` | mesma URL de detalhe, combina detalhe + anime + manga + voices | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people/:id/anime` | mesma URL de detalhe (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people/:id/manga` | mesma URL de detalhe (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people/:id/voices` | mesma URL de detalhe (campo derivado, sem fetch novo) | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people/:id/pictures` | `https://myanimelist.net/people/:id/x/pics` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/people/:id/news` | `https://myanimelist.net/people/:id/x/news` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/watch/episodes` | `https://myanimelist.net/watch/episode` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/watch/episodes/popular` | `https://myanimelist.net/watch/episode/popular` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/watch/promos` | `https://myanimelist.net/watch/promotion` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/watch/promos/popular` | `https://myanimelist.net/watch/promotion/popular` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/recommendations/anime` | `https://myanimelist.net/recommendations.php?s=recentrecs&t=anime` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/recommendations/manga` | `https://myanimelist.net/recommendations.php?s=recentrecs&t=manga` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/reviews/anime` | `https://myanimelist.net/reviews.php?t=anime` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/reviews/manga` | `https://myanimelist.net/reviews.php?t=manga` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/magazines` | `https://myanimelist.net/manga/magazine` | `catalog_lists`, `cache_entries` | 6 h |
| GET | `/v1/schedules` | `https://myanimelist.net/anime/season/schedule` | `catalog_lists`, `cache_entries` | 6 h |

`page` começa em 1; `limit` é limitado a 1–300 (padrão 100, só se aplica às listas de usuário — `top/anime`/`top/manga` paginam por página nativa do MAL, sem `limit`). Usernames aceitam somente ASCII alfanumérico, `_` e `-`, com até 32 caracteres. IDs numéricos (anime/manga/character/producer/club) devem ser inteiros positivos (400 se não forem). `:season` aceita `winter`/`spring`/`summer`/`fall`. Todas as respostas incluem `meta`; erros incluem `error.code` e `requestId`.

**`genres/anime` e `genres/manga` retornam 500**: o MAL serve uma taxonomia de gêneros reduzida (~12-13 itens, real é 40+/300+) especificamente para requisições vindas da rede da Cloudflare — confirmado comparando fetch direto vs. Worker publicado. O parser rejeita esse resultado incompleto em vez de aceitar silenciosamente. Ver [docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md](results/2026-07-26-genre-taxonomy-cloudflare-network-block.md).

Simplificações conhecidas: `top/anime`, `top/manga`, `top/people`, `seasons/*` retornam campos enxutos (`AnimeListEntry`/`MangaListEntry`/`TopPersonEntry`), não o detalhe completo — use `/v1/anime/:id`/`/v1/manga/:id`/`/v1/people/:id` para o detalhe. `character`/`producer`/`club` retornam metadados básicos (nome, imagem, favoritos, etc.), sem listas relacionadas de anime/manga/membros/papéis de dublagem.

`GET /v1/top/people?page=` (implementado em 2026-07-26) usa `people.php` sem query — a mesma URL cuja tentativa de busca (`?q=`) já está documentada, mas sem `q=` ela vira o ranking real "People" por favoritos (mesma classe `ranking-list` usada por `top/anime`/`top/manga`), com paginação nativa via `limit=` (não `show=`, que é só usado pela busca). Fecha o grupo de Pessoas (7/7 rotas do inventário Jikan).

`GET /v1/top/characters?page=` (implementado em 2026-07-26) segue o mesmo padrão: `character.php` sem `q=` é o ranking real "Characters" por favoritos, com duas colunas extras (`animeography`/`mangaography`) listando as obras em que o personagem aparece — cada uma como `{malId, title}`, sem imagem/papel (isso já existe em detalhe via `/v1/characters/:id/anime`). Paginação nativa via `limit=`, 50/página.

**`/v1/top/reviews` não foi implementado — decisão deliberada, não pendência**: o MAL não tem nenhum mecanismo de ranking de reviews por utilidade/votos. `reviews.php` (usada por `/v1/reviews/anime`/`/v1/reviews/manga`) só tem um modo, ordenado por data de publicação, com filtros de sentimento (Recommended/Mixed/Not Recommended) mas nenhum "sort by helpful" ou equivalente — confirmado inspecionando o form de filtro real da página, sem nenhum parâmetro de ordenação alternativa. Além disso, o campo de data exposto (`class="update_at"`) só tem granularidade de dia (ex. "Jul 26, 2026", repetido em várias reviews do mesmo dia), então nem seria possível intercalar de forma confiável os feeds de anime e mangá para simular uma rota unificada. Implementar `/v1/top/reviews` hoje seria, na prática, um alias redundante de `/v1/reviews/anime`/`/v1/reviews/manga` fingindo ser uma rota com semântica diferente — decisão de não fazer isso até haver evidência de um mecanismo de ranking real.

O projeto está no plano Workers Paid (upgrade feito em 2026-07-26) — o teto de CPU de 10ms do Free não se aplica mais. `/v1/people/:id` (página real de 1.25MB) foi implementado depois do upgrade.

`watch/episodes` e `watch/promos` não têm equivalente para manga (o MAL não tem página de vídeos de manga). `recommendations/*` e `reviews/*` mostram só a lista "mais recentes" (primeira página), sem paginação. `schedules` reaproveita o mesmo parser de `seasons/now` (mesma estrutura de cards no MAL), sem agrupar por dia da semana ainda.

`anime`/`manga` (busca) aceitam `q` (1-64 caracteres) e, desde 2026-07-27, **filtros server-side verificados um a um contra o comportamento real do MAL**: `type` (anime: tv/ova/movie/special/ona/music; manga: manga/novel/lightnovel/oneshot/doujin/manhwa/manhua), `status` (airing|publishing/complete/upcoming), `rating` (só anime: g/pg/pg13/r17/r/rx), `score` (mínimo, inteiro 1-10), `genres` (ids separados por vírgula, vira `genre[]=` repetido) e `order_by` (score/episodes|volumes/type — códigos de coluna dos links de ordenação reais da tabela de resultados; sempre descendente). Busca **só por filtros, sem `q`, é válida** (ex. `?genres=1&score=9`); `q` só é obrigatório quando não há nenhum filtro (senão seria um dump do catálogo). Valor de filtro inválido → 400 `INVALID_FILTER` com a lista de valores aceitos. `page` mapeia para o parâmetro nativo `show` do MAL (`show = (page-1)*50`). **Nota de comportamento do MAL, não bug**: para uma query textual sem nenhum resultado real, o MAL não retorna lista vazia — ele cai para um fallback com títulos populares não relacionados à busca. O parser reflete fielmente o que o MAL retorna.

Paginação adicionada em 2026-07-27: `reviews/anime|manga?page=` (parâmetro nativo `p=` do MAL, 50/página) e `recommendations/anime|manga?page=` (parâmetro nativo `show=`, 100/página). `magazines?q=` filtra localmente sobre o diretório completo já cacheado (mesmo padrão de `producers?q=`).

**`/v1/schedules` mudou de contrato em 2026-07-27**: sem `filter`, retorna um objeto agrupado por dia (`{monday: [...], ..., sunday: [...], other: [...], unknown: [...]}` — os mesmos nove grupos da página real do MAL); com `?filter=monday` (ou qualquer dia/other/unknown), retorna só a lista daquele dia. O formato achatado anterior foi descontinuado — era um subconjunto sem a informação de dia, que é o ponto da rota.

`relations`/`external`/`streaming` são derivados da mesma página de detalhe já buscada — não fazem fetch adicional, só projetam um campo do `AnimeDetail`/`MangaDetail` já cacheado (e disparam o mesmo fluxo de cache/refresh se ainda não tiver sido buscado). Relações são retornadas em formato simplificado (lista plana, não agrupada por tipo).

**`/v1/anime/:id/streaming` pode retornar vazio em produção mesmo quando a página tem dados reais** — confirmado que o widget de disponibilidade de streaming (JSON embutido em `data-raw`) está presente em fetch direto mas ausente no fetch via rede da Cloudflare para o mesmo anime no mesmo momento. Diferente do bug de gêneros, isso é plausivelmente esperado: disponibilidade de streaming é conteúdo geo-restrito por natureza, e a rede da Cloudflare provavelmente é detectada numa região diferente pelo MAL. Não investigado a fundo — baixa prioridade.

`characters`/`staff` vêm da página `/anime/:id/x/characters` (ou `/manga/:id/x/characters`) — **nota importante**: essa rota do MAL exige um segmento de slug não-vazio na URL (`/anime/{id}/{qualquer-texto}/characters`); omitir o slug retorna uma página bem menor e sem as tabelas de personagens/staff. Só o `id` importa pro roteamento do MAL, então usamos um slug fixo (`x`). `staff` é derivado da mesma página de personagens (sem fetch novo); manga não tem `staff` (equivalente já coberto por `authors` no detalhe).

`statistics`/`pictures`/`news`/`forum` (anime e manga) e `episodes` (só anime) foram implementados em 2026-07-26, seguindo o mesmo padrão de fetch dedicado + `catalog_lists`. **`episodes` só busca a primeira página** — o formato do parâmetro de paginação do MAL para séries longas não foi confirmado, então shows com muitos episódios retornam só os primeiros. `statistics` reaproveita os rótulos `Watching`/`Reading` e `Plan to Watch`/`Plan to Read` como variantes por tipo de mídia.

`characters/:id/pictures`, `people/:id/pictures` e `people/:id/news` foram implementados em 2026-07-26, reaproveitando `parsePictures`/`parseNews` sem alteração — só uma URL nova (mesmo padrão `/x/{recurso}` com slug fixo). Reconhecimento real confirmou que **personagens não têm página de notícias nem fórum no MAL** (`/character/:id/x/news` e qualquer sub-caminho não reconhecido caem de volta na home genérica do MAL, que expõe por acidente o widget lateral "Recent News" do site inteiro — não é conteúdo do personagem; confirmado comparando com um sub-caminho claramente inválido, que produz o mesmo resultado) e que **pessoas não têm fórum** (mesmo comportamento de fallback). Os links reais presentes na própria página de detalhe de personagem/pessoa confirmam a superfície disponível: personagem só linka `/featured` e `/pics`; pessoa só linka `/news` e `/pics`. **Nota de duplicação, não bug**: a página de imagens de pessoa repete cada `js-picture-gallery` duas vezes no HTML (célula visível + preview de hover) com a mesma URL; o parser já ignora a segunda ocorrência por não casar o padrão de adjacência esperado, então a contagem retornada é a de imagens únicas reais.

`GET /v1/users?q=&page=` foi implementada em 2026-07-26. **Comportamento de MAL a conhecer**: uma query com match exato de username faz o MAL responder com redirect 303 direto para a página de perfil (em vez da lista de resultados) — o `MalClient` já segue redirects automaticamente, então o parser reconhece as duas formas possíveis (lista real com marcador "User Search Results", ou página de perfil única) e devolve sempre uma lista, com 1 item no caso do match exato. Uma query sem nenhum match retorna HTTP 404 do próprio MAL (comportamento diferente da busca de anime/manga, que cai num fallback de títulos populares) — o Worker repassa esse 404 fielmente, sem fallback silencioso. Paginação nativa do MAL em blocos de 24 (`show=24`, `48`, ...).

**Busca de clubes não é viável pelas fontes públicas permitidas neste projeto** — reconfirmado em 2026-07-26 com evidência nova (a tentativa anterior só tinha o rótulo "resposta suspeita", sem causa raiz). O parâmetro `?q=` de `clubs.php` não faz filtragem nenhuma no servidor: uma busca por "anime" e uma busca por uma string sem sentido (`zzzznonexistentclubquery123xyz`) devolvem exatamente o mesmo conjunto de clubes (mesmos `cid`s, mesma ordem) que a página sem nenhuma query — confirmado comparando as listas de IDs extraídas. Inspecionando o HTML da própria página de clubes, o campo de busca real (`name="q"`, `v-model="keyword"`) é um componente Vue que intercepta o Enter (`@keydown.enter.prevent="jump()"`) e despacha para uma busca incremental via JS/AJAX — não existe filtragem server-side acessível por um parâmetro de URL simples. Seguir esse caminho exigiria depender do endpoint interno de busca incremental do MAL, o que a regra do projeto proíbe explicitamente (`Não use... endpoints internos`). Permanece bloqueada até haver decisão de manter um índice de clubes próprio.

`GET /v1/clubs/:id/staff` é derivado do mesmo `ClubDetail` já buscado (campo `staff`, já existente desde a implementação original — sem fetch novo). `GET /v1/clubs/:id/members?page=` usa uma URL real diferente da de detalhe (`clubs.php?id=:id&action=view&t=members`, note o parâmetro `id` em vez de `cid` usado no detalhe — confirmado nos links reais da própria página de clube), com paginação nativa do MAL em blocos de 36 (`show=36`, `72`, ...). Estrutura de linha idêntica à de `users?q=` (mesmo marcador `<td align="center"  class="borderClass">`), mas sem o campo de data de entrada.

`GET /v1/clubs?page=` (índice, implementado em 2026-07-26) é a mesma página usada para tentar a busca (`clubs.php`), só que sem o parâmetro `q` — retorna a listagem padrão do MAL, paginada nativamente com `p=2`, `p=3`, ... (não `show=`, diferente da maioria das outras listas deste projeto). Contém uma seção de clubes "em destaque" fixa que se repete nas primeiras posições de várias páginas — comportamento do próprio MAL, não um bug do parser.

`GET /v1/producers/:id/full` (implementado em 2026-07-26) busca a mesma URL de `/v1/producers/:id`, mas com um parser mais completo que também extrai a descrição (`about`) e os links externos (`external`) das seções "Available At" e "Resources" da página real. `GET /v1/producers/:id/external` projeta só o campo `external` de `full` (sem fetch novo). **Bug real de marcação do MAL, não do parser**: vários hrefs nessas seções têm um caractere de carriage return (`\r`) literal colado antes da aspa de fechamento do atributo (confirmado nos bytes brutos da página, ex. `href="http://pierrot.jp/\r"`); `z.string().url()` valida essas URLs como válidas mesmo assim (o construtor `URL` do JS descarta esses caracteres na normalização interna, mas não altera a string original), então sem tratamento explícito o `\r` vazava para o JSON de resposta. O parser agora remove `\t`/`\r`/`\n` da URL capturada antes de validar. Coberto por fixture de regressão (`tests/fixtures/producers/full-valid.html`, que inclui um CR real injetado via byte, não uma entidade HTML).

`GET /v1/characters?q=&page=` e `GET /v1/people?q=&page=` (implementados em 2026-07-26) usam `character.php`/`people.php`, confirmados como busca real no servidor (duas queries reais e distintas devolvem conjuntos de IDs completamente diferentes — ao contrário de `clubs.php`). Paginação nativa em blocos de 50 (`show=50`, `100`, ...), mesmo esquema de `anime?q=`/`manga?q=`. **Comportamento de zero resultados difere entre os dois**: `character.php` responde HTTP 404 puro (igual à busca de usuários — sem fallback), já `people.php` responde 200 com um marcador explícito "No results returned" e tabela vazia; o parser de pessoas reconhece esse marcador e devolve lista vazia em vez de tentar (e falhar) extrair linhas de uma tabela sem `<tr>` de dados.

`GET /v1/anime/:id/full` (implementado em 2026-07-26) busca a mesma URL de `/v1/anime/:id`, com um parser mais rico que reaproveita `parseAnimeDetail` e adiciona `themeSongs.openings`/`themeSongs.endings` (título, artista, episódios) das seções reais "Opening Theme"/"Ending Theme" da página — confirmado com Cowboy Bebop (1 abertura, 3 encerramentos) e Naruto (8 aberturas, 14 encerramentos, série longa com muitas trocas de tema). Campo distinto do já existente `themes: string[]` (que é a tag de gênero "Themes" do MAL, tipo "Isekai"/"Military" — conceito diferente).

**`GET /v1/manga/:id/full` é um alias puro de `/v1/manga/:id`, não uma rota nova de verdade**: a página de detalhe de mangá do MAL já inclui tudo que o schema `full` do Jikan adicionaria (relations, external links) — não existe conceito de openings/endings ou streaming para mangá. Documentado assim porque é o que a página real oferece, não uma limitação da implementação.

`GET /v1/characters/:id/anime`, `/manga` e `/voices` (implementados em 2026-07-26) são derivados da mesma URL de detalhe do personagem (`character/:id`) — as três seções (Animeography, Mangaography, Voice Actors) já vêm juntas na página, então um único fetch é reaproveitado para os três campos (mesmo padrão de `characters`/`staff` do anime). Estrutura de linha idêntica entre animeography e mangaography (só muda `/anime/` por `/manga/` no link); voice actors usa blocos `<table>` separados por dublador, um por idioma. **Campos legitimamente vazios, não erro**: um personagem pode não ter mangaography (original, nunca adaptado) ou animeography (só existe em mangá), e personagens secundários podem não ter nenhum dublador creditado — o parser não lança erro nesses casos, só devolve lista vazia.

`GET /v1/people/:id/anime` (posições de staff), `/manga` (créditos como autor) e `/voices` (papéis de dublagem) — implementados em 2026-07-26, derivados da mesma URL de detalhe da pessoa. Três tabelas distintas na mesma página (`js-table-people-staff`, `js-table-people-manga`, `js-table-people-character`), cada linha já identificável pela própria classe CSS, então o parser não precisa delimitar seções por cabeçalho — só filtra por classe de linha em todo o documento. `anime`/`manga` trazem `positions: string[]` (ex. `["Director", "Screenplay"]`, separadas por vírgula; "Story & Art" de mangaká fica como um item só, sem quebrar no "&"). `voices` traz o par anime+personagem por papel de dublagem, com papel ("Main"/"Supporting") e imagens de ambos. Testado com Kouichi Yamadera (591 papéis de dublagem — dublador muito prolífico), Shinichirou Watanabe (48 posições de staff) e Eiichiro Oda (16 mangás) para validar em escala real, não só o caso mínimo do fixture.

`GET /v1/characters/:id/full` e `GET /v1/people/:id/full` (implementados em 2026-07-26) fecham o grupo de personagens e pessoas. Diferente do `full` de anime/produtor, aqui não há nenhum campo genuinamente novo para extrair — os parsers de `anime`/`manga`/`voices` já existiam e já foram testados nas rotas próprias; `full` só faz **um fetch** da mesma página de detalhe e combina detalhe + as três listas num objeto só, evitando quatro requisições separadas para quem precisa de tudo de uma vez. Contagens conferidas batendo exatamente com as rotas individuais em produção (personagem Spike Spiegel: 3/2/14; pessoa Kouichi Yamadera: 6/0/591).

`GET /v1/anime/:id/recommendations` e `GET /v1/manga/:id/recommendations` (implementados em 2026-07-26) usam `/{type}/:id/x/userrecs` — diferente da lista global `/v1/recommendations/anime`, aqui o título já é fixo (é o próprio `:id`), então cada card só mostra a OUTRA obra recomendada. Campo `votes` é `1 + N` quando existe o link "Read recommendations by N more users" (ausência do link = exatamente 1 voto, não 0). Sem paginação (página única do MAL, ex. 166 recomendações para Cowboy Bebop, 138 para Berserk).

`GET /v1/anime/:id/reviews?page=` e `GET /v1/manga/:id/reviews?page=` (implementados em 2026-07-26) usam `/{type}/:id/x/reviews`, com paginação nativa via `p=`. **Diferente da lista global `/v1/reviews/anime`/`/v1/reviews/manga`**: a página por título não linka de volta para o próprio título em cada review (não faz sentido, já é implícito na URL), então o payload não tem `malId`/`title` — só os dados do review em si (usuário, avatar, data, tag, nota, texto). Tentar reaproveitar o parser da lista global sem ajuste faria cada review falhar a validação (título vazio) e a rota inteira retornar vazio — por isso existe um parser dedicado (`title-reviews.parser.ts`) que reaproveita a mesma extração de campos, só sem a parte de identificar o título.

`GET /v1/anime/:id/moreinfo` e `GET /v1/manga/:id/moreinfo` (implementados em 2026-07-26) usam `/{type}/:id/x/moreinfo` — texto livre de notas de curadoria do MAL (ordem sugerida de visualização, trivia sobre protótipos/obras relacionadas, licenciamento expirado, etc.), extraído do `<h2 class="mb8">More Info</h2>` até o início do bloco de anúncios. **A maioria dos títulos não tem essa seção** (confirmado testando vários IDs reais em produção: Cowboy Bebop, Berserk e Trigun têm conteúdo; Naruto e outros retornam `null`) — o parser nunca lança erro por ausência, só devolve `{ "text": null }`.

**`/v1/anime/:id/userupdates` e `/v1/manga/:id/userupdates` — implementados em 2026-07-26, revertendo a exclusão anterior com evidência nova**: a conclusão original (correta) era que `/{type}/:id/{slug}/userupdates` não existe como página própria do MAL — qualquer sub-caminho inválido cai de volta na página de detalhe. O que a investigação inicial não tinha notado é que **o dado em si é público em outra página**: a seção de updates recentes de membros vive na mesma página `/stats` já usada por `/statistics` (é exatamente de lá que o Jikan upstream extrai). A rota agora busca a página de stats (cache key próprio) e extrai as linhas de membros. **Nota de marcação**: as variantes de anime e manga dessa página usam markup diferente (anime: células compactas `class="ac"`; manga: células multi-linha `align="center"` com colunas separadas de volumes/capítulos) — o parser ancora nos avatares (`image-member`) e tolera os dois formatos.

`GET /v1/users/:username/{full,about,friends,clubs,reviews,recommendations}` (implementados em 2026-07-26) fecham o grupo de Usuários. `about` e `full` são derivados/combinados do que já vinha da página de perfil (sem fetch novo além dos componentes); `friends`/`clubs`/`reviews`/`recommendations` usam as sub-páginas reais do perfil. Reviews e recomendações de usuário reutilizam exatamente os mesmos parsers das listas globais (estrutura idêntica no MAL), com tolerância a lista vazia — usuário sem reviews é um resultado válido `[]`, não erro. **`/v1/users/:username/history` não foi implementado — a página `/history/:username` do MAL renderiza vazia sem login (confirmado na investigação original do projeto); o dado equivalente já é servido por `/v1/users/:username/userupdates`, que vem da seção "Last Updates" pública do perfil.**

**Correção de parsing do perfil (2026-07-27, reportada por um consumidor real durante um port)**: o parser de estatísticas de usuário capturava as **larguras em pixels do gráfico de barras** (`width: 221.9px`) em vez dos contadores reais — os números pareciam plausíveis porque o gráfico é proporcional, mas estavam errados (ex.: completed 221 quando o real era 233). Além disso, `episodesWatched`/`chaptersRead`/`volumesRead` vinham sempre `null` porque os rótulos reais da página são `Episodes`/`Chapters`/`Volumes` em spans separados, não `Episodes Watched:`/`Chapters Read:`. Corrigido ancorando os contadores em `>Label</a>` e os totais em `>Label</span><span>`; a fixture sintética antiga foi substituída por markup copiado da página real. No mesmo lote: favoritos e userupdates passaram a emitir `malId` (camelCase, como o resto da API — antes vazava `mal_id`), favoritos de anime/mangá ganharam `startYear` (do `<span class="users">TV&middot;1998</span>`), `PARSER_VERSION` subiu para `user-html-v2`, e `withCache` agora trata divergência de `parser_version` como cache não-fresh (antes a versão era gravada mas nunca comparada, então dado errado sobrevivia até o TTL).

**Grupo Random (implementado em 2026-07-26) — política deliberadamente diferente do Jikan**: o MAL não tem página pública de "aleatório", e o Jikan upstream sorteia do banco de dados completo deles. Aqui, `/v1/random/{anime,manga,characters,people,users}` sorteia **apenas entre entidades já persistidas no D1 local** por requisições anteriores (`ORDER BY RANDOM()`). Catálogo vazio para aquele tipo retorna 404 `NO_LOCAL_ENTRIES` — não é erro de upstream, é só um convite a buscar alguns detalhes primeiro. O viés (só sorteia o que já foi visto) é intencional e documentado; a alternativa seria varredura massiva de IDs do MAL, que as regras do projeto proíbem.

**Lote de paridade final (2026-07-26)**: `GET /v1/producers?q=` (diretório real de ~895 produtoras em `/anime/producer`, mesmo formato do diretório de revistas, com filtro `q` aplicado localmente sobre o cache), `GET /v1/seasons` (arquivo de temporadas de `/anime/season/archive`, agrupado por ano decrescente), `GET /v1/anime/:id/videos` (página `/x/video` com três seções distintas: Trailers/PVs, Music Videos e vídeos de episódio), `GET /v1/anime/:id/videos/episodes` (projeção da mesma página), `GET /v1/anime/:id/episodes/:episode` (página real de episódio individual: título, título alternativo, duração, data de exibição e sinopse), `GET /v1/anime/:id/themes` (projeção do campo `themeSongs` já extraído pelo `full` — sem fetch novo), e `GET /v1/clubs/:id/relations` (seções Anime/Manga/Character Relations da própria página do clube — mesmo fetch do detalhe, cache separado).

Ainda fora (todas com evidência documentada): fórum por episódio individual, busca de clubes (ver nota acima), `/v1/top/reviews` (ver nota acima), `/v1/users/:username/history` (ver nota acima), `/v1/users/:username/external` (o perfil do MAL não expõe links externos estruturados — não há fonte real), `genres/anime|manga` (bloqueio de rede, ver nota acima).

## Rate limiting

Endurecido em 2026-07-27, antes de divulgação pública. Dois limites por **IP global** (a chave antiga era `IP:rota`, o que multiplicava o orçamento de um IP pelo número de rotas — ~5.700 req/min com 96 rotas; corrigido):

- **Burst**: 30 requisições / 10 s por IP (`API_BURST_LIMIT`).
- **Sustentado**: 60 requisições / 60 s por IP (`API_RATE_LIMIT`).

Espelha a política pública do próprio Jikan (3 req/s, 60 req/min). Estourou → 429 `RATE_LIMITED` com `Retry-After: 10` (burst) ou `60` (sustentado). A Rate Limiting API da Cloudflare é local ao colo e eventualmente consistente — o corte não é exato no limite (verificado em produção: rajada de 40 requisições alternando rotas diferentes produziu 429s, confirmando que a chave é global por IP e não por rota), então trate os números como alvo operacional, não como contrato rígido.

## Fluxo de cache

Um hit fresh não faz fetch ao MAL. Um miss faz um fetch da fonte, grava o dado normalizado e então `cache_entries`. Cache stale é devolvido se o refresh falhar; sem cache, a falha vira erro HTTP. O lease é por recurso e tem 30 segundos. O refresh é síncrono: ainda não há revalidação assíncrona.

As listas são obtidas de um único documento público do MAL; a paginação exposta é apenas D1, depois de persistir o snapshot. Não existe coleta de múltiplas páginas upstream neste slice.
