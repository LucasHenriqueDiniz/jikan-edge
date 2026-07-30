# Validação de rotas Jikan v4

> Fonte do inventário: [OpenAPI do Jikan REST](https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json), consultada em 2026-07-19.  
> Superfície atual: 100 rotas GET. Isto é uma referência de cobertura, não uma promessa de compatibilidade.

## Princípio de validação

Não fazer 100 scrapes independentes. Há dois níveis distintos:

1. **Fonte/parser:** testar cada tipo de página HTML do MyAnimeList com um corpus representativo e medir `cpuTime` da Cloudflare.
2. **Contrato:** para cada rota Jikan selecionada, testar a transformação dos dados já coletados para o JSON, paginação, erros e campos ausentes esperados.

Assim, por exemplo, `/anime/{id}`, `/anime/{id}/relations` e `/anime/{id}/themes` podem originar da mesma página principal, mas continuam três contratos diferentes.

## Inventário por grupo

| Grupo | Rotas | Rotas / famílias |
| --- | ---: | --- |
| Anime | 21 | detalhe, full, personagens, staff, episódios, notícias, fórum, vídeos, imagens, estatísticas, relações, temas, streaming, busca |
| Manga | 14 | detalhe, full, personagens, notícias, fórum, imagens, estatísticas, relações, reviews, external, busca |
| Usuários | 16 | perfil, about, estatísticas, favoritos, listas, amigos, clubes, histórico, reviews, recomendações, updates, busca |
| Personagens | 7 | detalhe, full, anime, manga, vozes, imagens, busca |
| Pessoas | 7 | detalhe, full, anime, manga, vozes, imagens, busca |
| Clubs | 5 | detalhe, membros, staff, relações, busca |
| Top | 5 | anime, manga, pessoas, personagens, reviews |
| Random | 5 | anime, manga, personagens, pessoas, usuários |
| Produtores | 4 | lista, detalhe, full, external |
| Seasons | 4 | lista, atual, upcoming, ano/estação |
| Watch | 4 | episódios e promos; recentes e populares |
| Genres | 2 | anime, manga |
| Recommendations | 2 | anime, manga |
| Reviews | 2 | anime, manga |
| Magazines | 1 | coleção/pesquisa |
| Schedules | 1 | calendário |

## Rotas de maior prioridade para o primeiro corpus

| Prioridade | Rotas | Motivo |
| --- | --- | --- |
| P0 | `/anime/{id}`, `/anime`, `/top/anime`, `/seasons/now`, `/genres/anime` | núcleo útil de catálogo e busca |
| P0 | `/users/{username}`, `/users/{username}/statistics`, `/users/{username}/animelist`, `/users/{username}/mangalist` | valida o tipo de perfil que já foi provado no spike |
| P1 | `/manga/{id}`, `/manga`, `/top/manga`, `/seasons/{year}/{season}` | segunda entidade e páginas de coleção |
| P1 | personagens, pessoas, produtores, relações e imagens | relações e modelos derivados |
| P2 | clubes, fórum, notícias, reviews, recomendações, watch, schedules | alta volatilidade, páginas comunitárias ou custo incerto |

## Critério por rota

Uma rota só recebe estado `validada` quando tiver:

- URL de origem identificada e página de fixture permitida;
- casos normal, vazio, 404 e resposta suspeita definidos quando aplicáveis;
- `cpuTime` p95 abaixo de 8 ms no corpus da família;
- schema de resposta e campos obrigatórios definidos;
- teste de contrato para paginação, filtros e nulos quando existirem;
- TTL, stale policy e custo de refresh registrados.

## Ordem de trabalho

1. Consolidar o corpus por famílias de páginas.
2. Executar probes de fetch/parsing por família — nunca varredura massiva.
3. Registrar CPU e qualidade de cada parser.
4. Criar adaptadores e testes de contrato por rota apenas para famílias aprovadas.
5. Manter uma matriz de estado: `não iniciada`, `probe`, `aprovada`, `bloqueada` ou `adiada`.

## Matriz após os probes de fonte

`Aprovada para fonte` abaixo significa apenas que o HTML respondeu e a medição pontual de CPU ficou dentro da margem; não equivale a uma rota de produto validada.

| Família | Estado de fonte | Pendência para rota de produto |
| --- | --- | --- |
| Anime: detalhe, busca, top, temporada atual, gêneros | fonte acessível; temporada atual medida em 7 ms | parsers de itens, fixtures, contratos e paginação |
| Anime: personagens/staff, fórum, moreinfo, notícias, imagens e reviews | fontes acessíveis; personagens/staff 7 ms, reviews 2 ms | **implementado integralmente** (personagens/staff, fórum, notícias, imagens e reviews em lotes anteriores; `moreinfo` em 2026-07-26) |
| Anime: episódios, vídeos, estatísticas | **fonte aprovada**: 2 ms, 2 ms e 1 ms | parser estruturado, fixtures e contratos; embed de vídeo confirmado em `youtube-nocookie.com` |
| Anime: recomendações e reviews por obra | fonte condicional: 7 ms, página de 1,054 MB | **implementadas em 2026-07-26** (`GET /v1/anime/:id/recommendations`, `GET /v1/anime/:id/reviews`) |
| Manga: detalhe, busca, top, gêneros, magazines | fonte acessível; top 1 ms e magazines 2 ms | parsers, fixtures e contratos; gêneros sem medição de CPU |
| Manga: personagens, fórum, moreinfo, notícias, imagens e reviews | fontes acessíveis; personagens 1 ms, reviews 2 ms | **implementado integralmente** (personagens, fórum, notícias, imagens e reviews em lotes anteriores; `moreinfo` em 2026-07-26) |
| Manga: recomendações e reviews por obra | fonte aprovada: 4 ms | **implementadas em 2026-07-26** (`GET /v1/manga/:id/recommendations`, `GET /v1/manga/:id/reviews`) |
| Manga: estatísticas | fonte aprovada: 2 ms | parser de distribuição, fixture e contrato |
| Usuário: perfil, listas e amigos | listas/aprovação de fonte em 5 ms e 4 ms; amigos 2 ms | parser de listas, filtros, privacidade, paginação e contratos |
| Usuário: histórico e reviews | fonte acessível | parser de itens e medição de CPU |
| Usuário: clubes | fonte aprovada: 2 ms; fixture positiva e vazia | parser de itens e contrato |
| Usuário: recomendações | fonte e resposta vazia aprovadas: 2 ms | fixture positiva e parser de itens |
| Usuários recentes | fonte aprovada: 2 ms | parser e decisão de produto; não é busca textual |
| Usuário: histórico canônico | transporte em 1 ms; marcador suspeito | inspeção estrutural, fixtures e parser |
| Personagem: detalhe, busca, imagens, anime, manga, voices e full | fonte acessível | **grupo completo (7/7)** — todas as rotas do inventário Jikan implementadas em 2026-07-26 |
| Pessoa: detalhe | **implementada em 2026-07-26** após upgrade para o plano Workers Paid — o bloqueio de CPU do Free (9 ms medido antes; página real de 1,25 MB confirmada em `/people/11/Kouichi_Yamadera`) deixou de se aplicar. `GET /v1/people/:id` em produção. | — |
| Pessoa: detalhe, busca, top, imagens, anime, manga, voices e full | fonte acessível | **grupo completo (7/7)** — todas as rotas do inventário Jikan implementadas em 2026-07-26 |
| Produtor: detalhe, full e external | fonte aprovada: 2 ms e 3 ms | **`full` e `external` implementados em 2026-07-26** (`GET /v1/producers/:id/full`, `GET /v1/producers/:id/external`); lista de produtores (`/v1/producers`, listagem sem busca) segue fora do escopo |
| Clube: índice, detalhe, membros e staff | fonte aprovada: 1 ms, 2 ms e 2 ms | **implementados em 2026-07-26**: `GET /v1/clubs?page=` (índice, sem busca), `GET /v1/clubs/:id/members`, `GET /v1/clubs/:id/staff` |
| Busca de clubes | **reconfirmada bloqueada em 2026-07-26** com causa raiz identificada: `clubs.php?q=` não filtra no servidor (query real e query sem sentido devolvem o mesmo conjunto de clubes); a busca real é um componente Vue client-side que despacha para um endpoint incremental interno, fora do que a regra do projeto permite acessar | exigiria índice de clubes próprio; sem isso, não há caminho válido |
| Schedules | fonte aprovada: 3 ms | parser de calendário e contrato |
| Temporada futura | **bloqueada no parser atual**: 12 ms | paginação/fonte menor/processamento fora do Free |
| Temporada por ano | condicional: 8 ms | cache/stale e parser delimitado; corpus adicional antes de tráfego |
| Reviews recentes: anime e manga | fonte aprovada: 4 ms e 6 ms | itemização, spoilers, paginação e contrato |
| Top: reviews | **investigado e recusado em 2026-07-26**: `reviews.php` não tem sort por utilidade/votos nem data com granularidade suficiente para intercalar anime+mangá | implementar exigiria um mecanismo de ranking real no MAL que não existe hoje; ver nota em `docs/routes.md` |
| Watch: episódios/promos recentes e populares | fonte aprovada: 2 ms, 1 ms, 1 ms e 1 ms | parser de itens, paginação, fixtures e contrato |
| Recommendations: anime e manga | fonte aprovada: 5 ms e 4 ms | pares de obras, autor, conteúdo, paginação, fixtures e contrato |
| Notícias, fórum e imagens | fontes HTML acessíveis; CPU prioritária medida nas páginas pesadas | parsers, fixtures, paginação e contratos |
| External, relações, temas e streaming | contratos derivados do detalhe já testado | definir campos, fixtures e adaptadores; não exigem nova URL |
| Random | sem página upstream própria | catálogo local/cache e política de seleção |
| Busca de usuários | **implementada em 2026-07-26**: `users.php?q=` filtra de verdade no servidor (confirmado comparando resultados de duas queries reais distintas, zero sobreposição); query sem match retorna 404 nativo do MAL, sem fallback de popularidade | `GET /v1/users?q=` em produção |

## Decisão de expansão (2026-07-26)

Após validar perfil/estatísticas/favoritos/updates/listas de usuário (6 de 16 rotas do grupo Usuários), a decisão registrada é seguir a priorização P0/P1/P2 já definida acima em vez de mirar as 100 rotas de uma vez. Este ciclo promove **4 das 5 rotas P0 de anime** para implementação: `/anime/{id}`, `/genres/anime`, `/top/anime`, `/seasons/now`.

Reconhecimento feito ao vivo nas páginas reais do MAL (via browser, um fetch por família — não varredura) antes de desenhar os parsers, substituindo as entradas "fonte acessível" da tabela acima por confirmação de seletor real:

- **Anime detalhe** (`/anime/{id}/{slug}`): título em `h1.title-name strong`; score em `span[itemprop="ratingValue"]`; imagem em `img[itemprop="image"]` (`data-src`/`src`); sinopse em `p[itemprop="description"]`; campos estruturados (Episodes, Status, Aired, Studios, Source, Duration, Rating, Ranked, Popularity, Members, Favorites) em `div.spaceit_pad > span.dark_text` + valor; Genres/Themes como `a[href^="/anime/genre/"]` dentro do mesmo bloco.
- **Top anime** (`topanime.php`): linhas `tr.ranking-list`, 50 por página com paginação nativa do MAL (`?limit=`); rank, link/imagem, score (`.score .text`) e metadados soltos em `div.information`.
- **Temporada atual** (`/anime/season`): `div.seasonal-anime`, confirmado **194 cards em um único documento sem paginação do MAL**; campos convenientes em spans ocultos `.js-score`, `.js-members`, `.js-start_date`, `.js-title`.
- **Gêneros** (`/anime/genre/{id}/{slug}`, usada só para extrair a barra lateral de gêneros): lista completa como `span.genre > a[href^="/anime/genre/"]`, mas **sem contagem por gênero visível numa página barata** — o campo `count` do Jikan fica omitido/nulo nesta implementação (simplificação documentada).
  - **Corrigido em 2026-07-30, duas afirmações erradas neste item.** A barra lateral *não* traz a lista completa quando quem pede é a rede da Cloudflare (~12 de 78 entradas — foi o que gerou os 500 documentados em `docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md`), e a contagem por gênero **existe** numa página barata: o bloco "Content Filter" de `anime.php?cat=genre` traz nome, id, categoria e contagem juntos. A fonte foi trocada para essa página; `count` deixou de ser omitido. O probe de 2026-07-19 (linha da tabela em "Gêneros — `/genres/anime`", 78 entradas) já apontava para ela.
- **Busca de anime** (`anime.php?q=`): confirmado que retorna resultados reais, mas paginação/filtros não foram mapeados — **adiada**, não faz parte deste ciclo.

Rotas de manga equivalentes e os grupos P1/P2 (personagens, pessoas, produtores, clubes, etc.) continuam fora deste ciclo, a serem decididos depois que o padrão de anime estiver validado em produção.

### Corpus real e p95 de produção (2026-07-26)

Medido com `wrangler tail` contra o Worker publicado — ver detalhe completo em [docs/results/2026-07-26-catalog-corpus-benchmark.md](../results/2026-07-26-catalog-corpus-benchmark.md).

- **Anime detalhe** (múltiplas rodadas, ~24 IDs reais distintos no total): cpuTime tipicamente 5-8 ms, mas com picos intermitentes de **13-15 ms** em títulos sem relação aparente com o tamanho do documento (Death Note, Violet Evergarden, Code Geass R2) — **acima do teto real de 10 ms do plano Free**. Uma tentativa de otimizar `MalClient` para ler só um prefixo do corpo via stream foi testada e **revertida**: os mesmos picos apareceram tanto na versão otimizada quanto na original, então a causa não está no código da aplicação (parsing local do HTML real levou ~0.5 ms, muito abaixo do observado) — ver detalhe em [docs/results/2026-07-26-catalog-corpus-benchmark.md](../results/2026-07-26-catalog-corpus-benchmark.md).
- **Top anime** (4 páginas reais): cpuTime p50 6 ms, p95 7 ms, wallTime muito estável (~1.35 s) — risco baixo.
- **Gêneros (anime e manga)**: **bloqueado** — o MAL serve uma barra lateral de gêneros reduzida (~12-13 itens, real é ~40+/300+) especificamente para requisições vindas da rede da Cloudflare, com HTTP 200 normal (não é challenge/captcha detectável). Confirmado comparando fetch direto (rede residencial, 284-316 itens) vs Worker publicado (12-13 itens) para a mesma URL. Depois de adicionar uma validação de tamanho mínimo no parser, `/v1/genres/anime` e `/v1/genres/manga` passaram a retornar 500 (antes retornavam 200 com dado silenciosamente incompleto). Ver [docs/results/2026-07-26-genre-taxonomy-cloudflare-network-block.md](../results/2026-07-26-genre-taxonomy-cloudflare-network-block.md). Sem causa raiz resolvida — mesma categoria do fenômeno "1042" já documentado.
- **Temporada atual**: só medida em cache hit nesta rodada (cpuTime 1 ms); o miss real de cada ocorreu antes do tail estar conectado. Recurso singleton — não há corpus de variações a amostrar, só reagendar a medição na próxima expiração de TTL.

Amostra ainda pequena e medida sob versões de código diferentes — tratar como corpus preliminar. O achado dos picos de 13-15 ms em anime detalhe é mais sério que a medição inicial sugeria (já ultrapassa o teto Free, não só encosta nele) e não tem mitigação de código identificada até agora.

## Decisão de paridade total (2026-07-26, segunda decisão do dia)

O usuário decidiu explicitamente ampliar o escopo para todas as rotas do Jikan, substituindo a limitação de "só P0/P1 documentado" pela anterior. A partir daqui, todo novo grupo de rotas (manga, personagens, pessoas, clubes, produtores, temporadas, watch, recomendações, reviews, magazines, schedules, busca de anime/manga) é implementado incrementalmente, em lotes, mantendo o mesmo critério de qualidade por rota já usado no catálogo de anime (probe real da página MAL, fixture sintética baseada em estrutura real, parser com fallback defensivo para variações de rótulo do MAL, testes unitário+benchmark+integração, contrato de resposta). Trabalho em andamento — ver progresso por lote nas seções acima e no changelog de implementação.

### Decisão de upgrade de plano (2026-07-26)

O usuário decidiu fazer upgrade para o plano Workers Paid ($5/mês, teto de CPU sobe de 10ms para 30s por padrão). Isso remove a justificativa original de vários bloqueios de CPU documentados neste arquivo (pessoa: detalhe a 9ms, temporada futura a 12ms, produtor Sunrise-scale a >1MB). **Importante:** isso não afeta o bloqueio de `genres/anime`/`genres/manga` (MAL servindo taxonomia reduzida para a rede Cloudflare) — são problemas de naturezas diferentes (CPU vs. conteúdo reduzido por origem de rede).

### Lote — Busca de usuários; busca de clubes reconfirmada bloqueada (2026-07-26)

`GET /v1/users?q=&page=` implementada após reconhecimento real que refutou a suposição inicial de "sem fonte aprovada": `users.php?q={query}` filtra de verdade no servidor — comparei os resultados de `q=amaya` e `q=kenshin` e não houve nenhuma sobreposição de username, confirmando filtragem real (não um fallback populacional fixo). Três formas de resposta foram mapeadas e tratadas: (1) match parcial → página "User Search Results" com lista paginada (24/página, blocos `<td align="center"  class="borderClass">`); (2) match exato de username → MAL responde 303 e redireciona direto para a página de perfil (`MalClient` já segue redirects, então o parser detecta esse formato e devolve uma lista de 1 item reaproveitando `parseUserProfile` sem duplicar regex); (3) zero matches → 404 nativo do MAL, sem fallback de "resultados populares" (diferente da busca de anime/manga) — o Worker repassa o 404 fielmente.

**Busca de clubes**: investigação nova (não apenas repetição da tentativa anterior) encontrou a causa raiz do "resposta suspeita" documentado antes. `clubs.php?q=X` sempre devolve a MESMA lista de clubes independente da query — verificado comparando os `cid`s extraídos de `q=anime`, de uma query sem sentido, e de nenhuma query: os três conjuntos são idênticos byte a byte. Inspecionando o HTML da página de clubes, o campo de busca real usa um componente Vue (`v-model="keyword"`, `@keydown.enter.prevent="jump()"`) que despacha para uma busca incremental via endpoint interno do MAL — não há parâmetro de URL server-side que filtre. Diferente do bloqueio de `genres/*` (conteúdo reduzido por origem de rede) ou do CPU do Free (já resolvido), este é um bloqueio estrutural: implementar exigiria depender do endpoint interno de busca, que a regra do projeto proíbe explicitamente. Permanece fora do escopo até haver decisão de manter um índice de clubes próprio (fora do scraping direto).

### Lote — Moreinfo de anime/manga; userupdates investigado e recusado (2026-07-26)

`GET /v1/anime/:id/moreinfo` e `GET /v1/manga/:id/moreinfo` implementados via `/{type}/:id/x/moreinfo`. Conteúdo real: texto livre de curadoria (`<h2 class="mb8">More Info</h2>` seguido de HTML solto com `<b>`/`<br />`) — ordem sugerida de visualização, protótipos relacionados, trivia, avisos de licenciamento expirado, etc. Confirmado testando múltiplos IDs reais em produção que a MAIORIA dos títulos não tem essa seção (Naruto, entre outros, retornou `null`), então o parser trata ausência do header como resultado válido, não erro.

**`/v1/anime/:id/userupdates` e `/v1/manga/:id/userupdates` investigados e recusados, com evidência real**: comparação de bytes entre `/anime/1/Cowboy_Bebop/userupdates`, `/anime/1/Cowboy_Bebop` (detalhe) e `/anime/1/Cowboy_Bebop/totallybogussubpage` (sub-caminho propositalmente inválido) mostrou os três com tamanho e título essencialmente idênticos (~200KB, título sem sufixo distintivo) — confirma que `userupdates` não é uma rota real do MAL, apenas o fallback silencioso já documentado para sub-caminhos não reconhecidos (mesmo padrão do bug de notícias de personagem/pessoa desta sessão). Mesmo teste repetido para manga (`Berserk`) confirmou o mesmo comportamento. Diferente de `moreinfo`, que tem marcador de conteúdo genuíno e distintivo, `userupdates` não tem nada para extrair — implementá-lo devolveria dado da página de detalhe disfarçado de "atualizações de usuário", o que seria enganoso. Decisão: não implementar até haver evidência de uma página real correspondente no MAL.

Nota lateral de reconhecimento: durante essa investigação, o MAL retornou alguns 504 Gateway Timeout transitórios em requisições consecutivas — resolvido apenas esperando ~15s antes de tentar de novo; não é um bloqueio, é instabilidade momentânea do servidor de origem (possivelmente relacionada ao volume de requisições desta sessão longa).

### Lote — Recomendações e reviews por título de anime/manga (2026-07-26)

`GET /v1/anime/:id/recommendations`, `/v1/manga/:id/recommendations`, `/v1/anime/:id/reviews` e `/v1/manga/:id/reviews`. Reconhecimento real nos links da própria página de detalhe (`/anime/1/Cowboy_Bebop`) confirmou as URLs reais: `/{id}/{slug}/userrecs` (recomendações) e `/{id}/{slug}/reviews` — ambas funcionam com o slug placeholder `x` já usado por outras rotas `/x/{recurso}`.

**Recomendações por título têm estrutura diferente da lista global** (`recommendations.parser.ts`, que espera pares `raArea1_`/`raArea2_` porque mistura obras arbitrárias): aqui um lado do par já é fixo (o próprio título), então cada card só mostra a obra recomendada. Novo parser (`title-recommendations.parser.ts`) extrai `{malId, title, imageUrl, votes}`, com `votes = 1 + N` quando existe o link "Read recommendations by N more users" — confirmado que a ausência desse link significa exatamente 1 voto (não 0, já que sempre há pelo menos o comentário inicial visível). Testado com Cowboy Bebop (166 recomendações, ex. Samurai Champloo com 122 votos) e Berserk (138 recomendações) em produção.

**Reviews por título quase reaproveitaram o parser errado**: a página por título (`/anime/1/Cowboy_Bebop/reviews`) usa o MESMO marcador de card (`review-element js-review-element`) da lista global, mas **não linka de volta pro título sendo revisado em cada card** (`class="title ga-click"`, usado pelo parser global pra extrair `malId`/`title`, tem contagem zero nessa página) — reaproveitar `parseReviews` sem ajuste faria `title` ficar vazio em toda linha, reprovando a validação Zod (`title: z.string().min(1)`) e devolvendo lista vazia pra TODA review, disparando erro de "página vazia" mesmo com dado real presente. Descoberto ANTES de escrever o parser, via reconhecimento (`class="title ga-click"` count = 0 na página real), evitando reproduzir esse bug. Novo parser dedicado (`title-reviews.parser.ts`) reaproveita a mesma extração de campos do parser global (usuário, avatar, data, tag, nota, texto — inclusive a correção de boundary de `reviewText` já documentada anteriormente), só sem tentar extrair `malId`/`title`. Paginação nativa via `p=`, confirmada real comparando usuários distintos entre página 1 e 2 em produção.

### Lote — Top characters; top reviews investigado e recusado (2026-07-26)

`GET /v1/top/characters?page=` — mesmo padrão de `top/people`: `character.php` sem `q=` é o ranking real "Characters" por favoritos (`class="characters-favorites-ranking-table"`, linhas `ranking-list`), com paginação nativa via `limit=`. Duas colunas extras confirmadas na página real (animeography/mangaography, cada uma com múltiplos `<div class="title"><a>`), extraídas como `{malId, title}[]` — sem imagem/papel, que já existe via `/v1/characters/:id/anime`. Testado com Lelouch Lamperouge (#1, 180.332 favoritos) e Monkey D. Luffy (#2) em produção, batendo exato com a página real.

**`/v1/top/reviews` investigado e decidido NÃO implementar, com evidência**: a entrada da matriz de probes já sinalizava "confirmar semântica da ordenação" como pendência. Reconhecimento real de `reviews.php?t=anime` mostrou: (1) nenhum parâmetro de sort por utilidade/votos existe — só um filtro de sentimento (Recommended/Mixed Feelings/Not Recommended) via JS/checkbox, sem equivalente de "mais úteis primeiro"; (2) o campo de data (`class="update_at"`) só tem granularidade de dia (`"Jul 26, 2026"`), repetido em múltiplas reviews do mesmo dia — inviabilizando até uma tentativa honesta de intercalar por data os feeds de anime e mangá num único endpoint. Implementar `/v1/top/reviews` nessas condições seria um alias redundante de `/v1/reviews/anime`/`/v1/reviews/manga` disfarçado de rota com semântica própria. Decisão: não implementar até haver evidência de um mecanismo de ranking real no MAL.

### Lote — Top people (2026-07-26)

`GET /v1/top/people?page=` — fecha o grupo de Pessoas. Reconhecimento real confirmou que `people.php` (a mesma URL cuja tentativa de busca `?q=` já está documentada como inviável — ver "Lote — Busca de usuários; busca de clubes reconfirmada bloqueada") sem nenhum parâmetro `q` vira uma listagem ranqueada real por favoritos: `class="people-favorites-ranking-table"`, linhas `<tr class="ranking-list">` — mesma classe de linha já usada por `topanime.php`/`topmanga.php`. Paginação nativa via `limit=` (confirmado por `<link rel="next" href=".../people.php?limit=50" />`), diferente do `show=` usado exclusivamente pela busca — os dois parâmetros não se misturam porque a busca e o ranking são, na prática, dois modos distintos da mesma URL base.

Campos extraídos: nome, nome em kanji/alfabeto original (`(神谷 浩史)`), imagem, aniversário, favoritos — sem posição de rank explícita no payload (ordem do array já reflete o ranking, mesmo padrão de `AnimeListEntry`/`MangaListEntry`). Validado com dados reais em produção: página 1 liderada por Hiroshi Kamiya (108.566 favoritos), página 2 com favoritos numa faixa bem menor (~16.000) confirmando paginação real, não repetição.

**Isso fecha o grupo de Pessoas (7/7 rotas do inventário Jikan)**: detalhe, full, busca, anime, manga, voices, pictures/news (bônus além do inventário oficial) e agora top — junto com o grupo de Personagens já fechado no lote anterior.

### Lote — Full de personagens e pessoas (2026-07-26)

`GET /v1/characters/:id/full` e `GET /v1/people/:id/full` — fecham os dois grupos. Diferente de `full` de anime (precisou de um parser novo para openings/endings) ou de produtor (precisou extrair `about`/`external` que não existiam antes), aqui **não sobrou nenhum campo real para adicionar**: os parsers de `anime`/`manga`/`voices` de personagem e pessoa já foram implementados e testados nos lotes anteriores. `full` só reaproveita esses mesmos parsers sobre o HTML de UM fetch (a mesma URL de `detail()`) e devolve tudo combinado — evita quatro requisições separadas (`detail` + `anime` + `manga` + `voices`) para quem precisa do pacote completo de uma vez, com sua própria chave de cache em `catalog_lists` (não reaproveita as chaves de `detail()`/`media()` já existentes, mesmo padrão de isolamento usado em `producer.full()`).

Validado comparando as contagens do `full` contra as rotas individuais já testadas em produção: personagem Spike Spiegel (3 anime, 2 manga, 14 dubladores — bate exato com o lote anterior) e pessoa Kouichi Yamadera (6 posições de staff, 0 mangás, 591 papéis de dublagem — idem). Isso fecha o grupo de Personagens (7/7 rotas do inventário Jikan) e deixa Pessoas só com `top/people` pendente.

### Lote — Anime/manga/voices por pessoa (2026-07-26)

`GET /v1/people/:id/anime`, `/manga` e `/voices`. Reconhecimento real na página de detalhe de pessoa confirmou três seções: "Voice Acting Roles" (dublador), "Anime Staff Positions" (diretor/roteirista/etc.) e "Published Manga" (mangaká) — todas na mesma URL já usada por `detail()`. Diferente do personagem, aqui as três tabelas usam classes CSS de linha diferentes e sempre presentes no documento mesmo quando vazias (`class="js-people-staff"`, `class="js-people-manga"`, `class="js-people-character"`) — MAL chega a mostrar a mensagem literal "No voice acting roles have been added to this person." quando não há nenhum papel, confirmado numa pessoa que é só diretor (Shinichirou Watanabe, id 2009). Isso significa que **a própria classe da linha já identifica a qual tabela ela pertence**, então o parser não precisa achar os limites de cada seção — só filtra por marcador de linha no documento inteiro.

Estrutura de linha de `anime`/`manga`: imagem + link do título + `<small>` com posições separadas por vírgula (ex. "Production Manager, Production Assistant"; "Story & Art" de mangaká fica como item único, sem quebrar no "&"). `voices` tem uma estrutura mais rica: a linha se divide em uma metade "anime" (imagem+título) e uma metade "personagem" (nome, papel Main/Supporting, imagem) — o parser localiza o `align="right" nowrap"` que marca o início da metade do personagem e aplica regexes diferentes a cada metade.

Testado com três perfis reais de naturezas bem diferentes antes do deploy: Kouichi Yamadera (dublador prolífico, 591 papéis de dublagem — valida robustez em escala grande), Shinichirou Watanabe (diretor, 48 posições de staff, zero papéis de dublagem) e Eiichiro Oda (mangaká, 16 mangás publicados). Confirma que os três parsers lidam bem com listas grandes e com ausência total de uma das três categorias.

### Lote — Anime/manga/voices por personagem (2026-07-26)

`GET /v1/characters/:id/anime`, `/manga` e `/voices`. Reconhecimento real na página de detalhe do personagem (`/character/1/Spike_Spiegel`) confirmou três seções na mesma página: `<div class="normal_header character-anime">Animeography</div>`, `<div class="normal_header character-manga">Mangaography</div>` e `<div class="normal_header">Voice Actors</div>` — todas com URL idêntica à já usada por `detail()`, então as três rotas reaproveitam um único fetch (mesmo padrão de `characters`/`staff` do anime: um `charactersAndStaff()` privado compartilhado). Animeography e mangaography têm exatamente a mesma estrutura de linha (imagem + link + `<small>` com o papel "Main"/"Supporting"), só trocando `/anime/` por `/manga/` no href. Voice Actors usa um `<table>` separado por dublador (um por idioma) em vez de linhas dentro de uma tabela só.

Testado com Spike Spiegel (character id 1): 3 animes, 2 mangás, 14 dubladores em produção — confirma que o parser lida bem com listas de tamanho realista, não só o caso mínimo do fixture. Nenhum dos três parsers lança erro em lista vazia — um personagem pode legitimamente não ter mangaography (original) ou animeography (só existe em mangá), e personagens secundários podem não ter dublador creditado.

### Lote — Full de anime e manga (2026-07-26)

Análise do que o schema `full` do Jikan realmente adiciona sobre o detalhe base (`relations`, `theme` com openings/endings, `external`, `streaming`) mostrou que, neste projeto, `AnimeDetail`/`MangaDetail` **já carregam `relations`, `externalLinks` e (só anime) `streaming`** desde a implementação original — porque a página real do MAL expõe tudo isso num único documento, e o projeto optou por embutir esses campos no detalhe base em vez de reservá-los só para uma rota `full` separada (diferente do Jikan oficial, que separa isso deliberadamente por custo de resposta). Isso deixou só uma peça real de `full` faltando para anime: os openings/endings (nomes de música tema).

`GET /v1/anime/:id/full` reaproveita `parseAnimeDetail` e adiciona `themeSongs: { openings, endings }`, extraído das seções reais "Opening Theme"/"Ending Theme" da página (`<h2>Opening Theme</h2>` seguido de `<div class="theme-songs js-theme-songs opnening">` — note o typo do próprio MAL em "opnening"). Cada música vem numa célula `<td width="84%">` com `theme-song-title`/`theme-song-artist`/`theme-song-episode`. **Achado importante do reconhecimento real**: o índice numérico (`<span class="theme-song-index">1:</span>`) só aparece quando há 2+ músicas na seção — com uma seção de música única (ex. abertura do Cowboy Bebop, só "Tank!"), o MAL omite a numeração inteiramente. Por isso o parser não depende desse índice para dividir as entradas, usa `theme-song-title` como marcador (sempre presente) e deriva a ordem pela posição no array. Testado com Cowboy Bebop (1 abertura, 3 encerramentos) e Naruto (8 aberturas, 14 encerramentos) para validar robustez com séries longas antes do deploy.

`GET /v1/manga/:id/full` é um alias puro de `MangaService.detail()` — sem fetch novo, sem parser novo, sem chave de cache nova. Justificativa: mangá não tem conceito de openings/endings nem streaming no Jikan, e `relations`/`externalLinks` já estão no `MangaDetail` desde sempre, então não sobra nada real para uma rota `full` distinta adicionar.

### Lote — Busca de personagens e pessoas (2026-07-26)

`GET /v1/characters?q=&page=` e `GET /v1/people?q=&page=`. Reconhecimento real confirmou que, diferente de `clubs.php`, tanto `character.php?q=` quanto `people.php?q=` filtram de verdade no servidor: duas queries reais e distintas ("spike" vs "naruto", "miyazaki" vs "yamadera") devolvem conjuntos de IDs com zero sobreposição — verificado antes de escrever qualquer parser. Paginação nativa em blocos de 50 (`show=50`, `100`, `250`), mesmo esquema de `anime?q=`/`manga?q=` — `searchUrl()` em `mal-urls.ts` foi generalizada para aceitar `'character' | 'people'` além de `'anime' | 'manga'`, sem precisar de uma função de URL nova.

Comportamento de zero resultados diverge entre os dois, então cada um tem tratamento próprio: `character.php` responde HTTP 404 puro (mesmo padrão de `users.php`, sem fallback de popularidade), enquanto `people.php` responde 200 com o marcador literal "No results returned" numa tabela sem linhas de dado — o parser de pessoas checa esse marcador primeiro e devolve lista vazia, evitando um `ParserError` incorreto por "página vazia" numa situação que na verdade é uma resposta válida sem resultados.

Estrutura de linha: personagens usam `<tr>` com zebra `bgColor1`/`bgColor2` e uma 3ª coluna com anime/manga associados (não extraída — fora do escopo desta rota); pessoas usam `<tr>` mais simples, sem zebra nem coluna extra, com hrefs relativos (`/people/{id}/{slug}`) em vez de absolutos como em `character.php`. Ambos os parsers pegam o `malId` a partir do primeiro link da linha (imagem) e o nome do segundo link (com texto), já que o link da imagem não tem texto entre as tags e por isso não bate com o padrão `[^<]+<\/a>` usado para capturar o nome.

Validado localmente e em produção com dados reais antes do deploy: `spike`/`naruto` (characters), `miyazaki` (people, com resultados) e uma query sem sentido para people (200, lista vazia, confirmado o parser não lança erro).

### Lote — Índice de clubes; produtor full/external (2026-07-26)

`GET /v1/clubs?page=` implementado usando a mesma URL da tentativa de busca (`clubs.php`), agora sem `q=` — retorna a listagem padrão real do MAL, com paginação nativa via `p=` (não `show=`, confirmado comparando os `cid`s de `p=1` vs `p=2`: distintos, exceto um bloco fixo de "clubes em destaque" que se repete no topo). Estrutura de linha (`<tr class="table-data">`) é a mesma já usada pela busca frustrada de clubes, então o parser reaproveita esse conhecimento de reconhecimento.

`GET /v1/producers/:id/full` e `GET /v1/producers/:id/external` implementados. Reconhecimento real na página de detalhe de produtor (`/anime/producer/1/Studio_Pierrot`) revelou duas seções não capturadas pelo parser de detalhe original: um parágrafo de descrição (`about`) logo após "Member Favorites", e duas seções de links (`<h2>Available At</h2>` com site oficial/redes sociais, `<h2>Resources</h2>` com wikis/agregadores). `full` reutiliza `parseProducerDetail` internamente e adiciona esses dois campos via um parser separado, armazenado em `catalog_lists` sob sua própria chave (não altera a tabela `producers` nem o contrato de `/v1/producers/:id`, evitando qualquer risco de invalidação de cache em linhas já armazenadas). `external` projeta o campo sem fetch novo.

**Bug real descoberto via validação em produção (não hipotético)**: vários `href` nas seções "Available At"/"Resources" têm um byte de carriage return (`0x0D`) literal antes da aspa de fechamento — confirmado inspecionando os bytes brutos da resposta do MAL (`href="http://pierrot.jp/` seguido do byte `0d` e então `"`). O regex original capturava esse `\r` como parte da URL; `z.string().url()` não pegou o problema porque o construtor `URL` do JavaScript descarta tab/CR/LF durante sua própria normalização interna sem que isso afete a string original armazenada — validação passa, mas o dado salvo fica sujo. Corrigido removendo `\t`/`\r`/`\n` da URL capturada antes da validação Zod. Descoberto e corrigido durante a validação local com `dev:local` contra o produtor real "Studio Pierrot" (id 1), antes do deploy — reforça o valor de testar contra HTML real do MAL em vez de confiar só em fixtures sintéticas.

### Lote — Clubes por título: membros e staff (2026-07-26)

`GET /v1/clubs/:id/staff` (derivado do `ClubDetail` já buscado — campo `staff` já existia desde a implementação original do detalhe) e `GET /v1/clubs/:id/members?page=`. Investigação real via fetch direto: a página de detalhe do clube (`clubs.php?cid=:id`) linka `clubs.php?id=:id&action=view&t=members` para a lista de membros — nota: esse link usa o parâmetro `id`, diferente do `cid` usado na URL de detalhe (confirmado, ambos resolvem o mesmo clube). Estrutura de linha é idêntica à de `users.php?q=` (mesmo marcador de bloco `<td align="center"  class="borderClass">`, mesmo padrão de avatar via `picSurround`/`data-src`), só sem o campo de data de entrada — paginação nativa do MAL em blocos de 36 (`show=36`, `72`, ...; confirmado via `<link rel="next" ... show=36 />` na própria página). Testado com o clube real `cid=1` ("Cowboy Bebop"), ~1.404 membros em 39 páginas. Validado localmente e em produção antes do deploy: página 1 e página 2 devolvem membros distintos (paginação real, não repetida).

### Lote — Imagens e notícias por personagem/pessoa (2026-07-26)

`GET /v1/characters/:id/pictures`, `GET /v1/people/:id/pictures` e `GET /v1/people/:id/news`. Reconhecimento real (não suposição) feito antes de codificar: os links de navegação presentes na própria página de detalhe de personagem (`/character/1/Spike_Spiegel`) só apontam para `/featured` e `/pics` — **sem página de notícias ou fórum para personagens**. A página de pessoa (`/people/1/Tomokazu_Seki`) só linka `/news` e `/pics` — **sem fórum para pessoas**. Confirmado também por fallback: qualquer sub-caminho não reconhecido sob `/character/:id/x/` ou `/people/:id/x/` retorna 200 com a home genérica do MyAnimeList.net (não um 404), o que teria mascarado silenciosamente um parser aplicado ao lugar errado — `/character/1/x/news`, por exemplo, "parseava" como se tivesse notícias porque a home genérica carrega um widget lateral "Recent News" do site inteiro, sem relação com o personagem.

Reaproveitado `parsePictures`/`parseNews` sem nenhuma alteração de parser — só URLs novas (`picturesUrl`/`newsUrl` em `mal-urls.ts` ganharam `'character'`/`'people'` no union de tipo). Achado sem impacto no resultado: a página de imagens de pessoa tem cada `js-picture-gallery` duplicado no HTML (célula da grade + preview de hover, mesma URL); o regex do parser só casa a primeira ocorrência de cada uma (adjacência estrita `<a>...<img data-src>`), então o resultado final já reflete a contagem de imagens únicas sem necessidade de dedup explícito — verificado comparando a lista de URLs retornada (8 únicas) contra a contagem bruta de marcadores no HTML (16, ou seja, 2×8).

### Lote — Estatísticas, imagens, notícias, fórum e episódios por título (2026-07-26)

Completa o grupo de rotas derivadas por título: `GET /v1/anime/:id/statistics`, `/pictures`, `/news`, `/forum`, `/episodes` e `GET /v1/manga/:id/statistics`, `/pictures`, `/news`, `/forum` (manga não tem página de episódio-a-episódio no MAL). Todas usam o mesmo padrão de URL com slug fixo já estabelecido em `characters` (`/{type}/{id}/x/{recurso}`) e reaproveitam `catalog_lists` — sem migração nova.

- **Estatísticas** (`/x/stats`): distribuição de status (`dark_text` com rótulos `Watching`/`Reading` e `Plan to Watch`/`Plan to Read` como variantes anime/manga) e distribuição de notas (`score-label score-N` + `width: N%` + `(N votes)`). Verificado em produção com dados reais: Cowboy Bebop (2.074.721 membros) e Berserk (804.286 membros).
- **Imagens** (`/x/pics`): galeria `js-picture-gallery`, `imageUrl`/`thumbnailUrl` via `data-src`.
- **Notícias** (`/x/news`): itens via marcador `picSurround`, campos título/excerto/data/autor.
- **Fórum** (`/x/forum`): tópicos via `data-topic-id`, com autor/data/respostas/último post.
- **Episódios** (`/x/episode`, só anime): linhas `episode-list-data`; título romanizado e japonês, data de exibição, nota média e respostas no fórum do episódio. **Só a primeira página é buscada** — o formato do parâmetro de paginação do MAL para séries longas não foi confirmado nesta rodada, então séries com muitos episódios (ex. animes com 50+) retornam só os primeiros. Documentado como simplificação conhecida, não bug.

Todas as 5 famílias de parser passaram nos testes de fixture na primeira tentativa (sem bug de produção descoberto, diferente de várias rotas anteriores neste ciclo). Validado localmente contra HTML real do MAL e depois em produção (`https://jikan-edge.lucas-hdo.workers.dev`) para anime id=1 e manga id=2 antes do deploy ser considerado concluído.

### Lote 3 — Clubes e temporadas (2026-07-26)

`GET /v1/clubs/:id` — página real ~66KB, campos em `<span class="dark_text">` (Members/Pictures/Category/Created) e lista de staff via `<a href="/profile/...">`. Confirmado real cuidado: a página de clube contém um template Vue com texto `Members: ${ item.payload.members }` usado pelo widget de busca global do MAL — o parser usa o padrão `Members:</span>` (com a tag de fechamento) para não confundir com esse template.

`GET /v1/seasons/:year/:season` e `GET /v1/seasons/upcoming` — reaproveitam o parser de `seasons/now` (`parseSeasonNow`) sem alteração, já que `/anime/season/{year}/{season}` e `/anime/season/later` usam exatamente a mesma estrutura de cards `js-seasonal-anime`. Nota: a URL real para "temporada futura" é `/anime/season/later`, não `/anime/season/upcoming` (que retorna 404) — a nomenclatura antiga do Jikan não bate mais com a URL atual do MAL. Página de "later" é grande (~1.8MB, 434 cards antes de dedup) — dentro do orçamento agora que o plano será pago.

### Lote 2 — Manga (2026-07-26)

Implementado espelhando a arquitetura do catálogo de anime: `GET /v1/manga/:id` (detalhe), `GET /v1/top/manga?page=` (ranking), `GET /v1/genres/manga` (taxonomia — **bloqueado**, mesmo problema de rede da Cloudflare descrito acima). Estrutura real do MAL para manga difere da de anime em pontos específicos: título em `<span class="h1-title"><span itemprop="name">` (não `<h1 class="title-name">`), sinopse em `<span itemprop="description">` (não `<p itemprop="description">`), campos `Volumes`/`Chapters`/`Published`/`Authors`/`Demographic`/`Serialization` em vez de `Episodes`/`Aired`/`Studios`/`Duration`/`Rating`/`Source`. Sem rota de temporada (não existe conceito de temporada para manga no Jikan).

## Fora do compromisso atual (histórico, anterior à decisão de paridade total acima)

O projeto não promete implementar as 100 rotas. Esta lista evita perder cobertura e permite decidir, com evidência, quais subconjuntos têm viabilidade técnica e valor suficiente.
