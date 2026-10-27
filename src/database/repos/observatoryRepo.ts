import { CONFIG } from "../../config.js";
import { connectDatabase, getModels } from "../models.js";

const escapedRegex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

const dateForSearch = (value: unknown): string => value ? new Date(value as string).toLocaleDateString("pt-BR") : "sem data";

// ---- notícias ----
export async function listNews(limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  return models?.news ? models.news.find().sort({ publishedAt: -1 }).limit(limit).lean() : [];
}

export async function listUndeliveredNews(guildId: string, since: Date, limit: number): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  if (!models?.news || !models.newsDeliveries) return [];
  const deliveries = await models.newsDeliveries.find({ guildId }).select("newsId").lean();
  return models.news.find({
    _id: { $nin: deliveries.map(item => item.newsId) },
    publishedAt: { $gte: since, $lte: new Date() },
  }).sort({ publishedAt: 1 }).limit(limit).lean();
}

export async function saveNewsDelivery(guildId: string, newsId: unknown, channelId: string, messageId: string): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await getModels()?.newsDeliveries?.updateOne(
    { guildId, newsId },
    { $setOnInsert: { guildId, newsId, channelId, messageId, deliveredAt: new Date() } },
    { upsert: true },
  );
}

export async function saveNewsItem(item: {
  title: string;
  summary?: string;
  publisher: string;
  url: string;
  publishedAt?: Date;
  sourceUrl: string;
}): Promise<boolean> {
  if (!CONFIG.MONGO_URI) return false;
  try {
    await connectDatabase();
    const models = getModels();
    if (!models?.news) return false;
    const result = await models.news.updateOne(
      { url: item.url },
      { $setOnInsert: item },
      { upsert: true },
    );
    return result.upsertedCount > 0;
  } catch (error) {
    console.warn(`[MongoDB] Notícia não salva: ${(error as Error).message}`);
    return false;
  }
}

// ---- pesquisas ----
export async function listPolls(office = "presidente", round?: number, limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  if (!models?.polls) return [];
  return models.polls.find({ office, ...(round ? { round } : {}) }).sort({ publishedAt: -1 }).limit(limit).lean();
}

// ---- finanças de campanha ----
export async function campaignFinanceReport(name: string, election?: string, category?: string): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  if (!models?.campaignFinances) return [];
  return models.campaignFinances.aggregate([
    { $match: { candidateName: escapedRegex(name), ...(election ? { election } : {}), ...(category ? { category } : {}) } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, sources: { $addToSet: "$sourceUrl" } } },
  ]);
}

export async function saveCampaignFinances(items: Array<{
  election: string;
  candidateName: string;
  candidateNumber?: string;
  party?: string;
  office?: string;
  scope?: string;
  category: "assets" | "income" | "expense" | "fund";
  description?: string;
  amount: number;
  transactionDate?: Date;
  sourceUrl: string;
  recordKey: string;
}>): Promise<number> {
  if (!CONFIG.MONGO_URI || !items.length) return 0;
  await connectDatabase();
  const models = getModels();
  if (!models?.campaignFinances) return 0;
  const result = await models.campaignFinances.bulkWrite(
    items.map(item => ({ updateOne: { filter: { recordKey: item.recordKey }, update: { $set: item }, upsert: true } })),
    { ordered: false },
  );
  await saveSource({ url: items[0].sourceUrl, publisher: "Tribunal Superior Eleitoral", title: "Dados abertos de contas eleitorais", kind: "official" });
  return result.upsertedCount + result.modifiedCount;
}

// ---- candidatos ----
export async function findCandidates(name: string, limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  return models?.candidates ? models.candidates.find({ $or: [{ name: new RegExp(name, "i") }, { ballotName: new RegExp(name, "i") }] }).limit(limit).lean() : [];
}

export async function searchCandidates(query: string, limit = 10): Promise<any[]> {
  if (!CONFIG.MONGO_URI || query.trim().length < 2) return [];
  await connectDatabase();
  const models = getModels();
  if (!models?.candidates) return [];
  return models.candidates.find({
    $or: [{ name: new RegExp(query, "i") }, { ballotName: new RegExp(query, "i") }],
  }).sort({ updatedAt: -1 }).limit(limit).lean();
}

export async function saveOfficialCandidates(items: Array<{
  externalId: string; name: string; ballotName?: string; party?: string; number?: string;
  office?: string; election: string; scope?: string; sourceUrl: string;
}>): Promise<number> {
  if (!CONFIG.MONGO_URI || !items.length) return 0;
  await connectDatabase();
  const models = getModels();
  if (!models?.candidates) return 0;
  const now = new Date();
  const result = await models.candidates.bulkWrite(items.map(item => ({ updateOne: {
    filter: { externalId: item.externalId },
    update: { $set: { ...item, status: "official_candidate", updatedAt: now }, $addToSet: { sourceUrls: item.sourceUrl } },
    upsert: true,
  } })), { ordered: false });
  await saveSource({ url: items[0].sourceUrl, publisher: "Tribunal Superior Eleitoral", title: `Candidatos — ${items[0].election}`, kind: "official" });
  return result.upsertedCount + result.modifiedCount;
}

// ---- influência ----
export async function listInfluenceEvents(actor?: string, limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  return models?.influenceEvents
    ? models.influenceEvents.find(actor ? { $or: [{ actor: new RegExp(actor, "i") }, { country: new RegExp(actor, "i") }] } : {}).sort({ eventDate: -1 }).limit(limit).lean()
    : [];
}

// ---- fontes e ingestão ----
export async function saveSource(source: {
  url: string;
  publisher: string;
  title?: string;
  kind: "official" | "news" | "research" | "academic" | "other";
}): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  try {
    await connectDatabase();
    await getModels()?.sources?.updateOne(
      { url: source.url },
      { $set: source },
      { upsert: true },
    );
  } catch (error) {
    console.warn(`[MongoDB] Fonte não salva: ${(error as Error).message}`);
  }
}

export async function listSources(limit = 20): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const models = getModels();
  return models?.sources ? models.sources.find().sort({ capturedAt: -1 }).limit(limit).lean() : [];
}

export async function saveIngestionRun(run: {
  source: string;
  resourceUrl: string;
  status: "cataloged" | "running" | "complete" | "failed";
  records?: number;
  detail?: string;
  finishedAt?: Date;
}): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await getModels()?.ingestionRuns?.updateOne(
    { source: run.source, resourceUrl: run.resourceUrl },
    { $set: run },
    { upsert: true },
  );
}

// ---- busca geral do observatório ----
export async function searchObservatory(query: string, limit = 100): Promise<any[]> {
  if (!CONFIG.MONGO_URI || query.trim().length < 2) return [];
  await connectDatabase();
  const models = getModels();
  if (!models) return [];
  const match = escapedRegex(query.trim());
  const [candidates, news, polls, influence, sources] = await Promise.all([
    models.candidates.find({ $or: [{ name: match }, { ballotName: match }, { party: match }, { office: match }] }).sort({ updatedAt: -1 }).limit(limit).lean(),
    models.news.find({ $or: [{ title: match }, { summary: match }, { publisher: match }, { tags: match }] }).sort({ publishedAt: -1 }).limit(limit).lean(),
    models.polls.find({ $or: [{ institute: match }, { office: match }, { scope: match }] }).sort({ publishedAt: -1 }).limit(limit).lean(),
    models.influenceEvents.find({ $or: [{ actor: match }, { country: match }, { title: match }, { description: match }] }).sort({ eventDate: -1 }).limit(limit).lean(),
    models.sources.find({ $or: [{ title: match }, { publisher: match }] }).sort({ capturedAt: -1 }).limit(limit).lean(),
  ]);
  return [
    ...candidates.map(item => ({ id: String(item._id), type: "candidate", title: item.ballotName || item.name, subtitle: `${item.party || "partido não informado"} • ${item.office || "cargo não informado"}`, item })),
    ...news.map(item => ({ id: String(item._id), type: "news", title: item.title, subtitle: `${item.publisher || "fonte não informada"} • ${dateForSearch(item.publishedAt)}`, item })),
    ...polls.map(item => ({ id: String(item._id), type: "poll", title: `${item.institute} — ${item.office || "pesquisa"}`, subtitle: `${item.scope || "abrangência não informada"} • ${dateForSearch(item.publishedAt)}`, item })),
    ...influence.map(item => ({ id: String(item._id), type: "influence", title: item.title, subtitle: `${item.actor}${item.country ? ` • ${item.country}` : ""}`, item })),
    ...sources.map(item => ({ id: String(item._id), type: "source", title: item.title || item.publisher, subtitle: `${item.publisher} • ${item.kind || "fonte"}`, item })),
  ];
}
