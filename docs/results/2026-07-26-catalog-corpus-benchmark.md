# Corpus real e p95 de produção — catálogo de anime

Data: 2026-07-26. Medição feita com `wrangler tail --format json` conectado ao Worker publicado (`jikan-edge`, versão `c429a5fd-46c3-4502-8f0e-c17cbaec4bd8`), capturando `cpuTime`/`wallTime` reais da Cloudflare por requisição — não o microbenchmark local de fixture sintética.

## Limite de referência

Confirmado agora na documentação oficial (developers.cloudflare.com/workers/platform/limits): **plano Free tem teto de 10 ms de CPU por requisição**; plano pago vai a 30 s por padrão (configurável até 5 min). A margem de 8 ms já usada nos benchmarks locais deste projeto é, portanto, um buffer de ~2 ms abaixo do teto real — não uma margem arbitrária.

## Anime detalhe (`GET /v1/anime/:id`) — 8 IDs reais, todos cache miss

Corpus escolhido para diversidade de tamanho/popularidade: franquias muito longas, um filme e títulos de porte médio.

| mal_id | Título | cpuTime (ms) | wallTime (ms) |
| ---: | --- | ---: | ---: |
| 21 | One Piece | **8** | **5314** |
| 269 | Bleach | 6 | 1760 |
| 52991 | Sousou no Frieren | 5 | 1635 |
| 20 | Naruto | 6 | 1525 |
| 9253 | Steins;Gate | 5 | 1466 |
| 30 | Neon Genesis Evangelion | 6 | 1487 |
| 5114 | Fullmetal Alchemist: Brotherhood | 5 | 1422 |
| 199 | Sen to Chihiro no Kamikakushi (Spirited Away) | 6 | 1347 |

- cpuTime: min 5 ms, p50 6 ms, **p95 8 ms**, max 8 ms.
- wallTime: min 1347 ms, mediana ~1487 ms, **One Piece é outlier a 5314 ms** — 3 a 4× o restante do corpus.

**Risco identificado:** o cpuTime de One Piece (8 ms) já encosta no teto real do Free plan (10 ms), não só na margem provisória de 8 ms. O parser (`parseAnimeDetail`) já limita sua própria leitura a `html.slice(0, 60_000)`, então o custo extra não vem da extração por regex — vem de `MalClient.getHtml` fazer `response.text()` do corpo **inteiro** antes de qualquer corte (até o teto de `maxUpstreamBytes`, 2 MiB). Páginas de franquias muito grandes parecem ser proporcionalmente mais pesadas para baixar/decodificar, não para parsear. Isso também explica o wallTime 3-4× maior — mais bytes trafegando e sendo decodificados, ainda bem dentro do timeout de 8 s (`sourceTimeoutMs`), mas sem folga generosa.

Amostra pequena (n=8): serve como primeiro corpus real, não como p95 estatisticamente robusto. Recomendado ampliar para pelo menos ~20-30 IDs reais, incluindo mais casos de franquias com centenas/milhares de episódios, antes de tratar este número como definitivo.

## Top anime (`GET /v1/top/anime?page=`) — 4 páginas reais, todas cache miss

| Página | cpuTime (ms) | wallTime (ms) |
| ---: | ---: | ---: |
| 2 | 5 | 1369 |
| 3 | 6 | 1365 |
| 4 | 6 | 1364 |
| 5 | 7 | 1344 |

cpuTime: min 5 ms, p50 6 ms, p95 7 ms. wallTime extremamente estável (~1.34-1.37 s) — esperado, já que cada página do MAL tem exatamente 50 linhas de tamanho comparável. Risco baixo, boa margem em relação ao teto de 10 ms.

## Gêneros e temporada atual — limitação da medição

`GET /v1/genres/anime` e `GET /v1/seasons/now` só puderam ser medidos em **cache hit** nesta rodada (cpuTime 1 ms, wallTime 157–190 ms) — ambos já estavam com TTL de 6 h aquecido desde o deploy, e não há mecanismo de bypass de cache nesta API para forçar um novo miss sob demanda. O miss real de cada um ocorreu durante o smoke test pós-deploy, antes do `wrangler tail` estar conectado, então não temos o `cpuTime` real desse fetch+parse específico — só a confirmação qualitativa de que funcionou (payloads de 1.226 e 39.060 bytes, respectivamente).

Diferente de anime detalhe/top anime, estes dois recursos são **singleton** (existe só uma página "gêneros" e uma "temporada atual" no MAL a qualquer momento) — não há um corpus de variações para amostrar; a única forma de capturar o cpuTime real do miss é aguardar a próxima expiração natural do TTL (~6 h) com o tail já conectado.

## Tentativa de otimização do `MalClient` (revertida)

Depois desta medição inicial, tentei otimizar `MalClient.getHtml` para ler só um prefixo do corpo via stream (`response.body.getReader()`) em vez de `response.text()` completo, já que `parseAnimeDetail` só usa os primeiros ~55 KB de qualquer página real testada. A ideia era reduzir o custo de download/decodificação para franquias grandes como One Piece.

**Isso foi revertido.** Ao medir de novo em produção com um corpus novo (8 IDs distintos), dois títulos (Death Note, Violet Evergarden) mostraram `cpuTime` de 13-14 ms — pior que o pior caso anterior (8 ms), sem correlação com o tamanho real do documento (Hunter x Hunter, 250 KB, ficou em 5 ms). Tentei uma segunda versão (acumular os chunks brutos e decodificar uma única vez no fim, em vez de decodificar a cada chunk) — o mesmo padrão de picos continuou (15 ms em dois títulos diferentes).

**Antes de aceitar "a leitura em stream piora as coisas" como conclusão, testei o código revertido (voltando a `response.text()` puro) com mais um corpus novo — e o mesmo tipo de pico (15 ms, Code Geass R2) apareceu ali também.** Ou seja: os picos de 13-15 ms não são causados pela tentativa de otimização — acontecem esporadicamente também na implementação original. Descartei a hipótese de que fosse o parser (`parseAnimeDetail` rodou em ~0,5 ms contra o HTML real de Code Geass R2 num teste local, muito abaixo dos 15 ms observados em produção). A causa mais provável está fora do código da aplicação — variância de cold start/isolamento do runtime da Cloudflare, ou como o `Transfer-Encoding: chunked` do MAL é entregue pela borda da Cloudflare para casos específicos — e não foi isolada nesta sessão.

**Estado final:** o código voltou ao `response.text()` original (sem leitura parcial). O único ganho real que ficou desta investigação foi um bug genuíno encontrado no caminho: algumas páginas do MAL usam o rótulo `Genre:`/`Studio:` no singular em vez de `Genres:`/`Studios:` (ex.: Violet Evergarden), o que quebrava tanto o marcador obrigatório quanto a extração — corrigido em `anime-detail.parser.ts` e `anime.service.ts`, com teste de regressão (`detail-singular-labels.html`).

## Recomendações (da rodada inicial — parcialmente superadas pela remedição abaixo)

1. Tratar o corpus de anime detalhe como preliminar (agora n=24 entre as três rodadas, mas medido sob três versões de código diferentes) — expandir com um corpus único e estável antes de qualquer decisão de produto que dependa deste número.
2. **Não vale a pena** truncar a leitura do corpo em `MalClient` — tentado e revertido nesta sessão (ver seção acima). Picos de 13-15 ms apareceram tanto na versão otimizada quanto na original; a causa não está no código da aplicação.
3. ~~Reagendar uma medição de miss real para `genres/anime` e `seasons/now` na próxima janela de expiração de TTL~~ — feito na remedição abaixo (os singletons expiraram naturalmente e foram medidos como miss real).
4. Os picos de 13-15 ms deixaram de ser um risco com o upgrade para o plano Workers Paid (feito em 2026-07-26; teto de CPU passou de 10 ms para 30 s).

## Remedição pós-paridade total (2026-07-26, ~20:50 UTC-3, plano Workers Paid)

Mesma metodologia (`wrangler tail --format json` conectado antes do disparo), agora sobre a superfície completa de rotas (85 registradas) na versão `4e7e45f7`. Corpus de **49 cache-miss reais** cobrindo todas as famílias — IDs e queries deliberadamente novos, e os recursos singleton (watch, reviews, recommendations, magazines, schedules) pegos numa janela pós-expiração natural do TTL de 6 h, então também foram misses genuínos.

### Agregado geral (49 misses)

- cpuTime: **p50 7 ms, p95 27 ms, máx 48 ms**. wallTime: tipicamente 1,1–1,7 s (dominado pelo fetch upstream), máx 3,1 s (`manga?q=vagabond`).
- No plano Free (teto 10 ms), **11 dos 49 misses teriam falhado ou ficado na zona de risco** — o upgrade não foi cosmético.

### Cauda pesada (tudo dentro do teto atual de 30 s, sem risco)

| Rota | cpuTime | Por quê |
| --- | ---: | --- |
| `/v1/manga/13/characters` (One Piece) | 48 ms | lista de personagens gigante de série longa |
| `/v1/people/1/full` (Tomokazu Seki) | 41 ms | página >1 MB de dublador prolífico + 4 parses no mesmo documento |
| `/v1/magazines` | 27 ms | diretório de 1.445 revistas num documento só |
| `/v1/seasons/2025/winter` | 27 ms | temporada completa (~200 cards) num documento só |
| `/v1/anime/5/characters` | 19 ms | tabelas de personagens+staff+dubladores |
| `/v1/schedules` | 18 ms | mesmo formato de temporada |

O padrão é consistente: o custo escala com o tamanho do documento e o número de itens extraídos, não há mais outliers inexplicados como na rodada do plano Free (os picos de 13-15 ms em páginas pequenas não reapareceram de forma anômala — 14-15 ms agora só aparecem onde o documento justifica).

### Por família (cpuTime dos misses)

| Família | n | p50 | máx |
| --- | ---: | ---: | ---: |
| Anime detalhe | 6 | 7 | 15 |
| Sub-rotas de anime por título (full/characters/stats/pics/news/forum/reviews/recs/moreinfo) | 9 | 5 | 19 |
| Manga detalhe + sub-rotas | 8 | 6,5 | 48 |
| Personagens (detalhe/full/pictures/busca) | 5 | 5 | 6 |
| Pessoas (detalhe/full) | 2 | — | 41 |
| Produtores (detalhe/full) | 2 | — | 8 |
| Clubes (members) | 1 | — | 5 |
| Buscas (anime/manga/users) | 3 | 6 | 10 |
| Usuário (perfil/friends/clubs/full/busca) | 5 | 8 | 12 |
| Tops (anime/manga/people/characters, páginas novas) | 4 | 8 | 10 |
| Listas globais (watch/reviews/recs/magazines/schedules/season) | 6 | 15,5 | 27 |
| Random (local, sem fetch) | 1 | — | 0 |

### Observações da rodada

- `/v1/anime/5/episodes` retornou **404 real do MAL** — id 5 é um filme (Cowboy Bebop: Tengoku no Tobira), que não tem página de episódios. Comportamento correto, repassado fielmente.
- `/v1/clubs/5` retornou 500 (`UPSTREAM_SUSPICIOUS`) — o clube de id 5 aparentemente não existe e o `clubs.php?cid=5` não responde com a estrutura esperada. Vale um follow-up para mapear "clube inexistente" para 404 em vez de 502/500, mas é tratamento de erro, não performance.
- `/v1/random/anime` custou **0 ms de cpuTime / 152 ms de wallTime** — como esperado para sorteio puramente local no D1, sem fetch.
- Cache hits continuam em ~1 ms de cpuTime (ex. `people?q=miyazaki`, hit da sessão de testes anterior).
