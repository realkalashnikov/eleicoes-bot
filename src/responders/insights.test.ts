import assert from "node:assert/strict";
import { buildElectionPanel } from "../menus/electionPanel.js";
import { handleInteraction } from "./interactions.js";

const cand = (i: number) => ({
  number: String(i), ballotName: "CANDIDATO " + i, fullName: "x", party: "X", rank: i,
  votes: 1000 - i, votesFormatted: "1.000", percentage: 50 - i, percentageStr: "50,00", isElected: i === 0,
  status: "", runningMate: undefined,
});
const summary: any = {
  uf: "BR", round: 2, cargoName: "Presidente", generatedDate: "25/10/2026", generatedTime: "19:00:00", fetchedAt: Date.now(), stale: false,
  totalSections: 10, totalizedSections: 5, totalizedPercent: "50,00", totalVotes: 1, totalVotesFormatted: "1", validVotes: 1,
  validVotesFormatted: "1", validPercent: "100", blankVotes: 0, blankPercent: "0", nullVotes: 0, nullPercent: "0",
  turnoutPercent: "80", abstentionPercent: "20", isComplete: false, sourceUrl: "https://resultados.tse.jus.br/x",
  candidates: Array.from({ length: 7 }, (_, i) => cand(i)),
};

const controls = (node: any): any[] =>
  node?.custom_id ? [node] : Object.values(node ?? {}).flatMap(v => typeof v === "object" ? controls(v) : []);

const panel: any = JSON.parse(JSON.stringify(buildElectionPanel(summary, "br", "1", "6258", undefined, 0)));
const ids = controls(panel).filter(c => typeof c.custom_id === "string" && !c.disabled).map(c => c.custom_id);
for (const id of ["election:map:br:1", "election:chart:br:1:6258"]) {
  assert.ok(ids.includes(id), `botão ausente no painel: ${id}`);
}
const responses: any[] = [];
const click = async (customId: string) => {
  const interaction: any = {
    customId, values: [], isButton: () => true, isStringSelectMenu: () => false,
    isChannelSelectMenu: () => false, isModalSubmit: () => false,
    deferUpdate: async () => responses.push("defer"),
    deferReply: async () => responses.push("deferReply"),
    editReply: async (payload: any) => { responses.push("edit"); interaction.last = payload; },
    reply: async () => responses.push("reply"),
    followUp: async () => responses.push("followUp"),
  };
  await handleInteraction(interaction);
  return interaction;
};
const chart = await click("election:chart:br:1:6258");
assert.ok(!chart.last || JSON.stringify(chart.last).includes("Histórico insuficiente") || JSON.stringify(chart.last).includes("Evolução"));
assert.ok(!responses.includes("followUp"), "gráfico ergueu erro");
responses.length = 0;
const map = await click("election:map:br:1");
assert.ok(map.last && JSON.stringify(map.last).includes("Mapa por estado"));
console.log("insights interactions: ok");
process.exit(0);
