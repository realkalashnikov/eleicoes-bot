import { Client, Message, TextChannel } from "discord.js";
import { CONFIG } from "../config.js";
import { getGuildSettings, updateGuildSettings } from "../database/index.js";
import { syncApplicationEmojis } from "./emojiSync.js";
import { getElectionPanel, toStaticPanel } from "./electionView.js";

// Guilds que já tiveram o painel republicado nesta sessão; as próximas voltas só editam no lugar.
const republished = new Set<string>();

export async function startLiveElectionPanel(client: Client): Promise<void> {
  await syncApplicationEmojis(client);
  const syncGuild = async (guildId: string) => {
    const settings = await getGuildSettings(guildId);
    const channelId = settings.channels?.election;
    if (!channelId) return;
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const channel = await guild?.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return;

    const panel = toStaticPanel(await getElectionPanel("br", "1", CONFIG.FED_ELECTION), Date.now() + CONFIG.PANEL_REFRESH_MS);
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
      await updateGuildSettings(guildId, { "panelMessages.election": liveMessage.id }).catch(() => null);
    }
  };

  const sync = async () => {
    for (const guild of client.guilds.cache.values()) {
      await syncGuild(guild.id).catch(error => console.error(`[Painel] ${guild.id}:`, error));
    }
  };

  await sync();
  setInterval(sync, CONFIG.PANEL_REFRESH_MS);
}
