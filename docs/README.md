# Documentação

| Área | Conteúdo | Estado |
| --- | --- | --- |
| [`self-hosting.md`](self-hosting.md) | como rodar uma instância própria numa conta Cloudflare qualquer: setup, troubleshooting, limites de plano e política de uso | ativa |
| [`routes.md`](routes.md) | contrato de cada rota servida, com fonte no MAL, TTL e as limitações verificadas | ativa |
| `research/` | pesquisas externas, com fontes e data | iniciada |
| `architecture/` | princípios e decisões de arquitetura | iniciada |
| `planning/` | escopo, riscos, experimentos e marcos | iniciada |
| `sources/` | como cada fonte do MAL entrega o dado, com as medições que sustentam isso — hoje [`mal-list-delivery.md`](sources/mal-list-delivery.md) | ativa |
| `adr/` | decisões arquiteturais formais quando houver alternativas maduras | reservada |

## Fluxo documental

```text
Pesquisa verificável -> hipótese -> experimento -> decisão -> implementação
```

O projeto ainda está nas três primeiras etapas. Documentação não deve descrever uma solução como implementada quando ela for apenas proposta.
