import assert from "node:assert/strict";
import { buildElectionPanel } from "./electionPanel.js";
import { getPollPanel } from "../services/observatory.js";

const cand = (i: number) => ({
  number: String(i), ballotName: "CANDIDATO LONGO NOME " + i, fullName: "x", party: "REPUBLICANOS", rank: i,
  votes: 6321590, votesFormatted: "6.321.590", percentage: 55.4, percentageStr: "55,40", isElected: i === 0,
  status: "Não eleito", runningMate: "VICE COM NOME BEM LONGO DEMAIS",
});
const summary: any = {
  uf: "BR", round: 1, cargoName: "Governador", generatedDate: "24/10/2026", generatedTime: "19:19:13", fetchedAt: Date.now(), stale: false,
  totalSections: 1, totalizedSections: 1, totalizedPercent: "100,00", totalVotes: 1, totalVotesFormatted: "1", validVotes: 1,
  validVotesFormatted: "1", validPercent: "100", blankVotes: 0, blankPercent: "0", nullVotes: 0, nullPercent: "0",
  turnoutPercent: "80", abstentionPercent: "20", isComplete: true, sourceUrl: "https://resultados.tse.jus.br/x",
  candidates: Array.from({ length: 12 }, (_, i) => cand(i)),
};
const texts = (node: any): string[] => node?.content ? [node.content] : Object.values(node ?? {}).flatMap(v => typeof v === "object" ? texts(v) : []);
for (const page of [0, 1, 2]) {
  const json = JSON.parse(JSON.stringify(buildElectionPanel(summary, "mg", "3", "6259", undefined, page)));
  const total = texts(json).join("").length;
  assert.ok(total > 500 && total <= 4000, `página ${page}: ${total} chars`);
}
for (const detailed of [false, true]) for (const page of [0, 1, 2, 3]) {
  const json = JSON.parse(JSON.stringify(await getPollPanel("presidente", 2, page, detailed)));
  const total = texts(json).join("").length;
  assert.ok(total > 300 && total <= 4000, `pesquisa ${detailed ? "detalhada" : "resumida"} p${page}: ${total} chars`);
}
// Painel automático publicado no canal deve ser estático: sem ActionRow nenhuma
const { toStaticPanel } = await import("../services/electionView.js");
const interactive = buildElectionPanel(summary, "br", "1", "6260", undefined, 0) as any;
const countRows = (node: any, seen = new WeakSet<object>()): number => {
  if (typeof node !== "object" || node === null || seen.has(node)) return 0;
  seen.add(node);
  if (node.type === 1) return 1;
  return Object.values(node).reduce((sum: number, v: any) => sum + countRows(v, seen), 0);
};
assert.ok(countRows(interactive) > 0, "painel interativo deveria ter ActionRow (botões)");
const staticPanel = toStaticPanel(interactive) as any;
assert.equal(countRows(staticPanel), 0, "painel estático não pode ter ActionRow");
assert.ok(texts(staticPanel).join("").length > 300, "painel estático perdeu o conteúdo");
// Nenhum componente pode perder o `type` na conversão — foi o bug do TAG_FIELD_MISSING (50035)
for (const top of staticPanel.components) {
  assert.ok(top?.type != null, `componente de topo sem type: ${JSON.stringify(top)?.slice(0, 60)}`);
  for (const child of top.components ?? []) assert.ok(child?.type != null, `filho sem type dentro do componente ${top.type}`);
}
const withCountdown = toStaticPanel(interactive, Date.now() + 10000) as any;
assert.equal(countRows(withCountdown), 0, "contagem regressiva não pode trazer ActionRow de volta");
assert.ok(texts(withCountdown).join("").includes("Próxima atualização"), "contagem regressiva não apareceu");
console.log("electionPanel/pollReport pagination: ok");
process.exit(0);
