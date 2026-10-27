import { findCandidates, listInfluenceEvents, listNews, listPolls, listSources, searchCandidates, searchObservatory } from "#database";
import { buildPollPanel } from "../menus/observatoryPanels.js";

type SearchItem = { id: string; type: string; title: string; subtitle: string; item: any };
const searches = new Map<string, { query: string; items: SearchItem[]; expiresAt: number }>();
const PAGE_SIZE = 10;

const date = (value: unknown) => value ? new Date(value as string).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "sem data";

export async function candidateReport(name: string): Promise<string> {
  const items = await findCandidates(name);
  if (!items.length) return `Nenhum candidato encontrado para **${name}**.\n\nFonte ainda não cadastrada.`;
  return items.map(item => `## ${item.name}\n> **Status:** ${item.status === "reported_pre_candidate" ? "pré-candidatura reportada" : item.status === "politician" ? "político" : "candidatura oficial TSE"}\n> **Partido:** ${item.party || "não informado"} • **Cargo:** ${item.office || "não informado"}\n> **Número:** ${item.number || "não informado"}${item.statusNote ? `\n> ${item.statusNote}` : ""}\n> **Fontes:** ${(item.sourceUrls || []).join(" ") || "não informadas"}`).join("\n\n");
}

export async function createSearch(query: string): Promise<{ id: string; query: string; total: number }> {
  const items = await searchObservatory(query);
  const id = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  searches.set(id, { query, items, expiresAt: Date.now() + 15 * 60_000 });
  return { id, query, total: items.length };
}

export function getSearch(id: string): { query: string; items: SearchItem[] } | null {
  const search = searches.get(id);
  if (!search || search.expiresAt < Date.now()) { searches.delete(id); return null; }
  return search;
}

export function searchPage(id: string, page: number): { query: string; total: number; page: number; pages: number; items: SearchItem[] } | null {
  const search = getSearch(id);
  if (!search) return null;
  const pages = Math.max(1, Math.ceil(search.items.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, pages - 1));
  return { query: search.query, total: search.items.length, page: safePage, pages, items: search.items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) };
}

export function searchDetail(id: string, itemId: string): { title: string; body: string } | null {
  const result = getSearch(id)?.items.find(item => item.id === itemId);
  if (!result) return null;
  const item = result.item;
  if (result.type === "candidate") return { title: result.title, body: `**Tipo:** perfil político/candidatura\n**Status:** ${item.status === "reported_pre_candidate" ? "pré-candidatura reportada" : item.status === "politician" ? "político" : "candidatura oficial TSE"}\n**Nome:** ${item.name}\n**Partido:** ${item.party || "não informado"}\n**Cargo:** ${item.office || "não informado"}\n**Número:** ${item.number || "não informado"}\n**Fontes:** ${(item.sourceUrls || []).join(" ") || "não informadas"}` };
  if (result.type === "news") return { title: result.title, body: `**Tipo:** notícia\n**Veículo:** ${item.publisher || "não informado"}\n**Data:** ${date(item.publishedAt)}\n${item.summary || "Sem resumo."}\n[**Abrir notícia**](${item.url})` };
  if (result.type === "poll") return { title: result.title, body: `**Tipo:** pesquisa\n**Registro:** ${item.registration || "não informado"}\n**Coleta:** ${date(item.fieldworkStart)} a ${date(item.fieldworkEnd)}\n**Amostra:** ${item.sampleSize || "não informada"}\n**Margem:** ${item.marginError ? `${item.marginError}%` : "não informada"}\n[**Fonte**](${item.sourceUrl})` };
  if (result.type === "influence") return { title: result.title, body: `**Tipo:** evento de influência\n**Ator:** ${item.actor}${item.country ? ` (${item.country})` : ""}\n**Data:** ${date(item.eventDate)}\n**Evidência:** ${item.evidenceLevel || "baixa"}\n${item.description || "Sem descrição."}\n**Hipótese:** ${item.hypothesis || "não avaliada"}\n**Alternativas:** ${(item.alternativeExplanations || []).join("; ") || "não informadas"}\n**Fontes:** ${(item.sourceUrls || []).join(" ") || "não informadas"}` };
  return { title: result.title, body: `**Tipo:** fonte\n**Publicador:** ${item.publisher}\n**Categoria:** ${item.kind || "não informada"}\n[**Abrir fonte**](${item.url})` };
}

const POLL_SOURCE = "https://www.poder360.com.br/poder-eleicoes-2026/saiba-como-estao-lula-e-flavio-nas-pesquisas-a-1-dia-da-eleicao/";
const PRESIDENT_POLL_DATA = [
  ["PoderData/Aya",51,49,"19/10/2026","21/10/2026",4000,1.6,"BR-07926/2026"],
  ["BTG/Nexus",50.5,49.5,"23/10/2026","24/10/2026",2000,2.2,"BR-08234/2026"],
  ["AtlasIntel/Bloomberg",50.8,49.2,"18/10/2026","23/10/2026",4990,1,"BR-06380/2026"],
  ["Datafolha",51,49,"23/10/2026","24/10/2026",4050,2,"BR-09540/2026"],
  ["Indexa/Broadcast",51,49,"13/10/2026","14/10/2026",2000,2.2,"BR-04629/2026"],
  ["Instituto França",51.4,48.6,"21/10/2026","23/10/2026",1537,2.5,"BR-04863/2026"],
  ["CNT/MDA",50.7,49.3,"21/10/2026","23/10/2026",2032,2.2,"BR-02136/2026"],
  ["Palver",51,49,"16/10/2026","20/10/2026",5000,2.4,"BR-04612/2026"],
  ["Gerp",52,48,"22/10/2026","24/10/2026",2400,2,"BR-09327/2026"],
  ["Futura",51.1,48.9,"19/10/2026","20/10/2026",2000,2.2,"BR-06614/2026"],
  ["DataTrends",51.5,48.5,"15/10/2026","17/10/2026",2000,2.19,"BR-04454/2026"],
  ["Ipespe/Abrapel",50.5,49.5,"20/10/2026","22/10/2026",1500,2.6,"BR-04350/2026"],
  ["Real Time Big Data",52,48,"19/10/2026","22/10/2026",2000,2,"BR-09670/2026"],
  ["Instituto Veritá",51.1,48.9,"12/10/2026","16/10/2026",15554,1,"BR-01107/2026"],
  ["Meio/Ideia",51.1,48.9,"15/10/2026","19/10/2026",1500,2.5,"BR-08251/2026"],
  ["Quaest",51,49,"23/10/2026","24/10/2026",3702,2,"BR-09158/2026"],
  ["Vox Brasil",49.4,50.6,"20/10/2026","22/10/2026",2100,2.15,"BR-03259/2026"],
  ["Alfa Inteligência",52,48,"18/10/2026","22/10/2026",2700,1.9,"BR-08496/2026"],
].map(([institute, flavio, lula, start, end, sampleSize, marginError, registration]) => ({
  institute, office: "presidente", fieldworkStart: start, fieldworkEnd: end, sampleSize, marginError, registration,
  candidates: [{ name: "Flávio Bolsonaro", validVotes: flavio }, { name: "Lula", validVotes: lula }], sourceUrl: POLL_SOURCE,
} as any));

export function pollCatalog(office = "presidente", round = 2) {
  return office === "presidente" && round === 2 ? PRESIDENT_POLL_DATA : [];
}

const POLL_PAGE_SIZE = 5;
const pct = (value: number) => value.toFixed(2).replace(".", ",");

export async function getPollPanel(office = "presidente", round = 2, page = 0, detailed = false) {
  const staticItems = pollCatalog(office, round);
  const stored = (await listPolls(office, round)).filter(item => !staticItems.some(report => report.registration === item.registration));
  const items = [...staticItems, ...stored];
  const pages = Math.max(1, Math.ceil(items.length / POLL_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, pages - 1));
  if (!items.length) return buildPollPanel(office, round, `Nenhuma pesquisa cadastrada para **${office}** no ${round}º turno.`, { page: 0, pages: 1, detailed });
  const comparable = items.filter(item => item.candidates?.[0]?.validVotes != null);
  const average = comparable.reduce((sum, item) => sum + Number(item.candidates[0].validVotes), 0) / comparable.length;
  const rows = items.slice(safePage * POLL_PAGE_SIZE, (safePage + 1) * POLL_PAGE_SIZE).map((item, index) => {
    const [first, second] = item.candidates || [];
    const title = `${safePage * POLL_PAGE_SIZE + index + 1}. ${item.institute}`;
    const result = `${first?.name?.split(" ")[0]} ${first?.validVotes}% • ${second?.name?.split(" ")[0]} ${second?.validVotes}%`;
    const margin = `±${item.marginError || "?"} p.p.`;
    if (!detailed) return `**${title}** — ${result}\n> Coleta ${date(item.fieldworkStart)}–${date(item.fieldworkEnd)} • n=${item.sampleSize?.toLocaleString("pt-BR") || "?"} • ${margin}`;
    return `### ${title}\n> **Votos válidos:** ${result}\n> **Coleta:** ${date(item.fieldworkStart)} a ${date(item.fieldworkEnd)}${item.publishedAt ? ` • **Divulgação:** ${date(item.publishedAt)}` : ""}\n> **Amostra:** ${item.sampleSize?.toLocaleString("pt-BR") || "não informada"} • **Margem:** ${margin} • **Confiança:** ${item.confidence || "95%"}\n> **Registro informado:** ${item.registration || "não informado"}\n> **Metodologia:** ${item.methodology || "consultar ficha do registro no PesqEle; não reproduzida pela compilação"}\n> **Fonte:** [reportagem](${item.sourceUrl})`;
  });
  const report = `## Média simples: ${pct(average)}% Flávio • ${pct(100 - average)}% Lula\n> ${comparable.length} levantamentos comparáveis, mesmo peso; dados compilados pelo Poder360. Sem ajuste de data/amostra, não é previsão.\n\n${rows.join("\n\n")}`;
  return buildPollPanel(office, round, report, { page: safePage, pages, detailed });
}

export async function newsReport(): Promise<string> {
  const items = await listNews();
  if (!items.length) return "Nenhuma notícia cadastrada. Feed ainda não configurado.";
  return items.map((item, index) => `**${index + 1}. [${item.title}](${item.url})**\n> ${item.publisher || "Fonte não informada"} • ${date(item.publishedAt)}${item.summary ? `\n> ${item.summary}` : ""}`).join("\n\n");
}

export async function influenceReport(actor?: string): Promise<string> {
  const items = await listInfluenceEvents(actor);
  if (!items.length) return `Nenhum evento de influência cadastrado${actor ? ` para **${actor}**` : ""}.`;
  return items.map(item => `## ${item.title}\n> **Ator:** ${item.actor}${item.country ? ` (${item.country})` : ""} • **Data:** ${date(item.eventDate)}\n> **Evidência:** ${item.evidenceLevel || "baixa"}\n> ${item.description || "Sem descrição"}\n> **Hipótese:** ${item.hypothesis || "não avaliada"}\n> **Fontes:** ${(item.sourceUrls || []).join(" ") || "não informadas"}`).join("\n\n");
}

export async function sourcesReport(): Promise<string> {
  const items = await listSources();
  if (!items.length) return "Nenhuma fonte cadastrada. Configure MongoDB e alimente dados com fontes oficiais.";
  return items.map((item, index) => `**${index + 1}. [${item.title || item.publisher}](${item.url})**\n> Tipo: ${item.kind || "não informado"} • Capturada: ${date(item.capturedAt)}`).join("\n\n");
}
