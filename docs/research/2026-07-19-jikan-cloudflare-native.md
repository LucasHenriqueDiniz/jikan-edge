---
tags:
  - research
  - jikan
  - myanimelist
  - cloudflare
  - architecture
---

# Pesquisa — Jikan e uma alternativa Cloudflare-native

> Data da pesquisa: 2026-07-19  
> Status: base de decisão; não é especificação implementada.

## Resumo executivo

O Jikan é uma API não oficial e somente de leitura que obtém dados por scraping do MyAnimeList. A documentação pública declara cache de 24 horas e limites de 3 requisições/segundo e 60/minuto. Isto mostra que cache, controle de frequência e tolerância a falhas da fonte são propriedades centrais do problema — não otimizações opcionais.

Uma alternativa Cloudflare-native no plano Free pode ser viável para um MVP pequeno e de tráfego controlado, desde que seja orientada a dados armazenados, cache e atualização assíncrona. Não há evidência suficiente para prometer um substituto público completo do Jikan: Workers Free tem 100.000 requests/dia e 10 ms de CPU por invocação, e cada acesso a D1/R2/KV conta como subrequest.

## Como o Jikan funciona

O próprio Jikan se apresenta como uma API não oficial do MyAnimeList que faz scraping do site para suprir lacunas da API oficial. A API pública é apenas GET, armazena dados extraídos temporariamente por 24 horas e oferece `ETag`/`304` para validação de cache.

Na prática, o serviço precisa separar duas responsabilidades:

- obtenção e interpretação de dados da fonte, que falha e pode sofrer rate limit;
- catálogo/cache consultável, que protege a fonte e dá desempenho previsível aos consumidores.

Isso explica por que a implantação histórica do Jikan REST envolve aplicação, banco, migrations e scheduler. Essa stack é referência de domínio, mas não deve ser portada diretamente para Workers.

## Restrições Cloudflare verificadas

| Recurso Free | Limite relevante | Consequência de projeto |
| --- | ---: | --- |
| Workers | 100.000 requests/dia | uma API pública precisa de rate limit, cache de CDN e plano de degradação |
| CPU por invocação | 10 ms | parsing e normalização só podem ser aceitos após benchmark real |
| Memória | 128 MB | respostas devem ser processadas em streaming; não assumir DOM completo grande |
| Subrequests | 50/request | cada chamada a fonte, R2 ou D1 entra no orçamento por requisição |
| D1 | 5 milhões de leituras/dia; 100 mil escritas/dia; 5 GB totais | usar como índice e consulta; medir amplificação de escrita |
| KV | 1.000 escritas/dia | não usar como armazenamento canônico de itens atualizados em volume |
| Queues | 10.000 operações/dia, 24 h de retenção | serve para atualização pequena e deduplicada; cada mensagem normalmente consome três operações |

O tempo de espera de rede não entra no CPU do Worker, mas parsing, transformação e serialização entram. Portanto, `fetch` possível não prova que o parser cabe no Free.

## Arquitetura candidata

```text
Fonte permitida
    -> ingestão assíncrona e limitada
    -> normalização/versionamento
    -> R2: payload por entidade
    -> D1: aliases, filtros e relações mínimas
    -> API Worker + cache: leitura, ETag e stale-while-revalidate
```

Esta é uma hipótese, não uma decisão final. R2 evita que consultas por ID dependam de tabelas normalizadas extensas; D1 permite pesquisa e filtros que um armazenamento chave-valor não resolve. Ambas as escolhas dependem dos experimentos de custo e qualidade de busca.

## Fontes e scraping: postura recomendada

1. Priorizar uma API oficial quando ela oferecer os campos e o modelo de acesso necessários.
2. Tratar HTML público como fonte a validar: termos, consistência por região, bloqueios, conteúdo alternativo e mudanças estruturais.
3. Tratar endpoints internos observados na rede como investigação, nunca como dependência do MVP. Podem mudar, exigir sessão ou contrariar condições de uso.
4. Não fazer scraping ao vivo para satisfazer uma requisição do usuário. Em cache miss, responder com estado conhecido/stale e solicitar atualização deduplicada.
5. Manter canários, fixtures, validação de schema e proteção contra gravar uma página de bloqueio como dado válido.

## Escopo inicial recomendado

Se os bloqueadores forem aprovados, o primeiro recorte deve limitar-se a anime: detalhe por ID, busca por título, gêneros, temporada atual e ranking. Manga, personagens, pessoas, relações profundas, reviews, notícias e adapter Jikan devem ficar fora até que o fluxo básico tenha orçamento medido.

## Riscos que permanecem abertos

- Resposta inconsistente ou bloqueio da fonte para IPs Cloudflare.
- Mudança de HTML e falso sucesso (página de CAPTCHA/erro com status 200).
- CPU acima de 10 ms em páginas grandes ou durante normalização.
- Baixa qualidade de FTS5 para japonês e aliases.
- Amplificação de escrita por títulos, gêneros, relações e índices.
- Esgotamento de request quota mesmo com cache, pois o Worker ainda é invocado.
- Implicações de termos de uso e direitos sobre dados/imagens.

## Conclusão

O caminho responsável não é reescrever o Jikan inteiro nem declarar compatibilidade v4. É executar um spike que responda, primeiro, se há fonte sustentável, parser dentro da CPU, armazenamento dentro das franquias e busca aceitável. Até esses resultados, a arquitetura acima é uma direção de pesquisa e não um compromisso de implementação.

## Fontes

- [Jikan API v4 — documentação](https://docs.api.jikan.moe/)
- [Jikan REST — instalação e operação](https://github.com/jikan-me/jikan-rest/wiki/Installation-%28feature-elasticsearch%29)
- [Cloudflare Workers — limites](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers — preços, D1, KV e Queues](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Queues no plano Free](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)
