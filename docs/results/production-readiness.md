# Production readiness — jikan-edge

Atualizado em 2026-08-27. O veredito de 2026-07-19 está preservado no fim como registro.

## Decisão atual

**Em produção e servindo tráfego externo.** As 98 rotas respondem, existe o primeiro consumidor
externo (issue #1, um self-hoster) e o segundo (PR #2, um port), e a varredura de 2026-08-27 cobriu
124 chamadas sem nenhum 5xx. O que ainda falta não é o que faltava em julho.

| Área | Estado | Evidência | Risco restante | Próxima ação |
| --- | --- | --- | --- | --- |
| Suíte | confirmado | 349 unitários + 29 de integração contra D1 real; typecheck e dry-run limpos | duas configs separadas: `vitest run` sozinho não roda `tests/integration/**` | — |
| Cobertura de rota | confirmado | 124 chamadas capturadas, 114× 200 / 10× 400 / zero 5xx ([varredura](2026-08-27-route-audit-and-hardening.md)) | — | — |
| Contrato de query param | confirmado | `QUERY_CONTRACT` é fonte da verdade e `tests/routes/query-contract.test.ts` falha se uma rota GET não tiver entrada | — | — |
| Cache HTTP | confirmado | `Cache-Control` com frescor restante, `ETag`/`If-None-Match`; 1.132.672 B → 0 num 304 | — | — |
| Cache interno | confirmado | stale-while-revalidate medido em produção; a requisição que estoura o TTL não bloqueia mais | — | — |
| CPU | confirmado no plano pago | p50 7 ms / p95 27 ms / máx 48 ms em miss ([benchmark](2026-07-26-catalog-corpus-benchmark.md)) | **plano Free devolve `Error 1102` nas rotas pesadas** — o teto lá é 10 ms | está documentado em `docs/self-hosting.md`; não prometer "roda no Free" sem a ressalva |
| Armazenamento D1 | **atenção** | teto de linha medido em 4.194.256 B; maior linha 1.207.652 B | 28,8% do teto medido, mas **60,4% do documentado** (2 MB), e `characters-staff` só cresce | desenhar particionamento de payload grande antes de encostar |
| Self-hosting | confirmado | `npm run setup`, `503 DATABASE_NOT_MIGRATED`, `/health` com `checks.database`, `docs/self-hosting.md` | — | — |
| Rate limit | confirmado | chave por IP global, burst 30/10 s + sustentado 60/60 s, `Retry-After` no 429 | é local ao colo e eventualmente consistente, por design da API da Cloudflare | — |
| Corpus de perfis | parcial | validado contra perfis reais completos (Xinil 399, AMayacrab 360, Karinyia 2.354) | ainda não é amostragem estatística de 10 perfis por porte | — |
| 1042/404 | resolvido na prática | não reincidiu desde o upgrade de plano; a investigação original segue em [`cloudflare-1042-investigation.md`](cloudflare-1042-investigation.md) | — | — |

## Riscos que valem repetir

- **O modo de falha caro deste projeto é `200` com dado errado, não `5xx`.** Os cinco defeitos reais
  encontrados em 2026-08-27 responderam todos 200. Nenhuma checagem de status teria achado qualquer
  um deles.
- **Fixture sintética esconde campo faltante.** Dois achados do lote (F3 e o parser de listas antes
  dele) passavam nos testes justamente porque a fixture não tinha a marcação real.
- **O teto de linha do D1 é um penhasco, não uma curva.** A folga entre o documentado e o medido é
  real mas não é contratual.

## Veredito anterior (2026-07-19), preservado

> **pronto para desenvolvimento**. Não atende ainda aos critérios para beta controlada: faltam corpus
> real de 10 perfis, categorias grande/muito grande, testes HTTP de cache/stale com fetch
> determinístico, perfil privado, comparação estatística e investigação conclusiva de 1042.
>
> Testes: 11 unitários, 5 integrações D1 local no runtime Workers, nenhum ignorado. O corpus de rede
> permanece limitado a `AMayacrab`; não é benchmark operacional.

Do que aquela lista pedia: cache/stale com fetch determinístico e o corpus real de listas foram
feitos; o 1042 deixou de ocorrer; a amostragem estatística de perfis por porte **não** foi feita.
