# API v1

| Rota | Descrição |
| --- | --- |
| `GET /health` | Estado do Worker |
| `GET /v1/users/:username` | Perfil normalizado |
| `GET /v1/users/:username/statistics` | Estatísticas extraídas do perfil |
| `GET /v1/users/:username/animelist?page=1&limit=100` | Lista de anime paginada pelo D1 |
| `GET /v1/users/:username/mangalist?page=1&limit=100` | Lista de manga paginada pelo D1 |

Todas as respostas de recurso retornam `{ data, meta }`. Erros retornam `{ error: { code, message, requestId } }` com 404, 403, 429, 501, 502, 503 ou 504 conforme a classificação da fonte — o 501 é `LIST_TOO_LARGE`, único código que não vem da fonte: sinaliza que a lista passa das 6.000 entradas que a API lê num refresh.

`limit` (padrão 100, máximo 300) **só existe nestas duas rotas**, que paginam sobre o D1. Nas demais é 400 `UNSUPPORTED_PARAMETER`: a resposta de lá é uma página do MAL, e recortá-la daria um resultado diferente do que o mesmo `limit` significa no Jikan.

`page` vai de 1 a 1000, e valor inválido é 400 `INVALID_PAGE` — não é mais corrigido em silêncio. Todas as rotas paginadas trazem `meta.pagination` com `{ page, limit, count, total, hasNextPage }`; `total` é número só aqui, onde a contagem vem do banco local.

Parâmetro que a rota não declara é 400: `UNKNOWN_PARAMETER` se o nome não existe em lugar nenhum, `UNSUPPORTED_PARAMETER` se existe no Jikan v4 e esta API não o honra — nesse caso a mensagem diz por quê e aponta o substituto.

## Formas que diferem do Jikan v4

Renomear campo não basta — estas mudam de **forma**, e um `mal_id → malId` mecânico deixa `undefined` em silêncio:

| Jikan v4 | aqui |
| --- | --- |
| `images.jpg.image_url` | `images.medium` — a chave também se chama `images`, mas é `{ small, medium, large }`, sem divisão jpg/webp. Qualquer um dos três é `null` onde o CDN do MAL não tem aquele tamanho. `imageUrl` também existe e é sempre igual a `images.medium`. |
| `genres[].mal_id` | `genres[].malId` — arrays de `{ malId, name, url }`, o mesmo para `themes`, `demographics`, `studios`, `authors`, `producers` e `licensors` |
| `serialization` (string) | `serializations` (array de `MalRef`) |
| `aired.prop.from.year` | `aired.from` — `{ from, to, string }`, datas `YYYY-MM-DD` ou `null`, sem o aninhamento `prop`. `string` preserva a redação do próprio MAL. |
| busca de mangá com `episodes` | `volumes` |
| — | `url` em toda entidade, com o link canônico do MAL |

> Esta página cobre só o núcleo de usuários. O contrato completo das 98 rotas, com as limitações conhecidas de cada grupo, está em [`routes.md`](routes.md). As mudanças que afetam quem consome estão no [`CHANGELOG.md`](../CHANGELOG.md).
