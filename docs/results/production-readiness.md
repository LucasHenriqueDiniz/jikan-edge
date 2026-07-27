# Production readiness — jikan-edge

## Decisão final

**pronto para desenvolvimento**. Não atende ainda aos critérios para beta controlada: faltam corpus real de 10 perfis, categorias grande/muito grande, testes HTTP de cache/stale com fetch determinístico, perfil privado, comparação estatística e investigação conclusiva de 1042.

| Área | Estado | Evidência | Risco restante | Próxima ação |
| --- | --- | --- | --- | --- |
| D1/leases | parcial | 5 integrações Workers/Miniflare | cenários de serviço não cobertos | cache/stale via HTTP/fetch mock |
| Snapshot de lista | parcial | resultado discriminado e bloqueio de partial | terminal marker é heurístico | corpus real e total declarado |
| CORS | parcial | allowlist configurável, GET/OPTIONS | domínio WeebProfile não informado | configurar produção |
| Rate limit/métricas | confirmado | binding nativo e logs JSON | métricas ainda não enumeram todo evento | ampliar eventos |
| 1042/404 | pendente | investigação anterior | origem externa ao Worker não confirmada | tail/traces controlados |

## Testes

11 unitários, 5 integrações D1 local no runtime Workers, nenhum ignorado. O corpus de rede permanece limitado a `AMayacrab`; não é benchmark operacional.
