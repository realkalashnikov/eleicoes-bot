import assert from "node:assert/strict";
import { handleInteraction } from "./interactions.js";
import { getPollPanel } from "../services/observatory.js";

const controls = (node: any): any[] =>
  node?.custom_id ? [node] : Object.values(node ?? {}).flatMap(v => typeof v === "object" ? controls(v) : []);

async function click(control: any) {
  const calls: string[] = [];
  const isSelect = control.type === 3;
  const interaction: any = {
    customId: control.custom_id,
    values: isSelect ? [control.options.find((o: any) => !o.default).value] : [],
    isButton: () => !isSelect,
    isStringSelectMenu: () => isSelect,
    isChannelSelectMenu: () => false,
    isModalSubmit: () => false,
    deferUpdate: async () => { calls.push("defer"); },
    deferReply: async () => { calls.push("deferReply"); },
    editReply: async (payload: any) => { calls.push("edit"); interaction.last = payload; },
    reply: async () => { calls.push("reply"); },
    followUp: async () => { calls.push("followUp"); },
  };
  await handleInteraction(interaction);
  return { calls, last: interaction.last };
}

let panel: any = JSON.parse(JSON.stringify(await getPollPanel("presidente", 2, 1, false)));
let checked = 0;
for (const control of controls(panel).filter(c => !c.disabled && !c.custom_id.endsWith(":noop"))) {
  const { calls } = await click(control);
  assert.ok(calls.length > 0, `sem resposta: ${control.custom_id}`);
  assert.ok(!calls.includes("followUp"), `erro ao responder: ${control.custom_id}`);
  checked++;
}
assert.ok(checked >= 6, `poucos controles testados: ${checked}`);

const toggle = controls(panel).find(c => c.custom_id.startsWith("poll:toggle:"));
const detailed = JSON.stringify((await click(toggle)).last);
assert.ok(detailed.includes("Metodologia"), "toggle não detalhou");
panel = JSON.parse(detailed);
const next = controls(panel).find(c => c.custom_id.startsWith("poll:page:") && !c.disabled && c.style === 1);
assert.ok(JSON.stringify((await click(next)).last).includes("Metodologia"), "página perdeu modo detalhado");
console.log(`poll interactions: ok (${checked} controles)`);
process.exit(0);
