import { campaignFinanceReport } from "#database";

const format = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const names: Record<string, string> = { assets: "Patrimônio declarado", income: "Receitas", expense: "Despesas", fund: "Fundos públicos" };
const views = new Map<string, { name: string; election?: string; expiresAt: number }>();

export function createCampaignView(name: string, election?: string): string {
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  views.set(id, { name, election, expiresAt: Date.now() + 15 * 60_000 });
  return id;
}

export async function campaignCategoryReport(id: string, category: string): Promise<{ name: string; election?: string; report: string } | null> {
  const view = views.get(id);
  if (!view || view.expiresAt < Date.now()) { views.delete(id); return null; }
  return { ...view, report: await campaignFinanceSummary(view.name, view.election, category === "all" ? undefined : category) };
}

export async function campaignFinanceSummary(name: string, election?: string, category?: string): Promise<string> {
  const rows = await campaignFinanceReport(name, election, category);
  if (!rows.length) return `Nenhum dado financeiro importado para **${name}**${election ? ` na eleição ${election}` : ""}.`;
  return rows.map(row => `> **${names[row._id] || row._id}:** ${format(row.total)}\n> **Fontes:** ${row.sources.join(" ")}`).join("\n\n");
}
