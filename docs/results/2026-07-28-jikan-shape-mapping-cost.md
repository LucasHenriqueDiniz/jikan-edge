# Custo da conversão para o shape Jikan v4 (2026-07-28)

Medição do que a conversão do `/v1` para o shape do Jikan adicionou na borda HTTP. A pergunta
era se o p95 de **7ms / 27ms** registrado em produção em
[`2026-07-26-catalog-corpus-benchmark.md`](./2026-07-26-catalog-corpus-benchmark.md) sairia do
lugar.

**Resposta curta: não.** No pior caso possível a conversão adiciona ~0,3ms sobre um p95 de 27ms.
O que cresce de verdade é o tamanho da resposta, e é dele que vem quase todo o acréscimo.

## O que foi medido

`tests/benchmarks/jikan-mapping.test.ts` (`npm run benchmark`). Cada caso compara o caminho
antigo (`JSON.stringify` do objeto de domínio) com o novo (mapeador + `JSON.stringify`), 200
amostras cada, com warm-up de 20 iterações para o V8 estabilizar a shape do objeto.

O acréscimo aparece em 100% dos casos, e isso é esperado **por construção**: o caminho novo faz
tudo o que o antigo fazia mais duas coisas (construir o objeto Jikan, serializar um objeto
maior). A pergunta útil não é se subiu, é quanto — e de qual das duas parcelas.

Duas ressalvas antes dos números:

1. São números de Node no container do CI, **não** cpuTime de Workers. Os 7ms/27ms de produção
   vieram de `wrangler tail`. O que transfere daqui é a **ordem de grandeza do acréscimo** e o
   crescimento de bytes, não o valor absoluto.
2. **O piso de ruído deste ambiente é da ordem de ±0,05ms.** Medido: serializar o mesmo objeto
   de domínio deu 0,008ms numa execução e 0,064ms em outra — 8× de variação para código
   idêntico, só por ordem de execução e JIT. Em algumas rodadas o objeto *mapeado* (maior)
   chegou a serializar mais rápido que o de domínio, o que é impossível e denuncia o artefato.

| Caso | p95 antes → depois | Δ p95 | Bytes antes → depois |
| --- | --- | --- | --- |
| `anime-detail` | 0,008 → 0,020ms | *abaixo do ruído* | 1.683 → 2.667 (+58%) |
| `manga-detail` | 0,005 → 0,017ms | *abaixo do ruído* | 1.322 → 2.096 (+59%) |
| `top-anime-list` | 0,001 → 0,006ms | *abaixo do ruído* | 466 → 1.453 (+212%) |
| `user-list-300` | 0,251 → 0,524ms | **+0,27ms** | 120.467 → 149.759 (+24%) |

As três primeiras linhas **não devem ser lidas como medição de tempo**. Os deltas (+0,011ms,
+0,012ms, +0,004ms) são menores que a variação do próprio ambiente; a coluna de bytes é o que
tem significado nessas linhas. A conclusão honesta para rotas de detalhe é "o acréscimo é
pequeno demais para este instrumento medir", não um número com três casas decimais.

`user-list-300` é o único caso com sinal acima do ruído — e é o pior caso possível: 300 é o teto
documentado de `limit`, então nenhuma rota produz payload mais largo. Repetido em 3 rodadas, o
Δ p95 ficou entre 0,19ms e 0,41ms.

## De onde vem o acréscimo

O teste `attributes the added cost between mapper and serialization` separa as duas parcelas,
cada uma com warm-up próprio, sobre a lista de 300. Mediana de 3 rodadas:

| Parcela | p95 |
| --- | --- |
| `stringify` do objeto de domínio (custo que já se pagava) | ~0,22ms |
| **mapeador** (construir o objeto Jikan) | **~0,056ms** |
| `stringify` do objeto mapeado | ~0,50ms |

Acréscimo = 0,056 (mapeador) + 0,28 (serialização extra) ≈ **0,34ms**, consistente com os
0,19–0,41ms medidos ponta-a-ponta — os dois métodos fecham, o que dá confiança no valor.

**~80% do custo é serializar o payload maior, não construir o objeto.** Os mapeadores explícitos
são baratos: um literal de objeto por item, shape monomórfica, exatamente o que o V8 otimiza bem.
Isso define qual alavanca puxar se um dia precisar (ver abaixo) — mexer nos mapeadores não
renderia quase nada.

Só a divisão da lista de 300 está registrada porque, nas rotas de detalhe (~10µs), a divisão
também cai abaixo do piso de ruído e não é legível.

## Crescimento de bytes

O percentual maior (`top-anime-list`, +212%) é o menos relevante em absoluto: entradas de
ranking são compactas, então virar `images` (objeto de 6 chaves), `titles[]`, `aired` e
`broadcast` triplica um payload de 466 bytes. Em números que importam, a lista de 300 entradas
cresceu 24%, ~29KB.

Se algum dia isso pesar — em egresso **ou** em CPU, já que é a serialização que domina — a
alavanca é remover o bloco `images.webp` (hoje três `null`, porque o MAL dá uma URL por
entidade). Não foi feito: a chave presente é o que permite um cliente Jikan fazer
`images.webp.image_url` sem lançar, e 29KB não justifica quebrar isso.

## Conclusão

Mesmo assumindo que o CPU do Worker seja algumas vezes mais lento que este container, o pior
caso continua abaixo de ~1,5ms contra um p95 de 27ms — folga de mais de uma ordem de grandeza
até o teto de 30s do plano pago. **Nenhuma ação de otimização é necessária.**

## Parsers

Cinco parsers subiram de versão nesta mudança (`anchorRefs` captura href além do texto). O
benchmark de parsers foi rodado em worktree no commit anterior e no HEAD, 3 rodadas cada:

| Parser | p95 base (mediana de 3) | p95 head (mediana de 3) |
| --- | --- | --- |
| `anime-detail` | 0,469ms | 0,414ms |
| `manga-detail` | 0,273ms | 0,199ms |
| `club-detail` | 0,095ms | 0,070ms |
| `top-manga` (**não alterado**) | 0,088ms | 0,072ms |

O head aparece mais rápido em todos — inclusive em `top-manga`, que esta mudança não tocou.
Isso é artefato de máquina/ordem de execução, não ganho real. A leitura correta é que o custo
extra do `anchorRefs` está **abaixo do piso de ruído** (~±0,05ms) do ambiente. Sem regressão.

## Follow-up ainda em aberto

Continua valendo remedir em produção com `wrangler tail` depois do deploy, para confirmar contra
cpuTime real em vez de Node — e porque o refresh forçado pelos 5 bumps de versão de parser vai
gerar uma janela de misses maior que o normal logo após publicar.
