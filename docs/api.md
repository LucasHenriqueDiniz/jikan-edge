# API v1

| Rota | Descrição |
| --- | --- |
| `GET /health` | Estado do Worker |
| `GET /v1/users/:username` | Perfil normalizado |
| `GET /v1/users/:username/statistics` | Estatísticas extraídas do perfil |
| `GET /v1/users/:username/animelist?page=1&limit=100` | Lista de anime paginada pelo D1 |
| `GET /v1/users/:username/mangalist?page=1&limit=100` | Lista de manga paginada pelo D1 |

Todas as respostas de recurso retornam `{ data, meta }`. `limit` padrão é 100 e máximo 300. Erros retornam `{ error: { code, message, requestId } }` com 404, 403, 429, 501, 502, 503 ou 504 conforme a classificação da fonte — o 501 é `LIST_TOO_LARGE`, único código que não vem da fonte: sinaliza que a lista passa das 6.000 entradas que a API lê num refresh.

> Esta página cobre só o núcleo de usuários. O contrato completo das 98 rotas, com as limitações conhecidas de cada grupo, está em [`routes.md`](routes.md).
