import { createCommand } from "#base";
import { menus } from "#menus";
import { createSearch, searchPage } from "#services";
import { searchCandidates } from "#database";
import { ApplicationCommandOptionType, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";

export default createCommand({
  name: "buscar",
  description: "Busca perfis políticos e candidaturas verificadas",
  options: [{ name: "termo", description: "Nome de pessoa ou candidatura", type: ApplicationCommandOptionType.String, required: true, autocomplete: true }],
  async autocomplete(interaction: AutocompleteInteraction) {
    const query = interaction.options.getFocused();
    const results = await searchCandidates(query, 10);
    return results.map(item => ({ name: `${item.ballotName || item.name} — ${item.party || "sem partido"}`.slice(0, 100), value: item.name.slice(0, 100) }));
  },
  async run(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString("termo", true);
    await interaction.deferReply();
    const search = await createSearch(query);
    const page = searchPage(search.id, 0)!;
    await interaction.editReply(menus.observatory.search({ ...search, ...page }));
  },
});
