// Publicação/republicação do painel oficial de apuração no canal configurado.
// Discord adapter: vive fora da camada de dados.
import type { Client } from "discord.js";
import { CONFIG } from "../config.js";
import { getGuildSettings, updateGuildSettings } from "../database/index.js";

export async function publishElectionPanel(client: Client, guildId: string): Promise<boolean> {
  const settings = await getGuildSettings(guildId);
  const channelId = settings.channels?.election;
  if (!channelId) throw new Error("Canal de apuração não configurado.");
  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("Canal de apuração indisponível ou sem permissão de envio.");
  const { getElectionPanel, toStaticPanel } = await import("./electionView.js");
  const panel = toStaticPanel(await getElectionPanel("br", "1", CONFIG.FED_ELECTION), Date.now() + CONFIG.PANEL_REFRESH_MS);
  const priorId = settings.panelMessages?.election;
  const prior = priorId && "messages" in channel
    ? await channel.messages.fetch(priorId).catch(() => null)
    : null;
  let message: any;
  if (prior) {
    // Republicar: remove o painel antigo e publica um novo no fim do canal.
    const removed = await prior.delete().catch(() => null);
    message = removed ? await channel.send(panel as any) : await prior.edit(panel as any);
  } else {
    message = await channel.send(panel as any);
  }
  if (CONFIG.MONGO_URI) await updateGuildSettings(guildId, { "panelMessages.election": message.id });
  return !prior || message.id !== priorId;
}
