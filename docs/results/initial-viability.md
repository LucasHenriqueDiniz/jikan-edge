# Viabilidade inicial

## Ambiente publicado

- Worker: `https://jikanv2.lucas-hdo.workers.dev`
- D1: `jikanv2`, migration `0001_initial.sql` aplicada remotamente.
- R2: `jikanv2-snapshots`, configurado e sem snapshots automáticos no milestone.

## Evidência do vertical slice

- `/health` respondeu 200 no Worker publicado.
- Perfil público de validação respondeu 200, persistiu no D1 e a segunda leitura foi cache hit.
- Estatísticas, anime list e manga list responderam a partir do mesmo slice; as listas foram persistidas e paginadas pelo D1.
- Observabilidade da Cloudflare registrou uma leitura de perfil publicada com `cpuTime: 6 ms`, abaixo da margem provisória de 8 ms. Isso é uma medição pontual, não p95.
- Benchmark local da fixture do perfil: p95 abaixo de 1 ms nas execuções do milestone. Ele isola o parser e não substitui o benchmark de corpus real.

Campos a ampliar no próximo ciclo: p50/p95 por corpus, cache hit rate agregado, leituras/escritas D1, latência upstream, falha/403/429, tamanho de documento e taxa de resposta suspeita.

Risco conhecido: o HTML de listas é público porém sujeito a mudanças de markup; a API não considera um `200` suficiente e não substitui cache válido com documento suspeito.
