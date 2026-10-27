import mongoose, { Schema, type Model } from "mongoose";
import { CONFIG } from "../config.js";
import type { ElectionSummary } from "../services/tse.js";

const snapshotSchema = new Schema(
  {
    election: { type: String, required: true },
    uf: { type: String, required: true },
    cargo: { type: String, required: true },
    round: { type: Number, default: 1 },
    generatedDate: String,
    generatedTime: String,
    totalizedSections: Number,
    totalSections: Number,
    totalizedPercent: String,
    totalVotes: Number,
    validVotes: Number,
    blankVotes: Number,
    nullVotes: Number,
    turnoutPercent: String,
    abstentionPercent: String,
    candidates: { type: Schema.Types.Mixed, required: true },
    sourceUrl: { type: String, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

snapshotSchema.index({ election: 1, uf: 1, cargo: 1, round: 1, fetchedAt: -1 });

let connection: Promise<typeof mongoose> | null = null;
let databaseReady = false;
let snapshots: Model<any> | null = null;
let models: {
  candidates: Model<any>;
  polls: Model<any>;
  news: Model<any>;
  sources: Model<any>;
  influenceEvents: Model<any>;
  guildSettings: Model<any>;
  newsDeliveries: Model<any>;
  campaignFinances: Model<any>;
  ingestionRuns: Model<any>;
  alertSubscriptions: Model<any>;
  bolaoBets: Model<any>;
  bolaoState: Model<any>;
} | null = null;

const candidateSchema = new Schema({
  externalId: String,
  name: { type: String, required: true },
  ballotName: String,
  party: String,
  number: String,
  office: String,
  election: String,
  scope: String,
  status: { type: String, enum: ["official_candidate", "reported_pre_candidate", "politician"], default: "official_candidate" },
  statusNote: String,
  sourceUrls: [String],
  updatedAt: { type: Date, default: Date.now },
});

const pollSchema = new Schema({
  institute: { type: String, required: true },
  registration: String,
  office: String,
  election: String,
  scope: String,
  round: { type: Number, enum: [1, 2] },
  fieldworkStart: Date,
  fieldworkEnd: Date,
  publishedAt: Date,
  sampleSize: Number,
  marginError: Number,
  candidates: { type: Schema.Types.Mixed, required: true },
  methodology: String,
  sourceUrl: { type: String, required: true },
});

const newsSchema = new Schema({
  title: { type: String, required: true },
  summary: String,
  publisher: String,
  url: { type: String, required: true },
  publishedAt: Date,
  tags: [String],
  candidateIds: [Schema.Types.ObjectId],
  sourceUrl: String,
});

const sourceSchema = new Schema({
  url: { type: String, required: true },
  publisher: { type: String, required: true },
  title: String,
  kind: { type: String, enum: ["official", "news", "research", "academic", "other"] },
  capturedAt: { type: Date, default: Date.now },
});

const influenceEventSchema = new Schema({
  actor: { type: String, required: true },
  country: String,
  title: { type: String, required: true },
  description: String,
  eventDate: { type: Date, required: true },
  evidenceLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
  hypothesis: String,
  alternativeExplanations: [String],
  sourceUrls: [String],
});

const guildSettingsSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: CONFIG.PREFIX },
    channels: {
      election: String,
      news: String,
      polls: String,
      influence: String,
    },
    panelMessages: {
      election: String,
    },
  },
  { timestamps: true },
);

const newsDeliverySchema = new Schema({
  guildId: { type: String, required: true },
  newsId: { type: Schema.Types.ObjectId, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  deliveredAt: { type: Date, default: Date.now },
});

const campaignFinanceSchema = new Schema({
  election: { type: String, required: true },
  candidateName: { type: String, required: true },
  candidateNumber: String,
  party: String,
  office: String,
  scope: String,
  category: { type: String, enum: ["assets", "income", "expense", "fund"], required: true },
  description: String,
  amount: { type: Number, required: true },
  transactionDate: Date,
  sourceUrl: { type: String, required: true },
  recordKey: { type: String, required: true },
  importedAt: { type: Date, default: Date.now },
});

const bolaoBetSchema = new Schema({
  userId: { type: String, required: true },
  userName: String,
  guildId: String,
  candidateName: { type: String, enum: ["Flávio Bolsonaro", "Lula"], required: true },
  betPercent: { type: Number, required: true, min: 0, max: 100 },
  betAt: { type: Date, default: Date.now },
});
bolaoBetSchema.index({ userId: 1 }, { unique: true });

const bolaoStateSchema = new Schema({
  key: { type: String, required: true, unique: true },
  settledAt: Date,
});

const alertSubscriptionSchema = new Schema({
  userId: { type: String, required: true },
  scope: { type: String, required: true },
}, { timestamps: true });
alertSubscriptionSchema.index({ userId: 1, scope: 1 }, { unique: true });

const ingestionRunSchema = new Schema({
  source: { type: String, required: true },
  resourceUrl: { type: String, required: true },
  status: { type: String, enum: ["cataloged", "running", "complete", "failed"], required: true },
  records: { type: Number, default: 0 },
  detail: String,
  finishedAt: Date,
}, { timestamps: true });

newsSchema.index({ publishedAt: -1 });
pollSchema.index({ office: 1, scope: 1, round: 1, publishedAt: -1 });
influenceEventSchema.index({ eventDate: -1 });
candidateSchema.index({ externalId: 1 }, { unique: true, sparse: true });
newsDeliverySchema.index({ guildId: 1, newsId: 1 }, { unique: true });
campaignFinanceSchema.index({ election: 1, candidateName: 1, category: 1 });
campaignFinanceSchema.index({ recordKey: 1 }, { unique: true });
ingestionRunSchema.index({ source: 1, resourceUrl: 1, createdAt: -1 });

export async function connectDatabase(): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  if (databaseReady) return;
  connection ??= mongoose.connect(CONFIG.MONGO_URI, {
    dbName: CONFIG.DATABASE_NAME,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await connection;
    snapshots ??= mongoose.models.ElectionSnapshot || mongoose.model("ElectionSnapshot", snapshotSchema);
    models ??= {
      candidates: mongoose.models.Candidate || mongoose.model("Candidate", candidateSchema),
      polls: mongoose.models.Poll || mongoose.model("Poll", pollSchema),
      news: mongoose.models.NewsItem || mongoose.model("NewsItem", newsSchema),
      sources: mongoose.models.Source || mongoose.model("Source", sourceSchema),
      influenceEvents: mongoose.models.InfluenceEvent || mongoose.model("InfluenceEvent", influenceEventSchema),
      guildSettings: mongoose.models.GuildSettings || mongoose.model("GuildSettings", guildSettingsSchema),
      newsDeliveries: mongoose.models.NewsDelivery || mongoose.model("NewsDelivery", newsDeliverySchema),
      campaignFinances: mongoose.models.CampaignFinance || mongoose.model("CampaignFinance", campaignFinanceSchema),
      ingestionRuns: mongoose.models.IngestionRun || mongoose.model("IngestionRun", ingestionRunSchema),
      alertSubscriptions: mongoose.models.AlertSubscription || mongoose.model("AlertSubscription", alertSubscriptionSchema),
      bolaoBets: mongoose.models.BolaoBet || mongoose.model("BolaoBet", bolaoBetSchema),
      bolaoState: mongoose.models.BolaoState || mongoose.model("BolaoState", bolaoStateSchema),
    };
    if (!databaseReady) {
      databaseReady = true;
      console.log("[MongoDB] Conectado");
    }
  } catch (error) {
    connection = null;
    console.warn(`[MongoDB] Indisponível; bot segue sem persistência: ${(error as Error).message}`);
  }
}

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
  if (!models?.guildSettings) return fallbackGuildSettings(guildId);
  return (await models.guildSettings.findOneAndUpdate(
    { guildId },
    { $setOnInsert: fallbackGuildSettings(guildId) },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  ).lean()) || fallbackGuildSettings(guildId);
}

export async function updateGuildSettings(guildId: string, update: Record<string, unknown>): Promise<any> {
  if (!CONFIG.MONGO_URI) throw new Error("MONGO_URI não configurado.");
  await connectDatabase();
  if (!models?.guildSettings) throw new Error("Banco de configurações indisponível.");
  return models.guildSettings.findOneAndUpdate(
    { guildId },
    { $set: update },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function publishElectionPanel(client: import("discord.js").Client, guildId: string): Promise<boolean> {
  const settings = await getGuildSettings(guildId);
  const channelId = settings.channels?.election;
  if (!channelId) throw new Error("Canal de apuração não configurado.");
  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("Canal de apuração indisponível ou sem permissão de envio.");
  const { getElectionPanel, toStaticPanel } = await import("../services/electionView.js");
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

export async function listGuildSettings(): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [fallbackGuildSettings(CONFIG.GUILD_ID)];
  await connectDatabase();
  return models?.guildSettings ? models.guildSettings.find().lean() : [];
}

export async function listNews(limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  return models?.news ? models.news.find().sort({ publishedAt: -1 }).limit(limit).lean() : [];
}

export async function listUndeliveredNews(guildId: string, since: Date, limit: number): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
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
  await models?.newsDeliveries?.updateOne(
    { guildId, newsId },
    { $setOnInsert: { guildId, newsId, channelId, messageId, deliveredAt: new Date() } },
    { upsert: true },
  );
}

export async function listPolls(office = "presidente", round?: number, limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  if (!models?.polls) return [];
  return models.polls.find({ office, ...(round ? { round } : {}) }).sort({ publishedAt: -1 }).limit(limit).lean();
}

export async function campaignFinanceReport(name: string, election?: string, category?: string): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
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
  if (!models?.campaignFinances) return 0;
  const result = await models.campaignFinances.bulkWrite(
    items.map(item => ({ updateOne: { filter: { recordKey: item.recordKey }, update: { $set: item }, upsert: true } })),
    { ordered: false },
  );
  await saveSource({ url: items[0].sourceUrl, publisher: "Tribunal Superior Eleitoral", title: "Dados abertos de contas eleitorais", kind: "official" });
  return result.upsertedCount + result.modifiedCount;
}

export async function findCandidates(name: string, limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  return models?.candidates ? models.candidates.find({ $or: [{ name: new RegExp(name, "i") }, { ballotName: new RegExp(name, "i") }] }).limit(limit).lean() : [];
}

export async function searchCandidates(query: string, limit = 10): Promise<any[]> {
  if (!CONFIG.MONGO_URI || query.trim().length < 2) return [];
  await connectDatabase();
  if (!models?.candidates) return [];
  return models.candidates.find({
    $or: [{ name: new RegExp(query, "i") }, { ballotName: new RegExp(query, "i") }],
  }).sort({ updatedAt: -1 }).limit(limit).lean();
}

const escapedRegex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export async function searchObservatory(query: string, limit = 100): Promise<any[]> {
  if (!CONFIG.MONGO_URI || query.trim().length < 2) return [];
  await connectDatabase();
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

function dateForSearch(value: unknown): string {
  return value ? new Date(value as string).toLocaleDateString("pt-BR") : "sem data";
}

export async function saveOfficialCandidates(items: Array<{
  externalId: string; name: string; ballotName?: string; party?: string; number?: string;
  office?: string; election: string; scope?: string; sourceUrl: string;
}>): Promise<number> {
  if (!CONFIG.MONGO_URI || !items.length) return 0;
  await connectDatabase();
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

export async function listInfluenceEvents(actor?: string, limit = 5): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  return models?.influenceEvents
    ? models.influenceEvents.find(actor ? { $or: [{ actor: new RegExp(actor, "i") }, { country: new RegExp(actor, "i") }] } : {}).sort({ eventDate: -1 }).limit(limit).lean()
    : [];
}

export async function saveElectionSnapshot(
  summary: ElectionSummary,
  election: string,
  cargo: string,
  sourceUrl: string,
): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  try {
    await connectDatabase();
    if (!snapshots) return;

    await saveSource({
      url: sourceUrl,
      publisher: "Tribunal Superior Eleitoral",
      title: "Resultados oficiais de totalização do TSE",
      kind: "official",
    });

    const key = { election, uf: summary.uf.toLowerCase(), cargo, round: summary.round };
    const latest = await snapshots.findOne(key).sort({ fetchedAt: -1 }).lean();
    if (latest && latest.generatedTime === summary.generatedTime && latest.totalizedSections === summary.totalizedSections) return;

    await snapshots.create({
      ...key,
      generatedDate: summary.generatedDate,
      generatedTime: summary.generatedTime,
      totalizedSections: summary.totalizedSections,
      totalSections: summary.totalSections,
      totalizedPercent: summary.totalizedPercent,
      totalVotes: summary.totalVotes,
      validVotes: summary.validVotes,
      blankVotes: summary.blankVotes,
      nullVotes: summary.nullVotes,
      turnoutPercent: summary.turnoutPercent,
      abstentionPercent: summary.abstentionPercent,
      candidates: summary.candidates,
      sourceUrl,
      fetchedAt: new Date(),
    });

    if (models?.candidates) {
      for (const candidate of summary.candidates) {
        await models.candidates.updateOne(
          { election, number: candidate.number, scope: summary.uf },
          {
            $set: {
              name: candidate.fullName,
              ballotName: candidate.ballotName,
              party: candidate.party,
              number: candidate.number,
              office: summary.cargoName,
              election,
              scope: summary.uf,
              updatedAt: new Date(),
            },
            $addToSet: { sourceUrls: sourceUrl },
          },
          { upsert: true },
        );
      }
    }
  } catch (error) {
    console.warn(`[MongoDB] Snapshot não salvo: ${(error as Error).message}`);
  }
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

export async function saveSource(source: {
  url: string;
  publisher: string;
  title?: string;
  kind: "official" | "news" | "research" | "academic" | "other";
}): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  try {
    await connectDatabase();
    await models?.sources?.updateOne(
      { url: source.url },
      { $set: source },
      { upsert: true },
    );
  } catch (error) {
    console.warn(`[MongoDB] Fonte não salva: ${(error as Error).message}`);
  }
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
  await models?.ingestionRuns?.updateOne(
    { source: run.source, resourceUrl: run.resourceUrl },
    { $set: run },
    { upsert: true },
  );
}

export async function listSources(limit = 20): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  return models?.sources ? models.sources.find().sort({ capturedAt: -1 }).limit(limit).lean() : [];
}

export async function listSnapshots(election: string, uf: string, cargo: string, limit = 200): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  if (!snapshots) return [];
  const items = await snapshots.find({ election, uf: uf.toLowerCase(), cargo }).sort({ fetchedAt: -1 }).limit(limit).select("generatedTime totalizedPercent candidates fetchedAt").lean();
  return items.reverse();
}

export async function setAlertSubscription(userId: string, scope: string, enabled: boolean): Promise<void> {
  if (!CONFIG.MONGO_URI) throw new Error("MONGO_URI não configurado.");
  await connectDatabase();
  if (!models?.alertSubscriptions) throw new Error("Banco de assinaturas indisponível.");
  if (enabled) await models.alertSubscriptions.updateOne({ userId, scope }, { $setOnInsert: { userId, scope } }, { upsert: true });
  else await models.alertSubscriptions.deleteOne({ userId, scope });
}

export async function listAlertScopes(userId: string): Promise<string[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  return models?.alertSubscriptions ? (await models.alertSubscriptions.find({ userId }).lean()).map(item => item.scope) : [];
}

export async function listAlertSubscribers(scope: string): Promise<string[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  return models?.alertSubscriptions ? (await models.alertSubscriptions.find({ scope }).lean()).map(item => item.userId) : [];
}

export async function setBolaoBet(bet: { userId: string; userName?: string; guildId?: string; candidateName: string; betPercent: number }): Promise<void> {
  if (!CONFIG.MONGO_URI) throw new Error("MONGO_URI não configurado; bolão precisa de banco.");
  await connectDatabase();
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
  if (!models?.bolaoBets) return [];
  return guildId ? models.bolaoBets.find({ guildId }).sort({ betAt: 1 }).lean() : models.bolaoBets.find().sort({ betAt: 1 }).lean();
}

export async function isBolaoSettled(key = "presidente-2"): Promise<boolean> {
  if (!CONFIG.MONGO_URI) return false;
  await connectDatabase();
  const record = models?.bolaoState ? await models.bolaoState.findOne({ key }).lean() : null;
  return Boolean(record?.settledAt);
}

export async function markBolaoSettled(key = "presidente-2"): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await models?.bolaoState?.updateOne({ key }, { $set: { settledAt: new Date() } }, { upsert: true });
}

export async function removeBolaoBet(userId: string): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await models?.bolaoBets?.deleteOne({ userId });
}

export async function purgeTestBolaoBets(guildId: string, userIdPrefix = "test-bolao-"): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  await connectDatabase();
  await models?.bolaoBets?.deleteMany({ guildId, userId: { $regex: `^${userIdPrefix}` } });
}
