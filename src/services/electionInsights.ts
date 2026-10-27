import { createMediaGallery, brBuilder, createContainer, createRow, Separator } from "@magicyan/discord";
import { ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config.js";
import { listSnapshots } from "../database/index.js";
import { icon } from "../functions/utils/icon.js";
import { fetchElectionResults, type ElectionSummary } from "./tse.js";
import { pollCatalog } from "./observatory.js";

const STATE_UFS = ["ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to"];

const chartPercent = (value: unknown): number => typeof value === "number" ? value : Number(String(value ?? "0").replace(",", ".")) || 0;
const mapDate = (value: unknown) => new Date(value as string).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

export async function getStatesMapPanel(_client: unknown, round = 2): Promise<any> {
  const results = new Map<string, ElectionSummary | null>();
  for (let i = 0; i < STATE_UFS.length; i += 6) {
    await Promise.all(STATE_UFS.slice(i, i + 6).map(async uf =>
      results.set(uf, await fetchElectionResults(uf, "1", CONFIG.ELECTION_TURNS[round - 1].federal).catch(() => null))));
  }
  const lines = STATE_UFS.map(uf => {
    const summary = results.get(uf);
    if (!summary) return `\`${uf.toUpperCase()}\` ⚠️ fonte indisponível`;
    if (!summary.totalVotes) return `\`${uf.toUpperCase()}\` 🕒 aguardando primeiros dados (${summary.totalizedPercent}% apurado)`;
    const [top, second] = summary.candidates;
    const elected = top?.isElected ? "👑" : "";
    return `\`${uf.toUpperCase()}\`${elected} **${top?.ballotName}** ${top?.percentageStr}% • **${second?.ballotName}** ${second?.percentageStr}% (${summary.totalizedPercent}% apurado)`;
  });
  const leaders = new Map<string, number>();
  for (const uf of STATE_UFS) {
    const winner = results.get(uf)?.candidates[0];
    if (winner?.isElected || winner?.percentageStr) leaders.set(winner?.isElected ? `${winner.ballotName} ELEITO` : winner!.ballotName, (leaders.get(winner!.ballotName) ?? 0) + 1);
  }
  const podium = [...leaders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([name, count], index) => `${index + 1}. ${name} — líder em ${count} UF(s)`).join("\n");
  const body = brBuilder(
    `## ${icon.globe} Mapa por estado — Presidente • ${round}º turno`,
    podium ? `> **Quem lidera onde:**\n${podium}` : "",
    lines.join("\n"),
  );
  return {
    flags: ["IsComponentsV2"],
    components: [createContainer(0x002776, body, Separator.Default, brBuilder(`> Fonte: TSE (${CONFIG.CYCLE}). Percentuais oficiais de totalização.`))],
  };
}

function chartUrl(labels: string[], seriesA: number[], seriesB: number[], nameA: string, nameB: string, votesA: number, votesB: number) {
  const chart = {
    type: "line", options: { legend: { display: true, position: "bottom" }, title: { display: true, text: "Apuração — % dos votos válidos" } },
    data: {
      labels,
      datasets: [
        { label: `${nameA} — ${votesA} votos`, data: seriesA, borderColor: "#1F6FEB", backgroundColor: "#1F6FEB22", fill: true, lineTension: 0.2, borderWidth: 2 },
        { label: `${nameB} — ${votesB} votos`, data: seriesB, borderColor: "#E74C3C", backgroundColor: "#E74C3C22", fill: true, lineTension: 0.2, borderWidth: 2 },
      ] },
  };
  return `https://quickchart.io/chart?w=900&h=480&devicePixelRatio=2&bkg=2b2d31&c=${encodeURIComponent(JSON.stringify(chart))}`;
}

export async function getEvolutionPanel(uf = "br", cargo = "1", election = CONFIG.FED_ELECTION, round = 2): Promise<any> {
  const history = await listSnapshots(election, uf, cargo, 200);
  if (history.length < 2) {
    return createContainer(0x2B2D31, brBuilder(
      `## ${icon.chart_bar} Evolução da apuração`,
      `> Histórico insuficiente (${history.length} capturado(s)). Os snapshots são gravados a cada atualização do bot.`,
      "> Voltando em instantes, veja mais dados acumulados.",
    ));
  }
  const top = [...history.at(-1)!.candidates].sort((a: any, b: any) => b.votes - a.votes).slice(0, 2);
  const latest = top;
  const labels = history.map(item => mapDate(item.fetchedAt));
  const series = (match: (candidate: any) => boolean) => history.map(item => chartPercent(item.candidates.find(match)?.percentage));
  const url = chartUrl(labels, series(c => c.name === latest[0].name), series(c => c.name === latest[1].name), latest[0].ballotName, latest[1].ballotName, latest[0].votes, latest[1].votes);
  const header = brBuilder(
    `## ${icon.chart_bar} Evolução da apuração — ${top[0].ballotName} x ${top[1].ballotName}`,
    `> ${history.length} capturas do TSE, de ${mapDate(history[0].fetchedAt)} a ${mapDate(history.at(-1)!.fetchedAt)} (Brasília).`,
    `> Fonte: snapshots oficiais do TSE gravados pelo bot. Não é projeção.`,
  );
  return createContainer(0x5865F2, header, createMediaGallery(url));
}

export function buildInsightsRow(uf: string, cargo: string, election: string): any {
  return createRow(
    new ButtonBuilder({ customId: `election:map:${uf}:${cargo}`, label: "Mapa por estado", style: ButtonStyle.Primary }).setEmoji(icon.globe.toJSON()),
    new ButtonBuilder({ customId: `election:chart:${uf}:${cargo}:${election}`, label: "Evolução", style: ButtonStyle.Secondary }).setEmoji(icon.chart_bar.toJSON()),
  );
}

export async function getComparePanel(): Promise<any> {
  const election = await fetchElectionResults("br", "1", CONFIG.FED_ELECTION).catch(() => null);
  const items = pollCatalog();
  const comparable = items.filter(item => item.candidates?.[0]?.validVotes != null);
  if (!election || !comparable.length) return createContainer(0x2B2D31, brBuilder("## Pesquisa x Apuração", "> Dados indisponíveis agora; tente em instantes."));
  const average = comparable.reduce((sum, item) => sum + Number(item.candidates[0].validVotes), 0) / comparable.length;
  const byElection = new Map(election.candidates.map((cand: any) => [cand.ballotName, cand]));
  const topTwoName = (name: string) => [...byElection.values()].find((cand: any) => cand.ballotName.toLowerCase().includes(name.slice(0, 6).toLowerCase()));
  const pollAvgForList = (name: string) => {
    const match = topTwoName(name);
    return match ? average : 100 - average;
  };
  const pollLine = (name: string) => {
    const cand = topTwoName(name);
    if (!cand) return null;
    const pollAvg = pollAvgForList(name).toFixed(1).replace(".", ",");
    const diff = (Number(pollAvg.replace(",", ".")) - Number(cand.percentage)).toFixed(1).replace(".", ",");
    const sign = Number(diff.replace(",", ".")) > 0 ? "+" : "";
    return `> **${cand.ballotName}** • pesquisa: \`${pollAvg}%\` • apuração: \`${cand.percentageStr}%\` • diferença: \`${sign}${diff} p.p.\``;
  };
  const lines = ["flávio", "lula"].map(name => pollLine(name)).filter(Boolean) as string[];
  const consulted = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return createContainer(0x009C3B, brBuilder(
    `## Pesquisa x Apuração — ${election.cargoName} • ${election.round}º turno`,
    lines.join("\n"),
    `> ${election.totalizedPercent}% das urnas apuradas (fonte: TSE, consultado às ${consulted}).`,
    "> Comparação direta, sem ajuste. Pesquisa é estimativa; apuração é resultado oficial."),
  );
}
