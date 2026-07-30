# Desenvolvimento local

1. Instale dependências com `npm install`.
2. Para rodar em **outra conta** Cloudflare, siga [`self-hosting.md`](self-hosting.md) — `npm run setup` cria o D1 e escreve o id no `wrangler.jsonc`. A configuração commitada aponta para os recursos deste milestone; não há mais bucket R2 a criar.
3. Rode `npm run db:migrate:local`. `npm run dev` inicia preview local com bindings remotas, recomendado para validar o fetch do MAL; `npm run dev:local` usa o simulador apenas para saúde e D1 local.

O desenvolvimento local cria estado D1 no diretório `.wrangler`. Não use `load.json`: o milestone usa apenas páginas HTML públicas. Para uma validação manual, use `/v1/users/AMayacrab` sem transformar esse nome em configuração ou dado hard-coded.
