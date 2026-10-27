import assert from "node:assert/strict";
import { handlePrefixBolao } from "../discord/events/prefix.js";
import { removeBolaoBet, purgeTestBolaoBets } from "../database/index.js";

const replies: string[] = [];
const message: any = {
  author: { id: "test-bolao-" + Date.now(), username: "tester" },
  guildId: "test-guild",
  reply: async (payload: any) => { replies.push(payload?.content ?? JSON.stringify(payload)); },
};

// Apuração sintética aberta: em produção o handler busca o TSE (eleição encerrada = bolão fechado)
const liveAberta: any = { isComplete: false, totalizedPercent: "0,00", candidates: [], totalVotes: 0 };

await purgeTestBolaoBets("test-guild");
await handlePrefixBolao(new Map(), ["apostar", "lula", "48"], message, liveAberta);
assert.ok(replies.at(-1)?.includes("Aposta registrada"), `posicional falhou: ${replies.at(-1)}`);
await handlePrefixBolao(new Map(), ["apostar", "flavio", "51,5"], message, liveAberta);
assert.ok(replies.at(-1)?.includes("51,5"), `decimal vírgula falhou: ${replies.at(-1)}`);
await handlePrefixBolao(new Map([["acao", "apostar"], ["candidato", "Lula"], ["percentual", "49"]]), [], message, liveAberta);
assert.ok(replies.at(-1)?.includes("49,0"), `flags falharam: ${replies.at(-1)}`);
await handlePrefixBolao(new Map(), ["apostar", "ze"], message);
assert.ok(replies.at(-1)?.includes("Uso:"), `candidato inválido não avisou: ${replies.at(-1)}`);
await handlePrefixBolao(new Map(), [], message);
assert.ok(replies.at(-1)?.includes("Apostar") && replies.at(-1)?.includes("Sua aposta"), `painel default falhou: ${replies.at(-1)}`);
await handlePrefixBolao(new Map(), ["ver"], message);
assert.ok(replies.at(-1)?.includes("1. **tester**") && replies.at(-1)?.includes("%"), `ver falhou: ${replies.at(-1)}`);
await removeBolaoBet(message.author.id);
console.log("bolao prefix: ok");

// Modal payload monta com menu + texto dentro de label
const { bolaoModal } = await import("../discord/commands/bolao.js");
const payload = JSON.parse(JSON.stringify(bolaoModal.toJSON()));
assert.equal(payload.custom_id, "bolao:submit");
assert.equal(payload.components[0].component.type, 3);
assert.equal(payload.components[1].component.type, 4);
console.log("bolao modal: ok");
process.exit(0);
