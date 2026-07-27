# Plano de descoberta

## Objetivo

Transformar a hipótese "Jikan Cloudflare-native no Free" em uma decisão de viabilidade baseada em medições. Este plano não autoriza construir o produto.

## Bloqueadores P0

| Pergunta | Por que bloqueia | Evidência necessária | Go/no-go |
| --- | --- | --- | --- |
| A fonte permite e atende fetches da Cloudflare? | Sem fonte estável não há ingestão sustentável. | amostra em dias e regiões, status, conteúdo, sinais de bloqueio e termos aplicáveis | bloquear scraping se houver bloqueio persistente ou vedação aplicável |
| O parser mínimo cabe no Free? | Workers Free limita CPU por invocação a 10 ms. | p50/p95 e falhas em corpus representativo | avançar apenas com p95 abaixo de 8 ms e sem estouros no corpus |
| O modelo D1 + R2 cabe no orçamento? | Escritas e busca podem esgotar franquias antes do tráfego. | custo por entidade, tamanho e consulta em corpus real | avançar apenas com projeção abaixo de 70% da franquia-alvo |

## Experimentos, quando liberados

1. **Probe de fonte:** uma rota mínima e privada para casos pré-definidos; registrar somente metadados seguros (status, tamanho, tipo, marcadores, duração e região).
2. **Parser vertical:** uma entidade anime por ID e campos mínimos; medir CPU em ao menos 50 páginas diversas.
3. **Persistência:** documento versionado no R2 e metadados no D1; medir escrita, leitura e cache.
4. **Busca:** corpus de pelo menos 30 mil títulos/aliases; avaliar inglês, romaji e japonês com FTS5.
5. **Deduplicação:** simular alto volume de pedidos para o mesmo item expirado; validar um único refresh.
6. **Mapa de rede:** documentar o que é HTML, XHR e endpoint autenticado, sem tornar endpoint interno uma dependência do MVP.

## Artefatos esperados

- `docs/results/cloudflare-source-probe.md`
- `docs/results/parser-cpu.md`
- `docs/results/storage-budget.md`
- `docs/results/d1-search.md`
- `docs/sources/mal-network-map.md`
- uma decisão go/no-go em `docs/adr/`

## Critérios de sucesso do futuro spike

- A fonte se mantém disponível e dentro das regras aplicáveis.
- Nenhum resultado suspeito substitui um documento válido.
- O parser principal mantém margem para o limite de CPU.
- O cache reduz trabalho repetido e a API consegue responder com dados stale durante falha da fonte.
- A busca encontra títulos em múltiplas grafias sem varreduras caras.
- Há uma projeção clara do ponto em que o Free deixa de ser suficiente.
