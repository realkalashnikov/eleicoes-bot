// Ciclo de alertas com deps falsas: sem Mongo, sem TSE, sem Discord real.
import assert from "node:assert/strict";
import { TextChannel } from "discord.js";
import { runAlertCycle, type AlertDeps } from "./electionAlerts.js";
import type { ElectionSummary } from "./tse.js";

const summary = (over: Partial<ElectionSummary> = {}): ElectionSummary => ({
  uf: "BR", cargoName: "Presidente", round: 2, stale: false,
  totalVotes: 1000, totalizedPercent: "0,00", isComplete: false,
  candidates: [], ...over,
} as ElectionSummary);

const fakeChannel = (id: string) => {
  const sent: string[] = [];
  const channel: any = Object.create(TextChannel.prototype);
  channel.id = id;
  channel.send = async (payload: any) => { sent.push(payload.content); return { id: `m${sent.length}` }; };
  return { channel, sent };
};

const fakeUser = (id: string) => {
  const received: string[] = [];
  const user: any = { id, send: async (payload: any) => { received.push(payload.content); } };
  return { user, received };
};

// ---- cenário do bolão: liquidação única, canal do servidor e DMs ----
const c1 = fakeChannel("c1");
const ana = fakeUser("u1");
const bob = fakeUser("u2");
const channels = new Map([["c1", c1.channel]]);
const users = new Map([["u1", ana.user], ["u2", bob.user]]);
const client: any = {
  user: { id: "bot" },
  channels: { fetch: async (id: string) => channels.get(id) ?? null },
  users: { fetch: async (id: string) => users.get(id) ?? null },
};

let settled = false;
const deps: AlertDeps = {
  fetch: async (uf: string) => (uf !== "br" ? null : null), // governos falham; br definido por cenário
  guilds: async () => [{ guildId: "g1", channels: { election: "c1" } }, { guildId: "g2" }],
  bets: async () => [
    { userId: "u1", userName: "ana", candidateName: "Lula", betPercent: 50 },
    { userId: "u2", userName: "bob", candidateName: "Flávio Bolsonaro", betPercent: 45 },
  ],
  isSettled: async () => settled,
  markSettled: async () => { settled = true; },
  subscribers: async () => [],
};

// Apuração concluída: Lula 55,4% • Flávio 44,6% → ana 95 pts, bob 89,6 pts
const final: ElectionSummary = summary({
  isComplete: true, totalizedPercent: "100,00",
  candidates: [
    { number: "13", ballotName: "LULA", party: "PT", percentageStr: "55,40", isElected: true },
    { number: "22", ballotName: "FLÁVIO BOLSONARO", party: "PL", percentageStr: "44,60", isElected: false },
  ] as any,
});
(deps.fetch as any) = async (uf: string) => uf === "br" ? final : null;

await runAlertCycle(client, new Map(), deps);
assert.equal(settled, true, "bolão marcado como liquidado");
assert.equal(c1.sent.length, 1, "painel de resultado no canal");
assert.match(c1.sent[0], /Resultado do Bolão/);
assert.ok(c1.sent[0].indexOf("bob") < c1.sent[0].indexOf("ana"), "placar ordenado (bob 99,6 pts)");
assert.equal(ana.received.length, 1, "DM da ana");
assert.match(ana.received[0], /2º lugar com 94\.6 pts/);
assert.equal(bob.received.length, 1, "DM do bob");

// Segunda volta: já liquidado, não reenvia
await runAlertCycle(client, new Map([["br:1:6258", final]]), deps);
assert.equal(c1.sent.length, 1, "sem re-liquidação");
assert.equal(ana.received.length, 1, "sem DM repetida");

// ---- cenário de alertas: marco + virada entregues no canal e por DM ----
const c2 = fakeChannel("c2");
const sub = fakeUser("sub1");
const channels2 = new Map([["c2", c2.channel]]);
const users2 = new Map([["sub1", sub.user]]);
const client2: any = {
  user: { id: "bot" },
  channels: { fetch: async (id: string) => channels2.get(id) ?? null },
  users: { fetch: async (id: string) => users2.get(id) ?? null },
};

const at = (pct: string, first: string): ElectionSummary => summary({
  totalVotes: 500, totalizedPercent: pct,
  candidates: [
    { number: first === "LULA" ? "13" : "22", ballotName: first, party: "X", percentageStr: first === "LULA" ? "51,00" : "50,50", isElected: false },
    { number: first === "LULA" ? "22" : "13", ballotName: first === "LULA" ? "FLÁVIO BOLSONARO" : "LULA", party: "Y", percentageStr: first === "LULA" ? "49,00" : "49,50", isElected: false },
  ] as any,
});

const queue = [at("12,00", "LULA"), at("40,00", "FLÁVIO BOLSONARO"), at("40,00", "FLÁVIO BOLSONARO")];
const deps2: AlertDeps = {
  fetch: async (uf: string) => (uf === "br" ? queue.shift() ?? null : null),
  guilds: async () => [{ guildId: "g1", channels: { election: "c2" } }],
  bets: async () => [],
  isSettled: async () => true,
  markSettled: async () => {},
  subscribers: async (scope: string) => scope === "br" ? ["sub1"] : [],
};

const last = new Map<string, ElectionSummary>();
await runAlertCycle(client2, last, deps2); // primeira: sem prev → sem alerta
assert.equal(c2.sent.length, 0, "primeira volta não alerta");
await runAlertCycle(client2, last, deps2); // segunda: 12→40% com virada
assert.equal(c2.sent.length, 2, "marco 25% + virada no canal");
assert.match(c2.sent[0], /25% das urnas/);
assert.match(c2.sent[1], /Virada na liderança/);
assert.equal(sub.received.length, 2, "assinante recebe por DM");
await runAlertCycle(client2, last, deps2); // terceira: nada mudou
assert.equal(c2.sent.length, 2, "sem alerta duplicado");
assert.equal(sub.received.length, 2, "sem DM duplicada");

// ---- resumo stale é ignorado ----
const stale: ElectionSummary = { ...at("50,00", "LULA"), stale: true };
const last2 = new Map<string, ElectionSummary>();
const deps3: AlertDeps = { ...deps2, fetch: async () => stale, subscribers: async () => [] };
await runAlertCycle(client2, last2, deps3);
assert.equal(last2.size, 0, "stale não atualiza último estado");
assert.equal(c2.sent.length, 2, "stale não gera alerta");

console.log("ciclo de alertas: ok (liquidação única, entrega e dedupe)");
process.exit(0);
