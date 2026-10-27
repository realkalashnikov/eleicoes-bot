import { createCommand } from "#base";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import { influenceReport } from "#services";
import { menus } from "#menus";

export default createCommand({
  name: "influencia",
  description: "Consulta eventos e evidências de influência política",
  options: [{ name: "ator", description: "País, governo, empresa ou organismo", type: ApplicationCommandOptionType.String, required: false }],
  async run(interaction: ChatInputCommandInteraction) {
    const actor = interaction.options.getString("ator") || undefined;
    await interaction.deferReply();
    await interaction.editReply(menus.observatory.influence(actor, await influenceReport(actor)));
  },
});
