# 🇧🇷 Eleições Bot — Observatório Eleitoral para Discord

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![CI](https://github.com/realkalashnikov/eleicoes-bot/actions/workflows/ci.yml/badge.svg)
![Bun](https://img.shields.io/badge/Bun-1.4-F9F1DC?logo=bun&logoColor=black)
![discord.js](https://img.shields.io/badge/discord.js-14.x%20V2-5865F2?logo=discord&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-opcional-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue)

Bot de Discord que acompanhou **ao vivo** a apuração das eleições gerais de 2026 no Brasil (Presidente e governadores), rodando em produção durante o dia da eleição. Dados oficiais de totalização do **TSE** (`resultados.tse.jus.br`), agregador de pesquisas, alertas por assinatura e um bolão interativo com liquidação automática.

> Não é serviço oficial do TSE. Não recomenda voto. Pesquisa é estimativa e nunca é misturada com apuração — toda informação exibe fonte, registro, coleta, amostra e margem.

---

## ✨ Funcionalidades

### 🗳️ Apuração ao vivo
- **Painel único no canal** de apuração, atualizado a cada 10s (`PANEL_REFRESH`), editado no lugar — sem spam de mensagens.
- **Modo só leitura** no canal publicado: Components V2 sem botões nem menus, com **contagem regressiva nativa do Discord** (`⏱️ Próxima atualização: <t:...:R>`) entre os ciclos.
- **Painel interativo sob demanda** (`/apuracao`, `e.apuracao`): paginação de candidatos, seletor de estados, botões rápidos por cargo, mapa por estado, gráfico de evolução (QuickChart) e comparador **pesquisa × apuração** com diferença em p.p.
- **Snapshots no MongoDB** com dedupe por `generatedTime` — histórico só cresce quando o TSE publica dado novo.

### 🔔 Alertas com assinatura
- Marcos de apuração: 10/25/50/75/90/95/99%, virada de liderança, candidato eleito e conclusão.
- Escopos: nacional (Presidente) + 11 governos estaduais; entrega no canal configurado de cada servidor e **DM para assinantes** (`/alertas`, `e.alertas`).

### 🏆 Bolão interativo
- Aposta em **modal com menu dentro** (Components V2 permite): candidato + percentual final.
- Pontuação: `100 − |aposta − resultado oficial|`, uma aposta por pessoa (upsert), placar por servidor.
- **Liquidação automática** quando o TSE conclui a totalização: placar público + DM individual para cada apostador.
- Regra de fechamento configurável (`BOLAO_CLOSE_PERCENT`): por padrão, apostas abertas durante toda a apuração.

### 🔍 Observatório
- **Agregador de pesquisas** (Powers360 e similares) paginado com toggle detalhado/resumido e menus de cargo/turno.
- **Comandos de candidato** com bens/rendas/fundo partidário importados dos datasets oficiais do TSE.
- **Notícias via RSS** com backfill de 24h, dedupe e entrega por canal por servidor.
- **Linha do tempo de influência política** documentada com fontes e nível de evidência.

---

## 💬 Comandos

| Slash | Prefixo | O que faz |
|---|---|---|
| `/apuracao` | `e.apuracao` | Painel de apuração (BR por padrão; `--uf sp --cargo 3 --eleicao 6259`) |
| `/bolao` | `e.bolao` | Bolão: painel, apostar (`apostar lula 48`) e ver apostas |
| `/alertas` | `e.alertas` | Ativar/desativar/listar assinaturas de alertas |
| `/status` | `e.status` | Saúde do bot: latência TSE, urnas, Mongo, intervalos, assinaturas |
| `/pesquisa` | `e.pesquisa` | Agregador de pesquisas por cargo/turno |
| `/candidato` | `e.candidato` | Perfil com dados oficiais importados |
| `/campanha` | `e.campanha` | Finanças de campanha por categoria |
| `/noticias` | `e.noticias` | Últimas notícias das fontes configuradas |
| `/influencia` | `e.influencia` | Eventos de influência com evidência |
| `/fontes` | `e.fontes` | Fontes registradas no banco |
| `/buscar` | `e.buscar` | Busca com autocomplete entre perfis |
| `/config` | `e.config` | Canais de apuração/notícias/pesquisas/influência por servidor |

---

## 🧱 Arquitetura

```
src/
├── index.ts              # bootstrap: env validada no boot, depois o cliente
├── config.ts             # env validada por schema (zod) + constantes do ciclo eleitoral
├── domain/               # regra pura (bolão, alertas) — sem Mongo/TSE/Discord, testada isoladamente
├── discord/
│   ├── commands/         # 12 comandos (slash + prefixo compartilham a mesma camada de serviço)
│   └── events/           # ready, interações e parser de mensagens de prefixo
├── services/             # casos de uso com I/O: TSE, ciclos de alertas/painel (deps injetáveis), RSS, workers
├── menus/                # painéis Components V2, paginação e feedback
├── responders/           # roteador de interações (registro de rotas por customId)
├── database/             # conexão/models Mongoose + repos por domínio (settings, bolão, alertas, snapshots, observatório)
└── functions/utils/      # ícones de aplicação, logs silenciosos
```

- **Fonte única de verdade:** `services/electionView.ts` constrói o painel a partir do JSON oficial do TSE; a versão estática (`toStaticPanel`) deriva do mesmo payload, sem duplicação.
- **Interações à prova de acidente:** qualquer erro de interação responde como aviso ephemeral e nunca altera o painel público.
- **Testes em dois níveis:** herméticos (domínio, schema de env, ciclos com deps falsas) rodam sem Mongo nem TSE; testes de integração usam Mongo real (a CI sobe como serviço) e pulam quando `MONGO_URI` está ausente.

---

## 🚀 Como iniciar

Pré-requisitos: [Bun](https://bun.sh) e (opcional) MongoDB.

```bash
cp .env.example .env   # preencha BOT_TOKEN (e MONGO_URI, se quiser persistência)
bun install
bun dev
```

Workers separados do processo do Discord (datasets oficiais grandes):

```bash
bun run worker:tse          # baixa/extrai/importa arquivos oficiais do TSE
bun run worker:candidates   # importa candidaturas do dataset candidatos-<ano>
bun run worker:news         # ingestão de RSS
```

## ⚙️ Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `BOT_TOKEN` | — | Token do bot (**obrigatório**) |
| `PREFIX` | `e.` | Prefixo dos comandos por mensagem |
| `MONGO_URI` | — | Opcional; sem ele o bot roda com fallbacks em memória |
| `DATABASE_NAME` | `elections` | Base MongoDB |
| `GUILD_ID` / `CHANNEL_ID` | — | Fallback de servidor/canal sem banco |
| `PANEL_REFRESH` | `10` | Segundos entre atualizações do painel vivo |
| `REFRESH_INTERVAL` | `20` | Segundos entre ciclos de alertas |
| `BOLAO_CLOSE_PERCENT` | `100` | % das urnas que fecha apostas (100 = só no resultado oficial) |
| `NEWS_FEEDS` | G1, UOL, CNN, EBC, BBC, Poder360 | RSS separados por vírgula |
| `NEWS_REFRESH_INTERVAL` | `15` | Minutos entre ingestões de RSS |
| `NEWS_BACKFILL_HOURS` | `24` | Janela de backfill ao iniciar |
| `NEWS_BACKFILL_LIMIT` / `NEWS_DELIVERY_LIMIT` | `10` / `3` | Limites de importação/entrega |
| `TSE_FINANCE_YEAR` / `TSE_CANDIDATES_YEAR` | `2024` / `2026` | Anos dos datasets oficiais |
| `TSE_CATALOG_REFRESH_INTERVAL` | `720` | Minutos entre atualizações do catálogo TSE |

---

## 📚 Documentação

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas, ciclos de runtime e estratégia de testes.
- [METHODOLOGY.md](METHODOLOGY.md) — metodologia de coleta e análise.
- [SOURCES.md](SOURCES.md) — fontes de dados e notícias.
- [SECURITY.md](SECURITY.md) — política de segurança.
- [CONTRIBUTING.md](CONTRIBUTING.md) — como contribuir.

## 📄 Licença

AGPL-3.0 — veja [LICENSE](LICENSE). Base inicial sobre a template `@constatic/base`.
