# Contribuindo

## Regras de dados

1. Fonte primária vence fonte secundária.
2. Todo dado factual inclui URL, data e órgão/veículo.
3. Não classifique pré-candidatura como candidatura oficial.
4. Não trate correlação como causalidade.
5. Não suba `.env`, token, banco local, ZIP ou CSV do TSE.
6. Menus em `src/menus/` são síncronos e puros. I/O fica em comando, responder, serviço ou worker.
7. Toda resposta Discord usa `IsComponentsV2`; não usar `content` no mesmo payload.

## Checagem

```bash
bun run check
bun run test
```
