// Ciclo do painel vivo com deps falsas: publica na primeira, edita depois,
// e o scan de fallback só adota mensagens V2 do próprio bot.
import assert from "node:assert/strict";
import { TextChannel } from "discord.js";
import { runPanelSync, type LivePanelDeps } from "./livePanel.js";

const fakeMessage = (id: string, authorId: string, withComponents: boolean) => {
  const msg: any = { id, author: { id: authorId }, components: withComponents ? [1] : [], edited: [], deleted: 0 };
  msg.edit = async (payload: any) => { msg.edited.push(payload); return msg; };
  msg.delete = async () => { msg.deleted++; return msg; };
  return msg;
};

const fakeChannel = () => {
  const state = { sends: [] as any[], byId: new Map<string, any>(), history: [] as any[] };
  const channel: any = Object.create(TextChannel.prototype);
  channel.id = "c";
  channel.send = async (payload: any) => {
    const msg = fakeMessage(`m${state.sends.length + 1}`, "bot", true);
    state.sends.push(msg);
    state.byId.set(msg.id, msg);
    return msg;
  };
  channel.messages = {
    fetch: async (arg: any) => {
      if (typeof arg === "string") {
        const found = state.byId.get(arg);
        if (!found) throw new Error("Unknown Message");
        return found;
      }
      return state.history;
    },
  };
  return { channel, state };
};

const nestedUpdate = (settings: any, update: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(update)) {
    const parts = key.split(".");
    let target = settings;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)!] = value;
  }
};

const makeWorld = (settings: any) => {
  const { channel, state } = fakeChannel();
  const guild: any = { id: settings.guildId, channels: { fetch: async () => channel } };
  const client: any = {
    user: { id: "bot" },
    guilds: {
      fetch: async () => guild,
      cache: { values: () => [guild].values() },
    },
  };
  let panelCount = 0;
  const deps: LivePanelDeps = {
    buildPanel: async () => ({ painel: ++panelCount }),
    getSettings: async () => settings,
    updateSettings: async (_guildId: string, update) => { nestedUpdate(settings, update); },
  };
  return { client, deps, state, settings };
};

// ---- primeira volta: publica e salva o id ----
const w1 = makeWorld({ guildId: "g1", channels: { election: "c1" }, panelMessages: {} });
await runPanelSync(w1.client, w1.deps);
assert.equal(w1.state.sends.length, 1, "primeira volta publica");
assert.equal(w1.settings.panelMessages?.election, "m1", "id do painel salvo");

// ---- segunda volta: edita no lugar, sem nova mensagem ----
await runPanelSync(w1.client, w1.deps);
assert.equal(w1.state.sends.length, 1, "sem republicar");
assert.equal(w1.state.byId.get("m1")?.edited.length, 1, "editou no lugar");
assert.deepEqual(w1.state.byId.get("m1")?.edited[0], { painel: 2 }, "painel novo no edit");

// ---- guild sem canal configurado: volta silenciosa ----
const w2 = makeWorld({ guildId: "g2", channels: {}, panelMessages: {} });
await runPanelSync(w2.client, w2.deps);
assert.equal(w2.state.sends.length, 0, "nada publicado");

// ---- fallback scan: adota só mensagem V2 do bot e republica ----
const w3 = makeWorld({ guildId: "g3", channels: { election: "c3" }, panelMessages: {} });
w3.state.history.push(
  fakeMessage("old-1", "outro-bot", true),   // de outro autor → ignorada
  fakeMessage("old-2", "bot", false),        // sem components (não V2) → ignorada
  fakeMessage("old-3", "bot", true),         // V2 do bot → adotada
);
await runPanelSync(w3.client, w3.deps);
const adopted = w3.state.history[2];
assert.equal(adopted.deleted, 1, "painel antigo apagado ao republicar");
assert.equal(w3.state.sends.length, 1, "painel novo publicado no fim do canal");
assert.equal(w3.settings.panelMessages?.election, "m1", "novo id salvo");

// ---- fallback scan sem candidato V2: publica sem apagar nada ----
const w4 = makeWorld({ guildId: "g4", channels: { election: "c4" }, panelMessages: {} });
w4.state.history.push(fakeMessage("other", "outro-bot", true));
await runPanelSync(w4.client, w4.deps);
assert.equal(w4.state.history[0].deleted, 0, "mensagem alheia intocada");
assert.equal(w4.state.sends.length, 1, "publicou painel novo");

console.log("ciclo do painel: ok (publica/edita/republica)");
process.exit(0);
