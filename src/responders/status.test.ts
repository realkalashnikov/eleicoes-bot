import assert from "node:assert/strict";
import { getHealthReport } from "../discord/commands/status.js";
import { getComparePanel } from "../services/electionInsights.js";

const panel = await getComparePanel();
const text = JSON.stringify(JSON.parse(JSON.stringify(panel)));
assert.ok(text.includes("Pesquisa x Apuração"));
assert.ok(text.includes("TSE"));

const health = await getHealthReport();
const healthText = JSON.stringify(JSON.parse(JSON.stringify(health)));
assert.ok(/Status do bot/.test(healthText));
assert.ok(/TSE/.test(healthText));
assert.ok(/MongoDB/.test(healthText));
console.log("status/compare: ok");
process.exit(0);
