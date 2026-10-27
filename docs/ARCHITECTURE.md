# Arquitetura

Visão rápida para quem lê o código pela primeira vez. O bot acompanhou a apuração ao vivo das eleições de 2026 (dia da eleição em produção); este documento descreve como ele é organizado hoje.

## Camadas e direção de dependência

```
discord/  ──▶  services/  ──▶  domain/          (regra pura)
   │              │  ──▶  database/repos/       (Mongoose)
   └──────────────────────▶  menus/             (visual Components V2)
```

- **`domain/`** — regra de negócio pura: placar e regras do bolão, marcos de alerta. Zero I/O: nenhuma chamada de rede, Mongo ou Discord. Os tipos externos entram por `import type` e somem em runtime.
- **`services/`** — casos de uso com I/O: cliente do TSE (`tse.ts`), ciclo de alertas (`electionAlerts.ts`), ciclo do painel vivo (`livePanel.ts`), publicação (`publishing.ts`), RSS, workers. Os ciclos recebem dependências por parâmetro (`AlertDeps`, `LivePanelDeps`) com fábrica default (`createAlertDeps`, `createLivePanelDeps`) — o mesmo código roda em produção e em teste com fakes.
- **`database/`** — `models.ts` (schemas, índices, conexão) e `repos/` (consultas por domínio: settings, bolão, alertas, snapshots, observatório). Sem Mongo configurado, os repos voltam com fallbacks em memória em vez de quebrar.
- **`discord/`** — comandos (slash + prefixo compartilham a camada de serviço) e eventos.
- **`menus/`** — construção visual (Containers, TextDisplay, botões, menus). Nada de regra aqui.
- **`responders/`** — roteador de interações: registro de `{ pattern, handle }` por `customId`. Um controle novo é uma rota nova; ids desconhecidos são ignorados.

Regra implícita: **nada em `domain/` importa de fora**; `discord/` e `menus/` não falam com o banco direto — passam por `services/`.

## Os dois ciclos de runtime

```
clientReady
  ├── startLiveElectionPanel ── a cada PANEL_REFRESH_MS (10s)
  │     1ª volta: publica o painel no fim do canal (delete + resend)
  │     voltas seguintes: edita a mesma mensagem no lugar
  │     painel estático: sem botões, com ⏱️ <t:...:R> da próxima atualização
  └── startElectionAlerts ──── a cada REFRESH_INTERVAL_MS (20s)
        compara resumo novo × último (marcos, virada, eleito, conclusão)
        entrega no canal de cada servidor + DM de assinantes
        quando o TSE conclui: liquida o bolão uma única vez (isSettled/markSettled)
```

- **Fonte única de verdade:** `electionView.ts` monta o painel a partir do JSON oficial do TSE; `toStaticPanel` deriva dele (normaliza builders via `toJSON()` profundo antes do strip — instância V2 espalhada com spread perde o `type` e quebra o Discord com `50035 TAG_FIELD_MISSING`; bug real corrigido em produção).
- **À prova de acidente:** erro em qualquer interação vira aviso ephemeral; o painel público nunca é alterado por falha de navegação.
- **Snapshots** no Mongo com dedupe por `generatedTime` + `totalizedSections`: histórico só cresce com dado novo do TSE.

## Configuração e boot

- `config.ts` valida o env com schema zod no load (coerção, faixas e defaults com erro agregado).
- `assertRuntimeEnv()` roda em `index.ts` **antes** do login: falha o processo com mensagem clara se `BOT_TOKEN` estiver ausente ou `MONGO_URI`/`GUILD_ID`/`CHANNEL_ID` malformados.
- O bolão fica aberto por padrão até a totalização oficial (`BOLAO_CLOSE_PERCENT=100`); o corte configurável cobre eleições futuras.

## Testes

| Nível | Onde | Precisa de |
|---|---|---|
| Hermético | `config.test.ts`, `domain/domain.test.ts`, `services/{alertsCycle,panelCycle}.test.ts` | nada (deps falsas, canal/mensagens fake) |
| Integração | painéis, interações, observatório, bolão | MongoDB (`MONGO_URI`); pulam sem ele |
| Live (opcional) | payloads reais do TSE | rede pública do TSE |

A CI (`ci.yml`) sobe MongoDB como serviço e roda `tsc` + os testes em cada push/PR — nenhum segredo é necessário.
