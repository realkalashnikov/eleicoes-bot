import { createCommand } from "#base";
import type { ChatInputCommandInteraction } from "discord.js";
import { newsReport } from "#services";
import { menus } from "#menus";

export default createCommand({
  name: "noticias",
  description: "Lista notícias eleitorais cadastradas",
  async run(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    await interaction.editReply(menus.observatory.news(await newsReport()));
  },
});
