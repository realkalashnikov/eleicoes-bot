// Roteador de interações: registro de rotas por padrão de customId.
// Adicionar um controle novo = adicionar uma rota, sem cadeia de ifs.
import type { Interaction } from "discord.js";
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from "discord.js";
import {
  bolaoBoard, campaignCategoryReport, getBolaoPanel, getComparePanel, getElectionPanel,
  getEvolutionPanel, getPollPanel, getStatesMapPanel, placeBolaoBet, publishElectionPanel,
  searchDetail, searchPage,
} from "#services";
import { bolaoModal } from "../discord/commands/bolao.js";
import { CONFIG } from "#config";
import { getGuildSettings, updateGuildSettings, type ChannelKey } from "#database";
import { menus } from "#menus";

type AnyInteraction = any; // payloads V2 são dinâmicos; cada handler usa só o que precisa

interface Route {
  pattern: RegExp;
  handle: (interaction: AnyInteraction, match: RegExpMatchArray) => Promise<void>;
}

// ---- settings (guarda de permissão antes de tudo) ----
async function handleSettings(interaction: AnyInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply(menus.feedback.notice("Permissão necessária", "Você precisa de **Gerenciar servidor**.", true));
    return;
  }
  const settings = await getGuildSettings(interaction.guildId);
  if (interaction.customId === "settings:publish-election") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const created = await publishElectionPanel(interaction.client, interaction.guildId);
      await interaction.editReply(menus.feedback.notice(created ? "Painel publicado" : "Painel atualizado", "Painel oficial publicado no canal de apuração configurado.", true));
    } catch (error) {
      await interaction.editReply(menus.feedback.error(`Não foi possível publicar o painel: ${(error as Error).message}`) as any);
    }
    return;
  }
  if (interaction.customId === "settings:refresh") {
    await interaction.deferUpdate();
    await interaction.editReply(menus.settings.main(settings));
    return;
  }
  if (interaction.customId === "settings:prefix") {
    await interaction.showModal(new ModalBuilder({
      customId: "settings:prefix:submit",
      title: "Trocar prefixo",
      components: [new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder({ customId: "prefix", label: "Prefixo", style: TextInputStyle.Short, value: settings.prefix || CONFIG.PREFIX, maxLength: 5, required: true }))],
    }));
    return;
  }
  if (interaction.customId === "settings:prefix:submit") {
    const prefix = interaction.fields.getTextInputValue("prefix").trim();
    if (!prefix || /\s/.test(prefix)) {
      await interaction.reply(menus.feedback.error("Prefixo inválido. Use texto curto sem espaços.") as any);
      return;
    }
    await updateGuildSettings(interaction.guildId, { prefix });
    await interaction.reply(menus.feedback.notice("Prefixo alterado", `Novo prefixo: \`${prefix}\`.`, true));
    return;
  }
  if (interaction.customId === "settings:channels:select") {
    const key = interaction.values[0] as ChannelKey;
    await interaction.deferUpdate();
    await interaction.editReply(menus.settings.main(settings, key));
    return;
  }
  const match = interaction.customId.match(/^settings:channels:set:(election|news|polls|influence)$/);
  if (match) {
    const key = match[1] as ChannelKey;
    const channelId = interaction.values[0];
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.reply(menus.feedback.error("Selecione canal de texto.") as any);
      return;
    }
    await updateGuildSettings(interaction.guildId, { [`channels.${key}`]: channelId });
    await interaction.deferUpdate();
    await interaction.editReply(menus.settings.main(await getGuildSettings(interaction.guildId), key));
  }
}

// ---- pesquisas (botões e menus) ----
async function handleElectionPolls(interaction: AnyInteraction, match: RegExpMatchArray): Promise<void> {
  const office = match[1];
  try {
    await interaction.reply({ ...(await getPollPanel(office, Number(match[2]))) as any, flags: ["IsComponentsV2", "Ephemeral"] });
  } catch {
    await interaction.reply(menus.feedback.notice("Pesquisas indisponíveis", "Não há pesquisas registradas para este cargo e turno. Pesquisas são estimativas, não apuração oficial.", true) as any);
  }
}

async function handlePollCompare(interaction: AnyInteraction): Promise<void> {
  await interaction.deferReply({ flags: ["Ephemeral"] } as any);
  try {
    await interaction.editReply({ components: [await getComparePanel()] } as any);
  } catch (error) {
    console.error("[Interactions] Erro em pesquisa x apuração:", error);
    await interaction.editReply(menus.feedback.error("Não foi possível comparar agora.") as any);
  }
}

async function handlePollPage(interaction: AnyInteraction, match: RegExpMatchArray): Promise<void> {
  await interaction.deferUpdate();
  if (match[4] === "noop") return;
  try {
    // poll:page:cargo:turno:detalhado:página
    await interaction.editReply(await getPollPanel(match[1], Number(match[2]), Number(match[4]), match[3] === "1") as any);
  } catch (error) {
    console.error("[Interactions] Erro ao navegar pesquisas:", error);
    await interaction.followUp(menus.feedback.notice("Pesquisas indisponíveis", "Não foi possível atualizar as pesquisas. Painel atual permanece intacto.", true) as any).catch(() => null);
  }
}

async function handlePollToggle(interaction: AnyInteraction, match: RegExpMatchArray): Promise<void> {
  await interaction.deferUpdate();
  try {
    // poll:toggle:cargo:turno:página:detalhado
    await interaction.editReply(await getPollPanel(match[1], Number(match[2]), Number(match[3]), match[4] === "1") as any);
  } catch (error) {
    console.error("[Interactions] Erro ao alternar detalhamento:", error);
    await interaction.followUp(menus.feedback.notice("Pesquisas indisponíveis", "Não foi possível atualizar as pesquisas. Painel atual permanece intacto.", true) as any).catch(() => null);
  }
}

async function handlePollMenu(interaction: AnyInteraction, match: RegExpMatchArray): Promise<void> {
  const [, menu, currentOffice, currentRound, detailed] = match;
  const value = interaction.values[0];
  await interaction.deferUpdate();
  await interaction.editReply(await getPollPanel(menu === "office" ? value : currentOffice, menu === "round" ? Number(value) : Number(currentRound), 0, detailed === "1") as any);
}

// ---- bolão ----
async function handleBolaoOpen(interaction: AnyInteraction): Promise<void> {
  await interaction.showModal(bolaoModal as any);
}

async function handleBolaoBoard(interaction: AnyInteraction): Promise<void> {
  await interaction.deferReply({ flags: ["Ephemeral"] } as any);
  await interaction.editReply({
    content: (await bolaoBoard(interaction.guildId || undefined)) || "Nenhuma aposta ainda.",
    allowedMentions: { users: [] },
  }).catch(() => null);
}

async function handleBolaoModal(interaction: AnyInteraction): Promise<void> {
  const candidate = interaction.fields.getStringSelectValues("bolao:candidato")[0];
  const raw = interaction.fields.getTextInputValue("bolao:percentual").replace(",", ".");
  try {
    await placeBolaoBet({
      userId: interaction.user.id,
      userName: interaction.user.username,
      guildId: interaction.guildId || undefined,
      candidateName: candidate,
      betPercent: Number(raw),
    });
    const panel = await getBolaoPanel(interaction.guildId || undefined, interaction.user.id);
    await interaction.update(panel as any);
  } catch (error) {
    await interaction.reply(menus.feedback.notice("Aposta não registrada", (error as Error).message, true) as any);
  }
}

// ---- insights ----
async function handleElectionMap(interaction: AnyInteraction): Promise<void> {
  await interaction.deferReply({ flags: ["Ephemeral"] } as any);
  try {
    await interaction.editReply(await getStatesMapPanel(interaction.client, 2) as any);
  } catch (error) {
    console.error("[Interactions] Erro no mapa por estado:", error);
    await interaction.editReply(menus.feedback.error("TSE indisponível agora; tente de novo em instantes.") as any);
  }
}

async function handleElectionChart(interaction: AnyInteraction, match: RegExpMatchArray): Promise<void> {
  const [, uf, cargo, election] = match;
  await interaction.deferReply({ flags: ["Ephemeral"] } as any);
  try {
    await interaction.editReply({ components: [await getEvolutionPanel(uf, cargo, election, 2)] } as any);
  } catch (error) {
    console.error("[Interactions] Erro no gráfico de evolução:", error);
    await interaction.editReply(menus.feedback.error("Não foi possível gerar o gráfico agora.") as any);
  }
}

// ---- observatório ----
async function handleCampaignView(interaction: AnyInteraction, match: RegExpMatchArray): Promise<void> {
  const [, id, category] = match;
  const view = await campaignCategoryReport(id, category);
  if (!view) {
    await interaction.reply(menus.feedback.notice("Consulta expirada", "Execute `/campanha` novamente. Consulta fica ativa por 15 minutos.", true) as any);
    return;
  }
  await interaction.update(menus.observatory.campaign(view.name, view.report, view.election, category, id) as any);
}

async function handleSearchPage(interaction: AnyInteraction): Promise<void> {
  const [, , id, rawPage] = interaction.customId.split(":");
  if (rawPage === "noop") { await interaction.deferUpdate(); return; }
  const page = searchPage(id, Number(rawPage));
  if (!page) { await interaction.reply(menus.feedback.notice("Busca expirada", "Faça nova busca. Resultados ficam disponíveis por 15 minutos.", true) as any); return; }
  await interaction.update(menus.observatory.search({ id, ...page }) as any);
}

async function handleSearchPick(interaction: AnyInteraction): Promise<void> {
  const [, , id, rawPage] = interaction.customId.split(":");
  const detail = searchDetail(id, interaction.values[0]);
  if (!detail) { await interaction.reply(menus.feedback.notice("Busca expirada", "Faça nova busca. Resultados ficam disponíveis por 15 minutos.", true) as any); return; }
  await interaction.update(menus.observatory.searchDetail(id, Number(rawPage), detail.title, detail.body) as any);
}

// ---- apuração ----
async function handleSelectTurn(interaction: AnyInteraction): Promise<void> {
  try {
    await interaction.deferUpdate();
    const [, , uf = "br", cargo = "1"] = interaction.customId.split(":");
    const round = Number(interaction.values[0]) === 1 ? 1 : 2;
    const isFederal = uf === "br" || uf === "zz";
    const election = isFederal ? CONFIG.ELECTION_TURNS[round - 1].federal : CONFIG.ELECTION_TURNS[round - 1].state;
    const panel = await getElectionPanel(uf, cargo, election);
    await interaction.editReply(panel as any);
  } catch (error) {
    await interaction.followUp(menus.feedback.notice("Turno indisponível", "TSE não publicou dados para este recorte. A apuração exibida permanece intacta.", true) as any).catch(() => null);
  }
}

async function handleSelectView(interaction: AnyInteraction): Promise<void> {
  try {
    await interaction.deferUpdate();
    const selectedValue = interaction.values[0]; // "sp:3:6259"
    const [uf, cargo, election] = selectedValue.split(":");
    const panel = await getElectionPanel(uf || "br", cargo || "1", election || CONFIG.FED_ELECTION);
    await interaction.editReply(panel);
  } catch (err) {
    console.error("[Interactions] Erro ao selecionar estado:", err);
    await interaction.followUp(menus.feedback.notice("Recorte indisponível", "Não há dados publicados para essa combinação de estado, cargo e turno. Painel atual permanece intacto.", true) as any).catch(() => null);
  }
}

async function handleElectionButtons(interaction: AnyInteraction): Promise<void> {
  const customId = interaction.customId;
  try {
    await interaction.deferUpdate();
    let uf = "br";
    let cargo = "1";
    let election = CONFIG.FED_ELECTION;
    let page = 0;
    if (customId.startsWith("election:refresh:") || customId.startsWith("election:page:")) {
      const parts = customId.split(":");
      uf = parts[2] || "br";
      cargo = parts[3] || "1";
      election = parts[4] || CONFIG.FED_ELECTION;
      if (customId.startsWith("election:page:")) {
        if (parts[5] === "noop") return;
        page = Math.max(0, Number(parts[5]) || 0);
      }
    } else if (customId.startsWith("election:quick:")) {
      const parts = customId.split(":");
      uf = parts[2] || "br";
      cargo = parts[3] || "1";
      election = parts[4] || (uf === "br" ? CONFIG.FED_ELECTION : CONFIG.STATE_ELECTION);
    }
    const panel = await getElectionPanel(uf, cargo, election, page);
    await interaction.editReply(panel);
  } catch (err) {
    console.error("[Interactions] Erro ao processar clique no botão:", err);
    const message = err instanceof Error && err.message.includes("HTTP 404")
      ? "TSE ainda não publicou este recorte ou código de eleição. O painel atual continua intacto."
      : "Não foi possível atualizar painel eleitoral. Painel atual permanece intacto.";
    await interaction.followUp(menus.feedback.notice("Apuração indisponível", message, true) as any).catch(() => null);
  }
}

// Ordem importa: rotas mais específicas antes das genéricas de election:.
const routes: Route[] = [
  { pattern: /^bolao:submit$/, handle: handleBolaoModal },
  { pattern: /^settings:/, handle: handleSettings },
  { pattern: /^election:polls:(presidente|governador):([12])$/, handle: handleElectionPolls },
  { pattern: /^poll:compare$/, handle: handlePollCompare },
  { pattern: /^poll:page:(presidente|governador):([12]):([01]):(-?\d+|noop)$/, handle: handlePollPage },
  { pattern: /^poll:toggle:(presidente|governador):([12]):(\d+):([01])$/, handle: handlePollToggle },
  { pattern: /^bolao:open$/, handle: handleBolaoOpen },
  { pattern: /^bolao:board$/, handle: handleBolaoBoard },
  { pattern: /^election:map:([a-z]{2}):([13])$/, handle: handleElectionMap },
  { pattern: /^election:chart:([a-z]{2}):([13]):(\d{1,6})$/, handle: handleElectionChart },
  { pattern: /^campaign:view:([a-f\d]+):(all|assets|income|expense|fund)$/, handle: handleCampaignView },
  { pattern: /^search:page:/, handle: handleSearchPage },
  { pattern: /^poll:(office|round):(presidente|governador):([12]):([01])$/, handle: handlePollMenu },
  { pattern: /^search:pick:/, handle: handleSearchPick },
  { pattern: /^election:select_turn:/, handle: handleSelectTurn },
  { pattern: /^election:select_view$/, handle: handleSelectView },
  { pattern: /^election:(refresh|page|quick):/, handle: handleElectionButtons },
];

export async function handleInteraction(interaction: Interaction) {
  const customId = "customId" in interaction ? String((interaction as any).customId) : undefined;
  if (!customId) return;
  const route = routes.find(item => item.pattern.test(customId));
  if (!route) return; // ids desconhecidos são ignorados (comportamento original)
  try {
    await route.handle(interaction as AnyInteraction, customId.match(route.pattern)!);
  } catch (error) {
    console.error(`[Interactions] Erro não tratado em "${customId}":`, error);
  }
}
