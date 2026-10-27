import { CONFIG } from "../../config.js";
import { connectDatabase, getModels } from "../models.js";

export type ChannelKey = "election" | "news" | "polls" | "influence";

const fallbackGuildSettings = (guildId: string) => ({
  guildId,
  prefix: CONFIG.PREFIX,
  channels: guildId === CONFIG.GUILD_ID ? { election: CONFIG.CHANNEL_ID } : {},
  panelMessages: {},
});

export async function getGuildSettings(guildId: string): Promise<any> {
  if (!CONFIG.MONGO_URI) return fallbackGuildSettings(guildId);
  await connectDatabase();
  if (!getModels()?.guildSettings) return fallbackGuildSettings(guildId);
  return (await getModels()!.guildSettings.findOneAndUpdate(
    { guildId },
    { $setOnInsert: fallbackGuildSettings(guildId) },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  ).lean()) || fallbackGuildSettings(guildId);
}

export async function updateGuildSettings(guildId: string, update: Record<string, unknown>): Promise<any> {
  if (!CONFIG.MONGO_URI) throw new Error("MONGO_URI não configurado.");
  await connectDatabase();
  const models = getModels();
  if (!models?.guildSettings) throw new Error("Banco de configurações indisponível.");
  return models.guildSettings.findOneAndUpdate(
    { guildId },
    { $set: update },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function listGuildSettings(): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [fallbackGuildSettings(CONFIG.GUILD_ID)];
  await connectDatabase();
  const models = getModels();
  return models?.guildSettings ? models.guildSettings.find().lean() : [];
}
