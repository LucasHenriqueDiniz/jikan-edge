# Resultado — probe de fontes P0 do Jikan

> Data: 2026-07-19  
> Worker: `jikan-edge-profile-probe`  
> Método: uma URL fixa por família; sem persistência, sem endpoint aberto e sem varredura.

## Casos executados

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | Marcadores | Estado |
| --- | --- | ---: | ---: | --- | --- |
| Perfil — `/users/{username}` | `/profile/amayacrab` | 200 | 92 KB | presentes | parser básico aprovado no spike anterior |
| Anime detalhe — `/anime/{id}` | `/anime/1/Cowboy_Bebop` | 200 | 192 KB | presentes | campos iniciais: score e sinopse; título em ajuste |
| Busca — `/anime` | `/anime.php?q=cowboy+bebop&cat=anime` | 200 | 334 KB | presentes | 155 links de anime identificados; itemização pendente |
| Ranking — `/top/anime` | `/topanime.php` | 200 | 214 KB | presentes | 160 links de anime identificados; ranking/itemização pendentes |
| Temporada — `/seasons/now` | `/anime/season` | 200 | 949 KB | presentes | 715 links identificados; `cpuTime: 7 ms`; itemização pendente |
| Gêneros — `/genres/anime` | `/anime.php?cat=genre` | 200 | 326 KB | presentes | 78 entradas de gênero identificadas; nomes pendentes |

## Achado principal

Todas as seis fontes responderam HTTP 200 ao Worker e passaram os marcadores semânticos mínimos. Isso aprova somente a etapa de transporte para esta amostra.

O extrator experimental de perfil funcionou. Na segunda iteração, os formatos reais entregues ao Worker foram identificados: várias listas usam links absolutos, enquanto a página de gêneros expõe `input[name="genre[]"]`. A temporada atual, com aproximadamente 949 KB, concluiu uma execução observada com `cpuTime: 7 ms`.

Os extratores ainda contam e validam estruturas; eles não retornam o schema Jikan nem devem ser considerados parsers de produto.

## Decisão

- **Perfil:** `probe aprovado`, com uma execução de `cpuTime: 2 ms` registrada anteriormente.
- **Anime, busca, ranking, temporada e gêneros:** `fonte acessível; parser pendente`.
- **Nenhuma das rotas é aprovada para produto ainda.**

## Próximo passo

Para cada família pendente, capturar fixture sanitizada, identificar seletores reais, criar parser específico e medir p50/p95 de `cpuTime` em corpus representativo. A página de temporada deve receber prioridade de medição por ter aproximadamente 949 KB.

## Continuação — manga e personagem

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | Resultado |
| --- | --- | ---: | ---: | --- |
| Manga detalhe — `/manga/{id}` | `/manga/2/Berserk` | 200 | 145 KB | título, score `9.46` e sinopse identificados |
| Busca manga — `/manga` | `/manga.php?q=berserk&cat=manga` | 200 | 273 KB | 137 links de manga identificados |
| Top manga — `/top/manga` | `/topmanga.php` | 200 | 204 KB | 100 links identificados; `cpuTime: 1 ms` |
| Personagem detalhe — `/characters/{id}` | `/character/1/Spike_Spiegel` | 200 | 64 KB | título, Animeography e Voice Actors identificados |

Manga e personagem passam apenas como provas de transporte/extração inicial. As rotas derivadas — vozes, imagens, relações, paginação e `full` — continuam pendentes de parser e contrato próprios.

## Continuação — pessoa

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Pessoa detalhe — `/people/{id}` | `/people/1` | 200 | 1,171 KB | 9 ms | título, seção Voice Acting Roles e 1.087 links de personagem identificados |

### Decisão para pessoas

**Não aprovar parser único de pessoa no Free.** Embora a execução tenha retornado 200, 9 ms ultrapassa a margem de segurança provisória de 8 ms. A página é aproximadamente 1,17 MB e reúne muitos créditos; um parser que extraia todo o conteúdo detalhado teria risco alto de exceder o teto de 10 ms.

Alternativas a validar:

1. separar perfil básico de créditos/vozes em recursos diferentes;
2. coletar somente dados básicos no Worker Free e adiar créditos extensos;
3. usar executor com CPU maior apenas se a família provar valor suficiente;
4. aceitar dados stale previamente processados, sem recalcular conteúdo completo durante refresh.

### Tentativa de otimização rejeitada

Foi testado `HTMLRewriter` em streaming, capturando somente `title`, o cabeçalho de vozes e links de personagens, sem criar uma string com o HTML inteiro. Nesta página, a execução observada consumiu **44 ms de CPU**, pior que os 9 ms do parser textual seletivo.

Conclusão: `HTMLRewriter` não deve ser adotado automaticamente. Para páginas grandes com muitos elementos correspondentes, o custo dos callbacks/seletores pode superar o de poucas varreduras textuais delimitadas. O Worker foi revertido para a versão textual de 9 ms enquanto se avalia uma estratégia de segmentação de dados.

## Continuação — buscas de personagem e pessoa

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | Resultado |
| --- | --- | ---: | ---: | --- |
| Busca de personagens — `/characters` | `/character.php?q=Spike&cat=character` | 200 | 79 KB | 105 links de personagem identificados |
| Busca de pessoas — `/people` | `/people.php?q=Tomokazu&cat=person` | 200 | 53 KB | 38 links de pessoa identificados |

As duas buscas são fontes leves e adequadas para seguir à etapa de itemização e contrato. A URL de origem de rankings públicos de personagens/pessoas ainda precisa ser mapeada; a tentativa direta `topcharacters.php` retornou 404, portanto não será inferida sem evidência.

## Continuação — rankings de personagem e pessoa

| Família / rota de referência | Fonte MAL confirmada | HTTP upstream | HTML aproximado | Resultado |
| --- | --- | ---: | ---: | --- |
| Top personagens — `/top/characters` | `/character.php` | 200 | 131 KB | 105 links de personagem identificados |
| Top pessoas — `/top/people` | `/people.php` | 200 | 95 KB | 100 links de pessoa identificados |

O mapeamento de personagens foi confirmado pela documentação histórica do Jikan, que aponta `character.php` como fonte de top characters. A URL inexistente `topcharacters.php` permanece registrada como tentativa descartada.

## Continuação — produtor

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Produtor detalhe — `/producers/{id}` | `/anime/producer/1/Studio_Pierrot` | 200 | 599 KB | 3 ms | título e 670 links de anime identificados |

O detalhe de produtor é viável nesta amostra, mesmo com página grande. Índice/pesquisa de produtores ainda não estão aprovados: `anime.php?cat=producer` não expôs um marcador de lista de produtores e será investigado por fixture/estrutura, não inferido a partir da busca geral de anime.

### Lista de produtores

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Lista — `/producers` | `/anime/producer` | 200 | 160 KB | 2 ms | título e links de produtor identificados |

A fonte de lista passa com ampla margem. `full` e `external` não exigem uma nova página nesta fase: devem ser tratados como contratos derivados do detalhe, com parser e fixture próprios.

## Continuação — clube

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Clube detalhe — `/clubs/{id}` | `/clubs.php?cid=1` | 200 | 64 KB | 2 ms | título, seções Members/Staff e 42 links de perfil identificados |

O detalhe de clube passa com margem ampla. As rotas de membros, staff e relações precisam de testes de paginação/estrutura próprios antes de serem aprovadas.

### Membros de clube

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Membros — `/clubs/{id}/members` | `/clubs.php?action=view&t=members&id=1&show=0` | 200 | 56 KB | 2 ms | 72 ocorrências de link de perfil (36 itens esperados, abertura e referência repetida) |

A fonte de membros passa com ampla margem. A paginação da fonte usa `show` como offset em blocos de 36; o adaptador deve expor páginas sem vazar esse detalhe. Staff e relações continuam a exigir parser/fixture sobre a página de detalhe.

## Continuação — coleções de exibição e temporada futura

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Em exibição / schedules — `/schedules` | `/anime.php?cat=airing` | 200 | 334 KB | 3 ms | 137 links de anime identificados |
| Temporada futura — `/seasons/upcoming` | `/anime/season/later` | 200 | 1,769 KB | **12 ms** | 1.489 links de anime identificados |

### Decisão para temporadas futuras

**Não aprovar `/seasons/upcoming` no Workers Free pelo parser atual.** A execução observada atingiu 12 ms, acima do teto Free de 10 ms. A resposta HTTP 200 veio de uma conta com capacidade de execução suficiente para registrar a métrica; ela não torna a rota compatível com o Free.

Alternativas: limitar páginas/itens, encontrar uma fonte paginada, executar a ingestão fora do Free ou manter a rota fora do MVP.

## Continuação — reviews recentes

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Reviews recentes de anime — `/reviews/anime` | `/reviews.php?t=anime` | 200 | 492 KB | 4 ms | título e 50 links de review identificados |

O feed de reviews recentes é viável nesta amostra. Isto não aprova ainda reviews por obra, paginação, conteúdo com spoiler ou transformação do texto; são contratos separados.

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Reviews recentes de manga — `/reviews/manga` | `/reviews.php?t=manga` | 200 | 506 KB | 6 ms | título e 50 links de review identificados |

O feed de manga também é viável, porém com margem menor que o de anime. Recomendações ainda não tiveram uma fonte pública mapeada: as tentativas diretas em `recommendations.php` retornaram 404 e foram registradas como descartadas.

## Continuação — gêneros de manga e magazines

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Gêneros de manga — `/genres/manga` | `/manga.php?cat=genre` | 200 | 276 KB | não medida ainda | 79 entradas de gênero identificadas |
| Magazines — `/magazines` | `/manga/magazine` | 200 | 238 KB | 2 ms | 1.484 links de magazine identificados |

Magazines passa com margem ampla mesmo com alta densidade de itens. Gêneros de manga está acessível; sua medição de CPU pode ser agrupada no futuro com a validação de extração de nomes e tipos.

## Continuação — subrecursos de anime

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Episódios — `/anime/{id}/episodes` | `/anime/1/_/episode` | 200 | 94 KB | 2 ms | título e 52 links de episódio identificados |
| Vídeos — `/anime/{id}/videos` | `/anime/1/_/video` | 200 | 78 KB | 2 ms | página de vídeo e marcadores de obra identificados |
| Estatísticas — `/anime/{id}/statistics` | `/anime/1/_/stats` | 200 | 107 KB | 1 ms | título da página e 11 rótulos de estatística identificados |

As três fontes passaram no Worker real com ampla margem para o teto provisório de 8 ms e para o limite Free de 10 ms. Elas são candidatas ao MVP, sujeitas a parsers estruturados e fixtures antes de expor contratos públicos.

O HTML de vídeos usa `youtube-nocookie.com/embed/...`, não o domínio `youtube.com` inicialmente previsto. Após ajustar o padrão para esse formato, o Worker identificou um embed na amostra. A fonte e a extração inicial de URL de trailer/promo passam; campos adicionais e múltiplos vídeos continuam dependentes de fixture e parser estruturado.

## Continuação — superfícies públicas de usuário

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Lista de anime — `/users/{username}/animelist` | `/animelist/amayacrab` | 200 | 596 KB | 5 ms | título e 273 links de anime identificados |
| Lista de manga — `/users/{username}/mangalist` | `/mangalist/amayacrab` | 200 | 509 KB | 4 ms | título e 227 links de manga identificados |
| Amigos — `/users/{username}/friends` | `/profile/amayacrab/friends` | 200 | 86 KB | 2 ms | título e 132 links de perfil identificados |
| Histórico — `/users/{username}/history` | `/profile/amayacrab/history` | 200 | 92 KB | não medida ainda | fonte acessível; 42 links de obra detectados |
| Reviews do usuário — `/users/{username}/reviews` | `/profile/amayacrab/reviews` | 200 | 47 KB | não medida ainda | fonte acessível; o padrão do feed geral não encontrou itens nesta página |

### Decisão para usuário

Listas de anime e manga, assim como amigos, passam como fontes candidatas ao MVP: o Worker real ficou abaixo da margem provisória de 8 ms. Isso não aprova ainda paginação, filtros de status, notas, datas, privacidade ou os formatos completos de resposta.

Histórico e reviews têm transporte confirmado, mas não devem receber contrato público até uma inspeção de estrutura e fixtures extrair itens reais. A ausência de correspondência do seletor reutilizado na página de reviews é tratada como sinal para investigar o HTML, não como lista vazia.

### Clubes de usuário e busca de usuários

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Clubes do usuário — `/users/{username}/clubs` | `/profile/ZUKUT0/clubs` | 200 | 69 KB | 2 ms | links de clube identificados em fixture positiva |

`/profile/amayacrab/clubs` respondeu 200 sem clubes visíveis e fica registrada como fixture de lista vazia. A página positiva passa com ampla margem.

A tentativa de usar `/users.php?q={username}` como busca geral foi descartada: ela redireciona ao perfil exato quando o nome existe, em vez de retornar resultados de pesquisa. A rota `/users` do contrato Jikan exigirá um índice próprio/cache de perfis conhecidos ou ficará fora do MVP; não há fonte HTML de busca aprovada nesta etapa.

### Recomendações de usuário

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Recomendações — `/users/{username}/recommendations` | `/profile/amayacrab/recommendations?p=1` | 200 | 48 KB | 2 ms | resposta vazia acessível |

A URL e o comportamento vazio passam. As duas fixtures verificadas (`amayacrab` e `ZUKUT0`) não contêm recomendações visíveis; a rota não recebe aprovação de parser até existir uma fixture positiva pública, obtida sem varredura de perfis.

## Continuação — tentativa de ranking de reviews

As tentativas em `/topreviews.php`, `/topreviews.php?type=anime` e `/topreviews.php?type=manga` retornaram HTTP 404 e foram descartadas como fontes. A página `/reviews.php?t=anime&filter_check=1&order_by=most_helpful` retornou HTTP 200 (aproximadamente 482 KB) e é uma candidata para investigar o contrato de `/top/reviews`.

Ainda não há mapeamento aprovado: é preciso confirmar no HTML se a ordenação realmente é a desejada, identificar o bloco de cada review e medir CPU do Worker com esse parser.

### Resultado do probe de `top/reviews`

A fonte candidata retornou 200 no Worker real, com aproximadamente 482 KB, 50 reviews (100 ocorrências de `review-element`, abertura e fechamento) e **5 ms de CPU**. Os dez primeiros IDs de review diferem do feed padrão; o parâmetro de ordenação está alterando o resultado e não foi simplesmente ignorado.

**Decisão:** aprovar a fonte como candidata técnica para `/top/reviews`, mas manter o contrato pendente. Antes de expor a rota, o parser deve extrair autor, obra, score, conteúdo/resumo, reações e paginação, e a semântica exata de `order_by=most_helpful` deve ser validada por fixture.

## Continuação — recomendações recentes

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Recomendações de anime — `/recommendations/anime` | `/recommendations.php?s=recentrecs&t=anime` | 200 | 397 KB | 5 ms | título e links de anime identificados |
| Recomendações de manga — `/recommendations/manga` | `/recommendations.php?s=recentrecs&t=manga` | 200 | 400 KB | 4 ms | título e links de manga identificados |

As duas fontes são viáveis no Worker Free nesta amostra. Faltam parser por bloco de recomendação, pares de obras, usuário, conteúdo, paginação e fixtures antes de definir o contrato.

A página de recomendações por obra também foi encontrada em `/anime/1/Cowboy_Bebop/userrecs`, mas tem aproximadamente 1,06 MB. Ela não foi agrupada com os feeds globais: precisa de probe e decisão próprios.

### Recomendações por obra

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Recomendações de uma obra — `/anime/{id}/recommendations` | `/anime/1/Cowboy_Bebop/userrecs` | 200 | 1,054 KB | 7 ms | título e links de anime identificados |

**Decisão condicional:** a fonte passa na medição pontual, mas está próxima da margem provisória de 8 ms. Não usar parser genérico ou múltiplas varreduras completas; toda rota derivada deve ter cache/stale, parser delimitado e corpus com páginas de densidade maior antes de ser aprovada para tráfego.

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Recomendações de uma obra — `/manga/{id}/recommendations` | `/manga/2/Berserk/userrecs` | 200 | 605 KB | 4 ms | título e 288 links de manga identificados |

A amostra de manga tem margem ampla e pode seguir para parser específico com cache normal. Ela não remove a restrição da rota equivalente de anime: cada família manterá seus próprios limites de tamanho e CPU.

## Continuação — Watch

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Episódios recentes — `/watch/episodes` | `/watch/episode` | 200 | 49 KB | 2 ms | 11 links de episódio identificados |
| Episódios populares — `/watch/episodes/popular` | `/watch/episode/popular` | 200 | 147 KB | 1 ms | 162 links de episódio identificados |
| Promos recentes — `/watch/promos` | `/watch/promotion?p=1` | 200 | 73 KB | 1 ms | 30 embeds de vídeo identificados |
| Promos populares — `/watch/promos/popular` | `/watch/promotion/popular` | 200 | 71 KB | 1 ms | 30 embeds de vídeo identificados |

As quatro fontes são viáveis no Worker Free com ampla margem. Ficam pendentes a extração estruturada de cada item, paginação da lista recente de promos, fixtures de vazios/404 e os contratos públicos.

## Continuação — fontes derivadas de anime, manga, personagem e pessoa

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Personagens e staff de anime — `/anime/{id}/characters`, `/staff` | `/anime/1/_/characters` | 200 | 1,014 KB | 7 ms | fonte acessível; links de personagem identificados |
| Fórum de anime — `/anime/{id}/forum` | `/anime/1/_/forum` | 200 | 78 KB | não medida neste lote | fonte acessível |
| More info de anime — `/anime/{id}/moreinfo` | `/anime/1/_/moreinfo` | 200 | 58 KB | não medida neste lote | fonte acessível |
| Notícias de anime — `/anime/{id}/news` | `/anime/1/_/news?p=1` | 200 | 70 KB | não medida neste lote | fonte acessível |
| Imagens de anime — `/anime/{id}/pictures` | `/anime/1/jikan/pics` | 200 | 66 KB | não medida neste lote | fonte acessível |
| Reviews de anime — `/anime/{id}/reviews` | `/anime/1/jikan/reviews` | 200 | 290 KB | 2 ms | blocos de review identificados |
| Personagens de manga — `/manga/{id}/characters` | `/manga/2/_/characters` | 200 | 170 KB | 1 ms | fonte acessível |
| Fórum de manga — `/manga/{id}/forum` | `/manga/2/_/forum` | 200 | 72 KB | não medida neste lote | fonte acessível |
| More info de manga — `/manga/{id}/moreinfo` | `/manga/2/_/moreinfo` | 200 | 55 KB | não medida neste lote | fonte acessível |
| Notícias de manga — `/manga/{id}/news` | `/manga/2/_/news?p=1` | 200 | 88 KB | não medida neste lote | fonte acessível |
| Imagens de manga — `/manga/{id}/pictures` | `/manga/2/jikan/pics` | 200 | 64 KB | não medida neste lote | fonte acessível |
| Reviews de manga — `/manga/{id}/reviews` | `/manga/2/jikan/reviews` | 200 | 264 KB | 2 ms | blocos de review identificados |
| Imagens de personagem — `/characters/{id}/pictures` | `/character/1/jikan/pics` | 200 | 58 KB | não medida neste lote | fonte acessível |
| Imagens de pessoa — `/people/{id}/pictures` | `/people/1/jikan/pics` | 200 | 51 KB | não medida neste lote | fonte acessível |

### Decisão de risco

`/anime/{id}/characters` é condicional: embora tenha passado em 7 ms, a fixture de 1 MB deixa pouca margem. Deve usar parser delimitado, cache/stale e corpus de páginas densas antes de tráfego de produto. As demais fontes desta tabela têm transporte confirmado; a medição de CPU fica pendente somente por serem leves e não terem prioridade sobre as páginas já medidas.

## Continuação — usuários recentes, temporadas, clubes e estatísticas de manga

| Família / rota de referência | Fonte MAL | HTTP upstream | HTML aproximado | CPU observada | Resultado |
| --- | --- | ---: | ---: | ---: | --- |
| Usuários recentes — base para `/users` | `/users.php` | 200 | 52 KB | 2 ms | 40 referências de perfil identificadas |
| Histórico canônico — `/users/{username}/history` | `/history/amayacrab/all` | 200 | 39 KB | 1 ms | transporte acessível; o marcador de conteúdo esperado falhou |
| Temporada por ano — `/seasons/{year}/{season}` | `/anime/season/2025/winter` | 200 | 1,273 KB | **8 ms** | fonte acessível, sem margem de CPU |
| Índice de clubes — base para busca | `/clubs.php` | 200 | 102 KB | 1 ms | links de clube identificados |
| Busca de clubes candidata | `/clubs.php?action=search&query=cowboy` | 200 | 102 KB | 1 ms | resposta suspeita; não aprovada como busca |
| Estatísticas de manga — `/manga/{id}/statistics` | `/manga/2/jikan/stats` | 200 | 124 KB | 2 ms | rótulos de estatística identificados |

### Decisões

- **Temporada por ano:** condicional, exatamente no teto provisório de 8 ms; cache/stale e parser delimitado são obrigatórios. Não é uma fonte para refresh síncrono sem corpus adicional.
- **Histórico canônico:** o transporte é leve, mas o HTML não confirmou os marcadores esperados para a fixture. Não expor contrato até inspecionar a estrutura e casos vazio/populado.
- **Busca de clubes:** não aprovada. A URL candidata retornou 200, mas o resultado é suspeito e não comprova que o termo foi aplicado.
- **Busca de usuários:** `/users.php` é somente a listagem de usuários recentes; não substitui pesquisa textual. Qualquer `/users?q=` dependerá de índice próprio/cache de perfis, não de scraping em tempo real.

## Fechamento do probe de fontes

Não restam famílias de página pública independentes sem tentativa no escopo do inventário Jikan. Rotas como `full`, `about`, `favorites`, `external`, `relations`, `themes`, `streaming`, créditos de personagem/pessoa e staff não pedem uma nova URL: são **contratos derivados** de páginas já testadas e exigem parser, fixture e schema próprios. As exceções arquiteturais são busca textual de usuários, busca de clubes, random e qualquer paginação/índice que requeira catálogo local.
