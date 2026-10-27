import { Client, TextChannel } from "discord.js";
import { CONFIG } from "../config.js";
import { listAlertSubscribers, listBolaoBets, listGuildSettings, isBolaoSettled, markBolaoSettled } from "../database/index.js";
import { fetchElectionResults, type ElectionSummary } from "./tse.js";
import { bolaoActuals, bolaoResultPanel, scoreBets } from "./bolao.js";

const MILESTONES = [10, 25, 50, 75, 90, 95, 99];
const percent = (value: string) => Number(value.replace(",", ".")) || 0;
const leaderLine = (summary: ElectionSummary) =>
  summary.candidates.slice(0, 2).map(c => `**${c.ballotName}** ${c.percentageStr}%`).join(" • ");
const scopeLabel = (summary: ElectionSummary) =>
  `${summary.cargoName}${summary.cargoName !== "Presidente" ? ` • ${summary.uf}` : ""} • ${summary.round}º turno`;

export interface ElectionAlert { uf: string; content: string }

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

// ponytail: estado em memória; após reinício só alerta mudanças novas. Persistir em Mongo se precisar sobreviver a restart.
const WATCHED = [
  { uf: "br", cargo: "1", election: CONFIG.FED_ELECTION },
  ...CONFIG.UFS.filter(item => item.cargo === "3").map(item => ({ uf: item.uf as string, cargo: "3", election: CONFIG.STATE_ELECTION })),
];

export async function startElectionAlerts(client: Client): Promise<void> {
  const last = new Map<string, ElectionSummary>();
  const check = async () => {
    const alerts: ElectionAlert[] = [];
    for (const target of WATCHED) {
      const key = `${target.uf}:${target.cargo}:${target.election}`;
      const next = await fetchElectionResults(target.uf, target.cargo, target.election).catch(() => null);
      if (!next || next.stale) continue;
      const prev = last.get(key);
      if (prev) alerts.push(...detectElectionAlerts(prev, next));
      last.set(key, next);
    }
    const presidentSummary = last.get(`br:1:${CONFIG.FED_ELECTION}`);
    if (presidentSummary?.isComplete && !(await isBolaoSettled("presidente-2"))) {
      const bets = await listBolaoBets();
      if (bets.length) {
        const overall = scoreBets(bets, bolaoActuals(presidentSummary));
        for (const settings of await listGuildSettings()) {
          const channel = settings.channels?.election ? await client.channels.fetch(settings.channels.election).catch(() => null) : null;
          if (!(channel instanceof TextChannel)) continue;
          const local = bets.filter(bet => bet.guildId === settings.guildId);
          const panel = local.length ? bolaoResultPanel(scoreBets(local, bolaoActuals(presidentSummary)), presidentSummary) : bolaoResultPanel(overall, presidentSummary);
          await channel.send({ content: panel }).catch(() => failures.push("bolao:" + channel.id));
        }
        for (const [index, entry] of overall.entries()) {
          const user = await client.users.fetch(entry.userId).catch(() => null);
          await user?.send({ content: `**Seu resultado no bolão:** ${index + 1}º lugar com ${entry.score} pts (${entry.candidateName} ${entry.betPercent.toFixed(1).replace(".", ",")}% • real ${entry.actualPercent.toFixed(1).replace(".", ",")}%).` }).catch(() => failures.push(`dm:${entry.userId}`));
        }
      }
      await markBolaoSettled("presidente-2");
    }
    if (!alerts.length) return;
    const failures: string[] = [];
    for (const settings of await listGuildSettings()) {
      const channelId = settings.channels?.election;
      const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
      if (!(channel instanceof TextChannel)) continue;
      for (const alert of alerts) await channel.send({ content: alert.content }).catch(() => failures.push(channel.id));
    }
    for (const alert of alerts) {
      for (const userId of await listAlertSubscribers(alert.uf)) {
        const user = await client.users.fetch(userId).catch(() => null);
        await user?.send({ content: alert.content }).catch(() => failures.push(`dm:${userId}`));
      }
    }
    if (failures.length) console.warn(`[Alertas] Falhas de envio: ${failures.join(", ")}`);
  };
  await check();
  setInterval(() => check().catch(error => console.error("[Alertas]", error)), CONFIG.REFRESH_INTERVAL_MS);
}
