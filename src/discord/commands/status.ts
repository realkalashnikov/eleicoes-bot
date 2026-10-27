import { createCommand } from "#base";
import { type ChatInputCommandInteraction } from "discord.js";
import { CONFIG } from "#config";
import { connectDatabase, listAlertSubscribers } from "#database";
import { fetchElectionResults } from "#services";
import { brBuilder, createContainer } from "@magicyan/discord";

export async function getHealthReport() {
  const t0 = Date.now();
  const tse = await fetchElectionResults("br", "1", CONFIG.FED_ELECTION).catch(error => error as Error);
  const latency = Date.now() - t0;
  const tseOk = !(tse instanceof Error);
  let mongoOk = false;
  try { await connectDatabase(); mongoOk = true; } catch { mongoOk = false; }
  const rows = [
    `## ${tseOk ? "✅" : "⚠️"} Status do bot`,
    `> **TSE:** ${tseOk ? `ok • ${latency}ms • urnas ${((tse as any).totalizedPercent)}% apurado • dado de "${(tse as any).generatedTime}"` : `falha: ${(tse as Error).message}`}`,
    `> **MongoDB:** ${mongoOk ? `conectado (base: ${CONFIG.DATABASE_NAME})` : "desconectado"}`,
    `> **Atualização automática:** painel a cada ${CONFIG.PANEL_REFRESH_MS / 1000}s • alertas a cada ${CONFIG.REFRESH_INTERVAL_MS / 1000}s`,
    `> **Bases assistidas:** ${CONFIG.UFS.length + 1} recortes (presidente e ${CONFIG.UFS.length} governos)`,
    `> **Fonte:** [resultados do TSE](${CONFIG.TSE_BASE_URL}/${CONFIG.CYCLE})`,
  ];
  if (mongoOk) {
    const [flavio, lula] = await Promise.all([listAlertSubscribers("br"), listAlertSubscribers("sp")]);
    rows.push(`> **Alertas por DM:** ${flavio.length + lula.length} assinatura(s) nas amostras visíveis`);
  }
  return createContainer(0x2B2D31, brBuilder(...rows));
}

export default createCommand({
  name: "status",
  description: "Mostra a saúde do bot (TSE, banco, atualização e assinaturas)",
  async run(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({ components: [await getHealthReport()] } as any);
  },
});
