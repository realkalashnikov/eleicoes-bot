import { createCommand } from "#base";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { CONFIG } from "#config";
import { listAlertScopes, setAlertSubscription } from "#database";

const STATE_LABELS = new Map<string, string>(CONFIG.UFS.filter(item => item.cargo === "3").map(item => [item.uf as string, item.name as string]));
const VALID_SCOPES = new Set(["br", ...STATE_LABELS.keys()]);
const scopeLabel = (scope: string) => scope === "br" ? "Nacional — Presidente" : `Governador — ${STATE_LABELS.get(scope)?.replace(" (Governador)", "") || scope.toUpperCase()}`;

export const runAlertaCommand = async (interaction: ChatInputCommandInteraction) => {
  const action = interaction.options.getString("acao") || "listar";
  await interaction.deferReply({ ephemeral: true });
  try {
    if (action === "listar") {
      const scopes = await listAlertScopes(interaction.user.id);
      await interaction.editReply(scopes.length
        ? `Alertas ativos:\n${scopes.map(scope => `> • ${scopeLabel(scope)}`).join("\n")}\nRecebe por DM: início da apuração, marcos de urnas, virada de liderança, eleito e totalização concluída.`
        : "Nenhum alerta ativo. Use `/alertas acao:ativar uf:br` para começar.");
      return;
    }
    const scope = (interaction.options.getString("uf") || "br").toLowerCase();
    if (!VALID_SCOPES.has(scope)) {
      await interaction.editReply(`UF não disponível. Opções: br, ${[...STATE_LABELS.keys()].join(", ")}.`);
      return;
    }
    await setAlertSubscription(interaction.user.id, scope, action === "ativar");
    await interaction.editReply(action === "ativar"
      ? `**Alertas ativados** para ${scopeLabel(scope)}. Envio por DM: começou a apuração, marcos de urnas (10, 25, 50, 75, 90, 95 e 99%), virada de liderança, candidatos eleitos e totalização concluída.`
      : `**Alertas desativados** para ${scopeLabel(scope)}.`);
  } catch (error) {
    await interaction.editReply(`Não foi possível configurar alertas: ${(error as Error).message}\nAssinaturas precisam de MongoDB configurado.`);
  }
};

export default createCommand({
  name: "alertas",
  description: "Ativa alertas de apuração (TSE) na sua DM: marcos, viradas e eleitos",
  options: [
    { name: "acao", description: "O que fazer", type: ApplicationCommandOptionType.String, required: true, choices: [{ name: "Ativar", value: "ativar" }, { name: "Desativar", value: "desativar" }, { name: "Listar", value: "listar" }] },
    { name: "uf", description: "Alcance: br (nacional) ou sp, rj, mg, ba, rs, pr, pe, ce, sc, go, df", type: ApplicationCommandOptionType.String, required: false, maxLength: 2 },
  ],
  async run(interaction) {
    await runAlertaCommand(interaction);
  },
});
