import { createCommand } from "#base";
import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { getGuildSettings } from "#database";
import { menus } from "#menus";

export default createCommand({
  name: "config",
  description: "Configura canais e prefixo do servidor",
  defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  async run(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply(menus.feedback.notice("Servidor necessário", "Este comando só funciona em servidor.", true));
      return;
    }

    await interaction.reply(menus.settings.main(await getGuildSettings(interaction.guildId)));
  },
});
