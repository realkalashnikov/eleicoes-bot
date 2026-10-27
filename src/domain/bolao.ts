// Domínio puro do bolão: nenhuma dependência de Mongo, Discord ou rede.
// O tipo de resumo entra por type-only import (eliminado em runtime).
import type { ElectionSummary } from "../services/tse.js";

export const BOLAO_CANDIDATES = ["Flávio Bolsonaro", "Lula"] as const;
export type BolaoCandidate = (typeof BOLAO_CANDIDATES)[number];

export const normalizeName = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export const percentNumber = (value: string): number => Number(String(value).replace(",", "."));

/** Fechado quando a totalização conclui ou a apuração passa do corte configurado. */
export function bolaoClosed(live: ElectionSummary | null | undefined, closePercent: number): boolean {
  return Boolean(live && (live.isComplete || percentNumber(String(live.totalizedPercent)) >= closePercent));
}

/** Erro legível quando não dá pra apostar; null quando livre. */
export function bolaoCloseError(live: ElectionSummary | null | undefined, closePercent: number): string | null {
  if (!live || !bolaoClosed(live, closePercent)) return null;
  return live.isComplete
    ? "Bolão encerrado: a apuração foi concluída."
    : `Bolão fechado: a apuração já passou de ${closePercent}% das urnas.`;
}

/** Sufixo da linha de apuração no painel, refletindo a regra configurada. */
export function bolaoStatusLabel(live: ElectionSummary | null | undefined, closePercent: number): string {
  if (!live) return "";
  if (bolaoClosed(live, closePercent)) {
    return closePercent >= 100 ? " • bolão fechado (apuração concluída)" : ` • bolão fechado (corte: ${closePercent}% das urnas)`;
  }
  return closePercent >= 100 ? " • bolão aberto até o resultado oficial" : ` • bolão aberto até ${closePercent}% das urnas`;
}

/** Valida aposta sem tocar I/O; devolve mensagem de erro ou null. */
export function validateBolaoBet(candidateName: string, betPercent: number): string | null {
  if (!BOLAO_CANDIDATES.includes(candidateName as BolaoCandidate)) return "Candidato fora do bolão.";
  if (!Number.isFinite(betPercent) || betPercent < 0 || betPercent > 100) return "Percentual fora do intervalo (0–100).";
  return null;
}

/** Score = 100 − desvio em p.p. (piso 0); o candidato precisa existir na apuração. */
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

/** Percentual real de cada candidato do bolão a partir do resumo do TSE. */
export function bolaoActuals(summary: ElectionSummary): { name: string; percent: number }[] {
  return BOLAO_CANDIDATES.map(name => {
    const candidate = summary.candidates.find(item => normalizeName(item.ballotName).includes(normalizeName(name).split(" ")[0]));
    return { name, percent: candidate ? Number(candidate.percentageStr.replace(",", ".")) : NaN };
  }).filter(item => !Number.isNaN(item.percent));
}

const ptPercent = (value: number) => value.toFixed(1).replace(".", ",");

/** Painel de resultado (texto puro), com medalhas para o topo do placar. */
export function bolaoResultPanel(scored: ReturnType<typeof scoreBets>, summary: ElectionSummary): string {
  const actuals = summary.candidates.slice(0, 3).map(c => `**${c.ballotName}** ${c.percentageStr}%`).join(" • ");
  const medals = ["🥇", "🥈", "🥉"];
  const lines = scored.slice(0, 15).map((entry, index) =>
    `${medals[index] ?? `${index + 1}.`} **${entry.userName}** — ${entry.score} pts • apostou ${entry.candidateName} ${ptPercent(entry.betPercent)}% (real ${ptPercent(entry.actualPercent)}%)`);
  return `## 🏆 Resultado do Bolão — Presidente • ${summary.round}º turno\n> Resultado oficial: ${actuals}\n\n${lines.join("\n")}\n\n> Pontuação: 100 pontos menos a diferença absoluta entre aposta e resultado real, em pontos percentuais.`;
}
