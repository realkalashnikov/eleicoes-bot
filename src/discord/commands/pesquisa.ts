import { createCommand } from "#base";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { getPollPanel } from "#services";

export default createCommand({
  name: "pesquisa",
  description: "Consulta pesquisas eleitorais cadastradas",
  options: [
    { name: "cargo", description: "Cargo pesquisado", type: ApplicationCommandOptionType.String, required: false, choices: [{ name: "Presidente", value: "presidente" }, { name: "Governador", value: "governador" }] },
    { name: "turno", description: "Primeiro ou segundo turno", type: ApplicationCommandOptionType.Integer, required: false, choices: [{ name: "1º turno", value: 1 }, { name: "2º turno", value: 2 }] },
  ],
  async run(interaction: ChatInputCommandInteraction) {
    const office = interaction.options.getString("cargo") || "presidente";
    const round = interaction.options.getInteger("turno") || 2;
    await interaction.deferReply();
    await interaction.editReply(await getPollPanel(office, round) as any);
  },
});
