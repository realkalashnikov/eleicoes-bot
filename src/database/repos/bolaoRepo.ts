import { CONFIG } from "../../config.js";
import { connectDatabase, getModels } from "../models.js";

export async function setBolaoBet(bet: { userId: string; userName?: string; guildId?: string; candidateName: string; betPercent: number }): Promise<void> {
  if (!CONFIG.MONGO_URI) throw new Error("MONGO_URI não configurado; bolão precisa de banco.");
  await connectDatabase();
  const models = getModels();
  if (!models?.bolaoBets) throw new Error("Banco do bolão indisponível.");
  await models.bolaoBets.updateOne(
    { userId: bet.userId },
    { $set: { ...bet, betAt: new Date() } },
    { upsert: true },
  );
}

export async function listBolaoBets(guildId?: string): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  if (!models?.bolaoBets) return [];
  return guildId ? models.bolaoBets.find({ guildId }).sort({ betAt: 1 }).lean() : models.bolaoBets.find().sort({ betAt: 1 }).lean();
}

export async function isBolaoSettled(key = "presidente-2"): Promise<boolean> {
  if (!CONFIG.MONGO_URI) return false;
  await connectDatabase();
  const models = getModels();
  const record = models?.bolaoState ? await models.bolaoState.findOne({ key }).lean() : null;
  return Boolean(record?.settledAt);
}

export async function markBolaoSettled(key = "presidente-2"): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await getModels()?.bolaoState?.updateOne({ key }, { $set: { settledAt: new Date() } }, { upsert: true });
}

export async function removeBolaoBet(userId: string): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await getModels()?.bolaoBets?.deleteOne({ userId });
}

export async function purgeTestBolaoBets(guildId: string, userIdPrefix = "test-bolao-"): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await getModels()?.bolaoBets?.deleteMany({ guildId, userId: { $regex: `^${userIdPrefix}` } });
}
