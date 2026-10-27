import assert from "node:assert/strict";
import { detectElectionAlerts } from "./electionAlerts.js";

const cand = (number: string, name: string, pct: number, elected = false): any =>
  ({ number, ballotName: name, party: "X", percentageStr: String(pct).replace(".", ","), isElected: elected });
const sum = (over: any = {}): any => ({
  cargoName: "Presidente", round: 2, uf: "BR", totalVotes: 1, totalizedPercent: "0,00", isComplete: false,
  candidates: [cand("22", "A", 50), cand("13", "B", 50)], ...over,
});

assert.deepEqual(detectElectionAlerts(sum(), sum()), []);
assert.match(detectElectionAlerts(sum({ totalVotes: 0 }), sum())[0].content, /Apuração começou/);
assert.equal(detectElectionAlerts(sum({ totalVotes: 0 }), sum())[0].uf, "br");
assert.match(detectElectionAlerts(sum({ totalizedPercent: "24,00" }), sum({ totalizedPercent: "26,00" }))[0].content, /25% das urnas/);
assert.match(detectElectionAlerts(sum(), sum({ candidates: [cand("13", "B", 51), cand("22", "A", 49)] }))[0].content, /Virada/);
const done = detectElectionAlerts(sum({ totalizedPercent: "98,00" }), sum({ totalizedPercent: "100,00", isComplete: true, candidates: [cand("22", "A", 51, true), cand("13", "B", 49)] }));
assert.ok(done.some(a => alertBuff(a).includes("ELEITO")) && done.some(a => alertBuff(a).includes("concluída")));
function alertBuff(a: any) { return a.content; }
assert.equal(detectElectionAlerts(sum({ totalVotes: 0 }), sum({ cargoName: "Governador", round: 1, uf: "SP" }))[0].uf, "sp");
console.log("detectElectionAlerts: ok");
