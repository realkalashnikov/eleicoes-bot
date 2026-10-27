import { CONFIG } from "../../config.js";
import { connectDatabase, getModels } from "../models.js";

export async function setAlertSubscription(userId: string, scope: string, enabled: boolean): Promise<void> {
  if (!CONFIG.MONGO_URI) throw new Error("MONGO_URI não configurado.");
  await connectDatabase();
  const models = getModels();
  if (!models?.alertSubscriptions) throw new Error("Banco de assinaturas indisponível.");
  if (enabled) await models.alertSubscriptions.updateOne({ userId, scope }, { $setOnInsert: { userId, scope } }, { upsert: true });
  else await models.alertSubscriptions.deleteOne({ userId, scope });
}

export async function listAlertScopes(userId: string): Promise<string[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  return models?.alertSubscriptions ? (await models.alertSubscriptions.find({ userId }).lean()).map(item => item.scope) : [];
}

export async function listAlertSubscribers(scope: string): Promise<string[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  return models?.alertSubscriptions ? (await models.alertSubscriptions.find({ scope }).lean()).map(item => item.userId) : [];
}
