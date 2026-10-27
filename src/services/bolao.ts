import { CONFIG } from "../config.js";
import { listBolaoBets, setBolaoBet } from "../database/index.js";
import { fetchElectionResults, type ElectionSummary } from "./tse.js";
import {
  BOLAO_CANDIDATES, bolaoActuals, bolaoCloseError, bolaoClosed, bolaoResultPanel, bolaoStatusLabel,
  normalizeName, scoreBets, validateBolaoBet, type BolaoCandidate,
} from "../domain/bolao.js";

// Regra pura vive em src/domain/bolao.ts; aqui ficam só os pontos de I/O (TSE + Mongo).
export { BOLAO_CANDIDATES, normalizeName, scoreBets, bolaoActuals, bolaoResultPanel, bolaoClosed, validateBolaoBet } from "../domain/bolao.js";
export type { BolaoCandidate } from "../domain/bolao.js";

export async function placeBolaoBet(bet: { userId: string; userName?: string; guildId?: string; candidateName: string; betPercent: number }, liveCheck?: ElectionSummary | null): Promise<void> {
  const invalid = validateBolaoBet(bet.candidateName, bet.betPercent);
  if (invalid) throw new Error(invalid);
  const live = liveCheck === undefined ? await fetchElectionResults("br", "1", CONFIG.FED_ELECTION).catch(() => null) : liveCheck;
  const closed = bolaoCloseError(live, CONFIG.BOLAO_CLOSE_PERCENT);
  if (closed) throw new Error(closed);
  await setBolaoBet(bet);
}

export async function bolaoBoard(guildId?: string): Promise<string> {
  const bets = await listBolaoBets(guildId);
  if (!bets.length) return "";
  return bets.map((bet, index) => `${index + 1}. **${bet.userName || `<@${bet.userId}>`}** — **${bet.candidateName}** \`${Number(bet.betPercent).toFixed(1).replace(".", ",")}%\``).join("\n");
}

const stat = (value: number) => value.toFixed(1).replace(".", ",") + "%";

export async function bolaoOverview(guildId?: string, userId?: string) {
  const bets = await listBolaoBets(guildId);
  const live = await fetchElectionResults("br", "1", CONFIG.FED_ELECTION).catch(() => null);
  const closed = bolaoClosed(live, CONFIG.BOLAO_CLOSE_PERCENT);
  const mine = userId ? bets.find(bet => bet.userId === userId) : null;
  const stats = [
    `> **Apostas:** ${bets.length} registrada(s)${guildId ? " neste servidor" : ""}`,
    mine ? `> **Sua aposta:** ${mine.candidateName} \`${Number(mine.betPercent).toFixed(1).replace(".", ",")}%\`` : "> **Sua aposta:** nenhuma ainda — é só clicar em **Apostar agora**",
    live ? `> **Apuração:** ${live.totalizedPercent}% das urnas${bolaoStatusLabel(live, CONFIG.BOLAO_CLOSE_PERCENT)}` : "> **Apuração:** TSE indisponível agora",
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
