---
tags:
  - research
  - jikan
  - compatibility
  - api-design
  - migration
status: draft
research_date: 2026-07-19
---

# Pesquisa — Compatibilidade com Jikan e escopo de mercado

## Pergunta de decisão

**O MVP deve ser API nativa ou oferecer compatibilidade seletiva desde o início?**

## Resumo executivo

- **Resposta curta:** o modelo interno deve ser nativo desde o início. Uma superfície `/v4` seletiva pode ser lançada junto ao beta público, mas somente para rotas de alto valor e com contrato de compatibilidade explícito.
- **Impacto direto para o projeto:** compatibilidade seletiva aumenta utilidade para migração sem obrigar o projeto a reproduzir toda a complexidade, os bugs e os endpoints comunitários do Jikan.
- **Recomendação:** **avançar condicionado** com `/v1` como fonte de verdade e um adaptador `/v4` pequeno. Não prometer “drop-in replacement” antes de medir consumidores reais e executar testes de contrato.

## Evidências verificadas

| Classificação | Fato, hipótese ou inferência | Fonte e consulta | Confiança |
|---|---|---|---|
| Fato verificado | A documentação do Jikan v4 expõe uma API ampla, somente GET, organizada em anime, manga, personagens, pessoas, temporadas, rankings, gêneros, reviews, recomendações, usuários, schedules e outros recursos. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consultado em 2026-07-19. | Alta |
| Fato verificado | O Jikan documenta convenções específicas de payload: valores escalares ausentes como `null`, arrays/objetos ausentes vazios, score desconhecido como `0`, datas ISO 8601 UTC e erros JSON. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consultado em 2026-07-19. | Alta |
| Fato verificado | O Jikan documenta paginação, filtros, cache de 24 horas, ETag e validação condicional. Compatibilidade envolve mais que nomes de rotas. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consultado em 2026-07-19. | Alta |
| Fato verificado | O site do Jikan informa mais de 100 milhões de requests mensais. O número é auto-relatado e não contém divisão por endpoint. | [Jikan](https://jikan.moe/), consultado em 2026-07-19. | Média-alta |
| Fato verificado | O projeto oficial lista wrappers em JavaScript, TypeScript, Python, Java, .NET, Go, Dart e outras linguagens. Isso evidencia ecossistema relevante, mas não revela rotas mais usadas. | [Jikan REST README](https://github.com/jikan-me/jikan-rest), consultado em 2026-07-19. | Alta |
| Evidência observacional | Pesquisa de código público no GitHub encontrou ampla presença de URLs de pesquisa/detalhe de anime, `top/anime` e `seasons/now`. A amostra não é completa, sofre viés do índice e não deve ser interpretada como market share. | GitHub Code Search, consultas realizadas em 2026-07-19. | Média |
| Fato verificado | Não foi encontrada telemetria pública oficial por endpoint do Jikan. | Pesquisa realizada em 2026-07-19. | Alta quanto à ausência encontrada |
| Inferência | Pesquisa/detalhe de anime, top e temporada atual são candidatas prioritárias porque aparecem nos exemplos oficiais e em muitas integrações públicas. | Derivada da documentação e amostra de código. | Média-alta |
| Inferência | Compatibilidade de rota sem query/payload/error compatibility não permite migração sem alterações. | Princípio de contratos de API. | Alta |
| Hipótese a validar | Consumidores de manga, personagens e pessoas são numerosos o suficiente para entrarem no primeiro adapter `/v4`. | Precisa de amostra estruturada e entrevistas/issues. | Média |
| Inferência | Reproduzir todos os endpoints de usuários, reviews, notícias e fóruns elevaria custo e dependência da origem sem benefício comprovado para o MVP. | Derivada do escopo e dos riscos de fonte. | Alta |

## Implicações arquiteturais

### 1. Quatro níveis distintos de compatibilidade

#### Compatibilidade conceitual

A API oferece os mesmos conceitos gerais:

- anime;
- manga;
- título;
- score;
- temporada;
- gênero.

Não garante migração.

#### Compatibilidade por rota

Mesmos paths e métodos:

- `/v4/anime`;
- `/v4/anime/{id}`;
- `/v4/top/anime`.

Ainda não garante parâmetros ou payload.

#### Compatibilidade por payload

Mantém:

- envelope `data`;
- `pagination`;
- nomes e tipos;
- nulls e arrays;
- datas;
- erros;
- referências aninhadas.

#### Compatibilidade comportamental

Mantém:

- filtros;
- defaults;
- ordenação;
- limites de página;
- 404/400/429;
- cache headers;
- ETag;
- edge cases.

Somente este nível se aproxima de “drop-in”.

### 2. Modelo interno nativo

O contrato interno não deve incorporar peculiaridades do Jikan:

- nomes inconsistentes;
- score desconhecido como zero;
- campos derivados da estrutura atual;
- bugs históricos;
- limites de paginação.

O adaptador `/v4` converte do modelo nativo. Isso permite:

- evoluir `/v1`;
- manter compatibilidade seletiva;
- documentar campos sem fonte;
- retirar rotas incompatíveis sem corromper o núcleo.

### 3. Escopo seletivo sugerido

A priorização abaixo é uma **proposta a validar**, não telemetria oficial.

#### Tier A — migração básica

- pesquisa de anime;
- detalhe de anime;
- pesquisa de manga;
- detalhe de manga;
- top anime;
- top manga;
- temporada atual.

#### Tier B — páginas comuns de catálogo

- detalhe completo de anime/manga;
- temporada futura;
- temporada por ano/estação;
- gêneros;
- personagens de anime;
- detalhe de personagem;
- detalhe de pessoa.

#### Tier C — somente após demanda e fonte

- episódios;
- estatísticas;
- recomendações;
- imagens alternativas;
- streaming;
- schedules;
- producers/magazines.

#### Fora do MVP

- usuários;
- listas;
- histórico;
- amigos;
- reviews;
- notícias;
- fóruns;
- clubes;
- user updates.

### 4. A compatibilidade precisa ser declarada em matriz

Para cada rota:

- path;
- parâmetros aceitos;
- parâmetros ignorados;
- campos completos;
- campos parciais;
- campos sempre nulos;
- semântica de paginação;
- cache;
- erros;
- status: experimental, partial ou compatible.

Não usar um selo genérico “Jikan compatible”.

### 5. Versionamento recomendado

- `/v1`: API nativa, contrato controlado pelo projeto;
- `/v4`: adapter de compatibilidade seletiva com Jikan v4;
- header ou endpoint de metadados: matriz/versão do adapter;
- mudanças incompatíveis no adapter exigem versão ou período de depreciação;
- o modelo nativo pode evoluir com campos adicionais sem afetar `/v4`.

## Riscos e limites

### Ausência de telemetria por endpoint

A priorização é baseada em:

- documentação;
- exemplos;
- wrappers;
- busca pública de código.

Essas fontes super-representam tutoriais e projetos abertos e sub-representam aplicações privadas. Uma pesquisa de consumidores é necessária.

### Drop-in replacement como promessa perigosa

Diferenças pequenas quebram clientes:

- `null` versus `[]`;
- número versus string;
- paginação;
- score zero;
- filtros compostos;
- ordem de resultados;
- 404;
- nomes de campos;
- URLs de imagem;
- datas incompletas.

O projeto deve usar “compatibilidade seletiva” até passar testes reais.

### Custo de `/full`

Um endpoint agregado pode:

- fazer várias leituras;
- gerar payload grande;
- aumentar CPU;
- depender de recursos não atualizados juntos.

Pode ser necessário armazenar visão pronta ou aceitar consistência eventual. Isso deve ser medido, não presumido.

### Paridade de busca

Mesmo com mesma rota, resultados podem diferir por:

- índice próprio;
- aliases;
- relevância;
- catálogo parcial;
- filtros;
- refresh.

O adapter deve documentar que compatibilidade de forma não significa identidade de ranking.

### Risco de acoplamento à descontinuação

Construir somente para capturar migração imediata pode congelar uma API com decisões herdadas. O produto precisa preservar proposta própria e sustentabilidade.

## Questões ainda abertas

- Quais endpoints representam 80% do tráfego real do Jikan?
- Quais bibliotecas/wrappers têm maior base instalada?
- Quantos consumidores usam URLs diretamente versus wrappers?
- Quais campos de `/full` são realmente exigidos?
- Há consumidores que dependem de ETag e cache headers?
- Quais filtros de `/anime` e `/manga` são mais usados?
- Personagens e pessoas são MVP ou fase seguinte?
- Qual tolerância dos usuários para dados stale/parciais?
- O adapter `/v4` será gratuito e anônimo?
- A API nativa oferecerá vantagens claras?
- Como comunicar rotas incompatíveis?
- Qual nome evita confusão com serviço oficial do Jikan?

## Recomendação e critério de go/no-go

### Recomendação

**API nativa como núcleo; compatibilidade seletiva no beta público.**

Não implementar full parity. O adapter inicial deve ser limitado a rotas que:

- têm demanda observada;
- podem ser cobertas por fonte aprovada;
- cabem no Free;
- têm testes de contrato;
- não exigem conteúdo comunitário.

### Pesquisa adicional de mercado

Antes de congelar o escopo:

1. selecionar 30–50 repositórios ativos que usam Jikan;
2. incluir diferentes linguagens e wrappers;
3. registrar rotas, parâmetros e campos acessados;
4. excluir tutoriais duplicados;
5. verificar atividade recente;
6. abrir survey/issue público para migração;
7. construir matriz de frequência qualitativa;
8. não publicar contagens como market share.

### Teste de contrato

Para cada rota candidata:

- coletar fixtures públicas do Jikan enquanto disponível;
- comparar status, headers relevantes, schema e tipos;
- testar query defaults e invalid inputs;
- executar SDKs/wrappers populares contra um mock do contrato;
- medir percentual de requests que não precisam de alteração.

### Critérios de go

- pelo menos 20 consumidores ativos analisados;
- Tier A representa a maioria clara dos fluxos observados;
- fonte autorizada cobre ao menos 95% dos campos obrigatórios do Tier A;
- 100% dos nomes e tipos obrigatórios do schema selecionado são reproduzidos;
- pelo menos 95% das requests da amostra Tier A funcionam sem alteração;
- erros e paginação têm contrato testado;
- custo estimado por rota permanece dentro do modelo Free;
- documentação explicita incompatibilidades;
- `/v1` continua independente.

### Critérios de no-go

- consumidores dependem majoritariamente de rotas fora do escopo;
- fonte não cobre campos essenciais;
- payload agregado excede CPU/armazenamento;
- compatibilidade exige reproduzir conteúdo não autorizado;
- adapter aumenta writes/leitura além do orçamento;
- equipe não consegue manter testes de contrato;
- marketing exige “drop-in” sem evidência.

## Fontes

- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [Jikan REST API](https://github.com/jikan-me/jikan-rest)
- [Jikan parser](https://github.com/jikan-me/jikan)
- [Jikan website](https://jikan.moe/)
- [Jikan GitHub organization](https://github.com/jikan-me)
- [JikanPy](https://github.com/abhinavk99/jikanpy)
