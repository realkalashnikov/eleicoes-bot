import {
  brBuilder,
  createContainer,
  createRow,
  Separator,
} from "@magicyan/discord";
import {
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { CONFIG } from "../config.js";
import { ElectionSummary, createProgressBar } from "../services/tse.js";
import { buildInsightsRow } from "../services/electionInsights.js";
import { icon } from "../functions/utils/icon.js";
import { paginator } from "./paginator.js";

const CANDIDATES_PER_PAGE = 5;

export function buildElectionPanel<R = any>(
  summary: ElectionSummary,
  currentUf = "br",
  currentCargo = "1",
  currentElection = CONFIG.FED_ELECTION,
  notice?: string,
  page = 0,
): R {
  const isPresident = currentCargo === "1";
  const round = summary.round;
  const scopeLabel = currentUf.toLowerCase() === "zz" ? "Exterior" : summary.uf;
  const turnLabel = `${round}º TURNO`;
  const fetchedAt = new Date(summary.fetchedAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const electionOpensAt = new Date("2026-10-25T08:00:00-03:00").getTime();
  const remainingMs = electionOpensAt - Date.now();
  const countdown =
    remainingMs > 0
      ? ` • **Abertura das urnas em:** \`${Math.floor(remainingMs / 3_600_000)}h ${Math.floor((remainingMs % 3_600_000) / 60_000)}m\``
      : "";
  const awaitingResults = !summary.isComplete && summary.totalVotes === 0;
  const statusBadge = summary.isComplete
    ? `${icon.check} **TOTALIZAÇÃO CONCLUÍDA**`
    : awaitingResults && remainingMs > 0
      ? `🕒 **URNAS AINDA NÃO ABRIRAM**${countdown}`
      : awaitingResults
        ? "🕒 **AGUARDANDO PRIMEIROS DADOS DE APURAÇÃO**"
        : `⏳ **APURAÇÃO EM ANDAMENTO**`;

  const headerLines = [
    `## ${isPresident ? icon.brazil_flag : ""} ELEIÇÕES 2026 — ${turnLabel} • APURAÇÃO`,
    `> **Cargo:** \`${summary.cargoName.toUpperCase()}\` • **Abrangência:** \`${scopeLabel}\``,
    `> **Totalização de Urnas:** **${summary.totalizedPercent}%** (\`${summary.totalizedSections.toLocaleString("pt-BR")}\` de \`${summary.totalSections.toLocaleString("pt-BR")}\` seções)`,
    `> **Situação:** ${statusBadge}${summary.stale ? " • ⚠️ DADO EM CACHE — TSE indisponível" : ""}`,
    `> **Último dado TSE:** \`${summary.generatedDate || "não informado"} ${summary.generatedTime || ""}\` • **Consultado:** \`${fetchedAt}\``,
    `> **Fonte:** [TSE](${summary.sourceUrl})`,
    ...(notice ? [`> ℹ️ ${notice}`] : []),
  ];

  // Candidatos
  const pages = Math.max(
    1,
    Math.ceil(summary.candidates.length / CANDIDATES_PER_PAGE),
  );
  const safePage = Math.max(0, Math.min(page, pages - 1));
  const offset = safePage * CANDIDATES_PER_PAGE;
  const topCandidates = summary.candidates.slice(
    offset,
    offset + CANDIDATES_PER_PAGE,
  );
  const candidatesLines: string[] = [];

  for (let j = 0; j < topCandidates.length; j++) {
    const i = offset + j;
    const cand = topCandidates[j];
    const rankIcon =
      i === 0
        ? `${icon.rank_1st}`
        : i === 1
          ? `${icon.rank_2nd}`
          : i === 2
            ? `${icon.rank_3rd}`
            : `\`${i + 1}º\``;

    const bar = createProgressBar(cand.percentage, 10);
    const badge = cand.isElected
      ? ` ${icon.crown} **ELEITO**`
      : cand.status
        ? ` **[${cand.status}]**`
        : "";

    candidatesLines.push(
      `${rankIcon} **${cand.ballotName}** (${cand.party}) — **${cand.percentageStr}%**${badge}`,
      `> ${bar} • \`${cand.votesFormatted}\` votos${
        cand.runningMate ? ` • *Vice: ${cand.runningMate}*` : ""
      }`,
    );
  }

  if (candidatesLines.length === 0) {
    candidatesLines.push(
      "> *Nenhum voto computado até o momento para este pleito.*",
    );
  }

  // Estatísticas gerais
  const statsLines = [
    `### ${icon.chart_bar} Estatísticas de Votação`,
    `> **Total de Votos:** \`${summary.totalVotesFormatted}\``,
    `> **Votos Válidos:** \`${summary.validVotesFormatted}\` (${summary.validPercent}%)`,
    `> **Brancos:** \`${summary.blankVotes.toLocaleString("pt-BR")}\` (${summary.blankPercent}%) • **Nulos:** \`${summary.nullVotes.toLocaleString("pt-BR")}\` (${summary.nullPercent}%)`,
    `> **Comparecimento:** \`${summary.turnoutPercent}%\` • **Abstenções:** \`${summary.abstentionPercent}%\``,
  ];

  // Select menu para alternar entre Presidente e Estados
  const selectMenu = new StringSelectMenuBuilder({
    customId: "election:select_view",
    placeholder: "Selecionar outro cargo / estado...",
  });

  const isSecondRound =
    currentElection === "6258" || currentElection === "6260";
  const hasStateSecondRound = (_uf: string) =>
    summary.candidates.some((candidate) =>
      candidate.status.toLowerCase().includes("2º turno"),
    );
  const turnOptions: {
    uf: string;
    name: string;
    cargo: string;
    election: string;
  }[] = CONFIG.UFS.map((item) => ({
    ...item,
    election:
      item.uf === "br"
        ? isSecondRound
          ? "6258"
          : "6257"
        : isSecondRound && hasStateSecondRound(item.uf)
          ? "6260"
          : "6259",
  }));
  turnOptions.push({
    uf: "zz",
    name: `Exterior — Presidente (${round}º turno)`,
    cargo: "1",
    election: isSecondRound ? "6258" : "6257",
  });
  if (round === 2) {
  }
  for (const item of turnOptions) {
    const isSelected =
      item.uf === currentUf.toLowerCase() &&
      item.cargo === currentCargo &&
      item.election === currentElection;
    const opt = new StringSelectMenuOptionBuilder({
      label: item.name,
      value: `${item.uf}:${item.cargo}:${item.election}`,
      default: isSelected,
      description: `Consultar apuração para ${item.name}`,
    });

    if (item.uf === "br") opt.setEmoji(icon.brazil_flag.toJSON());
    else if (item.uf === "zz") opt.setEmoji(icon.globe.toJSON());
    else opt.setEmoji(icon.building.toJSON());

    selectMenu.addOptions(opt);
  }

  const turnSelect = new StringSelectMenuBuilder({
    customId: `election:select_turn:${currentUf}:${currentCargo}`,
    placeholder: "Selecionar turno...",
    options: CONFIG.ELECTION_TURNS.map((turn) => ({
      label: `${turn.round}º turno`,
      value: String(turn.round),
      default: turn.round === (currentElection === "6259" ? 1 : round),
      description:
        turn.round === 1
          ? "Resultado preservado do primeiro turno"
          : "Apuração do segundo turno",
    })),
  });

  // Botões de ação rápida
  const refreshBtn = new ButtonBuilder({
    customId: `election:refresh:${currentUf}:${currentCargo}:${currentElection}`,
    label: "Atualizar Dados",
    style: ButtonStyle.Success,
  }).setEmoji(icon.refresh.toJSON());

  const pollsBtn = new ButtonBuilder({
    customId: `election:polls:${isPresident ? "presidente" : "governador"}:${round}`,
    label: "Pesquisas registradas",
    style: ButtonStyle.Secondary,
  }).setEmoji(icon.chart_bar.toJSON());

  const presBtn = new ButtonBuilder({
    customId: `election:quick:br:1:${isSecondRound ? "6258" : "6257"}`,
    label: `Presidente • ${round}º turno`,
    style: currentUf === "br" ? ButtonStyle.Primary : ButtonStyle.Secondary,
    disabled: currentUf === "br" && currentCargo === "1",
  }).setEmoji(icon.brazil_flag.toJSON());

  const spBtn = new ButtonBuilder({
    customId: `election:quick:sp:3:${isSecondRound ? "6260" : "6259"}`,
    label: "Gov. SP",
    style: currentUf === "sp" ? ButtonStyle.Primary : ButtonStyle.Secondary,
    disabled:
      currentUf === "sp" &&
      currentElection === (isSecondRound ? "6260" : "6259"),
  }).setEmoji(icon.building.toJSON());

  const rjBtn = new ButtonBuilder({
    customId: `election:quick:rj:3:${isSecondRound ? "6260" : "6259"}`,
    label: "Gov. RJ",
    style: currentUf === "rj" ? ButtonStyle.Primary : ButtonStyle.Secondary,
    disabled:
      currentUf === "rj" &&
      currentElection === (isSecondRound ? "6260" : "6259"),
  }).setEmoji(icon.building.toJSON());

  const mgBtn = new ButtonBuilder({
    customId: `election:quick:mg:3:${isSecondRound ? "6260" : "6259"}`,
    label: "Gov. MG",
    style: currentUf === "mg" ? ButtonStyle.Primary : ButtonStyle.Secondary,
    disabled:
      currentUf === "mg" &&
      currentElection === (isSecondRound ? "6260" : "6259"),
  }).setEmoji(icon.building.toJSON());

  const containerColor = summary.isComplete
    ? CONFIG.COLORS.BRAZIL_YELLOW
    : isPresident
      ? CONFIG.COLORS.BRAZIL_GREEN
      : CONFIG.COLORS.BRAZIL_BLUE;

  const pageRow = paginator(
    `election:page:${currentUf}:${currentCargo}:${currentElection}`,
    safePage,
    pages,
  );

  const container = createContainer(
    containerColor,
    brBuilder(...headerLines),
    Separator.Default,
    brBuilder(...candidatesLines),
    ...(pageRow ? [pageRow] : []),
    Separator.Default,
    brBuilder(...statsLines),
    Separator.Default,
    createRow(selectMenu),
    createRow(turnSelect),
    createRow(refreshBtn, pollsBtn),
    buildInsightsRow(currentUf, currentCargo, currentElection),
    createRow(presBtn, spBtn, rjBtn, mgBtn),
  );

  return {
    flags: ["IsComponentsV2"],
    components: [container],
  } as R;
}
