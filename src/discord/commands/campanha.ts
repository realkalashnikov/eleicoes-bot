import { createCommand } from "#base";
import { campaignFinanceSummary, createCampaignView } from "#services";
import { menus } from "#menus";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";

export default createCommand({
  name: "campanha",
  description: "Consulta patrimônio, receitas, despesas e fundos de campanha",
  options: [
    { name: "nome", description: "Nome do candidato", type: ApplicationCommandOptionType.String, required: true },
    { name: "eleicao", description: "Ano ou código da eleição", type: ApplicationCommandOptionType.String, required: false },
    { name: "categoria", description: "Categoria financeira", type: ApplicationCommandOptionType.String, required: false, choices: [
      { name: "Resumo", value: "all" }, { name: "Patrimônio", value: "assets" }, { name: "Receitas", value: "income" },
      { name: "Despesas", value: "expense" }, { name: "Fundos públicos", value: "fund" },
    ] },
  ],
  async run(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString("nome", true);
    const election = interaction.options.getString("eleicao") || undefined;
    const category = interaction.options.getString("categoria");
    const selectedCategory = category === "all" ? undefined : category || undefined;
    await interaction.deferReply();
    const viewId = createCampaignView(name, election);
    await interaction.editReply(menus.observatory.campaign(name, await campaignFinanceSummary(name, election, selectedCategory), election, category || "all", viewId));
  },
});
