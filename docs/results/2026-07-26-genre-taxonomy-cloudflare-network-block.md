# `genres/anime` e `genres/manga` — MAL reduz o conteúdo para a rede da Cloudflare

Data: 2026-07-26. Descoberto ao implementar o catálogo de manga e notar que `/v1/genres/manga` retornava só 12 gêneros (real: ~300+, contando gêneros de todo tipo de conteúdo listado na barra lateral). Investigação mostrou que o mesmo já afetava `/v1/genres/anime` desde o primeiro deploy — só não tinha sido notado porque a validação anterior olhou uma prévia truncada da resposta, não a contagem total.

## Evidência

Fetch da MESMA URL (`https://myanimelist.net/anime/genre/1/Action`), comparando origem:

| Origem do fetch | Contagem de `<span class="genre">` | Tamanho do documento |
| --- | ---: | ---: |
| PowerShell direto (minha rede residencial) | 284–316 (variou entre tentativas, mas sempre na faixa de centenas) | ~630–790 KB |
| `wrangler dev --local` (Workers runtime local, mas fetch pela minha rede) | 284 | 791 KB |
| Worker publicado em produção (rede real da Cloudflare) | 12–13 | não capturado, mas claramente um documento muito menor |

O status HTTP é 200 nos três casos — não há erro, redirect ou marcador de challenge/captcha detectável por `classifyHtml`. O MAL simplesmente serve uma barra lateral de gêneros reduzida (~12 itens) especificamente para requisições que chegam pela rede/datacenter da Cloudflare, provavelmente como mitigação anti-scraping direcionada a esse tipo de tráfego — o mesmo tipo de fenômeno já registrado (sem causa raiz confirmada) em `docs/results/cloudflare-1042-investigation.md`.

Páginas de **detalhe individual** (anime, manga) e de **ranking** (top anime, top manga, temporada atual) não mostraram esse problema — foram validadas extensivamente em produção com dados completos e corretos. O problema parece específico de páginas de **navegação/agregação por gênero**.

## Correção aplicada

`parseAnimeGenres`/`parseMangaGenres` agora rejeitam resultados com menos de 20 gêneros (`MIN_EXPECTED_GENRES`), lançando `ParserError` em vez de aceitar silenciosamente uma lista incompleta como válida. Isso segue a regra do projeto ("nunca substitua dado válido por documento suspeito"), mas tem uma consequência real: **`/v1/genres/anime` e `/v1/genres/manga` retornam 500 em produção agora**, porque toda tentativa de refresh pela rede da Cloudflare recebe a versão reduzida, nunca a completa. Antes da correção, essas rotas retornavam 200 com dados silenciosamente incompletos (13/12 itens) — pior, mas sem erro visível.

## Estado atual

**Bloqueado**, na mesma categoria de "Pessoa: detalhe" e outras rotas marcadas como bloqueadas em `docs/planning/jikan-v4-route-validation.md`. Não é um bug de parser — é uma restrição de rede externa sem solução identificada nesta sessão. Não tentei contornar com headers alternativos, rotação de IP ou outras técnicas — isso esbarraria nas regras do projeto contra scraping mais agressivo.

Próximos passos possíveis (não implementados):
1. Aceitar a lista reduzida como "melhor esforço" e documentar explicitamente no contrato da rota que pode vir incompleta — contradiz a filosofia atual do projeto, exigiria decisão explícita do usuário.
2. Investigar se outro caminho de origem (ex. uma página diferente que também liste a taxonomia completa de gêneros) tem o mesmo problema.
3. Deixar bloqueado e não expor a rota até uma solução aparecer.
