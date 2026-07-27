# API v1

| Rota | Descrição |
| --- | --- |
| `GET /health` | Estado do Worker |
| `GET /v1/users/:username` | Perfil normalizado |
| `GET /v1/users/:username/statistics` | Estatísticas extraídas do perfil |
| `GET /v1/users/:username/animelist?page=1&limit=100` | Lista de anime paginada pelo D1 |
| `GET /v1/users/:username/mangalist?page=1&limit=100` | Lista de manga paginada pelo D1 |

Todas as respostas de recurso retornam `{ data, meta }`. `limit` padrão é 100 e máximo 300. Erros retornam `{ error: { code, message, requestId } }` com 404, 403, 429, 502, 503 ou 504 conforme a classificação da fonte.
