import { createEvent } from "#base";
import { CONFIG } from "#config";
import { campaignFinanceSummary, createSearch, getElectionPanel, candidateReport, influenceReport, newsReport, getPollPanel, searchPage, sourcesReport } from "#services";
import { getGuildSettings } from "#database";
import { menus } from "#menus";
import { PermissionFlagsBits } from "discord.js";
import { getHealthReport } from "../commands/status.js";
import { getComparePanel, getBolaoPanel, bolaoBoard, placeBolaoBet, BOLAO_CANDIDATES, normalizeName } from "#services";
import { listAlertScopes, setAlertSubscription } from "#database";

const ALERT_STATES = CONFIG.UFS.filter(item => item.cargo === "3").map(item => item.uf as string);

export async function handlePrefixBolao(values: Map<string, string>, tokens: string[], message: any, live?: any) {
  const positional = tokens.filter(token => !token.startsWith("--"));
  const firstArg = positional[0]?.toLowerCase();
  const action = values.get("acao") || (firstArg === "apostar" ? "apostar" : firstArg === "ver" ? "ver" : "painel");
  try {
    if (action === "apostar") {
      const rest = positional.slice(values.has("acao") ? 0 : 1).map(token => token.replace(/^--/, ""));
      const candidateToken = values.get("candidato") || rest.find(token => BOLAO_CANDIDATES.some(name => normalizeName(name).includes(normalizeName(token.replace(/["'“”]/g, "")))));
      const percentToken = values.get("percentual") || rest.find(token => /^\d{1,3}([.,]\d+)?$/.test(token.replace(/["'“”]/g, "")));
      const candidateName = BOLAO_CANDIDATES.find(name => name.toLowerCase() === String(candidateToken).toLowerCase());
      const betPercent = Number(String(percentToken ?? "").replace(",", "."));
      if (!candidateName || !Number.isFinite(betPercent)) {
        await message.reply("Uso: `e.bolao apostar flavio 51,5` ou `e.bolao --acao=apostar --candidato=\"Lula\" --percentual=48,5`.");
        return;
      }
      await placeBolaoBet({ userId: message.author.id, userName: message.author.username, guildId: message.guildId || undefined, candidateName, betPercent }, live);
      await message.reply(`**Aposta registrada:** ${candidateName} com \`${betPercent.toFixed(1).replace(".", ",")}%\`.`);
      return;
    }
    if (action === "ver") {
      await message.reply(await bolaoBoard(message.guildId || undefined) || "Nenhuma aposta ainda. Use `e.bolao apostar flavio 51,5`.");
      return;
    }
    await message.reply(await getBolaoPanel(message.guildId || undefined, message.author.id) as any);
  } catch (error) {
    await message.reply(menus.feedback.error(`Bolão indisponível: ${(error as Error).message}`) as any);
  }
}
const scopeLabel = (scope: string) => scope === "br" ? "Nacional — Presidente" : `Governador — ${scope.toUpperCase()}`;

async function handlePrefixAlerts(values: Map<string, string>, message: any) {  const action = values.get("acao") || "listar";
  const scope = (values.get("uf") || "br").toLowerCase();
  const valid = new Set(["br", ...ALERT_STATES]);
  try {
    if (action === "listar") {
      const scopes = await listAlertScopes(message.author.id);
      await message.reply(scopes.length ? `Alertas ativos:\n${scopes.map(s => `> • ${scopeLabel(s)}`).join("\n")}` : "Nenhum alerta ativo. Use `e.alertas --acao=ativar --uf=br`.");
      return;
    }
    if (!valid.has(scope)) {
      await message.reply(`UF não disponível. Opções: br, ${ALERT_STATES.join(", ")}.`);
      return;
    }
    await setAlertSubscription(message.author.id, scope, action === "ativar");
    await message.reply(action === "ativar" ? `**Alertas ativados** para ${scopeLabel(scope)}. Envio por DM: começo da apuração, marcos de urnas, virada, eleito e totalização concluída.` : `**Alertas desativados** para ${scopeLabel(scope)}.`);
  } catch (error) {
    await message.reply(menus.feedback.error(`Não foi possível configurar alertas: ${(error as Error).message}`) as any);
  }
}

const aliases = new Map([
  ["apuracao", "apuracao"],
  ["eleicao", "apuracao"],
  ["eleições", "apuracao"],
  ["apuracao-eleitoral", "apuracao"],
  ["candidato", "candidato"],
    ["politico", "candidato"],
    ["buscar", "buscar"],
    ["busca", "buscar"],
    ["search", "buscar"],
  ["pesquisa", "pesquisa"],
  ["noticias", "noticias"],
  ["noticia", "noticias"],
  ["influencia", "influencia"],
  ["fontes", "fontes"],
  ["campanha", "campanha"],
  ["config", "config"],
  ["alertas", "alertas"],
  ["status", "status"],
  ["bolao", "bolao"],
]);

createEvent({
  name: "election-prefix",
  event: "messageCreate",
  async run(message) {
    if (message.author.bot || !message.content) return;
    if (message.mentions.has(message.client.user!)) {
      const settings = message.guildId ? await getGuildSettings(message.guildId) : { prefix: CONFIG.PREFIX };
      await message.reply(`## Observatório Eleitoral\nMeu prefixo neste servidor: \`${settings.prefix || CONFIG.PREFIX}\`\nComandos: \`apuracao\`, \`candidato <nome>\`, \`pesquisa\`, \`noticias\`, \`campanha <nome>\`, \`fontes\`, \`buscar <termo>\`.\nUse \`/config\` (ou \`${settings.prefix || CONFIG.PREFIX}config\`) para configurar canais; requer Gerenciar servidor.`);
      return;
    }
    const settings = message.guildId ? await getGuildSettings(message.guildId) : { prefix: CONFIG.PREFIX };
    const prefix = settings.prefix || CONFIG.PREFIX;
    if (!message.content.startsWith(prefix)) return;
    const tokens = message.content.slice(prefix.length).trim().match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) ?? [];
    const command = tokens.shift()?.toLowerCase();
    const route = command ? aliases.get(command) : undefined;
    if (!route) return;
    if (route === "config" && !message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply(menus.feedback.notice("Permissão necessária", "Você precisa de **Gerenciar servidor** para alterar configurações.") as any);
      return;
    }

    const values = new Map<string, string>();
    for (let i = 0; i < tokens.length; i++) {
      if (!tokens[i].startsWith("--")) continue;
      const [key, inline] = tokens[i].slice(2).split("=", 2);
      values.set(key, inline ?? tokens[++i] ?? "");
    }

    try {
      const positional = tokens.filter(token => !token.startsWith("--")).join(" ");
      const content = route === "config"
        ? menus.settings.main(await getGuildSettings(message.guildId!))
        : route === "apuracao"
        ? await getElectionPanel(values.get("uf") || "br", values.get("cargo") || "1", values.get("eleicao") || CONFIG.FED_ELECTION)
        : route === "candidato"
        ? menus.observatory.candidate(positional, await candidateReport(positional))
        : route === "buscar"
        ? null
         : route === "pesquisa"
         ? await getPollPanel(values.get("cargo") || positional || "presidente", Number(values.get("turno")) || 2)
        : route === "noticias"
        ? menus.observatory.news(await newsReport())
        : route === "campanha"
        ? menus.observatory.campaign(positional, await campaignFinanceSummary(positional, values.get("eleicao"), values.get("categoria")), values.get("eleicao"))
        : route === "influencia"
        ? menus.observatory.influence(values.get("ator") || positional || undefined, await influenceReport(values.get("ator") || positional || undefined))
        : route === "status"
        ? { components: [await getHealthReport()], flags: ["IsComponentsV2"] }
        : route === "alertas"
        ? null
        : route === "bolao"
        ? null
        : menus.observatory.sources(await sourcesReport());
      if (route === "buscar") {
        const search = await createSearch(positional);
        const page = searchPage(search.id, 0)!;
        await message.reply(menus.observatory.search({ ...search, ...page }) as any);
      } else if (route === "alertas") {
        await handlePrefixAlerts(values, message);
      } else if (route === "bolao") {
        await handlePrefixBolao(values, tokens, message);
      } else await message.reply(content as any);
    } catch (error) {
      await message.reply(menus.feedback.error(`Não foi possível obter dados: ${(error as Error).message}`) as any);
    }
  },
});
