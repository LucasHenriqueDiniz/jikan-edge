# API v1

| Rota | Descrição |
| --- | --- |
| `GET /health` | Estado do Worker |
| `GET /v1/users/:username` | Perfil normalizado |
| `GET /v1/users/:username/statistics` | Estatísticas extraídas do perfil |
| `GET /v1/users/:username/animelist?page=1&limit=100` | Lista de anime paginada pelo D1 |
| `GET /v1/users/:username/mangalist?page=1&limit=100` | Lista de manga paginada pelo D1 |

Todas as respostas de recurso retornam `{ data, meta }`. `limit` padrão é 100 e máximo 300. Erros retornam `{ error: { code, message, requestId } }` com 404, 403, 429, 502, 503 ou 504 conforme a classificação da fonte.

## Estatísticas de usuário

`GET /v1/users/:username/statistics` retorna dois buckets:

```text
anime: watching, completed, onHold, dropped, planToWatch, totalEntries,
       rewatched, episodesWatched, daysWatched, meanScore
manga: reading, completed, onHold, dropped, planToRead, totalEntries,
       reread, chaptersRead, volumesRead, daysRead, meanScore
```

Os contadores de status (`watching`…`totalEntries`) são sempre números. Os demais são `number | null` e vêm `null` quando o perfil não expõe o valor — por exemplo `meanScore` de um perfil sem notas, que o MAL renderiza como `N/A`. `daysWatched`/`daysRead` são decimais.

Os rótulos no HTML do MAL não são os nomes dos campos: a lista `stats-data` traz `Episodes`, `Chapters` e `Volumes` (não `Episodes Watched` etc.), e `Days` fica na `stat-score`, fora de qualquer tag. Os contadores por status ficam em `stats-status`, onde o número é o texto do `<span>` seguinte ao rótulo — ancorar em qualquer coisa mais frouxa lê a largura em pixels da barra do gráfico (`style="width: 221.9px"`) ou a classe utilitária `lh10` como se fosse o valor.
