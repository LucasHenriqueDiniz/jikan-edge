# Varredura das 124 chamadas e lote de endurecimento

Data: 2026-08-27. Diferente das varreduras anteriores, esta não comparou rotas contra o
`api.jikan.moe/v4` — capturou requisição e resposta de **cada rota desta API** numa pasta por rota e
analisou o corpus inteiro em conjunto: forma do envelope, campos sempre nulos, coleções vazias,
chaves em `snake_case`, cabeçalhos, tamanho e latência.

## Cobertura

| | |
| --- | --- |
| Chamadas capturadas | **124 de 124 (100%)** |
| Status | **114× 200, 10× 400, zero 5xx** |
| Rotas registradas | 97 em `/v1/*` mais `/health` (contagem autoritativa: `QUERY_CONTRACT`, que `tests/routes/query-contract.test.ts` obriga a cobrir toda rota GET) |

As 124 chamadas passam das 98 rotas porque variações de parâmetro (`?page=2`, `?filter=`, `?q=`)
foram capturadas separadamente. Os dez `400` são todos `INVALID_QUERY` em rota de busca chamada sem
`q` — comportamento correto, registrado como **F2** para não ser reaberto.

O que a varredura confirmou como já sadio: envelope `{data, meta}` universal, **zero** chaves em
`snake_case` sobreviventes da correção de 2026-07-27, e `meta.pagination` presente em toda rota que
aceita `page`.

## Achados e o que foi feito com cada um

| | Achado | Estado | Version |
| --- | --- | --- | --- |
| F1 | `?genres=` sozinho devolvia lista vazia, em anime e mangá, para todo id | corrigido | `0523faba` |
| F2 | busca sem `q` responde 400 | não é defeito | — |
| F3 | `type` nulo em toda entrada de temporada (1.021 no total) | corrigido | `f7d1a163` |
| F4 | `avatarUrl` e `about` nulos em todo perfil | corrigido | `9679c755` |
| F5 | nenhuma das 124 respostas trazia `Cache-Control` ou `ETag` | corrigido | `9679c755` |
| F6 | `meta` divergente no grupo random, e `random/users` cacheável | corrigido | `aa5baaa9` |

Detalhe técnico de cada um em [`docs/routes.md`](../routes.md); contrato para o consumidor no
[`CHANGELOG.md`](../../CHANGELOG.md).

**A forma dos defeitos importa mais que a contagem.** Nenhuma das 124 chamadas falhou — os cinco
defeitos reais eram todos **200 com dado errado ou ausente**, que é o modo de falha que este projeto
já identificou como o seu mais caro. Dois deles (F1, F3) eram estruturais: o campo não podia estar
certo para requisição nenhuma, e mesmo assim nada acusava.

## Medições novas

### Teto de tamanho de linha do D1 — documentação diverge do medido

Sondado contra o D1 remoto real, escrevendo por parâmetro vinculado exatamente como os repositórios
fazem, num Worker descartável apontado para o mesmo banco:

| bytes na linha | resultado |
| ---: | --- |
| 4.194.256 | grava; a leitura volta byte a byte idêntica |
| 4.194.257 | `D1_ERROR: string or blob too big: SQLITE_TOOBIG` |

São 4 MiB (4.194.304) menos os 48 bytes das outras colunas. O teto é **da linha**, não do valor:
enchendo a chave primária com 1.000 bytes a mais, a fronteira caiu na mesma medida. **Nada trunca**
abaixo do teto.

A [documentação oficial](https://developers.cloudflare.com/d1/platform/limits/) diz
`Maximum string, BLOB or table row size: 2,000,000 bytes` — cerca de **metade** do medido.

Nota de método: a primeira sonda usou SQL literal (`hex(zeroblob(...))`) e um valor de 2,2 MB
entrou. Isso poderia ser um caminho especial do SQL, então foi refeita por parâmetro vinculado. Os
dois caminhos concordam.

Maior linha de hoje: `catalog:anime:21:characters-staff` (One Piece), **1.207.652 bytes** — 28,8% do
teto medido, **60,4% do documentado**. As cinco maiores são todas `characters-staff`, a mesma família
que estourou o teto de fetch mais cedo hoje; é a mesma pressão de séries longas chegando na camada de
armazenamento em vez da de rede. Por isso a folga não documentada **não** é para se construir em
cima, e o caso virou `507 PAYLOAD_TOO_LARGE` (version `1f16e42c`) em vez de 500 mudo.

### Stale-while-revalidate interno

`wrangler dev --remote` com TTL de 60 s, mesma rota e mesma página:

| | antes | agora |
| --- | ---: | ---: |
| miss frio | 1747 ms | 1747 ms (inalterado — não há o que servir) |
| hit fresco | 512 ms | 512 ms |
| **primeira requisição depois do TTL** | fazia o trabalho do miss frio | **686 ms**, `X-Cache-Status: stale` |
| requisição seguinte | — | `hit`, `max-age=57` (linha reescrita pelo refresh de fundo) |

Confirmado também em produção, onde linhas vencidas dentro da janela de 6 h existiam de fato:
`stale` em 861 ms, depois `hit` com `max-age=21579` — TTL cheio, escrito pela tarefa de fundo, não
pela requisição que respondeu.

### Revalidação HTTP

`ETag` mais `If-None-Match` em `GET /v1/anime/21/characters`: **1.132.672 bytes → 0** num `304`.

### Limites de fetch ao MAL

O teto de 2 MiB por documento reprovava sete títulos populares com `502`; nunca funcionaram, e não
havia linha em D1 para nenhum deles. Resolvido em duas etapas: `MAX_UPSTREAM_BYTES` para 5 MiB
(`629508ce`, cinco títulos recuperados) e um budget por chamada de 16 MiB / 20 s para páginas de
personagens (`5b41891e`, os dois restantes). One Piece devolve 541 membros de staff e 1.482
personagens; Detective Conan, 471 e 2.110.

## Estado da suíte

| | |
| --- | --- |
| `vitest run` | 63 arquivos, **349 testes** |
| `vitest run --config vitest.integration.config.ts` | 6 arquivos, **29 testes**, contra D1 real |
| `tsc --noEmit` | limpo |
| `wrangler deploy --dry-run` | ok |

**378 no total.** As duas suítes têm config separada — rodar só `vitest run` não exercita
`tests/integration/**`.

Cobertura que passou a existir hoje, em pontos que estavam em produção sem teste nenhum:
`src/http/caching.ts`, `src/http/errors.ts` (todo status da união `ServiceErrorStatus` verificado
até o cliente), `src/config/env.ts` (lendo o `wrangler.jsonc` real, para que o valor publicado e o
default do código não possam divergir em silêncio) e `src/source/fetch-policy.ts`.

E uma fixture que era sintética virou real: `tests/fixtures/anime/season-now-real.html`, nove cards
byte a byte da página do MAL, incluindo as variantes `kids` e `r18` e cabeçalhos que discordam de
propósito do tipo dos cards. A fixture antiga não tinha `js-anime-type-all`, nem cabeçalho, nem essas
variantes — um parser que lesse o cabeçalho passaria nela e falharia em produção.

## Versões publicadas hoje

`4ce71084`, `9d3445dd`, `a07e0742`, `629508ce`, `ebeba400`, `5b41891e`, `f2b389cd`, `086145f9`,
`2139e894`, `9679c755`, `44d028aa`, `0523faba`, `b9cf7782`, `f7d1a163`, `feaf775d`, `aa5baaa9`,
`dff313ec`, `61a0c56e`, `7f6b59d3`, `1f16e42c`, `cf954b67`, `6d099571`.

Uma nota operacional que custou tempo: `1f16e42c` levou **~15 minutos** para aparecer, contra os
~30-60 s habituais. Não havia nada errado com o build. `wrangler deployments list` e
`wrangler versions list` mostram apenas o que teve sucesso, então **ausência de version não
distingue "atrasado" de "quebrado"** — essa distinção só existe na aba Builds do painel.

## O que fica em aberto

- **O teto de linha do D1 continua se aproximando.** O `507` transforma o estouro em erro explicado,
  não o evita. Se `characters-staff` continuar crescendo, a correção real é mudar como payloads
  grandes são guardados (particionar por página, por exemplo), e isso não foi desenhado.
- **A folga de 4 MiB não é documentada** e pode ser alinhada aos 2 MB documentados sem aviso. Contra
  esse número, One Piece já está em 60%.
- `anime/:id/episodes` segue lendo só a primeira página do MAL.
- As rotas não implementadas continuam recusadas pelos motivos já registrados em
  [`docs/routes.md`](../routes.md) — nenhuma foi reaberta por esta varredura.
