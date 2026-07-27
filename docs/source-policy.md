# Política de fonte

Somente `https://myanimelist.net` via HTTPS é permitido. URLs são centralizadas em `src/source/mal-urls.ts`; nunca vêm do cliente. O cliente usa timeout, tamanho máximo, content-type, marcadores obrigatórios e user-agent configurável.

Login, CAPTCHA, challenge, rate limit, HTML vazio, redirect genérico e documento sem estrutura essencial são respostas suspeitas. Elas não sobrescrevem conteúdo D1 já válido. Não há varredura massiva, browser headless ou endpoint interno.
