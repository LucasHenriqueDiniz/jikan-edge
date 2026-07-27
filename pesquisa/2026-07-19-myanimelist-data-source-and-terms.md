---
tags:
  - research
  - myanimelist
  - data-sources
  - terms
  - licensing
status: draft
research_date: 2026-07-19
---

# Pesquisa — Fontes de dados e termos do MyAnimeList

## Pergunta de decisão

**Qual fonte pode ser usada de forma sustentável e sob quais condições?**

## Resumo executivo

- **Resposta curta:** a fonte mais sustentável em tese é a API oficial do MyAnimeList, usando uma aplicação registrada e somente os usos autorizados pelos termos aplicáveis. HTML público e endpoints internos não devem ser considerados permitidos apenas por serem acessíveis sem login.
- **Impacto direto para o projeto:** não há base suficiente, nesta pesquisa, para aprovar crawling ou scraping em produção. A página oficial de termos e a documentação oficial da API não ficaram acessíveis às ferramentas de pesquisa em 19 de julho de 2026, impedindo uma conclusão jurídica e operacional de alta confiança.
- **Recomendação:** **condicionar**. O MVP pode avançar em desenho, contratos e pesquisa de fontes, mas a ingestão a partir do HTML deve ficar bloqueada até revisão manual dos termos oficiais vigentes ou autorização escrita do MyAnimeList. A API oficial deve ser avaliada primeiro, mediante registro de uma aplicação própria.

Esta pesquisa é técnica e não substitui avaliação jurídica.

## Evidências verificadas

| Classificação | Fato, hipótese ou inferência | Fonte e consulta | Confiança |
|---|---|---|---|
| Fato verificado | O Jikan se apresenta como API não oficial que faz scraping do MyAnimeList para fornecer funcionalidades ausentes na API oficial. | [Jikan REST API v4](https://github.com/jikan-me/jikan-rest), consultado em 2026-07-19. | Alta |
| Fato verificado | O Jikan declara que não é afiliado ao MyAnimeList e atribui ao operador/usuário a responsabilidade de respeitar os termos do MyAnimeList. | [README do Jikan REST](https://github.com/jikan-me/jikan-rest), consultado em 2026-07-19. | Alta |
| Fato verificado | A documentação pública do Jikan descreve uma API somente leitura, sem autenticação do usuário, com dados cacheados e uma superfície ampla: anime, manga, personagens, pessoas, temporadas, rankings, reviews, recomendações, usuários e outros recursos. | [Jikan API v4 Docs](https://docs.api.jikan.moe/), consultado em 2026-07-19. | Alta |
| Fato verificado | Existem páginas oficiais do MyAnimeList destinadas à API v2, autorização e configuração de aplicações. As URLs oficiais são conhecidas, mas não puderam ser carregadas pelas ferramentas usadas nesta pesquisa. | [Referência oficial da API v2](https://myanimelist.net/apiconfig/references/api/v2), [autorização](https://myanimelist.net/apiconfig/references/authorization) e [API Config](https://myanimelist.net/apiconfig), tentativas em 2026-07-19. | Alta quanto à indisponibilidade na pesquisa; baixa quanto ao conteúdo atual |
| Evidência secundária | Wrappers e clientes que apontam para a documentação oficial descrevem registro de aplicação, uso de `client_id`, OAuth 2.0/PKCE para ações em nome do usuário e endpoints de catálogo para anime, manga, rankings e temporadas. | [myanimelist-api-v2](https://github.com/Chris-Kode/myanimelist-api-v2) e [especificação não oficial](https://github.com/SuperMarcus/myanimelist-api-specification), consultados em 2026-07-19. | Média |
| Evidência secundária | Clientes atuais relatam que consultas públicas de catálogo podem usar um Client ID da aplicação, enquanto dados e mutações de usuário requerem OAuth. Isso precisa ser revalidado contra a documentação oficial antes do uso. | [@animelist/client](https://www.npmjs.com/package/@animelist/client) e [Annie Mei — MyAnimeList API](https://anniemei.app/api/myanimelist), consultados em 2026-07-19. | Média |
| Fato verificado | Não foi encontrada, em fonte primária acessível, uma quota pública estável da API oficial do MyAnimeList. | Pesquisa realizada em 2026-07-19; a referência oficial estava indisponível. | Alta quanto à ausência de evidência encontrada |
| Evidência secundária | Um registro do ToS;DR atribui aos termos do MyAnimeList uma cláusula contra sistemas automatizados, incluindo spiders e robots. Como a página oficial não pôde ser consultada, esse registro não deve ser tratado como texto jurídico definitivo. | [ToS;DR — case 150](https://edit.tosdr.org/cases/150), consultado em 2026-07-19. | Média-baixa |
| Fato verificado | O projeto `anime-offline-database` publica um dataset de anime sob ODbL 1.0 e DbCL 1.0, com IDs cruzados, títulos, aliases e metadados agregados. Em julho de 2026, o README informava 41.537 entradas, das quais 30.570 tinham referência ao MyAnimeList. | [anime-offline-database](https://github.com/manami-project/anime-offline-database), consultado em 2026-07-19. | Alta |
| Fato verificado | A licença do `anime-offline-database` cobre direitos da base e impõe atribuição/share-alike em cenários de base derivada pública; ela também alerta que direitos sobre conteúdos individuais, como imagens e textos, podem ser separados e não são automaticamente licenciados pela ODbL. | [LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE), consultado em 2026-07-19. | Alta |
| Fato verificado | O Wikidata disponibiliza seus dados estruturados sob CC0 e recomenda dumps para extrações amplas, reservando SPARQL para consultas focadas. Há propriedades para IDs do MyAnimeList, mas cobertura e qualidade precisam ser medidas. | [Wikidata:Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright), [Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en) e [P4086](https://www.wikidata.org/wiki/Property:P4086), consultados em 2026-07-19. | Alta |
| Fato verificado | A API do AniList proíbe expressamente mass collection/hoarding e uso como backup ou armazenamento de dados, salvo permissões específicas. Portanto, ela não é uma fonte aceitável para copiar um catálogo completo por padrão. | [AniList API Terms of Use](https://docs.anilist.co/guide/terms-of-use), consultado em 2026-07-19. | Alta |
| Inferência | A licença MIT do código do Jikan não concede direitos sobre dados, sinopses, imagens ou outros conteúdos obtidos do MyAnimeList. | Deriva da distinção entre licença de software e direitos sobre conteúdo/base. A própria licença do dataset Manami explicita distinção semelhante. | Alta |
| Inferência | Um endpoint interno público é uma interface não documentada do produto, não uma autorização de redistribuição. Sua acessibilidade técnica não determina seu uso permitido. | Inferência jurídica/arquitetural; depende dos termos vigentes do MyAnimeList. | Alta |
| Hipótese a validar | A API oficial pode cobrir grande parte dos campos centrais de anime e manga, mas provavelmente não oferece toda a superfície do Jikan, especialmente recursos comunitários e páginas detalhadas. | Sustentada pela superfície descrita por clientes da API oficial e pela superfície documentada do Jikan. A documentação oficial atual não pôde ser verificada. | Média |

### Diferença entre as três classes de fonte

| Fonte | Natureza | Estabilidade esperada | Autorização presumível | Uso recomendado |
|---|---|---:|---|---|
| API oficial | Contrato documentado e aplicação registrada | Maior | Somente conforme termos e escopos publicados | Primeira opção |
| Página HTML pública | Interface destinada a navegação humana | Média/baixa | **Não presumir** autorização para automação ou redistribuição | Somente após revisão dos termos/permissão |
| Endpoint interno | Interface usada pelo frontend, normalmente sem compromisso público | Baixa | **Não presumir** autorização nem estabilidade | Somente como otimização autorizada, com fallback |
| Dataset aberto | Base publicada com licença explícita | Variável | Conforme a licença do dataset e dos conteúdos individuais | Bootstrap, se as obrigações forem compatíveis |

### Lacunas da API oficial versus Jikan

A documentação oficial do MyAnimeList não ficou acessível. Assim, a seguinte análise é uma **matriz a confirmar**, e não um inventário definitivo:

- **Cobertura relatada com confiança média:** pesquisa e detalhe de anime/manga, rankings, temporadas, sugestões, listas e perfil do usuário.
- **Cobertura do Jikan confirmada:** personagens, pessoas, staff, episódios, reviews, notícias, fóruns, recomendações, estatísticas, relações, streaming, vídeos, temporadas e rankings.
- **Lacuna provável:** personagens, pessoas, episódios e conteúdo comunitário não parecem ter paridade completa na API oficial.
- **Quota e redistribuição:** não foi encontrada uma quota oficial acessível nem autorização explícita para construir uma API pública de redistribuição/cache permanente.

Antes de decidir que a API oficial é suficiente ou insuficiente, o projeto precisa obter uma cópia atual da referência oficial e produzir uma matriz campo a campo.

## Implicações arquiteturais

1. **A ordem das fontes deve ser jurídica antes de ser técnica.**
   - Fonte oficialmente autorizada.
   - Dataset com licença compatível.
   - HTML ou endpoint interno somente após aprovação explícita.
   - Dados stale locais como fallback.

2. **Proveniência precisa ser de primeira classe.**
   Cada campo ou documento deve ter, conceitualmente:
   - fonte;
   - URL de origem;
   - licença/termos aplicáveis;
   - data de obtenção;
   - versão do parser/adaptador;
   - direito de retenção e redistribuição conhecido ou pendente.

3. **Imagens devem ficar fora do bootstrap por padrão.**
   - A URL de uma imagem não concede licença para copiar ou redistribuir o arquivo.
   - Hotlinking também precisa ser validado contra termos e regras do CDN.
   - O MVP deve tratar imagem como referência externa opcional, não como ativo próprio, até haver base de uso clara.

4. **Dados factuais e textos autorais devem ser separados.**
   - IDs, datas, contagens e relações têm perfil jurídico diferente de sinopses, reviews, biografias e imagens.
   - O escopo inicial deve favorecer fatos estruturados e referências.
   - Conteúdo textual longo deve exigir análise específica.

5. **O projeto não deve depender de um Client ID de terceiros.**
   - Deve registrar sua própria aplicação.
   - O segredo e a identidade da aplicação não podem ser incorporados em clientes públicos.
   - O uso precisa respeitar escopos, rate limits e regras de cache/redistribuição da API oficial.

6. **Compatibilidade com Jikan não significa copiar a origem de dados do Jikan.**
   - O contrato de saída pode ser compatível.
   - A origem e a licença precisam ser avaliadas separadamente.

## Riscos e limites

### Bloqueador jurídico-operacional

A página oficial de termos do MyAnimeList estava indisponível para esta pesquisa. Sem o texto vigente, não é possível concluir:

- se scraping é proibido em qualquer forma;
- se há exceções para pesquisa, interoperabilidade ou uso não comercial;
- se cache e redistribuição de respostas da API oficial são permitidos;
- se há limite de retenção;
- se imagens podem ser exibidas por hotlink;
- se uma API concorrente/complementar é autorizada;
- se uso comercial futuro exige acordo.

O registro secundário do ToS;DR sugere proibição ampla de automação. Isso é suficiente para impedir uma aprovação por silêncio, mas não para substituir a leitura oficial.

### Risco de licença contaminante no bootstrap

Usar parte substancial do `anime-offline-database` pode exigir:

- atribuição;
- manutenção dos avisos;
- licenciamento compatível da base derivada;
- fornecimento da base derivada ou alterações em formato legível por máquina;
- análise separada dos direitos dos conteúdos individuais.

Isso pode ser compatível com um projeto aberto, mas deve ser uma decisão explícita de produto e licença.

### Ausência de fonte aberta equivalente para manga

Nesta pesquisa não foi encontrada uma base aberta e atual equivalente ao Manami para cobrir manga, personagens e pessoas com licença clara e abrangente. Portanto:

- o bootstrap de manga pode começar esparso;
- o projeto não deve inventar cobertura completa;
- a promessa pública deve diferenciar cobertura de anime e manga.

### Dependência de fonte secundária

As informações sobre autenticação e endpoints da API oficial foram trianguladas com clientes não oficiais porque a documentação primária não abriu. Elas não podem sustentar decisões finais de compliance.

## Questões ainda abertas

- Qual é o texto integral e vigente dos termos do MyAnimeList em 2026-07-19?
- Há termos específicos da API, além dos termos gerais do site?
- A API permite cache persistente e redistribuição pública?
- Há limites documentados por Client ID, IP, minuto ou dia?
- Quais endpoints públicos aceitam apenas Client ID e quais exigem OAuth?
- A API oficial oferece personagens, pessoas, staff, temas, episódios ou imagens alternativas atualmente?
- O MyAnimeList concede autorização a serviços equivalentes ao Jikan mediante solicitação?
- Hotlinking das imagens do CDN é permitido?
- Sinopses e biografias podem ser armazenadas e redistribuídas?
- O uso de ODbL é compatível com a licença pretendida para a base do `jikan-edge`?
- Existe um dataset aberto e sustentável para manga?
- O nome e a apresentação do projeto precisam de disclaimer ou restrições de marca?

## Recomendação e critério de go/no-go

### Recomendação

**Condicionar.** O projeto pode continuar com pesquisa de arquitetura e contratos, mas não deve aprovar scraping/ingestão em produção antes de concluir compliance.

### Go

A fonte é aprovada quando todos os critérios abaixo forem satisfeitos:

1. termos oficiais atuais foram lidos e arquivados internamente com data;
2. o uso pretendido — automação, cache e redistribuição — é expressamente permitido ou autorizado por escrito;
3. a aplicação usa credenciais próprias;
4. quotas e política de backoff estão documentadas;
5. direitos de imagens e textos foram avaliados separadamente;
6. a proveniência e as obrigações de licença podem ser expostas aos consumidores;
7. existe uma política de remoção/correção de dados.

### No-go

Bloquear a fonte quando:

- os termos proibirem automação ou redistribuição aplicável;
- a autorização for ambígua e não houver confirmação do titular;
- o projeto depender de credencial de terceiro;
- a fonte exigir mass collection proibida;
- a licença da base for incompatível com a licença/proposta do produto;
- o conteúdo individual não tiver direitos claros e não puder ser excluído.

### Experimento/documento necessário

Não é um experimento de carga. É uma **revisão documental**:

- obter manualmente as páginas oficiais;
- registrar versão/data;
- criar matriz “ação pretendida × cláusula aplicável”;
- solicitar esclarecimento por escrito ao MyAnimeList para automação, retenção e redistribuição;
- produzir decisão assinada pelo responsável do projeto antes de qualquer probe de scraping.

## Fontes

- [MyAnimeList API v2 — referência oficial](https://myanimelist.net/apiconfig/references/api/v2)
- [MyAnimeList — autorização](https://myanimelist.net/apiconfig/references/authorization)
- [MyAnimeList — API Config](https://myanimelist.net/apiconfig)
- [MyAnimeList — Terms of Use](https://myanimelist.net/about/terms_of_use)
- [Jikan REST API](https://github.com/jikan-me/jikan-rest)
- [Jikan API v4 Docs](https://docs.api.jikan.moe/)
- [Jikan parser](https://github.com/jikan-me/jikan)
- [ToS;DR — automated systems case](https://edit.tosdr.org/cases/150)
- [anime-offline-database](https://github.com/manami-project/anime-offline-database)
- [anime-offline-database — LICENSE](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE)
- [Wikidata — Copyright](https://www.wikidata.org/wiki/Wikidata:Copyright)
- [Wikidata — Data access](https://www.wikidata.org/wiki/Wikidata:Data_access/en)
- [Wikidata — MyAnimeList anime ID](https://www.wikidata.org/wiki/Property:P4086)
- [AniList API — Terms of Use](https://docs.anilist.co/guide/terms-of-use)
- [Cliente secundário da API v2](https://github.com/Chris-Kode/myanimelist-api-v2)
- [Especificação não oficial da API](https://github.com/SuperMarcus/myanimelist-api-specification)
