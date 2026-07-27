# Estratégia de fonte — scraping público

> Estado: decisão de descoberta. Sem implementação.

## Decisão

O `jikan-edge` investigará uma API própria baseada em scraping de páginas HTML públicas do MyAnimeList. A API oficial do MyAnimeList não entra no escopo inicial.

## Motivação

O objetivo é reproduzir o modelo de dados públicos e cacheados que tornou o Jikan útil, sem depender da cobertura, credenciais ou contrato da API oficial.

## Regras inegociáveis

- Coletar somente conteúdo acessível publicamente e sem sessão.
- Não automatizar login, não guardar cookies de usuário e não expor dados privados.
- Não resolver CAPTCHA, burlar desafios, falsificar identidade de navegador ou contornar rate limits/bloqueios.
- Não coletar no caminho síncrono da requisição do consumidor.
- Aplicar cache, stale-while-revalidate, deduplicação de refresh, baixa cadência e backoff.
- Validar status, tipo, título, marcadores esperados e schema antes de persistir uma resposta.
- Preservar a última versão válida quando a fonte falhar ou responder conteúdo suspeito.

## Consequência para a pesquisa

As perguntas prioritárias passam a ser:

1. O HTML entregue a Workers é estável e semanticamente válido?
2. O parser mínimo cabe no orçamento de CPU do plano Free?
3. Qual cadência mantém a fonte estável sem comportamento abusivo?
4. Que campos são realmente possíveis de extrair e manter?
5. Como detectar alteração estrutural e degradar para dados stale?

## O que permanece pendente

Esta decisão não declara que scraping é permitido ou sustentável. Antes de qualquer implementação, o projeto ainda precisa verificar termos vigentes, executar um probe controlado e decidir o critério de interrupção diante de bloqueios ou alterações da fonte.
