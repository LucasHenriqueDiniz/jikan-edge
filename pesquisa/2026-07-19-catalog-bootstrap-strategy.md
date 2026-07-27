---
tags:
  - research
  - bootstrap
  - catalog
  - datasets
  - provenance
status: draft
research_date: 2026-07-19
---

# Pesquisa — Estratégia de bootstrap do catálogo

## Pergunta de decisão

**Como iniciar cobertura útil sem ultrapassar limites ou criar dependência operacional inviável?**

## Resumo executivo

- **Resposta curta:** iniciar com um seed licenciado de identidades e aliases para anime, complementar temporada atual/rankings por fonte autorizada e expandir sob demanda. Não tentar clonar todo o MAL antes do lançamento.
- **Impacto direto para o projeto:** o MVP pode oferecer cobertura útil de anime com dezenas de milhares de IDs sem crawling inicial, mas manga, personagens e pessoas provavelmente começarão com cobertura parcial.
- **Recomendação:** **avançar condicionado**. Usar dataset aberto somente após aceitar suas obrigações de licença; manter bootstrap e atualização separados; não usar AniList para hoarding; não tratar snapshot do Jikan como automaticamente redistribuível.

## Evidências verificadas

| Classificação | Fato, hipótese ou inferência | Fonte e consulta | Confiança |
|---|---|---|---|
| Fato verificado | O `anime-offline-database` agrega metadados e referências cruzadas de múltiplos provedores. Em seu README de julho de 2026, informa 41.537 entradas e 30.570 referências ao MyAnimeList. | [anime-offline-database](https://github.com/manami-project/anime-offline-database), consultado em 2026-07-19. | Alta |
| Fato verificado | O dataset oferece arquivos JSON/JSONL comprimidos e releases periódicas; o repositório GitHub estava marcado como arquivado, embora o README indicasse atualização recente. | [Repositório](https://github.com/manami-project/anime-offline-database) e [releases](https://github.com/manami-project/anime-offline-database/releases), consultados em 2026-07-19. | Alta |
| Fato verificado | A licença é ODbL 1.0 para a base e DbCL 1.0 para conteúdos, com obrigações de atribuição e share-alike em usos públicos de base derivada. Direitos de conteúdos individuais podem permanecer separados. | [LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE), consultado em 2026-07-19. | Alta |
| Fato verificado | O dataset Manami é de anime; não resolve sozinho manga, personagens, pessoas, reviews ou episódios. | [README e esquema](https://github.com/manami-project/anime-offline-database), consultado em 2026-07-19. | Alta |
| Fato verificado | Wikidata disponibiliza dados estruturados sob CC0, possui propriedade de ID de anime do MyAnimeList e recomenda dumps para extrações amplas. | [Wikidata Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright), [Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en) e [P4086](https://www.wikidata.org/wiki/Property:P4086), consultados em 2026-07-19. | Alta |
| Fato verificado | AniList proíbe usar sua API como backup/armazenamento e proíbe hoarding/mass collection sem autorização. | [AniList API Terms](https://docs.anilist.co/guide/terms-of-use), consultado em 2026-07-19. | Alta |
| Fato verificado | R2 Free inclui 10 GB-mês, 1 milhão de operações Class A e 10 milhões Class B por mês. | [R2 pricing](https://developers.cloudflare.com/r2/pricing/), consultado em 2026-07-19. | Alta |
| Fato verificado | D1 Free inclui 100.000 rows written por dia, 5 milhões de rows read por dia e 5 GB totais; cada banco Free é limitado a 500 MB. Índices também contribuem para writes e armazenamento. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) e [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), consultados em 2026-07-19. | Alta |
| Fato verificado | Queries/importações executadas por ferramentas da Cloudflare também entram nas métricas de uso; D1 retorna `rows_read` e `rows_written` para medição. | [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) e [D1 return objects](https://developers.cloudflare.com/d1/worker-api/return-object/), consultados em 2026-07-19. | Alta |
| Inferência | Um seed com aproximadamente 41 mil objetos de anime cabe numericamente na franquia mensal de 1 milhão de writes do R2, desde que cada entidade resulte em poucos objetos e não inclua imagens. | Inferência a partir das franquias; tamanho real precisa ser medido. | Alta |
| Inferência | O limite de D1 provavelmente será atingido por aliases, FTS e relações antes do número simples de entidades, porque uma entidade pode gerar muitas rows written, incluindo índices. | Derivada do modelo de cobrança do D1. | Alta |
| Hipótese a validar | O Manami fornece cobertura suficiente para pelo menos 90% da temporada atual e dos top 100 do MAL. | Precisa ser medido no release escolhido. | Baixa |
| Fato não encontrado | Não foi identificada uma fonte aberta, atual e abrangente, com licença clara, equivalente para manga, personagens e pessoas. | Pesquisa em 2026-07-19. | Média |

## Implicações arquiteturais

### 1. Bootstrap não deve ser sinônimo de conteúdo completo

O seed inicial precisa fornecer principalmente:

- ID MAL;
- título principal;
- aliases;
- tipo;
- status;
- temporada/ano;
- referências cruzadas;
- URL da imagem, somente como referência;
- proveniência;
- licença.

Campos dinâmicos e autorais devem ser atualizados separadamente:

- score;
- rank;
- membros;
- sinopse;
- background;
- relações detalhadas;
- personagens;
- staff;
- streaming.

### 2. Estratégia recomendada em camadas

#### Camada A — identidade de anime

Usar uma fonte aberta compatível para:

- criar o universo inicial de IDs;
- popular busca por título/alias;
- evitar varredura sequencial de IDs;
- marcar cada registro como `seed`, não como dado confirmado pelo upstream atual.

#### Camada B — conjunto quente

Atualizar por fonte autorizada:

- temporada atual;
- próxima temporada;
- top 100/500;
- títulos acessados;
- obras relacionadas ao conjunto quente.

#### Camada C — demanda

Quando um ID conhecido for solicitado:

- servir seed se suficiente;
- agendar enriquecimento;
- promover para documento verificado;
- não criar scraping síncrono.

#### Camada D — backfill controlado

Somente após observar folga de quotas:

- itens antigos populares;
- títulos com cobertura incompleta;
- relações de alta demanda;
- manga e personagens prioritários.

### 3. Cobertura precisa ser mensurável

Cada entidade deve ter estado conceitual:

- `seeded`;
- `verified`;
- `stale`;
- `partial`;
- `missing`;
- `source-restricted`;
- `removed`.

A API deve ser capaz de expor:

- data da última verificação;
- cobertura;
- fonte;
- campos indisponíveis;
- confiança.

### 4. Proveniência de campo

Misturar fontes sem rastreabilidade cria inconsistências e obrigações incompatíveis. Campos relevantes precisam registrar:

- origem;
- licença;
- data;
- regra de precedência;
- transformação aplicada;
- possibilidade de remoção.

### 5. Importação deve ser offline e reproduzível

O processo de bootstrap não deve consumir o Worker HTTP nem depender de Queues. O projeto deve produzir, como artefato de pesquisa/operação:

- hash do dataset;
- versão/release;
- licença;
- contagens;
- relatório de validação;
- tamanho antes/depois;
- rows written estimadas e reais;
- objetos R2;
- inconsistências;
- cobertura por categoria.

Isso descreve o processo; não implica implementação nesta fase.

## Riscos e limites

### Obrigações da ODbL

Caso o projeto reutilize parte substancial do Manami para uma base pública derivada, poderá precisar:

- atribuir o dataset;
- manter a licença;
- disponibilizar a base derivada ou diferenças;
- impedir termos adicionais que restrinjam os direitos concedidos;
- separar conteúdos individuais com direitos diferentes.

A decisão de usar o Manami deve vir acompanhada de decisão de licença do banco do `jikan-edge`.

### Repositório arquivado

Um dataset arquivado pode continuar publicando releases, mas:

- manutenção futura não é garantida;
- schema pode congelar;
- fontes podem ficar desatualizadas;
- o projeto não deve depender dele para atualização diária.

Ele é adequado como seed versionado, não como upstream operacional único.

### Imagens

URLs de imagens podem estar no dataset, mas:

- a licença da base não garante direito sobre a imagem;
- copiar imagens para R2 não está aprovado;
- hotlink precisa de análise própria;
- URLs podem expirar ou mudar.

### Cobertura assimétrica

Anime pode começar com boa cobertura; manga, personagens e pessoas podem começar vazios ou esparsos. Isso precisa aparecer na documentação pública, sem alegar paridade geral.

### Amplificação de writes no D1

Um anime com muitos aliases pode gerar:

- uma linha principal;
- dezenas de aliases;
- tokens de busca;
- relações;
- gêneros;
- índices.

Batch reduz round trips, mas não necessariamente rows written cobradas. O orçamento precisa ser calculado com dados reais.

### Importação de FTS

Cloudflare documenta suporte a FTS5, mas exportação de bancos com virtual tables tem limitações. O plano de recuperação deve manter o dataset fonte e permitir reconstruir o índice, em vez de depender apenas de export do D1.

## Questões ainda abertas

- Qual release do Manami será o baseline?
- O repositório continuará produzindo releases após julho de 2026?
- A licença ODbL é compatível com a licença planejada?
- Quanto do dataset é derivado de MAL e quanto é agregado?
- Qual a cobertura da temporada atual, top 100, top 500 e próximos lançamentos?
- Quantos aliases existem em média e no p99?
- Qual o tamanho comprimido/descomprimido?
- Quantas rows written são geradas por entidade no índice escolhido?
- O banco de anime com FTS fica abaixo de 500 MB?
- Qual fonte autorizada cobrirá manga?
- Como tratar IDs removidos/reaprovados?
- Como resolver divergências entre seed e fonte atual?
- O bootstrap deve incluir sinopses ou somente fatos estruturados?
- Qual política de atualização para registros nunca acessados?

## Recomendação e critério de go/no-go

### Recomendação

**Avançar condicionado** com uma estratégia de cobertura útil, não total:

1. seed licenciado para anime;
2. verificação da temporada atual e tops;
3. expansão por demanda;
4. backfill somente com orçamento sobrando;
5. manga declarado como cobertura parcial até existir fonte sustentável.

### Experimento de avaliação do seed

Sem implementar produto, preparar uma análise sobre um release congelado:

- validar schema e licença;
- medir total de entradas;
- extrair IDs MAL;
- comparar com temporada atual e top 500 por fonte autorizada;
- medir aliases, relações e tamanho;
- projetar objetos R2;
- projetar e depois medir rows written em um ambiente de teste;
- registrar campos que possuem direitos separados.

### Critérios de go

- licença e obrigações aprovadas;
- dataset reproduzível por release/hash;
- pelo menos 90% de cobertura da temporada atual de anime;
- pelo menos 95% de cobertura do top 100 de anime;
- nenhuma imagem copiada sem licença;
- importação projetada abaixo de 70% da franquia mensal de R2 Class A;
- D1 carregado em etapas abaixo de 70% da franquia diária de writes;
- cada banco projetado abaixo de 400 MB, deixando margem;
- índice reconstruível a partir do seed;
- proveniência e status de cobertura disponíveis;
- atualização quente independente do seed.

### Critérios de no-go

- obrigações ODbL incompatíveis com a estratégia do projeto;
- dataset sem releases verificáveis;
- direitos dos conteúdos misturados sem possibilidade de separação;
- necessidade de crawling indiscriminado para tornar o seed útil;
- importação excede sistematicamente limites e não pode ser particionada;
- cobertura de temporada/top insuficiente;
- ausência de caminho sustentável para correções e remoções.

## Fontes

- [anime-offline-database](https://github.com/manami-project/anime-offline-database)
- [anime-offline-database — releases](https://github.com/manami-project/anime-offline-database/releases)
- [anime-offline-database — LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE)
- [Wikidata — Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright)
- [Wikidata — Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en)
- [Wikidata — MyAnimeList anime ID](https://www.wikidata.org/wiki/Property:P4086)
- [AniList API Terms of Use](https://docs.anilist.co/guide/terms-of-use)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
