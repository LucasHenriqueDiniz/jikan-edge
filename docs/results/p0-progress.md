# P0 — progresso de endurecimento

Data: 2026-07-19.

> **Correção posterior (2026-07-30).** A conclusão sobre listas registrada abaixo estava errada e virou bug em produção: os 273 links eram a lista **truncada** (o perfil declara 360), `offset` existe e funciona como query param, e a generalização de "snapshot inteiro em um fetch" veio de um único perfil que por acaso usava o layout clássico. O estado correto está em [`docs/sources/mal-list-delivery.md`](../sources/mal-list-delivery.md). O texto original segue abaixo como registro do que se sabia na data.

## Feito nesta etapa

- Lista pública de `AMayacrab` inspecionada diretamente: anime retornou 273 links em 595.422 bytes; manga, 227 links em 509.234 bytes. Em ambos os HTMLs não houve `offset`, `page`, `ajax` ou `xhr`. Para esse usuário, a lista é snapshot inteiro em um fetch por mídia.
- Parser de lista já recusa IDs duplicados e itens que falhem validação, preservando o snapshot D1 anterior.
- Cliente MAL usa redirects manuais, no máximo três, e valida HTTPS/host exato a cada salto. Redirect externo é rejeitado.
- User-Agent agora referencia o endpoint real, sem `replace-me`.
- Rate Limiting API nativa: 60 requisições/60 s por IP e rota. É local ao colo e permissiva/eventualmente consistente, conforme a API da Cloudflare; protege o upstream mas não serve como contabilidade global.
- Métrica JSON `operation_metric` emitida por requisição, incluindo rota, status, duração e resultado de limitação.
- Worker publicado na versão `6f4f4942-a00a-4e09-84e7-d03705afbab4`.

## Ainda pendente no P0

- Harness de integração com D1 que prove cache fresh/stale, fonte indisponível, resposta suspeita e leases concorrentes/abandonados.
- Amostra confiável de usuários pequeno/médio/muito grande: duas tentativas adicionais de usuários públicos retornaram documentos sem cards, possivelmente bloqueio/estado de fonte, e não devem ser tratados como benchmark.
- Investigação conclusiva de 1042/404. A documentação oficial define 1042 como fetch de Worker para Worker na mesma zona sem `global_fetch_strictly_public`; o Worker não faz fetch para sua própria zona. A ocorrência observada fica fora do código e requer traces/logs Cloudflare para correlação.

## Validação

`typecheck`, 11 testes, dry-run, migração local e benchmark concluíram com sucesso. O benchmark segue sendo somente microbenchmark de parser.

## Fontes

- [Cloudflare Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare error 1042](https://developers.cloudflare.com/workers/observability/errors/)
