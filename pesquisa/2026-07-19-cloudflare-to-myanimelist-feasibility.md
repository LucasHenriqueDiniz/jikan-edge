---
tags:
  - research
  - cloudflare
  - workers
  - scraping
  - feasibility
status: draft
research_date: 2026-07-19
---

# Pesquisa — Viabilidade de ingestão Cloudflare para MyAnimeList

## Pergunta de decisão

**Quais resultados do probe tornam a ingestão por Worker viável?**

## Resumo executivo

- **Resposta curta:** Cloudflare Workers possui `fetch()` externo e recursos suficientes para um probe controlado, mas não há evidência primária de que o MyAnimeList permita ou bloqueie especificamente requisições originadas de Workers.
- **Impacto direto para o projeto:** a viabilidade não pode ser decidida em laboratório nem inferida pelo funcionamento do Jikan em outra infraestrutura. É necessário medir respostas reais, conteúdo semântico, rate limiting e CPU do parser em um Worker implantado.
- **Recomendação:** **condicionar**. Executar probe somente após aprovação dos termos. Aceitar HTML como fonte apenas se o teste de sete dias e o teste de carga-alvo passarem sem bloqueio persistente, conteúdo de desafio ou estouro de CPU.

## Evidências verificadas

| Classificação | Fato, hipótese ou inferência | Fonte e consulta | Confiança |
|---|---|---|---|
| Fato verificado | Workers Free permite 100.000 requests por dia, 10 ms de CPU por invocação, 128 MB de memória, 50 subrequests externos, 1.000 subrequests a serviços Cloudflare e 6 conexões externas simultâneas. | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consultado em 2026-07-19. | Alta |
| Fato verificado | O tempo esperando rede, incluindo `fetch()`, não conta como CPU; parsing, transformação e serialização contam. | [Workers limits — CPU time](https://developers.cloudflare.com/workers/platform/limits/), consultado em 2026-07-19. | Alta |
| Fato verificado | O runtime fornece a Fetch API para requisições HTTP externas. Redirects também consomem subrequests. | [Workers Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/) e [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), consultados em 2026-07-19. | Alta |
| Fato verificado | Cloudflare opera rede anycast e faixas compartilhadas para seus serviços; a documentação pública consultada não oferece um IP de saída exclusivo e estável para um Worker Free comum. | [Cloudflare IP addresses](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/), consultado em 2026-07-19. | Média-alta |
| Fato verificado | A documentação do Jikan reconhece que chamadas ao MyAnimeList podem receber rate limiting e que os testes podem falhar com HTTP 429. Isso demonstra risco geral do upstream, não comportamento específico contra Workers. | [Jikan REST](https://github.com/jikan-me/jikan-rest), consultado em 2026-07-19. | Alta |
| Fato verificado | Não foi encontrada fonte primária afirmando que o MyAnimeList aceita, bloqueia ou trata de forma especial o tráfego de Cloudflare Workers. | Pesquisa realizada em 2026-07-19. | Alta quanto à ausência de evidência encontrada |
| Inferência | Mesmo HTTP 200 não prova sucesso de coleta: páginas de challenge, consentimento ou erro podem ser devolvidas com status 200. | Prática comum de proteção web; precisa ser testada no MAL. | Alta |
| Inferência | O principal risco técnico do Free é a CPU do parser, não a espera do fetch. | Deriva da exclusão de tempo de rede e do limite de 10 ms. | Alta |
| Hipótese a validar | Um parser streaming e seletivo pode processar páginas centrais abaixo de 10 ms. | Não há medição prática do projeto. | Baixa até o benchmark |
| Hipótese a validar | O MAL pode aplicar políticas por IP, ASN, região, frequência, headers ou reputação compartilhada. | Possibilidade operacional; nenhuma foi confirmada para Workers. | Baixa/média |

## Implicações arquiteturais

### 1. O probe precisa validar transporte e conteúdo

Registrar somente o status HTTP é insuficiente. Cada amostra deve medir:

- URL solicitada e URL final;
- quantidade de redirects;
- status;
- `Content-Type`;
- tamanho comprimido e descomprimido, quando disponível;
- duração de rede;
- CPU do parser;
- colo/região Cloudflare;
- título da página;
- marcadores obrigatórios;
- marcadores de bloqueio;
- hash estrutural;
- campos extraídos;
- headers de rate limit ou `Retry-After`;
- código de erro de rede;
- versão do parser.

### 2. Validação semântica deve preceder persistência

Uma resposta somente será considerada válida quando:

- tiver o tipo de conteúdo esperado;
- contiver ao menos dois ou três marcadores independentes da entidade;
- produzir ID e título coerentes com a URL;
- não contiver textos/elementos conhecidos de challenge, login forçado ou erro;
- respeitar um intervalo plausível de tamanho;
- passar validação de contrato;
- não reduzir abruptamente campos obrigatórios em relação ao último documento válido.

Uma resposta suspeita nunca deve substituir dados válidos já armazenados.

### 3. O probe não deve descobrir URLs arbitrárias

Usar uma lista fixa de canários representativos:

- anime antigo e estável;
- anime em exibição;
- anime sem título inglês;
- anime com muitos personagens;
- manga em publicação;
- personagem;
- pessoa;
- temporada atual;
- ranking;
- página 404 conhecida.

Isso reduz risco, torna resultados comparáveis e evita crawling indiscriminado.

### 4. Backoff é parte do critério de viabilidade

Comportamento recomendado:

- respeitar `Retry-After`;
- parar imediatamente uma classe de requests após 403/429 persistente;
- usar backoff exponencial com jitter;
- não trocar User-Agent ou região para contornar bloqueio;
- limitar retries;
- servir stale durante indisponibilidade;
- manter circuit breaker por host/recurso.

### 5. A ingestão por Worker deve ser desacoplada da requisição do usuário

Mesmo se o probe passar:

- requests do usuário não devem aguardar scraping;
- dado fresh ou stale deve ser servido localmente;
- miss deve virar job sujeito a orçamento e prioridade;
- objetos desconhecidos não devem causar fan-out;
- falha do upstream não deve degradar o endpoint local para uma tempestade de retries.

## Riscos e limites

### Ausência de autorização

O probe técnico somente deve ocorrer depois da decisão de fontes e termos. Medir acesso não equivale a obter permissão.

### Reputação compartilhada de infraestrutura

Não há documentação que garanta identidade de saída exclusiva no Free. Se o upstream aplicar reputação a faixas compartilhadas, o projeto pode sofrer interferência de tráfego que não controla. Isso é risco, não fato confirmado.

### Variação por colo/região

Workers podem executar próximos ao usuário ou conforme decisões da plataforma. Respostas podem variar por:

- país;
- idioma;
- consentimento;
- edge/upstream;
- rota de rede;
- políticas anti-bot.

O probe deve registrar o colo, mas não presumir que conseguirá fixá-lo.

### Limite de CPU

10 ms é rígido para requests Free. Um parser pode passar em páginas pequenas e falhar em páginas com:

- muitos personagens;
- scripts/anúncios maiores;
- conteúdo excepcional;
- normalização pesada;
- JSON grande.

A medição precisa usar p95/p99, não apenas média.

### Headers e identidade

Não usar headers falsos para simular navegador real ou ocultar a natureza do cliente. O projeto deve usar identificação honesta, contato e versão, caso os termos permitam automação. Não depender de cookies pessoais.

### Falsos positivos de validade

Um layout parcialmente alterado pode passar marcadores simples e produzir JSON incompleto. A validação deve considerar:

- quantidade mínima de campos;
- consistência cruzada;
- delta em relação à última versão;
- hash estrutural;
- cobertura de parser.

### Retenção de Queue

Queues Free retém mensagens por apenas 24 horas. Uma interrupção longa do upstream pode expirar backlog; o estado de refresh precisa existir fora da fila. A fila não pode ser a fonte de verdade.

## Questões ainda abertas

- O MAL resolve e responde para Workers em todos os colos relevantes?
- Há diferença entre HTML entregue ao Worker e ao navegador?
- Quais headers mínimos são exigidos?
- O upstream fornece `ETag`, `Last-Modified` ou `Retry-After` úteis?
- Quais páginas dependem de JavaScript?
- Qual é o tamanho p95/p99 das páginas?
- Qual parser e conjunto de campos cabem em 10 ms?
- Há 403/429 por frequência, região, ASN ou padrão de URL?
- O conteúdo muda por idioma/região?
- Existe um contato oficial para identificar o crawler?
- Qual frequência é autorizada pelos termos?
- Um Client ID oficial deve substituir HTML para parte do probe?

## Recomendação e critério de go/no-go

### Recomendação

**Condicionar à autorização e ao probe.**

### Desenho do experimento

#### Fase A — baseline de baixa frequência

- duração: 7 dias;
- conjunto: 10 a 20 canários fixos;
- frequência: baixa e constante, abaixo de qualquer carga planejada;
- sem retries imediatos;
- registrar status, validade semântica, latência, CPU e colo;
- não armazenar catálogo, apenas evidências do probe.

#### Fase B — parser

- pelo menos 50 páginas reais por classe central;
- incluir casos pequenos, médios e extremos;
- medir CPU p50, p95 e p99;
- comparar parsing mínimo versus documento completo;
- não extrapolar da execução local para Workers.

#### Fase C — cadência-alvo

- reproduzir somente a maior cadência que o MVP efetivamente pretende usar;
- aumentar gradualmente;
- interromper ao primeiro padrão persistente de 403/429/challenge;
- provar recuperação após backoff;
- evitar qualquer tentativa de contornar proteção.

### Critérios de go

Valores abaixo são **limiares de projeto**, não garantias do fornecedor:

- autorização documental concluída;
- pelo menos 99% das respostas baseline semanticamente válidas;
- nenhum challenge/CAPTCHA interpretado como entidade;
- 403/429 abaixo de 0,5% e sempre recuperável com backoff;
- nenhum período contínuo de 30 minutos com mais de 5% de bloqueio;
- p95 de CPU do parser principal abaixo de 8 ms;
- p99 abaixo de 10 ms ou parser dividido em recursos menores;
- p95 de fetch abaixo de 5 segundos;
- validação impede sobrescrita por resposta vazia/suspeita;
- stale é servido durante falhas;
- cadência-alvo passa por pelo menos 72 horas sem tendência crescente de bloqueio.

### Critérios de no-go

- termos não autorizam a automação;
- bloqueio persistente ou challenge;
- necessidade de cookies pessoais, login ou bypass;
- p95 de CPU maior ou igual a 10 ms;
- respostas variam de forma não detectável;
- cadência útil exige retries agressivos;
- inexistência de fonte alternativa para dados críticos;
- o sistema só funciona ao imitar fingerprint de navegador.

### Resultado possível: go parcial

Pode ser viável coletar:

- detalhes básicos;
- temporadas;
- rankings;

e inviável coletar:

- personagens extensos;
- reviews;
- páginas comunitárias.

A decisão deve ser por recurso, não binária para todo o domínio.

## Fontes

- [Cloudflare Workers — limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Cloudflare IP addresses](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/)
- [Cloudflare Queues — limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Cloudflare Queues — pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare Workers — errors](https://developers.cloudflare.com/workers/observability/errors/)
- [Jikan REST API](https://github.com/jikan-me/jikan-rest)
- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [MyAnimeList Terms of Use](https://myanimelist.net/about/terms_of_use)
