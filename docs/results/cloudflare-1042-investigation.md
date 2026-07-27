# Investigação Cloudflare 1042/404

Estado: **not reproduced**.

Após publicar `a4d5243b-38d3-4046-a3bf-1aeeeab9b678`, foram feitas cinco chamadas controladas, com um segundo entre elas, ao health, perfil, estatísticas, anime list e manga list de `AMayacrab`. Todas retornaram 200, request ID da aplicação, cache `hit` (exceto health) e CF-Ray no colo POA. Não houve 1042 nem 404.

Os headers retornaram ainda `x-worker-version: 21d161a6-1a5e-400c-a823-7b4cbac00243`, apesar da nova configuração declarar `jikan-edge-2026-07-19`. Isso indica que a amostra ocorreu durante propagação/edge cache de release/configuração; não é evidência de execução do código novo. As respostas possuem request ID, portanto entraram na aplicação.

O Worker não faz fetch para `workers.dev` nem Worker-to-Worker. A documentação da Cloudflare associa 1042 a fetch Worker-to-Worker sem a flag adequada, hipótese não confirmada pelo código ou pela amostra. Sem `wrangler tail`/trace correlacionado no instante de um erro, a origem é **não determinada**. Mitigação: manter chamadas espaçadas, request/version/cache headers e coletar Tail se o erro reaparecer; não há correção de código segura a aplicar sem reprodução.
