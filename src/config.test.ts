// Testes do schema de env: herméticos, sem Mongo/TSE/Discord.
import assert from "node:assert/strict";
import { assertRuntimeEnv, parseEnv } from "./config.js";

// ---- parseEnv: defaults quando vazio/ausente ----
const env = parseEnv({});
assert.equal(env.PREFIX, "e.");
assert.equal(env.DATABASE_NAME, "elections");
assert.equal(env.BOT_TOKEN, "");
assert.equal(env.BOLAO_CLOSE_PERCENT, 100);
assert.equal(env.PANEL_REFRESH, 10);
assert.equal(env.REFRESH_INTERVAL, 20);
assert.equal(env.NEWS_FEEDS.length >= 5, true, "feeds padrão aplicadas");

// ---- coerção de números ----
assert.equal(parseEnv({ PANEL_REFRESH: "30" }).PANEL_REFRESH, 30);
assert.equal(parseEnv({ BOLAO_CLOSE_PERCENT: "50" }).BOLAO_CLOSE_PERCENT, 50);
assert.equal(parseEnv({ NEWS_BACKFILL_HOURS: "" }).NEWS_BACKFILL_HOURS, 24, "vazio usa default");

// ---- fora da faixa rejeita com mensagem ----
assert.throws(() => parseEnv({ PANEL_REFRESH: "0" }), /mínimo é 1/);
assert.throws(() => parseEnv({ BOLAO_CLOSE_PERCENT: "150" }), /máximo é 100/);
assert.throws(() => parseEnv({ NEWS_BACKFILL_HOURS: "999" }), /máximo é 168/);
assert.throws(() => parseEnv({ NEWS_REFRESH_INTERVAL: "abc" }), /NaN/);

// ---- strings com regra ----
assert.equal(parseEnv({ PREFIX: "e!" }).PREFIX, "e!");
assert.equal(parseEnv({ TSE_CANDIDATES_YEAR: "2026" }).TSE_CANDIDATES_YEAR, "2026");
assert.throws(() => parseEnv({ PREFIX: "a b" }), /sem espaços/);
assert.throws(() => parseEnv({ TSE_FINANCE_YEAR: "24" }), /4 dígitos/);

// ---- feeds: split, trim e filtro ----
assert.deepEqual(parseEnv({ NEWS_FEEDS: "https://a.com/rss, https://b.com/rss ,, " }).NEWS_FEEDS,
  ["https://a.com/rss", "https://b.com/rss"]);

// ---- assertRuntimeEnv (boot) ----
assertRuntimeEnv({ BOT_TOKEN: "abc", MONGO_URI: "mongodb://localhost:27017/x", GUILD_ID: "", CHANNEL_ID: "" });
assert.throws(() => assertRuntimeEnv({}), /BOT_TOKEN é obrigatório/);
assert.throws(() => assertRuntimeEnv({ BOT_TOKEN: "x", MONGO_URI: "http://nao-e-mongo" }), /mongodb/);
assert.throws(() => assertRuntimeEnv({ BOT_TOKEN: "x", GUILD_ID: "abc" }), /ID numérico/);

// múltiplos problemas aparecem juntos
try {
  assertRuntimeEnv({ MONGO_URI: "mysql://x", CHANNEL_ID: "12" });
  assert.fail("deveria ter lançado");
} catch (error) {
  const message = (error as Error).message;
  assert.match(message, /BOT_TOKEN/);
  assert.match(message, /MONGO_URI/);
  assert.match(message, /CHANNEL_ID/);
}

console.log("config env: ok (schema + boot guard)");
process.exit(0);
