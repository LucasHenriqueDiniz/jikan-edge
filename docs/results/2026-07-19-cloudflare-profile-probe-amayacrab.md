# Resultado — probe de perfil MyAnimeList em Cloudflare Worker

> Data: 2026-07-19  
> Escopo: um perfil público fixo, sem persistência, sem autenticação e sem endpoint genérico.

## Objetivo

Verificar se um Worker Free consegue buscar e extrair campos básicos de `https://myanimelist.net/profile/amayacrab` sem exceder o orçamento de CPU de 10 ms.

## Implementação do spike

- Worker: [`spikes/profile-probe`](../../spikes/profile-probe/)
- URL do probe: `https://jikan-edge-profile-probe.lucas-hdo.workers.dev/probe`
- Perfil é fixo no código; o Worker não aceita URL, usuário ou parâmetros de coleta.
- Nenhuma resposta é armazenada.
- Campos extraídos: usuário, avatar, último acesso, gênero, localização, dias e score médio de anime/manga.

## Resultados

| Etapa | Resultado |
| --- | --- |
| Fetch local inicial | HTTP 200, HTML `text/html`, aproximadamente 92 KB |
| Parser inicial com regex globais | falhou em parte das execuções com erro Cloudflare `1104` (limite de recursos) |
| Parser otimizado por seções delimitadas | 5 de 5 respostas HTTP 200; sem conteúdo suspeito |
| Execução observada pela Cloudflare | `cpuTime: 2 ms`, `wallTime: 393 ms`, `outcome: ok` |
| Fetch observado no Worker | 391 ms; espera de rede não entra no orçamento de CPU |

A execução observada ocorreu no colo `POA`. O Worker conseguiu identificar o perfil e extrair as estatísticas públicas esperadas. O perfil fornecido contém dados públicos como localização e gênero; o spike não os persiste.

## Conclusão

**Go parcial para parser de perfil básico.** Um parser deliberadamente pequeno, que evita regex globais repetidas no HTML completo, ficou abaixo do limite Free nesta amostra.

O primeiro parser ter retornado `1104` é igualmente relevante: uma estratégia ingênua de varrer o documento inteiro com regex pode não ter margem confiável. A métrica a proteger é o `cpuTime` emitido pela observabilidade da Cloudflare, e não apenas a duração local do parser.

## Limitações

- Uma página e uma única execução observada não representam perfis grandes, privados, removidos ou estruturados de modo diferente.
- Um colo não representa todas as regiões de execução Cloudflare.
- O teste não valida estabilidade por dias, limite de frequência, termos da fonte, páginas de bloqueio, canários ou estratégia de cache.
- Este resultado não autoriza ainda endpoints genéricos nem scraping sob demanda para consumidores.

## Próximos testes necessários

1. Repetir em corpus pequeno de perfis públicos com estruturas variadas.
2. Medir p50/p95 de `cpuTime`, não só sucesso HTTP.
3. Testar respostas 404, perfil privado/removido e página de bloqueio.
4. Converter o parser do spike em parser testável por fixtures antes de qualquer ingestão persistente.
