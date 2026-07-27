# Arquitetura do vertical slice

Fluxo: HTML público do MAL → `MalClient` → validação de resposta → parser puro → modelos normalizados → D1/cache → Hono → WeebProfile.

`UserService` (perfil, estatísticas, favoritos, updates, listas) e `AnimeService` (detalhe, gêneros, top, temporada atual) coordenam refresh. Ambos delegam a orquestração de cache/stale/lease para `withCache` em `src/services/cacheable.ts` — extraído do que antes era um método privado só da `UserService` — para não duplicar a lógica a cada nova entidade. `ServiceError`, `ServiceResponse<T>` e `sourceError()` (mapeamento `SourceResult.kind` → código/status HTTP) também vivem nesse módulo compartilhado.

D1 guarda entidades normalizadas e `cache_entries`; `refresh_leases` faz um lease expirável por recurso para evitar refresh concorrente. Se houver dado stale e a fonte falhar, a resposta continua 200 com `meta.stale=true` e `meta.refreshFailed=true`. Entidades com um único registro por chave (favoritos, updates, detalhe de anime) usam uma tabela dedicada com uma coluna `payload_json`; recursos com formato de lista sem uma entidade própria (gêneros, top anime, temporada atual) usam a tabela genérica `catalog_lists`, keyed por `resource_key` (ex.: `catalog:top:anime:page:1`).

Não há Durable Objects. R2 está configurado para snapshots problemáticos ou fixtures grandes, mas não recebe HTML por padrão. O parser não faz fetch nem toca no banco.
