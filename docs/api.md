# API v1

O contrato de resposta é o do **Jikan v4**. Rotas, query params, nomes de campo e formato de
erro seguem o Jikan — migrar de `api.jikan.moe/v4` é trocar a base URL. Ver `docs/routes.md`
para a lista completa de rotas e as rotas que não servimos.

## Envelope

Recurso único:

```json
{ "data": { "mal_id": 1, "images": { "jpg": { "image_url": "..." } } },
  "meta": { "cached": true, "stale": false, "refreshFailed": false, "fetchedAt": "..." } }
```

Lista:

```json
{ "pagination": { "last_visible_page": 1, "has_next_page": false, "current_page": 1,
                  "items": { "count": 25, "total": null, "per_page": 25 } },
  "data": [ ... ],
  "meta": { ... } }
```

`meta` é **nosso**, não do Jikan, e fica no topo ao lado de `data`. Clientes Jikan ignoram
chaves desconhecidas. `meta.stale === true` significa que servimos cache válido depois de um
refresh que falhou — é dado bom, não erro. Nenhum outro campo do Jikan foi movido para dentro
dele.

`limit` (só nas rotas `animelist`/`mangalist`) tem padrão 100 e máximo 300 — o Jikan trava em
25, então é um superset; `items.per_page` reporta o valor real usado.

## Paginação: quando `items.total` é `null`

Duas situações diferentes moram no mesmo bloco:

- **Sabemos o tamanho do corpus** — o D1 pagina para nós (`animelist`/`mangalist`), ou a rota
  serve um documento único do MAL cujas entradas contamos por inteiro. Aí a conta de páginas é
  real.
- **Servimos uma página do MAL e não sabemos o que vem depois** — `items.total` é `null` e
  `has_next_page` é `false`. Reportar `total = count` afirmaria que aquela página é o corpus
  inteiro, e um `has_next_page: true` especulativo mandaria o cliente paginar além do fim.

## Erros

Formato do Jikan, com o nosso código preservado em `error` e o `requestId` como chave extra:

```json
{ "status": 404, "type": "BadResponseException", "message": "Resource does not exist",
  "error": "NOT_FOUND", "requestId": "..." }
```

| `error` | HTTP | `type` |
| --- | --- | --- |
| `NOT_FOUND`, `NO_LOCAL_ENTRIES` | 404 | `BadResponseException` |
| `PRIVATE_PROFILE` | 403 | `BadResponseException` |
| `RATE_LIMITED`, `UPSTREAM_RATE_LIMITED` | 429 | `RateLimitException` |
| `INVALID_FILTER` | 400 | `BadRequestException` |
| `UPSTREAM_SUSPICIOUS` | 502 | `BadResponseException` |
| `UPSTREAM_UNAVAILABLE`, `REFRESH_IN_PROGRESS` | 503 | `BadResponseException` |
| `UPSTREAM_TIMEOUT` | 504 | `BadResponseException` |
| `INTERNAL_ERROR` | 500 | `Exception` |

`GET /health` é o único endpoint fora do contrato Jikan (o Jikan não tem equivalente) e
continua em `{ data, meta }`.

## Campos que não conseguimos preencher

Só extraímos o que a página pública do MAL mostra. Os campos abaixo existem na resposta — com
`null`, ou `[]` quando são coleção — porque cliente Jikan lê `data.images.jpg.image_url` sem
optional chaining, e objeto aninhado ausente lança onde folha `null` não lança.

| Campo | Valor | Por quê |
| --- | --- | --- |
| `approved` | `null` | a página não expõe |
| `scored_by` | `null` | só temos `score` |
| `background` | `null` | não parseado |
| `title_synonyms` | `[]` | não parseado |
| `explicit_genres` | `[]` | o MAL não distingue na página |
| `producers`, `licensors` (anime) | `[]` | a página de detalhe só lista `studios` |
| `demographics` (anime) | `[]` | existe só em mangá |
| `images.webp.*` | `null` | o MAL dá uma URL por entidade |
| `images.jpg.small_/large_image_url` | `null` | idem (exceto em `/pictures`, que tem thumbnail) |
| `trailer.*` no detalhe de anime | `null` | vídeo vive em `/anime/:id/videos`, outra rota e outro cache |
| `broadcast.*` | `null` | não parseado (exceto `broadcast.day` em `/schedules`) |
| `season`, `year` | `null` | exigiria parsear a string de `aired` — ver abaixo |
| `aired.from`, `aired.to`, `aired.prop` | `null` | idem |

**Sobre datas:** o MAL entrega o período como uma string só (`"Apr 3, 1998 to Apr 24, 1999"`,
mas também `"1998"`, `"Apr 1998 to ?"`, `"Not available"`). `aired.string` / `published.string`
carregam essa string inteira; os campos estruturados ficam `null` em vez de arriscar uma data
confiantemente errada nos formatos menos comuns.
