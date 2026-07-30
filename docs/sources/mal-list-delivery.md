# Entrega de listas pelo MAL

## Estado atual (2026-07-30)

O MAL renderiza a lista de um usuário em **dois layouts diferentes**, e qual deles é servido depende de uma configuração do próprio usuário — não da URL, não do User-Agent, não da rede:

- **Clássico**: tabela renderizada no servidor, com âncoras `class="animetitle"`.
- **Moderno**: as entradas vêm como um array JSON dentro do atributo `data-items`; a tabela é montada por JS.

A URL da lista precisa do parâmetro **`?status=7`** (a aba "All"). Sem ele:

- no layout moderno a página traz **uma única entrada** — o resto viria de `load.json`, endpoint interno que `docs/source-policy.md` proíbe;
- no layout clássico a página traz **menos linhas do que o perfil declara**.

Com `?status=7`, os dois layouts servem a lista inteira a partir da página pública. Paginação por `&offset=` em blocos de 300 se aplica **só ao layout moderno**; o clássico ignora o offset e devolve tudo num documento só.

Medições reais (2026-07-30), conferidas contra o `totalEntries` que `/v1/users/:u/statistics` reporta para cada usuário:

| Usuário | Layout | Sem `status=7` | Com `status=7` | Perfil declara |
| --- | --- | ---: | ---: | ---: |
| AMayacrab | clássico | 273 | 360 | 360 |
| Zel | clássico | 514 | 514 | 514 |
| Xinil | moderno | 1 | 300 + 99 = 399 | 399 |
| jet2r0cks | moderno | 1 | 898 | 898 |
| Karinyia | moderno | 1 | 2.354 (8 páginas) | 2.354 |

**Título numérico chega como número JSON, não string.** O MAL não põe aspas quando o título parece um número: `86` (o anime *86 Eighty-Six*), `1`, `663114`. Ler só strings esvaziava esses títulos, e um título vazio reprova no schema — como um item inválido rejeita a página inteira, um único anime chamado "86" derrubava uma lista de 2.354 entradas.

**O atributo `data-items` tem que ser lido cru.** Passá-lo pelo helper `decodeHtml` (usado por `capture()`) corrompe o payload em silêncio: ele decodifica `&amp;` antes de `&quot;`, remove qualquer coisa com formato de tag e colapsa espaços repetidos — os três destroem título ou JSON sem levantar erro.

## Guards de completude

A página de lista **não declara em lugar nenhum quantas entradas a lista tem** — os contadores ao lado de "All Anime" são desenhados por JS. Então não existe total a extrair do documento, e a única comparação possível é contra o `totalEntries` do perfil já persistido no D1:

- extrair **menos** que o declarado → snapshot rejeitado (502), com as contagens na mensagem;
- extrair **mais** → aceito: um contador cacheado antes de o usuário adicionar entradas fica legitimamente para trás;
- sem perfil em cache → sem contador, lista servida sem essa checagem.

Além disso: snapshot só é aceito com IDs únicos e marcador terminal `</html>`; lista vazia, HTML truncado, duplicatas ou item inválido resultam em rejeição e **nunca** substituem o que já está no D1. Passar do teto de 20 páginas (6.000 entradas) levanta 501 `LIST_TOO_LARGE` em vez de gravar um prefixo.

## Registro histórico — o que se acreditava em 2026-07-19, e por que estava errado

A versão anterior deste documento afirmava:

> Em 2026-07-19, `https://myanimelist.net/animelist/AMayacrab` retornou 595.422 bytes e 273 links de anime (…). A inspeção do HTML não encontrou `offset`, `page`, `ajax` ou `xhr`. Decisão atual: tratar a página como um snapshot de uma única página.

Três erros, todos confirmados em 2026-07-30:

1. **Os 273 links eram a lista truncada, não a lista.** O perfil do AMayacrab declara 360 entradas. O número foi registrado como se fosse o total, e a API serviu 273 como resposta 200 até ser corrigida — o modo de falha mais perigoso encontrado no projeto até agora, porque não havia erro nenhum.
2. **`offset` existe e funciona** como query param na URL pública. A busca por essas palavras no HTML não achou porque o JS as constrói.
3. **A conclusão de "página única" foi generalizada de um único perfil** que por acaso usava o layout clássico. O AMayacrab foi o perfil de referência do projeto inteiro, e o layout moderno — que quebrava a rota com 502 — só apareceu ao varrer usuários diferentes.

A lição prática: um perfil de referência não é amostra. Ao mexer em listas, teste ao menos um usuário de cada layout e confira a contagem contra o `totalEntries` do perfil.
