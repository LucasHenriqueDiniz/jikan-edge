# Decisões arquiteturais iniciais

> Status: propostas iniciais — não implementadas.

## Norte do produto

Construir uma API de leitura para catálogo de anime/mangá inspirada nos benefícios do Jikan: dados normalizados, cacheáveis e acessíveis sem a complexidade de cada consumidor lidar com fontes externas.

O produto não começa com a promessa de substituir toda a API Jikan v4 nem com paridade de payloads.

## Princípios aceitos

1. **Cache e dados pré-coletados primeiro.** A leitura do usuário deve priorizar dados armazenados e potencialmente stale; ela não deve depender de scraping síncrono.
2. **Separar payload de índice.** R2 é candidato ao documento canônico e D1 ao índice, relações e consulta. Isto precisa de benchmark antes de virar decisão definitiva.
3. **Ingestão desacoplada.** Atualizações são candidatas a jobs assíncronos, com deduplicação, limites e backoff.
4. **API nativa antes de compatibilidade.** O MVP deve ter `/v1` próprio. Um adaptador de compatibilidade Jikan só será avaliado depois que os contratos internos estiverem estáveis.
5. **Free como restrição de projeto, não garantia de escala.** A arquitetura deve degradar com dados stale e limites explícitos, em vez de esconder consumo imprevisível.
6. **Fonte lícita e sustentável.** APIs oficiais são preferidas. Qualquer uso de HTML público ou endpoint interno exige validação de termos, comportamento real e plano para mudanças.

## Decisão de fonte para a descoberta

Para a fase atual, o projeto **não usará a API oficial do MyAnimeList**. A hipótese de fonte é o scraping de páginas HTML públicas do MyAnimeList, no modelo geral do Jikan.

Limites desta decisão:

- sem login, cookies de usuário, tokens, dados privados ou mutações;
- sem CAPTCHA, bypass de bloqueio, fingerprinting enganoso ou tentativa de contornar proteções;
- endpoints internos observados em Network permanecem fora do caminho inicial;
- scraping só pode ocorrer de forma assíncrona, limitada, cacheada e com backoff;
- uma página inesperada, desafio, erro ou conteúdo incompleto nunca substitui um dado válido.

Isto remove a API oficial do escopo de arquitetura, mas não remove a necessidade de registrar os termos vigentes, respeitar limites da fonte e interromper a coleta se o probe identificar bloqueio persistente.

## Desenho conceitual a testar

```text
Fonte autorizada / HTML validado
              |
              v
Ingestão assíncrona -> normalização -> R2 (payload) + D1 (índice)
                                         |
                                         v
Cliente -> API Worker -> cache/CDN -> resposta fresca ou stale
```

## Fora do MVP proposto

- Escrita em listas de usuário ou autenticação em nome de usuários.
- Cópia/proxy de imagens.
- Cobertura integral dos endpoints Jikan v4.
- Dependência de browser automatizado no caminho normal de ingestão.
- Importação integral do catálogo antes de medir tamanho e custo.

## Decisões pendentes que bloqueiam código

- Se o HTML público do MyAnimeList é operacionalmente estável para o padrão de coleta proposto.
- Quais entidades e campos entram no MVP.
- Se o Worker Free suporta o parser mínimo com margem de CPU.
- Se D1/FTS5 atende busca em inglês, romaji e japonês.
- Como servir e sinalizar dados stale.
- Qual nível, se algum, de compatibilidade com Jikan será prometido.
