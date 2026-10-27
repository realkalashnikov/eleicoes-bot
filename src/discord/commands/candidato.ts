import { createCommand } from "#base";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { candidateReport } from "#services";
import { menus } from "#menus";

export default createCommand({
  name: "candidato",
  description: "Consulta dados cadastrados de candidato",
  options: [{ name: "nome", description: "Nome do candidato", type: ApplicationCommandOptionType.String, required: true }],
  async run(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString("nome", true);
    await interaction.deferReply();
    await interaction.editReply(menus.observatory.candidate(name, await candidateReport(name)));
  },
});
