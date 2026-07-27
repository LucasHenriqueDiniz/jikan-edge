---
tags:
  - research
  - index
  - jikan-edge
status: draft
research_date: 2026-07-19
---

# Pesquisa — Índice técnico do jikan-edge

## Pergunta de decisão

**Quais decisões precisam estar resolvidas, e em qual ordem, antes de qualquer implementação?**

## Resumo executivo

- **Resposta curta:** o projeto ainda possui dois bloqueadores absolutos: autorização sustentável da fonte e viabilidade real de acesso/parsing por Workers.
- **Impacto direto para o projeto:** armazenamento e busca possuem caminhos plausíveis, mas não justificam código antes de resolver origem, termos e probe.
- **Recomendação:** **bloquear implementação** até concluir pesquisas 1 e 2. Depois, executar benchmarks de bootstrap, busca, compatibilidade e tráfego na ordem abaixo.

## Evidências verificadas

Este índice referencia os seis documentos produzidos em 19 de julho de 2026. Cada documento separa fatos, inferências e hipóteses e registra fontes primárias ou limitações quando elas estavam indisponíveis.

## Documentos

| Ordem | Documento | Pergunta decisória | Status | Depende de |
|---:|---|---|---|---|
| 1 | [Fontes de dados e termos do MyAnimeList](2026-07-19-myanimelist-data-source-and-terms.md) | Qual fonte pode ser usada de forma sustentável e sob quais condições? | Draft — bloqueador | Nenhuma |
| 2 | [Viabilidade Cloudflare → MyAnimeList](2026-07-19-cloudflare-to-myanimelist-feasibility.md) | Quais resultados do probe tornam a ingestão por Worker viável? | Draft — bloqueador | Pesquisa 1 |
| 3 | [Estratégia de bootstrap do catálogo](2026-07-19-catalog-bootstrap-strategy.md) | Como iniciar cobertura útil sem ultrapassar limites ou criar dependência inviável? | Draft — condicional | Pesquisas 1 e 2 |
| 4 | [Busca multilíngue com D1/FTS5](2026-07-19-d1-search-multilingual.md) | D1/FTS5 é suficiente para o MVP de busca e filtros? | Draft — benchmark necessário | Pesquisa 3 |
| 5 | [Compatibilidade com Jikan e escopo de mercado](2026-07-19-jikan-compatibility-market-scope.md) | O MVP deve ser API nativa ou oferecer compatibilidade seletiva desde o início? | Draft — pesquisa de consumidores necessária | Pesquisas 1, 3 e 4 |
| 6 | [Modelo de tráfego e abuso no Free](2026-07-19-free-tier-traffic-and-abuse-model.md) | Qual público e qual rate limit mantêm o MVP sustentável no Free? | Draft — modelagem/benchmark necessários | Pesquisas 2, 3, 4 e 5 |

## Ordem recomendada de leitura

1. **Fontes e termos:** determina se existe produto sustentável.
2. **Viabilidade Cloudflare → MAL:** determina se a ingestão permitida funciona tecnicamente.
3. **Bootstrap:** determina cobertura inicial sem crawling.
4. **D1/FTS5:** determina se busca cabe no Free.
5. **Compatibilidade Jikan:** define produto e contrato após conhecer cobertura.
6. **Tráfego e abuso:** dimensiona a superfície final e os limites públicos.

## Dependências entre pesquisas

```text
Fontes e termos
       │
       ├──> Viabilidade de ingestão
       │          │
       │          └──> Bootstrap
       │                    │
       │                    └──> Busca D1
       │                              │
       └──────────────────────────────┴──> Compatibilidade
                                              │
                                              └──> Tráfego e abuso
```

A compatibilidade depende da cobertura real. O modelo de tráfego depende das rotas, consultas, cache e frequência de atualização escolhidos.

## Implicações arquiteturais

Conclusões provisórias consolidadas:

- API oficial ou fonte licenciada deve ter prioridade;
- HTML e endpoints internos não estão aprovados por acessibilidade pública;
- R2 é candidato para documentos canônicos e entrega estática;
- D1 é candidato para índices/filtros, condicionado a benchmark multilíngue;
- Queue Free limita refresh a aproximadamente 3.333 entregas normais/dia antes de retries;
- Workers Free limita a 100 mil requests/dia;
- cache dentro/à frente do Worker não deve ser confundido com tráfego fora do Worker;
- objetos R2 em domínio customizado podem retirar detalhes estáticos do orçamento do Worker;
- modelo interno deve ser nativo;
- compatibilidade `/v4` deve ser seletiva e testada;
- nenhuma request pública deve disparar scraping síncrono;
- cobertura de manga provavelmente começará parcial.

## Riscos e limites

### Bloqueadores antes de qualquer código

1. **Termos oficiais do MyAnimeList indisponíveis nesta pesquisa.**
   - Obter e revisar o texto vigente.
   - Confirmar automação, cache, retenção, redistribuição e imagens.
   - Solicitar autorização escrita se houver ambiguidade.

2. **Ausência de evidência sobre Workers → MAL.**
   - Não afirmar que permite ou bloqueia.
   - Probe somente após autorização.
   - Medir conteúdo semântico, 403/429/challenge e CPU.

3. **Quota oficial da API do MAL não confirmada.**
   - Obter documentação atual.
   - Não projetar bootstrap com quota desconhecida.

4. **Direitos de imagens e textos.**
   - Separar dados factuais, sinopses, reviews e imagens.
   - Não copiar imagens no MVP sem licença.

5. **Licença do bootstrap.**
   - Decidir se ODbL é compatível com o projeto.
   - Avaliar share-alike, atribuição e acesso à base derivada.

6. **Cobertura de manga.**
   - Nenhum dataset aberto equivalente foi identificado.
   - Não prometer paridade.

7. **Busca japonesa.**
   - D1/FTS5 é candidato, não conclusão.
   - Benchmark obrigatório.

8. **Mercado/rotas.**
   - Não há telemetria pública por endpoint.
   - Analisar consumidores ativos antes de congelar adapter `/v4`.

9. **Capacidade Free.**
   - 100 mil requests Worker/dia é limite duro.
   - Cache hit via Workers Caching continua contabilizado como request.
   - Rate limiting dentro do Worker não protege essa quota.

10. **Degradação e abuso.**
    - Sem política testada, uma enumeração de IDs ou queries únicas pode encerrar a quota diária.

## Questões ainda abertas

- O MyAnimeList autoriza o produto proposto?
- A API oficial permite retenção e redistribuição?
- O MAL responde de modo estável a Workers?
- O parser principal cabe em 10 ms?
- O bootstrap licenciado cobre o conjunto quente?
- O índice de anime cabe em 500 MB?
- Trigram está disponível no D1?
- Qual qualidade de busca japonesa?
- Quais rotas representam demanda real?
- Quantos requests e rows read um consumidor típico gera?
- Qual limite público evita esgotamento?
- Quando migrar do Free para Paid?

## Recomendação e critério de go/no-go

### Estado geral

**No-go para implementação neste momento.**

### Para liberar um spike técnico

- revisão de termos concluída;
- fonte aprovada;
- Client ID próprio, se aplicável;
- probe autorizado;
- critérios de interrupção definidos.

### Para liberar o MVP

- probe aprovado;
- parser dentro de CPU;
- bootstrap licenciado;
- busca aprovada por benchmark;
- adapter/rotas definidos por pesquisa de consumidores;
- tráfego abaixo de 70% das quotas;
- degradação e rate limits definidos;
- documentação pública de cobertura e proveniência.

## Fontes

As fontes completas estão listadas em cada documento. Fontes centrais:

- [MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2)
- [MyAnimeList Terms of Use](https://myanimelist.net/about/terms_of_use)
- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [Jikan REST](https://github.com/jikan-me/jikan-rest)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [anime-offline-database](https://github.com/manami-project/anime-offline-database)
