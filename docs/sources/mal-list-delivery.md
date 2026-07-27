# Entrega de listas pelo MAL

Em 2026-07-19, `https://myanimelist.net/animelist/AMayacrab` retornou 595.422 bytes e 273 links de anime; a manga list retornou 509.234 bytes e 227 links. A inspeção do HTML não encontrou `offset`, `page`, `ajax` ou `xhr`.

Decisão atual: tratar a página como um snapshot de uma única página apenas quando o parser encontra cards válidos, IDs únicos e marcador terminal `</html>`. Lista vazia, HTML truncado, duplicatas ou itens inválidos resultam em snapshot rejeitado e nunca substituem D1. Não há dependência de endpoint interno/XHR. Isso é evidência para um perfil médio, não prova universal; corpus grande/muito grande permanece pendente.
