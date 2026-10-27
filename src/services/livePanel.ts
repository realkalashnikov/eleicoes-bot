import { Client, Message, TextChannel } from "discord.js";
import { CONFIG } from "../config.js";
import { getGuildSettings, updateGuildSettings } from "../database/index.js";
import { syncApplicationEmojis } from "./emojiSync.js";
import { getElectionPanel, toStaticPanel } from "./electionView.js";

// Guilds que já tiveram o painel republicado nesta sessão; as próximas voltas só editam no lugar.
const republished = new Set<string>();

/** Pontos de I/O do ciclo do painel — injetáveis pra testes herméticos. */
export interface LivePanelDeps {
  buildPanel: () => Promise<unknown>;
  getSettings: (guildId: string) => Promise<any>;
  updateSettings: (guildId: string, update: Record<string, unknown>) => Promise<unknown>;
  intervalMs?: number;
}

export const createLivePanelDeps = (): LivePanelDeps => ({
  buildPanel: async () =>
    toStaticPanel(await getElectionPanel("br", "1", CONFIG.FED_ELECTION), Date.now() + CONFIG.PANEL_REFRESH_MS),
  getSettings: getGuildSettings,
  updateSettings: updateGuildSettings,
});

/** Uma volta de sincronização: publica na primeira, edita no lugar nas seguintes. */
export async function runPanelSync(client: Client, deps: LivePanelDeps): Promise<void> {
  const syncGuild = async (guildId: string) => {
    const settings = await deps.getSettings(guildId);
    const channelId = settings.channels?.election;
    if (!channelId) return;
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const channel = await guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return;

    const panel = await deps.buildPanel();
    const prior = settings.panelMessages?.election
      ? await channel.messages.fetch(settings.panelMessages.election).catch(() => null)
      : null;
    let liveMessage: Message | null = prior
      ?? (await channel.messages.fetch({ limit: 40 }).catch(() => null))?.find(message => message.author.id === client.user?.id && message.components?.length > 0) ?? null;

    if (liveMessage && republished.has(guildId)) {
      liveMessage = await liveMessage.edit(panel as any);
    } else {
      // Primeira volta após o restart (ou painel perdido): republica no fim do canal pra aparecer.
      const removed = liveMessage ? await liveMessage.delete().catch(() => null) : null;
      liveMessage = removed ? await channel.send(panel as any) : liveMessage ? await liveMessage.edit(panel as any) : await channel.send(panel as any);
    }
    republished.add(guildId);
    if (!settings.panelMessages?.election || settings.panelMessages.election !== liveMessage.id) {
      await deps.updateSettings(guildId, { "panelMessages.election": liveMessage.id }).catch(() => null);
    }
  };

  for (const guild of client.guilds.cache.values()) {
    await syncGuild(guild.id).catch(error => console.error(`[Painel] ${guild.id}:`, error));
  }
}

export async function startLiveElectionPanel(client: Client, deps: LivePanelDeps = createLivePanelDeps()): Promise<void> {
  await syncApplicationEmojis(client);
  await runPanelSync(client, deps);
  setInterval(() => runPanelSync(client, deps).catch(error => console.error("[Painel]", error)), deps.intervalMs ?? CONFIG.PANEL_REFRESH_MS);
}
