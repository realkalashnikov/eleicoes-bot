const DEFAULT_NEWS_FEEDS = [
  "https://g1.globo.com/rss/g1/",
  "https://rss.uol.com.br/feed/noticias.xml",
  "https://www.cnnbrasil.com.br/feed/",
  "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
  "https://feeds.bbci.co.uk/portuguese/rss.xml",
  "https://www.poder360.com.br/feed/",
];

const configuredNewsFeeds = (process.env.NEWS_FEEDS || "").split(",").map(value => value.trim()).filter(Boolean);

export const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  PREFIX: process.env.PREFIX || "e.",
  MONGO_URI: process.env.MONGO_URI || "",
  DATABASE_NAME: process.env.DATABASE_NAME || "elections",
  NEWS_FEEDS: configuredNewsFeeds.length ? configuredNewsFeeds : DEFAULT_NEWS_FEEDS,
  NEWS_REFRESH_INTERVAL_MS: (Number(process.env.NEWS_REFRESH_INTERVAL) || 15) * 60 * 1000,
  NEWS_BACKFILL_HOURS: Math.min(168, Math.max(1, Number(process.env.NEWS_BACKFILL_HOURS) || 24)),
  NEWS_BACKFILL_LIMIT: Math.min(20, Math.max(1, Number(process.env.NEWS_BACKFILL_LIMIT) || 10)),
  NEWS_DELIVERY_LIMIT: Math.min(10, Math.max(1, Number(process.env.NEWS_DELIVERY_LIMIT) || 3)),
  TSE_FINANCE_YEAR: process.env.TSE_FINANCE_YEAR || "2024",
  TSE_CANDIDATES_YEAR: process.env.TSE_CANDIDATES_YEAR || "2026",
  TSE_CATALOG_REFRESH_INTERVAL_MS: (Number(process.env.TSE_CATALOG_REFRESH_INTERVAL) || 720) * 60 * 1000,
  // Bolão: aposta aberta durante toda a apuração (100 = fecha só no resultado oficial).
  BOLAO_CLOSE_PERCENT: Math.min(100, Math.max(0, Number(process.env.BOLAO_CLOSE_PERCENT) || 100)),
  GUILD_ID: process.env.GUILD_ID || "",
  CHANNEL_ID: process.env.CHANNEL_ID || "",
  REFRESH_INTERVAL_MS: (Number(process.env.REFRESH_INTERVAL) || 20) * 1000,
  PANEL_REFRESH_MS: (Number(process.env.PANEL_REFRESH) || 10) * 1000,

  // TSE 2026 constants
  TSE_BASE_URL: "https://resultados.tse.jus.br/oficial",
  CYCLE: "ele2026",
  FED_ELECTION: "6258",
  STATE_ELECTION: "6260",
  ELECTION_TURNS: [
    { round: 1, federal: "6257", state: "6259" },
    { round: 2, federal: "6258", state: "6260" },
  ] as const,

  // Visuals & Themes
  COLORS: {
    BRAZIL_GREEN: 0x009C3B,
    BRAZIL_BLUE: 0x002776,
    BRAZIL_YELLOW: 0xFFDF00,
    NEUTRAL: 0x2B2D31,
    ALERT: 0xED4245,
  },

  // Abrangências de consulta; código eleitoral é selecionado pelo turno.
  UFS: [
    { uf: "br", name: "Brasil (Presidente)", cargo: "1" },
    { uf: "sp", name: "São Paulo (Governador)", cargo: "3" },
    { uf: "rj", name: "Rio de Janeiro (Governador)", cargo: "3" },
    { uf: "mg", name: "Minas Gerais (Governador)", cargo: "3" },
    { uf: "ba", name: "Bahia (Governador)", cargo: "3" },
    { uf: "rs", name: "Rio Grande do Sul (Governador)", cargo: "3" },
    { uf: "pr", name: "Paraná (Governador)", cargo: "3" },
    { uf: "pe", name: "Pernambuco (Governador)", cargo: "3" },
    { uf: "ce", name: "Ceará (Governador)", cargo: "3" },
    { uf: "sc", name: "Santa Catarina (Governador)", cargo: "3" },
    { uf: "go", name: "Goiás (Governador)", cargo: "3" },
    { uf: "df", name: "Distrito Federal (Governador)", cargo: "3" },
  ] as const,
};
