import { CONFIG } from "../config.js";
import {
  getGuildSettings,
  listUndeliveredNews,
  saveNewsDelivery,
} from "../database/index.js";
import { Client, TextChannel } from "discord.js";
import { refreshNewsFeeds } from "./newsFeeds.js";
import { icon } from "../functions/utils/icon.js";
import { syncTseFinanceCatalog } from "./tseCatalog.js";
import {
  brBuilder,
  createContainer,
  createLinkButton,
  createRow,
} from "@magicyan/discord";

async function publishNews(client: Client, initial: boolean): Promise<void> {
  const since = new Date(
    Date.now() - CONFIG.NEWS_BACKFILL_HOURS * 60 * 60 * 1000,
  );
  const limit = initial
    ? CONFIG.NEWS_BACKFILL_LIMIT
    : CONFIG.NEWS_DELIVERY_LIMIT;
  for (const guild of client.guilds.cache.values()) {
    const settings = await getGuildSettings(guild.id);
    const channelId = settings.channels?.news;
    if (!channelId) continue;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) continue;

    const pending = await listUndeliveredNews(guild.id, since, limit);
    for (const item of pending) {
      const message = await channel
        .send({
          flags: ["IsComponentsV2"],
          components: [
            createContainer(
              0xfee75c,
              brBuilder(
                `## ${icon.chart_bar} ${item.title}`,
                `> **Fonte:** ${item.publisher || "não informada"} • ${item.publishedAt ? new Date(item.publishedAt).toLocaleString("pt-BR") : "sem data"}`,
                item.summary ? `> ${item.summary.slice(0, 500)}` : "",
              ),
              createRow(createLinkButton(item.url, "Abrir fonte", "↗")),
            ),
          ],
        })
        .catch(() => null);
      if (message)
        await saveNewsDelivery(guild.id, item._id, channel.id, message.id);
    }
  }
}

export async function startSourceScheduler(client: Client): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  if (CONFIG.NEWS_FEEDS.length) {
    await refreshNewsFeeds();
    await publishNews(client, true);
    setInterval(async () => {
      await refreshNewsFeeds();
      await publishNews(client, false);
    }, CONFIG.NEWS_REFRESH_INTERVAL_MS);
  }
  await syncTseFinanceCatalog().catch((error) =>
    console.warn(`[TSE] Catálogo indisponível: ${(error as Error).message}`),
  );
  setInterval(() => {
    syncTseFinanceCatalog().catch((error) =>
      console.warn(`[TSE] Catálogo indisponível: ${(error as Error).message}`),
    );
  }, CONFIG.TSE_CATALOG_REFRESH_INTERVAL_MS);
}
