// Domínio puro dos alertas: comparação prev → next de resumos do TSE, sem I/O.
import type { ElectionSummary } from "../services/tse.js";

export const MILESTONES = [10, 25, 50, 75, 90, 95, 99];

export interface ElectionAlert { uf: string; content: string }

const percent = (value: string) => Number(value.replace(",", ".")) || 0;

const leaderLine = (summary: ElectionSummary) =>
  summary.candidates.slice(0, 2).map(c => `**${c.ballotName}** ${c.percentageStr}%`).join(" • ");

const scopeLabel = (summary: ElectionSummary) =>
  `${summary.cargoName}${summary.cargoName !== "Presidente" ? ` • ${summary.uf}` : ""} • ${summary.round}º turno`;

/** Marcos, virada de liderança, eleição e conclusão entre dois resumos consecutivos. */
export function detectElectionAlerts(prev: ElectionSummary, next: ElectionSummary): ElectionAlert[] {
  const alerts: ElectionAlert[] = [];
  const uf = next.cargoName === "Presidente" ? "br" : next.uf.toLowerCase();
  const push = (content: string) => alerts.push({ uf, content });
  if (prev.totalVotes === 0 && next.totalVotes > 0) push(`🗳️ **Apuração começou** — ${scopeLabel(next)}\n${leaderLine(next)}`);
  const crossed = MILESTONES.filter(m => percent(prev.totalizedPercent) < m && percent(next.totalizedPercent) >= m).pop();
  if (crossed && !next.isComplete) push(`📊 **${crossed}% das urnas apuradas** — ${scopeLabel(next)}\n${leaderLine(next)}`);
  const prevLeader = prev.candidates[0]?.number;
  if (prev.totalVotes > 0 && prevLeader && next.candidates[0]?.number && next.candidates[0].number !== prevLeader && !next.isComplete) {
    push(`🔄 **Virada na liderança** — ${scopeLabel(next)} (${next.totalizedPercent}% apurado)\n${leaderLine(next)}`);
  }
  const alreadyElected = new Set(prev.candidates.filter(c => c.isElected).map(c => c.number));
  for (const candidate of next.candidates.filter(c => c.isElected && !alreadyElected.has(c.number))) {
    push(`👑 **${candidate.ballotName} (${candidate.party}) ELEITO** — ${scopeLabel(next)}\n${candidate.percentageStr}% dos votos válidos • fonte: TSE`);
  }
  if (!prev.isComplete && next.isComplete) push(`✅ **Totalização concluída** — ${scopeLabel(next)}\n${leaderLine(next)}`);
  return alerts;
}
