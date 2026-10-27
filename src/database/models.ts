// Schemas, conexão e registro de models do Mongoose. Funções de consulta ficam em repos/.
import mongoose, { Schema, type Model } from "mongoose";
import { CONFIG } from "../config.js";

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

export interface DatabaseModels {
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
}

let connection: Promise<typeof mongoose> | null = null;
let databaseReady = false;
let snapshots: Model<any> | null = null;
let models: DatabaseModels | null = null;

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

export function getModels(): DatabaseModels | null {
  return models;
}

export function getSnapshots(): Model<any> | null {
  return snapshots;
}
