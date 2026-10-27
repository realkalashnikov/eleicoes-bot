// Testes de domínio puro: sem Mongo, sem TSE, sem Discord — rápidos e herméticos.
import assert from "node:assert/strict";
import {
  BOLAO_CANDIDATES, bolaoActuals, bolaoCloseError, bolaoClosed, bolaoStatusLabel,
  normalizeName, scoreBets, validateBolaoBet,
} from "./bolao.js";
import { detectElectionAlerts, MILESTONES } from "./alerts.js";

// ---- score do bolão ----
const actuals = [{ name: "Lula", percent: 55.4 }, { name: "Flávio Bolsonaro", percent: 44.6 }];
const scored = scoreBets([
  { userId: "u1", userName: "ana", candidateName: "Lula", betPercent: 55.4 },
  { userId: "u2", userName: "bob", candidateName: "Lula", betPercent: 60 },
  { userId: "u3", candidateName: "Flávio Bolsonaro", betPercent: 90 },
  { userId: "u4", userName: "duda", candidateName: "Fora do bolão", betPercent: 50 },
], actuals);
assert.deepEqual(scored.map(entry => entry.score), [100, 95.4, 54.6, 0], "score e ordem");
assert.equal(scored[2].userName, "<@u3>", "fallback de menção quando falta nome");

// ---- fechamento por corte ----
const sum = (over: any = {}): any => ({ isComplete: false, totalizedPercent: "0,25", candidates: [], ...over });
assert.equal(bolaoClosed(sum(), 5), false, "0,25% com corte 5 fica aberto");
assert.equal(bolaoClosed(sum({ totalizedPercent: "5,01" }), 5), true, "5,01% fecha");
assert.equal(bolaoClosed(sum({ isComplete: true }), 100), true, "concluída fecha sempre");
assert.equal(bolaoClosed(null, 5), false, "sem dado do TSE, não trava");
assert.match(bolaoCloseError(sum({ isComplete: true }), 100) ?? "", /concluída/);
assert.match(bolaoCloseError(sum({ totalizedPercent: "5,01" }), 5) ?? "", /5%/);
assert.equal(bolaoCloseError(sum(), 5), null);
assert.equal(bolaoCloseError(null, 5), null);

// ---- rótulos do painel refletem a regra ----
assert.match(bolaoStatusLabel(sum(), 100), /aberto até o resultado oficial/);
assert.match(bolaoStatusLabel(sum(), 5), /aberto até 5%/);
assert.match(bolaoStatusLabel(sum({ isComplete: true }), 100), /fechado \(apuração concluída\)/);
assert.match(bolaoStatusLabel(sum({ totalizedPercent: "9,99" }), 5), /corte: 5%/);

// ---- validação de aposta ----
assert.equal(validateBolaoBet("Lula", 50), null);
assert.match(validateBolaoBet("Zé", 50) ?? "", /Candidato fora/);
assert.match(validateBolaoBet("Lula", -1) ?? "", /intervalo/);
assert.match(validateBolaoBet("Lula", 150) ?? "", /intervalo/);
assert.equal(BOLAO_CANDIDATES.length, 2);

// ---- normalização ----
assert.equal(normalizeName("Flávio"), "flavio");
assert.equal(normalizeName("GOV. SÃO PAULO"), "gov. sao paulo");

// ---- actuals a partir do resumo ----
const summary: any = { round: 2, candidates: [
  { ballotName: "LULA", percentageStr: "55,40" },
  { ballotName: "FLÁVIO BOLSONARO", percentageStr: "44,60" },
] };
assert.deepEqual(bolaoActuals(summary), [
  { name: "Flávio Bolsonaro", percent: 44.6 },
  { name: "Lula", percent: 55.4 },
]);

// ---- alertas: começo, marco, virada, eleito e conclusão ----
const cand = (number: string, name: string, pct: number, elected = false): any =>
  ({ number, ballotName: name, party: "X", percentageStr: String(pct).replace(".", ","), isElected: elected });
const zero = sum({ uf: "BR", cargoName: "Presidente", round: 2, totalVotes: 0, totalizedPercent: "0,00" });
const start = { ...zero, totalVotes: 100, totalizedPercent: "12,00", candidates: [cand("13", "LULA", 51), cand("22", "FLÁVIO", 49)] };
const startAlerts = detectElectionAlerts(zero, start);
assert.ok(startAlerts.some(alert => alert.content.includes("Apuração começou")), "começo da apuração");
assert.ok(startAlerts.some(alert => alert.content.includes("10% das urnas")), "marco 10%");
assert.equal(startAlerts[0].uf, "br", "escopo de presidente");

const flipped = { ...start, totalizedPercent: "40,00", candidates: [cand("22", "FLÁVIO", 50.5), cand("13", "LULA", 49.5)] };
assert.ok(detectElectionAlerts(start, flipped).some(alert => alert.content.includes("Virada na liderança")), "virada");

const elected = { ...start, candidates: [cand("13", "LULA", 52, true), cand("22", "FLÁVIO", 48)] };
assert.ok(detectElectionAlerts(start, elected).some(alert => alert.content.includes("ELEITO")), "eleição");
assert.equal(detectElectionAlerts(elected, elected).length, 0, "sem eleito duplicado");

const done = { ...start, totalizedPercent: "100,00", isComplete: true };
const doneAlerts = detectElectionAlerts(start, done);
assert.ok(doneAlerts.some(alert => alert.content.includes("Totalização concluída")), "conclusão");
assert.ok(!doneAlerts.some(alert => alert.content.includes("% das urnas")), "sem marco quando concluída");

// marco cruzando dois valores de uma vez alerta só o mais alto
const jumped = detectElectionAlerts(zero, { ...zero, totalVotes: 1, totalizedPercent: "51,00" });
assert.ok(jumped.some(alert => alert.content.includes("50% das urnas")), "marco mais alto");
assert.ok(!jumped.some(alert => alert.content.includes("25% das urnas")), "marcos intermediários suprimidos");

assert.deepEqual(MILESTONES, [10, 25, 50, 75, 90, 95, 99]);
console.log("domain puro: ok (bolão + alertas)");
process.exit(0);
