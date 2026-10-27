import assert from "node:assert/strict";
import { electionSourceUrl } from "./electionView.js";

assert.equal(
  electionSourceUrl("sp", "3", "6259"),
  "https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json",
);
assert.equal(
  electionSourceUrl("zz", "1", "6258"),
  "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz/zz-c0001-e006258-u.json",
);
console.log("electionSourceUrl: ok");
