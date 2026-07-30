# `genres/anime` e `genres/manga` — MAL reduz o conteúdo para a rede da Cloudflare

> **Resolvido em 2026-07-30** trocando a fonte da taxonomia (a barra lateral continua truncada; a página de busca não). Ver "Estado atual" no fim do documento. O diagnóstico abaixo fica como registro.

Data: 2026-07-26. Descoberto ao implementar o catálogo de manga e notar que `/v1/genres/manga` retornava só 12 gêneros (real: ~300+, contando gêneros de todo tipo de conteúdo listado na barra lateral). Investigação mostrou que o mesmo já afetava `/v1/genres/anime` desde o primeiro deploy — só não tinha sido notado porque a validação anterior olhou uma prévia truncada da resposta, não a contagem total.

## Evidência

Fetch da MESMA URL (`https://myanimelist.net/anime/genre/1/Action`), comparando origem:

| Origem do fetch | Contagem de `<span class="genre">` | Tamanho do documento |
| --- | ---: | ---: |
| PowerShell direto (minha rede residencial) | 284–316 (variou entre tentativas, mas sempre na faixa de centenas) | ~630–790 KB |
| `wrangler dev --local` (Workers runtime local, mas fetch pela minha rede) | 284 | 791 KB |
| Worker publicado em produção (rede real da Cloudflare) | 12–13 | não capturado, mas claramente um documento muito menor |

O status HTTP é 200 nos três casos — não há erro, redirect ou marcador de challenge/captcha detectável por `classifyHtml`. O MAL simplesmente serve uma barra lateral de gêneros reduzida (~12 itens) especificamente para requisições que chegam pela rede/datacenter da Cloudflare, provavelmente como mitigação anti-scraping direcionada a esse tipo de tráfego — o mesmo tipo de fenômeno já registrado (sem causa raiz confirmada) em `docs/results/cloudflare-1042-investigation.md`.

Páginas de **detalhe individual** (anime, manga) e de **ranking** (top anime, top manga, temporada atual) não mostraram esse problema — foram validadas extensivamente em produção com dados completos e corretos. O problema parece específico de páginas de **navegação/agregação por gênero**.

## Correção aplicada

`parseAnimeGenres`/`parseMangaGenres` agora rejeitam resultados com menos de 20 gêneros (`MIN_EXPECTED_GENRES`), lançando `ParserError` em vez de aceitar silenciosamente uma lista incompleta como válida. Isso segue a regra do projeto ("nunca substitua dado válido por documento suspeito"), mas tem uma consequência real: **`/v1/genres/anime` e `/v1/genres/manga` retornam 500 em produção agora**, porque toda tentativa de refresh pela rede da Cloudflare recebe a versão reduzida, nunca a completa. Antes da correção, essas rotas retornavam 200 com dados silenciosamente incompletos (13/12 itens) — pior, mas sem erro visível.

## Estado atual

**Resolvido em 2026-07-30 pelo caminho 2** (fonte alternativa). O bloqueio era da página de navegação por gênero, não da taxonomia em si.

### Fonte que funciona

O bloco "Content Filter" da página de busca (`https://myanimelist.net/anime.php?cat=genre` e `manga.php?cat=genre`) traz a taxonomia inteira em markup de formulário, já separada nas quatro categorias que o Jikan expõe e com a contagem de títulos por gênero:

```html
<div class="fs10 fw-b mb4 category-type">Genres</div>
  <input id="genre-1" name="genre[]" type="checkbox" value="1" ...><p>Action (5,003)</p>
```

| Origem do fetch | Entradas de gênero | Documento |
| --- | ---: | ---: |
| PowerShell direto (rede residencial) | 78 anime / 79 manga | 335 KB / 277 KB |
| Worker na borda da Cloudflare (`wrangler dev --remote`, 2026-07-30) | **78 anime / 79 manga** | — |

A resposta veio com `meta.stale: false`, ou seja, refresh real bem-sucedido, não fallback de cache. A distribuição bateu exatamente com o fetch direto: 18 genres, 3 explicit genres, 52 themes e 5 demographics no anime; a mesma coisa no manga com 53 themes.

Essa evidência não é nova, aliás: o probe de 2026-07-19 (`docs/results/2026-07-19-p0-source-route-probe.md`) já tinha medido `anime.php?cat=genre` com 78 entradas **por um Worker publicado**. A implementação original escolheu a barra lateral mesmo assim, e o problema só apareceu uma semana depois. Vale como lembrete: a evidência do probe estava certa e foi contrariada na implementação sem que ninguém notasse.

### Por que a barra lateral trunca e esta página não

Sem explicação confirmada. O padrão observado — páginas de navegação/agregação por gênero reduzidas, páginas de detalhe, ranking e busca íntegras — continua valendo, e a página de busca cai do lado íntegro. Não houve tentativa de contornar o comportamento da barra lateral (headers alternativos, rotação de IP): a rota passou a usar uma fonte pública diferente, dentro das mesmas regras.

### O que mudou no código

`parseAnimeGenres`/`parseMangaGenres` (um parser por tipo, lendo `<span class="genre">`) foram substituídos por um `parseGenreTaxonomy(html, type)` só. O guard de completude deixou de ser "≥ 20 itens" e passou a exigir as quatro categorias presentes **e** ≥ 40 entradas — um documento reduzido perde categoria inteira antes de perder contagem. Payload ganhou `count` e `type`; a rota ganhou `?filter=`. Ver `docs/routes.md`.
