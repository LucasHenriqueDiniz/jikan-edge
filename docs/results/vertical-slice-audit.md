# Auditoria técnica do vertical slice — jikan-edge

Data: 2026-07-19. Escopo: código local, D1 remoto, binding R2, configuração Wrangler e Worker publicado. Não foram adicionadas rotas.

## Resultado objetivo

**Não pronto para integrar ao WeebProfile em produção.** O fluxo básico funciona, mas faltam testes de integração para cache/leases, proteção de abuso, instrumentação, e a coleta de listas ainda depende de um único HTML e de parser regex frágil. Está apto apenas para continuação controlada de desenvolvimento.

## Rotas e fluxo confirmado

| Rota | Upstream/fetches | Parser | D1 leitura/escrita | hit/miss/stale e falha |
| --- | --- | --- | --- | --- |
| `/health` | nenhum | nenhum | nenhum | 200 sempre que Worker responder |
| `/v1/users/:username` | `/profile/:username`, 1 no miss | `parseUserProfile`; também estatísticas | lê `cache_entries`,`users`; escreve `users`,`user_statistics`,`cache_entries`,`refresh_leases` | hit fresh 200 cached; miss atualiza; stale retorna 200 com `stale:true`; sem cache e falha retorna 404/403/429/502/503/504 |
| `/statistics` | delega ao perfil; 0 no hit, 1 no miss | `parseUserStatistics` | idem, depois lê `user_statistics` | mesmas regras do perfil |
| `/animelist` | `/animelist/:username`, 1 no miss | `parseUserAnimeList` | lê `cache_entries`,`user_media_list_entries`; escreve lista, cache e lease | hit pagina D1; stale preserva lista; sem cache falha conforme acima |
| `/mangalist` | `/mangalist/:username`, 1 no miss | `parseUserMangaList` | idem para manga | idem |

TTLs confirmados em `wrangler.jsonc`: perfil/estatísticas 21.600 s; listas 7.200 s. A resposta suspeita é rejeitada pelo cliente de fonte antes da persistência. A revisão corrigiu ainda o caso de IDs repetidos/item Zod inválido no parser: agora lança `ParserError`, e o stale existente é preservado.

## Cache, leases e listas

- **Cache fresh/upstream disponível ou indisponível:** confirmado por fluxo de código; não chama upstream.
- **Stale/upstream disponível:** parcial; o código faz refresh síncrono e substitui o snapshot se o parser aceitar.
- **Stale/upstream indisponível e HTML suspeito:** confirmado por fluxo; devolve stale e não chega em `replaceList`/`saveProfile`.
- **Sem cache/upstream indisponível:** confirmado por fluxo; erro mapeado, não escreve cache.
- **Leases:** a aquisição é um `INSERT ... ON CONFLICT ... WHERE expires_at < now`; é uma única instrução D1 e portanto atômica por chave. `release` é condicionado pelo owner. Leases de recursos diferentes não conflitam. Não há teste de integração concorrente/abandono; estado: **não testado**.
- **Listas:** `D1Database.batch` é transacional; delete e inserts fazem rollback juntos se uma instrução falhar. Porém não há paginação upstream, limite de tamanho/quantidade, detecção de mudança de markup além da extração, nem teste com lista grande real. Estado: **parcial**. O novo bloqueio de snapshot incompleto evita a corrupção silenciosa por duplicatas/itens inválidos que coincidam com o seletor.

## Estatísticas e benchmark

`/statistics` não consulta uma página própria e não deriva as listas: extrai Anime Stats e Manga Stats da mesma página de perfil. A execução anterior contra `AMayacrab` retornou anime completed 288 e manga reading 51/plan-to-read 10; não há corpus persistido nem segunda coleta independente para comparar, logo a comparação exigida é **não testada**.

O número anterior de aproximadamente 0,12 ms mede apenas 100 invocações em memória de `parseUserProfile` sobre `tests/fixtures/users/profile-valid.html`, após `readFileSync` fora do loop. Não inclui fetch, validação `classifyHtml`, D1, Worker, serialização nem warmup explícito; não é p95 de produção. Não há corpus de tamanhos variados nem p99/média por parser: **não implementado**.

## R2, segurança e observabilidade

`SNAPSHOTS_BUCKET` está configurado, mas não é referenciado em `src/`: nenhum objeto, retenção, limpeza ou custo existe. Estado: **não implementado**; o binding é dispensável até haver um desenho de privacidade/retenção.

SSRF: **confirmado** — `MalClient` aceita apenas HTTPS e hostname exato `myanimelist.net`; URLs são internas e não vêm do cliente. Há timeout de 8 s e teto de 2 MiB. Queries D1 são parametrizadas; stack traces não são devolvidos. Username ASCII impede Unicode/percent-encoded. Parcial: redirects seguem sem revalidar o destino final, não há retry/backoff, rate limiting, CORS explícito ou métrica efetiva (`logMetric` é importado mas não chamado). O User-Agent ainda contém URL placeholder e deve apontar para contato real antes de produção.

## Worker publicado e configuração

O projeto/Worker foi renomeado e publicado como `jikan-edge`: `https://jikan-edge.lucas-hdo.workers.dev` (versão `b77586ca-7124-48e4-a8eb-6124b291a46a`). D1 remoto novo: `jikan-edge` (`71f8a596-7855-47a5-906c-9a1cf46e12ee`) com as 9 tabelas de domínio mais tabelas internas; R2 novo: `jikan-edge-snapshots`. Os recursos antigos `jikanv2` foram preservados, sem exclusão.

Matriz executada após deploy: `/health` 200; perfil `AMayacrab` 200 (primeiro miss); username percent-encoded `a%2Fb` 400; `animelist?limit=999` 200 com limite aplicado a 300; manga list 200/cached. Houve respostas intermitentes Cloudflare `1042`/404 ao executar chamadas consecutivas muito rápidas, inclusive em `animelist?limit=3`; a mesma rota respondeu logo em seguida. Isso não é tratado pelo Worker e reforça o estado **não pronto**. `curl -i https://jikan-edge.lucas-hdo.workers.dev/health` e `curl -i "https://jikan-edge.lucas-hdo.workers.dev/v1/users/AMayacrab/animelist?limit=3"` são reproduzíveis.

## Tabela final

| Área | Estado | Evidência | Risco | Correção |
| ---- | ------ | --------- | ----- | -------- |
| Rotas básicas | confirmado | `src/app.ts`, serviço e deploy | baixo | manter contratos testados |
| Fonte/SSRF | parcial | allowlist/timeout/limite no cliente | médio | validar destino de redirect; contato real no UA |
| Cache stale | parcial | `withCache` e validação | médio | testes de integração com D1/fetch falso |
| Leases | parcial | upsert atômico no D1 | médio | testes concorrentes e telemetria |
| Integridade de lista | parcial | batch transacional; correção de parser | alto | parser estruturado, limite e corpus real |
| Paginação upstream | não implementado | um fetch/lista | alto | definir fonte/paginação antes de listas enormes |
| Estatísticas | parcial | parser de perfil | médio | comparação automatizada e fixtures reais |
| Benchmark | incorreto | teste smoke de 100 loops | médio | corpus e métricas completas |
| R2 | não implementado | binding sem uso | baixo | remover binding ou desenhar retenção |
| Rate limit/CORS/métricas | não implementado | código | alto | implementar antes de exposição pública |
| Testes de integração | não implementado | somente 9 testes unitários | alto | D1/leases/cache e matriz HTTP |
