import { CONFIG } from "../config.js";
import { listBolaoBets, setBolaoBet } from "../database/index.js";
import { fetchElectionResults, type ElectionSummary } from "./tse.js";

export const BOLAO_CANDIDATES = ["Flávio Bolsonaro", "Lula"] as const;
export type BolaoCandidate = (typeof BOLAO_CANDIDATES)[number];

/** Score = 100 − deviation p.p., capped at 0; winner bets must hit exact candidate. */
export function scoreBets(
  bets: { userId: string; userName?: string; candidateName: string; betPercent: number }[],
  actuals: { name: string; percent: number }[],
): { userId: string; userName: string; score: number; betPercent: number; candidateName: string; actualPercent: number }[] {
  return bets.map(bet => {
    const actual = actuals.find(item => item.name.toLowerCase() === bet.candidateName.toLowerCase());
    const deviation = actual ? Math.abs(bet.betPercent - actual.percent) : 100;
    return {
      userId: bet.userId,
      userName: bet.userName || `<@${bet.userId}>`,
      score: Math.max(0, Math.round((100 - deviation) * 10) / 10),
      betPercent: bet.betPercent,
      candidateName: bet.candidateName,
      actualPercent: actual?.percent ?? NaN,
    };
  }).sort((a, b) => b.score - a.score);
}

export async function placeBolaoBet(bet: { userId: string; userName?: string; guildId?: string; candidateName: string; betPercent: number }, liveCheck?: ElectionSummary | null): Promise<void> {
  if (!BOLAO_CANDIDATES.includes(bet.candidateName as BolaoCandidate)) throw new Error("Candidato fora do bolão.");
  if (!Number.isFinite(bet.betPercent) || bet.betPercent < 0 || bet.betPercent > 100) throw new Error("Percentual fora do intervalo (0–100).");
  const live = liveCheck === undefined ? await fetchElectionResults("br", "1", CONFIG.FED_ELECTION).catch(() => null) : liveCheck;
  if (bolaoClosed(live)) {
    throw new Error(live?.isComplete
      ? "Bolão encerrado: a apuração foi concluída."
      : `Bolão fechado: a apuração já passou de ${CONFIG.BOLAO_CLOSE_PERCENT}% das urnas.`);
  }
  await setBolaoBet(bet);
}

export async function bolaoBoard(guildId?: string): Promise<string> {
  const bets = await listBolaoBets(guildId);
  if (!bets.length) return "";
  return bets.map((bet, index) => `${index + 1}. **${bet.userName || `<@${bet.userId}>`}** — **${bet.candidateName}** \`${Number(bet.betPercent).toFixed(1).replace(".", ",")}%\``).join("\n");
}

const stat = (value: number) => value.toFixed(1).replace(".", ",") + "%";

const bolaoClosed = (live: ElectionSummary | null) =>
  Boolean(live && (live.isComplete || Number(String(live.totalizedPercent).replace(",", ".")) >= CONFIG.BOLAO_CLOSE_PERCENT));

const bolaoClosedLabel = CONFIG.BOLAO_CLOSE_PERCENT >= 100
  ? " • bolão fechado (apuração concluída)"
  : ` • bolão fechado (corte: ${CONFIG.BOLAO_CLOSE_PERCENT}% das urnas)`;
const bolaoOpenLabel = CONFIG.BOLAO_CLOSE_PERCENT >= 100
  ? " • bolão aberto até o resultado oficial"
  : ` • bolão aberto até ${CONFIG.BOLAO_CLOSE_PERCENT}% das urnas`;

export async function bolaoOverview(guildId?: string, userId?: string) {
  const bets = await listBolaoBets(guildId);
  const live = await fetchElectionResults("br", "1", CONFIG.FED_ELECTION).catch(() => null);
  const closed = bolaoClosed(live);
  const mine = userId ? bets.find(bet => bet.userId === userId) : null;
  const stats = [
    `> **Apostas:** ${bets.length} registrada(s)${guildId ? " neste servidor" : ""}`,
    mine ? `> **Sua aposta:** ${mine.candidateName} \`${Number(mine.betPercent).toFixed(1).replace(".", ",")}%\`` : "> **Sua aposta:** nenhuma ainda — é só clicar em **Apostar agora**",
    live ? `> **Apuração:** ${live.totalizedPercent}% das urnas${closed ? bolaoClosedLabel : bolaoOpenLabel}` : "> **Apuração:** TSE indisponível agora",
    ...BOLAO_CANDIDATES.map(name => {
      const matching = bets.filter(bet => bet.candidateName === name);
      const candidate = live?.candidates.find(item => normalizeName(item.ballotName).includes(normalizeName(name).split(" ")[0]));
      const average = matching.length ? matching.reduce((sum, bet) => sum + Number(bet.betPercent), 0) / matching.length : null;
      const atual = candidate ? ` • apuração \`${candidate.percentageStr}%\` ${candidate.isElected ? "👑" : ""}` : "";
      return `> **${name}:** ${matching.length} aposta(s)${average != null ? ` • média da aposta \`${stat(average)}\`` : ""}${atual}`;
    }),
  ].join("\n");
  return { closed, stats };
}

export async function getBolaoPanel(guildId?: string, userId?: string, view?: { stats: string; closed: boolean }) {
  const { buildBolaoPanel } = await import("../menus/bolaoPanel.js");
  const base = view ?? await bolaoOverview(guildId, userId);
  const board = await bolaoBoard(guildId);
  return buildBolaoPanel({ ...base, board: board || "> Nenhuma aposta ainda. Seja o primeiro!" });
}

export const normalizeName = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function bolaoActuals(summary: ElectionSummary): { name: string; percent: number }[] {
  return BOLAO_CANDIDATES.map(name => {
    const candidate = summary.candidates.find(item => normalizeName(item.ballotName).includes(normalizeName(name).split(" ")[0]));
    return { name, percent: candidate ? Number(candidate.percentageStr.replace(",", ".")) : NaN };
  }).filter(item => !Number.isNaN(item.percent));
}

export function bolaoResultPanel(scored: ReturnType<typeof scoreBets>, summary: ElectionSummary): string {
  const actuals = summary.candidates.slice(0, 3).map(c => `**${c.ballotName}** ${c.percentageStr}%`).join(" • ");
  const medals = ["🥇", "🥈", "🥉"];
  const lines = scored.slice(0, 15).map((entry, index) =>
    `${medals[index] ?? `${index + 1}.`} **${entry.userName}** — ${entry.score} pts • apostou ${entry.candidateName} ${entry.betPercent.toFixed(1).replace(".", ",")}% (real ${entry.actualPercent.toFixed(1).replace(".", ",")}%)`);
  return `## 🏆 Resultado do Bolão — Presidente • ${summary.round}º turno\n> Resultado oficial: ${actuals}\n\n${lines.join("\n")}\n\n> Pontuação: 100 pontos menos a diferença absoluta entre aposta e resultado real, em pontos percentuais.`;
}
