// Configuração: env validada por schema (zod) no load, falha rápida no boot
// para o que é obrigatório em runtime (assertRuntimeEnv, chamado em src/index.ts).
import { z } from "zod";

const DEFAULT_NEWS_FEEDS = [
  "https://g1.globo.com/rss/g1/",
  "https://rss.uol.com.br/feed/noticias.xml",
  "https://www.cnnbrasil.com.br/feed/",
  "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
  "https://feeds.bbci.co.uk/portuguese/rss.xml",
  "https://www.poder360.com.br/feed/",
];

// Vazio/branco = "não configurei" (usa o default), não é erro.
const blankToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "") ? undefined : value;

// Inteiro com faixa: vazio → default; fora da faixa → erro com mensagem clara.
const intEnv = (fallback: number, min: number, max: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce.number().min(min, `mínimo é ${min}`).max(max, `máximo é ${max}`).optional(),
  ).transform(value => value ?? fallback);

const strEnv = (fallback: string, schema: z.ZodType<string> = z.string()) =>
  z.preprocess(blankToUndefined, schema.optional()).transform(value => value ?? fallback);

export const envSchema = z.object({
  BOT_TOKEN: strEnv(""),
  PREFIX: strEnv("e.", z.string().trim().regex(/^\S{1,8}$/, "use de 1 a 8 caracteres sem espaços")),
  MONGO_URI: strEnv(""),
  DATABASE_NAME: strEnv("elections", z.string().trim().min(1)),
  NEWS_FEEDS: z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== ""
      ? value.split(",").map(item => item.trim()).filter(Boolean)
      : undefined),
    z.array(z.string().min(1)).min(1, "informe ao menos uma feed").optional(),
  ).transform(value => value ?? DEFAULT_NEWS_FEEDS),
  NEWS_REFRESH_INTERVAL: intEnv(15, 1, 10_080),
  NEWS_BACKFILL_HOURS: intEnv(24, 1, 168),
  NEWS_BACKFILL_LIMIT: intEnv(10, 1, 20),
  NEWS_DELIVERY_LIMIT: intEnv(3, 1, 10),
  TSE_FINANCE_YEAR: strEnv("2024", z.string().regex(/^\d{4}$/, "ano com 4 dígitos")),
  TSE_CANDIDATES_YEAR: strEnv("2026", z.string().regex(/^\d{4}$/, "ano com 4 dígitos")),
  TSE_CATALOG_REFRESH_INTERVAL: intEnv(720, 1, 525_600),
  // Bolão: aposta aberta durante toda a apuração (100 = fecha só no resultado oficial).
  BOLAO_CLOSE_PERCENT: intEnv(100, 0, 100),
  GUILD_ID: strEnv(""),
  CHANNEL_ID: strEnv(""),
  REFRESH_INTERVAL: intEnv(20, 1, 3600),
  PANEL_REFRESH: intEnv(10, 1, 3600),
});

export type EnvValues = z.infer<typeof envSchema>;

/** Valida e converte o env bruto; lança erro agregado listando todos os problemas. */
export function parseEnv(source: Record<string, string | undefined> = process.env): EnvValues {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(issue => `  - ${issue.path.map(String).join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }
  return parsed.data;
}

const env = parseEnv();

export const CONFIG = {
  BOT_TOKEN: env.BOT_TOKEN,
  PREFIX: env.PREFIX,
  MONGO_URI: env.MONGO_URI,
  DATABASE_NAME: env.DATABASE_NAME,
  NEWS_FEEDS: env.NEWS_FEEDS,
  NEWS_REFRESH_INTERVAL_MS: env.NEWS_REFRESH_INTERVAL * 60 * 1000,
  NEWS_BACKFILL_HOURS: env.NEWS_BACKFILL_HOURS,
  NEWS_BACKFILL_LIMIT: env.NEWS_BACKFILL_LIMIT,
  NEWS_DELIVERY_LIMIT: env.NEWS_DELIVERY_LIMIT,
  TSE_FINANCE_YEAR: env.TSE_FINANCE_YEAR,
  TSE_CANDIDATES_YEAR: env.TSE_CANDIDATES_YEAR,
  TSE_CATALOG_REFRESH_INTERVAL_MS: env.TSE_CATALOG_REFRESH_INTERVAL * 60 * 1000,
  BOLAO_CLOSE_PERCENT: env.BOLAO_CLOSE_PERCENT,
  GUILD_ID: env.GUILD_ID,
  CHANNEL_ID: env.CHANNEL_ID,
  REFRESH_INTERVAL_MS: env.REFRESH_INTERVAL * 1000,
  PANEL_REFRESH_MS: env.PANEL_REFRESH * 1000,

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

const SNOWFLAKE = /^\d{5,25}$/;

/** Checagens que só fazem sentido com o bot de pé; falha o processo antes do login. */
export function assertRuntimeEnv(envSource: Record<string, string | undefined> = process.env): void {
  const problems: string[] = [];
  if (!envSource.BOT_TOKEN?.trim()) {
    problems.push("BOT_TOKEN é obrigatório — copie o token em https://discord.com/developers/applications");
  }
  if (envSource.MONGO_URI?.trim() && !/^mongodb(\+srv)?:\/\//.test(envSource.MONGO_URI.trim())) {
    problems.push("MONGO_URI deve começar com mongodb:// ou mongodb+srv://");
  }
  for (const [name, value] of [["GUILD_ID", envSource.GUILD_ID], ["CHANNEL_ID", envSource.CHANNEL_ID]] as const) {
    if (value?.trim() && !SNOWFLAKE.test(value.trim())) {
      problems.push(`${name} deve ser um ID numérico do Discord (recebido "${value}")`);
    }
  }
  if (problems.length) {
    throw new Error(`Configuração de ambiente inválida:\n${problems.map(item => `  - ${item}`).join("\n")}`);
  }
}
