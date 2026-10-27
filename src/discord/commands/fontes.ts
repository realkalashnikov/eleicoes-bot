import { createCommand } from "#base";
import { sourcesReport } from "#services";
import { menus } from "#menus";
import type { ChatInputCommandInteraction } from "discord.js";

export default createCommand({
  name: "fontes",
  description: "Lista fontes cadastradas no observatório",
  async run(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    await interaction.editReply(menus.observatory.sources(await sourcesReport()));
  },
});
