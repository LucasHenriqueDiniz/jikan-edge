---
tags:
  - research
  - cloudflare-d1
  - sqlite
  - fts5
  - search
  - multilingual
status: draft
research_date: 2026-07-19
---

# Pesquisa — Busca multilíngue com D1 e FTS5

## Pergunta de decisão

**D1/FTS5 é suficiente para o MVP de busca e filtros?**

## Resumo executivo

- **Resposta curta:** D1/FTS5 é uma base plausível para o MVP, especialmente para inglês, romaji, aliases e filtros estruturados. A suficiência para japonês e substring não está provada.
- **Impacto direto para o projeto:** o MVP pode evitar um serviço de busca pago, mas precisa usar aliases normalizados e benchmark real; `unicode61` isolado provavelmente é insuficiente para consultas japonesas parciais.
- **Recomendação:** **condicionar**. Avançar com D1 como candidato principal, comparando `unicode61`, trigram, prefixos normalizados e tabela de aliases. Aprovar somente se qualidade, latência, rows read, writes e tamanho passarem os limites definidos.

## Evidências verificadas

| Classificação | Fato, hipótese ou inferência | Fonte e consulta | Confiança |
|---|---|---|---|
| Fato verificado | D1 suporta SQLite FTS5 e `fts5vocab`. | [D1 supported SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/), consultado em 2026-07-19. | Alta |
| Fato verificado | O tokenizer padrão do FTS5 é `unicode61`; ele considera sequências contíguas de letras/números como tokens, é case-insensitive e remove diacríticos latinos por padrão. | [SQLite FTS5](https://www.sqlite.org/fts5.html), consultado em 2026-07-19. | Alta |
| Fato verificado | FTS5 oferece consultas de prefixo; índices de prefixo podem acelerar essas consultas ao custo de mais entradas e armazenamento. | [SQLite FTS5 — prefix queries/indexes](https://www.sqlite.org/fts5.html), consultado em 2026-07-19. | Alta |
| Fato verificado | O tokenizer `trigram` transforma sequências contíguas de três caracteres em tokens e permite busca de substring. Consultas FTS com menos de três caracteres não produzem matches. | [SQLite FTS5 — trigram tokenizer](https://www.sqlite.org/fts5.html), consultado em 2026-07-19. | Alta para SQLite |
| Fato verificado | O trigram pode acelerar `LIKE` e `GLOB` em certas configurações; padrões sem sequência não-curinga de ao menos três caracteres caem para scan linear. | [SQLite FTS5 — trigram tokenizer](https://www.sqlite.org/fts5.html), consultado em 2026-07-19. | Alta para SQLite |
| Fato verificado | D1 Free oferece 5 milhões de rows read/dia, 100 mil rows written/dia, 5 GB totais e 500 MB por banco. | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) e [limits](https://developers.cloudflare.com/d1/platform/limits/), consultados em 2026-07-19. | Alta |
| Fato verificado | D1 limita padrões `LIKE`/`GLOB` a 50 bytes. Em UTF-8, a quantidade de caracteres japoneses possível é menor que 50. | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), consultado em 2026-07-19. | Alta |
| Fato verificado | D1 expõe por query rows read, rows written, duração SQL e tamanho do banco, permitindo benchmark de custo. | [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) e [return objects](https://developers.cloudflare.com/d1/worker-api/return-object/), consultados em 2026-07-19. | Alta |
| Fato verificado | Cada banco D1 processa queries de forma single-threaded. Um único banco pode se tornar gargalo sob concorrência. | [D1 limits — concurrency](https://developers.cloudflare.com/d1/platform/limits/), consultado em 2026-07-19. | Alta |
| Inferência | Um título japonês sem espaços pode ser tratado por `unicode61` como um único token longo. Assim, prefixo do início pode funcionar, mas substring no meio não é garantida. | Inferência direta das regras do tokenizer. | Alta |
| Inferência | Remoção de diacríticos do `unicode61` é útil para buscas como “Pokémon”/“Pokemon”, mas não resolve romanização, kana/kanji ou erros ortográficos. | Derivada do comportamento do tokenizer. | Alta |
| Hipótese a validar | O build de SQLite usado pelo D1 disponibiliza o tokenizer trigram com o mesmo comportamento documentado pelo SQLite. A documentação do D1 confirma FTS5, mas não enumera explicitamente todos os tokenizers compilados. | Precisa de query de capability em D1 real. | Média |
| Hipótese a validar | Um índice trigram completo pode caber abaixo de 500 MB para anime e manga, considerando aliases. | Precisa de benchmark. | Baixa |
| Inferência | Filtros estruturados de score, ano, temporada, tipo e status são melhor atendidos por índices SQL normais do que por FTS. | Princípio de modelagem relacional. | Alta |

## Implicações arquiteturais

### 1. Busca precisa de múltiplas estratégias

Uma única consulta FTS não deve determinar toda a relevância. Pipeline conceitual:

1. match exato de ID;
2. título/alias normalizado exato;
3. prefixo de título/alias;
4. FTS por tokens para inglês e romaji;
5. trigram/substring para japonês e fragmentos;
6. desempate por popularidade e qualidade do alias.

### 2. Normalizações necessárias

Sem definir implementação, o corpus precisa avaliar:

- Unicode normalization, preferencialmente NFKC;
- case folding;
- remoção opcional de diacríticos latinos;
- espaços e pontuação;
- hífens, apóstrofos e dois-pontos;
- símbolos como `★`, `×`, `!`, `?`;
- variantes `ou`/`ō`, `uu`/`ū`;
- títulos oficiais em romaji;
- kana e kanji;
- aliases em idiomas diferentes;
- números romanos e arábicos;
- artigos e subtítulos.

Não gerar romanização automaticamente como verdade canônica sem avaliar erros; preferir aliases fornecidos por fonte autorizada.

### 3. FTS e filtros devem ser separados

- FTS retorna candidatos e relevância textual.
- SQL aplica filtros estruturados.
- Ordenação por score/popularidade precisa de índice próprio.
- O benchmark deve medir rows read após combinar busca e filtros, não somente a FTS isolada.

### 4. Um índice reconstruível é obrigatório

FTS5 pode ser tratado como derivado:

- origem: tabela de títulos/aliases;
- índice: reconstruível;
- backup: dataset e aliases, não apenas arquivo D1;
- migração: recriar índice quando tokenizer/normalização mudar.

A documentação da Cloudflare observa limitações de export quando há virtual tables; isso reforça a necessidade de reconstrução.

### 5. Alternativas sem serviço pago

#### Alternativa A — aliases normalizados + B-tree

Adequada para:

- igualdade;
- prefixo;
- títulos muito curtos;
- alta precisão.

Limitação: substring e typo tolerance fracos.

#### Alternativa B — FTS5 `unicode61`

Adequada para:

- inglês/romaji;
- palavras;
- diacríticos;
- ranking BM25.

Limitação: japonês sem espaços e substring.

#### Alternativa C — FTS5 trigram

Adequada para:

- substring;
- scripts sem segmentação;
- aliases parciais.

Limitações:

- mínimo de três caracteres em MATCH;
- maior armazenamento e write amplification;
- qualidade/relevância precisa ser calibrada;
- disponibilidade no D1 precisa ser confirmada.

#### Alternativa D — índice de prefixos pré-computado

Adequada para:

- autocomplete controlado;
- previsibilidade.

Limitações:

- mais rows written;
- explosão de armazenamento;
- precisa limitar tamanho e quantidade de prefixos.

#### Alternativa E — índice estático em R2/CDN

Adequada para:

- pequenos catálogos ou shards por prefixo;
- redução de D1 em autocomplete.

Limitações:

- atualização e invalidação;
- payload ao cliente;
- não substitui filtros complexos;
- pode expor o catálogo inteiro.

## Riscos e limites

### Relevância não é apenas matching

Resultados precisam considerar:

- título principal versus alias;
- correspondência exata versus parcial;
- idioma;
- popularidade;
- tipo de mídia;
- duplicatas;
- temporadas sequenciais;
- obras com títulos quase idênticos.

BM25 padrão não conhece essas regras sozinho.

### Japonês curto

Consultas de um ou dois caracteres são especialmente difíceis:

- trigram não encontra;
- `LIKE` pode escanear;
- prefix tables podem explodir;
- muitos resultados são semanticamente ambíguos.

O MVP pode exigir mínimo de três caracteres para busca livre, mantendo ID e match exato para consultas menores.

### Tamanho por banco

O limite de 500 MB inclui:

- tabelas;
- índices B-tree;
- FTS;
- aliases;
- páginas livres;
- metadados.

Separar anime e manga pode ser necessário, mas só após medição. Sharding precoce complica consultas e migração.

### Write amplification

Atualizar um título pode modificar:

- linha canônica;
- aliases;
- FTS;
- índices;
- relações.

D1 conta rows written também para índices. O benchmark precisa medir a atualização, não somente a carga inicial.

### Concorrência

Um banco single-threaded pode suportar o MVP, mas buscas caras e scans podem bloquear outras queries. O p99 e a fila de queries são tão importantes quanto a mediana.

## Questões ainda abertas

- O tokenizer trigram está habilitado no D1 atual?
- Qual a qualidade de `unicode61` para kana e kanji?
- Quais títulos japoneses são tokenizados como uma única sequência?
- Qual é o tamanho do índice por 10 mil, 40 mil e 100 mil entidades?
- Quantos aliases por entidade existem no p50/p95/p99?
- Prefix index do FTS melhora o suficiente para justificar armazenamento?
- Qual algoritmo de relevância atende sequência, remake e títulos alternativos?
- Como tratar erros ortográficos sem serviço externo?
- O limite de 50 bytes de LIKE afeta queries reais?
- Quais filtros mais multiplicam rows read?
- Um único banco de 500 MB basta para anime?
- A busca precisa retornar manga e anime em uma única chamada?
- Qual comportamento será compatível com Jikan para queries menores que três caracteres?

## Recomendação e critério de go/no-go

### Recomendação

**Condicionar.** D1/FTS5 é a primeira opção, mas não deve ser aprovada sem benchmark multilíngue.

### Corpus de benchmark

Mínimo recomendado:

- 10 mil entidades para iteração inicial;
- 30–50 mil anime para teste próximo do real;
- amostra separada de manga;
- título principal, inglês, japonês e todos os aliases;
- casos com acentos, macrons, símbolos, números e pontuação;
- pelo menos 500 queries avaliadas manualmente.

Classes de query:

- ID;
- título exato;
- alias exato;
- prefixo;
- palavra interna;
- substring japonesa;
- romaji sem macron;
- diacrítico removido;
- erro de digitação de um caractere;
- sequência/temporada;
- título com símbolo;
- um, dois e três caracteres.

### Métricas

- precision@1;
- precision@5;
- recall@10;
- MRR@10;
- nDCG@10;
- p50/p95/p99 de latência SQL;
- rows read por query;
- rows written por inserção e atualização;
- tamanho total do banco;
- tamanho incremental por mil entidades;
- queries por segundo sob concorrência moderada;
- taxa de queries que caem em scan.

### Critérios de go

Limiares de projeto propostos:

- match exato/alias: precision@1 ≥ 0,98;
- inglês/romaji: recall@10 ≥ 0,95;
- japonês com três ou mais caracteres: recall@10 ≥ 0,90;
- prefixo/autocomplete: precision@5 ≥ 0,90;
- p95 SQL ≤ 50 ms no corpus completo;
- p99 SQL ≤ 150 ms;
- p95 rows read ≤ 500 por consulta comum;
- nenhuma consulta comum lê mais de 10 mil rows;
- banco projetado ≤ 400 MB;
- atualização média ≤ 30 rows written por entidade;
- nenhuma dependência de scan linear para fluxos normais;
- índice pode ser reconstruído do dataset fonte.

### Critérios de no-go

- trigram indisponível e japonês parcial insuficiente;
- banco excede 500 MB com margem inadequada;
- rows read extrapolam 5 milhões/dia no cenário moderado;
- writes tornam atualizações quentes inviáveis;
- p95/p99 incompatíveis com a API;
- relevância exige lógica externa complexa;
- consultas comuns dependem de LIKE com scan.

### Plano alternativo

Se D1 falhar:

1. manter D1 para filtros e exact/prefix;
2. servir busca básica por aliases;
3. limitar substring/typo tolerance;
4. gerar shards estáticos de autocomplete;
5. adiar busca avançada até existir orçamento para motor dedicado.

## Fontes

- [Cloudflare D1 — supported SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [Cloudflare D1 — pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 — limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 — metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Cloudflare D1 — return objects](https://developers.cloudflare.com/d1/worker-api/return-object/)
- [Cloudflare D1 — import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [SQLite FTS5 Extension](https://www.sqlite.org/fts5.html)
