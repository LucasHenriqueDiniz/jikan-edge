---
tags:
  - research
  - cloudflare
  - free-tier
  - traffic
  - abuse
  - rate-limiting
status: draft
research_date: 2026-07-19
---

# Pesquisa — Modelo de tráfego e abuso no plano Free

## Pergunta de decisão

**Qual público e qual rate limit mantêm o MVP sustentável no Free?**

## Resumo executivo

- **Resposta curta:** o Free comporta preview público e projetos pessoais/pequenos, não uma substituição irrestrita da escala do Jikan. O limite mais imediato é 100.000 requests de Worker por dia.
- **Impacto direto para o projeto:** cache não elimina automaticamente a quota. Cache API e cache de origem atrás do Worker ainda começam com uma invocação; Workers Caching pode evitar execução, mas requests cacheadas continuam sendo contabilizadas como requests do Worker. Objetos públicos em R2 com domínio próprio podem ser servidos sem Worker.
- **Recomendação:** **condicionar** a um beta controlado: payloads estáticos via R2/CDN, busca dinâmica com API key gratuita, rate limit pré-Worker por WAF e limites adicionais dentro do Worker. Sem SLA e sem refresh síncrono.

## Evidências verificadas

| Classificação | Fato, hipótese ou inferência | Fonte e consulta | Confiança |
|---|---|---|---|
| Fato verificado | Workers Free permite 100.000 requests/dia e retorna Error 1027 ao exceder o limite. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consultado em 2026-07-19. | Alta |
| Fato verificado | O modo fail-open pode ignorar o Worker após exceder a quota; fail-closed retorna erro. Para API e controles de segurança, fail-closed é o comportamento seguro. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consultado em 2026-07-19. | Alta |
| Fato verificado | Cache API (`caches.default`) opera dentro do Worker; portanto, a requisição já invocou o Worker. | [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), consultado em 2026-07-19. | Alta |
| Fato verificado | No fluxo tradicional Worker + zone cache, o Worker executa antes de verificar o cache de origem. | [Workers and Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/), consultado em 2026-07-19. | Alta |
| Fato verificado | Workers Caching pode responder antes de executar o código do Worker, porém a documentação de pricing afirma que essas respostas são contabilizadas na mesma métrica de request. | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) e [Workers cache configuration](https://developers.cloudflare.com/workers/cache/configuration/), consultados em 2026-07-19. | Alta |
| Fato verificado | R2 Free inclui 10 GB-mês, 1 milhão Class A e 10 milhões Class B/mês, com egress gratuito. | [R2 pricing](https://developers.cloudflare.com/r2/pricing/), consultado em 2026-07-19. | Alta |
| Fato verificado | Um bucket R2 em domínio customizado pode usar CDN, WAF e cache. JSON não é cacheado automaticamente em todos os casos e precisa de regra apropriada. O domínio `r2.dev` não oferece esses controles. | [R2 cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/) e [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), consultados em 2026-07-19. | Alta |
| Fato verificado | Cache em domínio R2 relaxa consistência: overwrite/delete pode continuar servindo objeto anterior até TTL/purge; 404 também pode ficar cacheado. | [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), consultado em 2026-07-19. | Alta |
| Fato verificado | D1 Free: 5 milhões rows read/dia, 100 mil rows written/dia, 5 GB totais, 500 MB por banco. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) e [limits](https://developers.cloudflare.com/d1/platform/limits/), consultados em 2026-07-19. | Alta |
| Fato verificado | Queues Free inclui 10.000 operações/dia; mensagem normal menor que 64 KB costuma consumir três operações: write, read e delete. Retenção Free é 24 horas. | [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) e [limits](https://developers.cloudflare.com/queues/platform/limits/), consultados em 2026-07-19. | Alta |
| Fato verificado | WAF Free permite uma regra de rate limiting, com match limitado principalmente a path/verified bot, contagem por IP, período de 10 segundos e sem exclusão de cache. | [WAF rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/), consultado em 2026-07-19. | Alta |
| Fato verificado | Rate Limiting binding dentro do Worker é local por colo, permissivo/eventualmente consistente e executado depois que o Worker já iniciou. Não é sistema exato de contabilização. | [Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), consultado em 2026-07-19. | Alta |
| Inferência | CORS aberto facilita uso no navegador, mas não protege contra bots ou clientes server-side. | Semântica do CORS. | Alta |
| Inferência | API key gratuita melhora identificação e quotas, mas não protege requests anônimas antes da invocação se a verificação ocorrer apenas no Worker. | Derivada do lifecycle. | Alta |
| Inferência | IDs sequenciais só são baratos se o objeto existir e for servido diretamente do cache/R2. Misses que enfileiram refresh podem transformar enumeração em ataque de custo. | Derivada da arquitetura. | Alta |

## Implicações arquiteturais

### 1. Separar tráfego estático e dinâmico

#### Domínio de objetos

- documentos por ID;
- payloads imutáveis/versionados;
- R2 custom domain;
- Cache Rule para JSON;
- TTL alto;
- sem Worker no caminho normal.

Benefício: cache hit não consome Worker nem operação R2.

#### Domínio de API dinâmica

- busca;
- filtros;
- paginação;
- aliases;
- compatibilidade;
- metadados;
- usa Worker + D1.

### 2. Cache key deve ser canônica

Para evitar cardinalidade infinita:

- permitir somente parâmetros documentados;
- remover parâmetros vazios/desconhecidos;
- normalizar case quando semanticamente permitido;
- ordenar query parameters;
- limitar tamanho;
- limitar `page`/`limit`;
- não variar por headers irrelevantes;
- não aceitar cache-busting;
- separar versão e formato.

### 3. Público recomendado

Fase Free:

- preview para desenvolvedores;
- projetos pessoais;
- demos;
- pequenos bots/sites;
- nenhuma garantia de SLA;
- nenhuma dependência crítica;
- acesso revogável/reduzível em abuso.

Não recomendado:

- apps com dezenas de milhares de usuários ativos;
- sync massivo;
- crawling;
- treinamento de datasets;
- mirrors;
- uso como backend único de produção de alta escala.

### 4. Modelo de rate limit

#### Camada 1 — WAF antes do Worker

Usar a única regra Free para limitar paths dinâmicos. Como a janela Free é curta e a contagem é por IP, ela é proteção grosseira, não quota de produto.

#### Camada 2 — chave no Worker

- API key gratuita para busca e filtros;
- chave por consumidor/rota;
- rate binding local;
- limites diferentes por custo;
- não usar somente IP, pois NAT/proxies agregam usuários;
- aceitar que não é contabilidade global exata.

#### Camada 3 — orçamento operacional

- limite diário global de refresh;
- nenhuma requisição pública força refresh;
- admissão de jobs por prioridade;
- desativar backfill ao se aproximar das quotas.

### 5. Enumeração de IDs

Medidas:

- não buscar upstream sincronamente;
- não enfileirar automaticamente qualquer ID arbitrário;
- aceitar miss somente para IDs conhecidos no catálogo;
- negative cache para 404;
- TTL de 404;
- limitar frequência de misses por cliente;
- detectar sequências no nível de observabilidade;
- manter endpoint de bulk fora do MVP;
- impedir `refresh=true` público.

### 6. Cache stampede

Requisitos:

- um único refresh por entidade/recurso;
- lock/idempotency fora da Queue;
- resposta stale imediata;
- cooldown após erro;
- fan-out limitado;
- Queue não é fonte de verdade.

## Riscos e limites

### Workers Caching não resolve a quota diária

Mesmo quando evita a execução do código, a documentação de pricing contabiliza requests cacheadas. Portanto:

- 100 mil requests/dia continua sendo teto;
- CDN direto para R2 é necessário para desviar tráfego estático;
- não basear capacidade em “90% cache hit = 90% menos requests Worker”.

### WAF Free é limitado

Uma única regra e janela de 10 segundos não oferecem:

- quota diária por chave;
- custo por endpoint;
- proteção global exata;
- detecção de enumeração;
- exclusão de cache;
- custom counting.

### Rate limit dentro do Worker chega tarde

Ele reduz D1/R2/upstream, mas não evita consumir a invocação que está protegendo. Em ataque volumétrico, a quota de 100 mil ainda pode acabar.

### R2 público

Tornar bucket público exige:

- objetos sem segredo;
- chaves não enumerarem dados privados;
- cache de 404 cuidadosamente configurado;
- purge/objetos versionados;
- WAF contra abuso;
- CORS consciente.

### D1 rows read

O limite pode acabar antes das requests. Exemplo de modelagem:

- 50 mil requests dinâmicas/dia;
- 100 rows read por request;
- 5 milhões rows read/dia.

Assim, o orçamento p95 de rows por query é crítico.

### Queues

10 mil operações/dia corresponde aproximadamente a 3.333 entregas normais sem retries. Retries e dead-letter consomem mais. Isso limita refresh sob demanda.

## Cenários de tráfego

Os cenários são modelos, não previsões.

| Cenário | Requests dinâmicas/dia | Rows read médias | D1 rows/dia | Refreshes/dia | Interpretação |
|---|---:|---:|---:|---:|---|
| Baixo | 5.000 | 50 | 250.000 | 200 | Confortável |
| Moderado | 30.000 | 100 | 3.000.000 | 1.000 | Viável com margem |
| Limite | 50.000 | 100 | 5.000.000 | 2.000 | D1 sem margem |
| Worker saturado | 100.000 | 20 | 2.000.000 | 0 | Quota Worker encerrada |
| Abuso de miss | 20.000 | 20 | 400.000 | até 20.000 tentativas | Queue/ingestão inviável sem admissão |
| Estático direto | 500.000 no CDN | 0 | 0 | 0 | Viável se servido do cache R2 sem Worker; origem depende do hit ratio |

## Questões ainda abertas

- Workers Caching está disponível e estável para o desenho final da conta?
- Qual o cache hit ratio real dos objetos R2?
- Quanto tráfego vem de detalhe versus busca?
- Qual rows read p95 por rota?
- Quantos refreshes são realmente necessários por dia?
- API key será obrigatória para busca?
- Como emitir chaves sem criar serviço administrativo pesado?
- Qual rate limit mantém boa UX?
- WAF Free consegue cobrir todos os paths dinâmicos com uma expressão?
- Qual política de CORS?
- Qual TTL de 404 evita esconder novos objetos?
- Como divulgar degradação e quota?
- Há necessidade de plano pago mínimo antes do beta aberto?

## Recomendação e critério de go/no-go

### Recomendação

**Beta controlado no Free.**

Público:

- desenvolvedores e projetos pequenos;
- detalhe estático público;
- busca dinâmica com chave gratuita;
- sem bulk;
- sem force refresh;
- sem SLA.

Rate limit inicial proposto, sujeito a teste:

- detalhe em R2/CDN: limitado por WAF contra bursts, sem quota de aplicação;
- busca anônima: não oferecida ou limite muito baixo;
- busca com key: 30 requests/min por chave/colo;
- endpoints caros: 10 requests/min;
- máximo de 25 itens por página;
- máximo de 100 páginas;
- refresh: totalmente interno.

### Política de degradação

| Consumo diário | Ação |
|---:|---|
| 0–60% | operação normal |
| 60–75% | pausar backfill |
| 75–85% | aumentar TTL e reduzir refresh preventivo |
| 85–95% | stale-only; limitar busca cara |
| 95–100% | desativar rotas dinâmicas não essenciais |
| quota excedida | fail-closed, status público e objetos estáticos ainda disponíveis |

Aplicar política separada para Worker, D1 reads, D1 writes, Queue e R2.

### Critérios de go

- tráfego projetado p95 abaixo de 60 mil requests Worker/dia;
- D1 projetado abaixo de 3,5 milhões rows read/dia;
- writes abaixo de 70 mil/dia;
- Queue abaixo de 7 mil operações/dia;
- R2 abaixo de 70% da franquia mensal;
- ≥90% dos detalhes populares servidos diretamente por R2/CDN;
- cache key cardinality controlada;
- WAF bloqueia bursts antes do Worker;
- busca exige chave ou limite equivalente;
- miss não cria job automaticamente;
- stampede testado;
- degradação testada e documentada;
- fail-closed configurado;
- alertas em 60/75/85/95%.

### Critérios de no-go

- expectativa pública acima de 100 mil requests Worker/dia;
- necessidade de anonimato irrestrito em busca;
- requisito de bulk/crawling;
- rows read por request tornam cenário moderado maior que 5 milhões/dia;
- WAF/rate limit não contém abuso;
- objeto estático precisa passar pelo Worker;
- refresh por demanda excede Queue;
- produto promete SLA incompatível com fail-closed/quota diária.

## Fontes

- [Cloudflare Workers — limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Cloudflare — Workers and Cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/)
- [Cloudflare Workers Caching](https://developers.cloudflare.com/workers/cache/configuration/)
- [Cloudflare R2 — pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 — cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)
- [Cloudflare R2 — public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 — consistency](https://developers.cloudflare.com/r2/reference/consistency/)
- [Cloudflare D1 — pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 — limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Queues — pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Queues — limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Cloudflare WAF — rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Workers — Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
