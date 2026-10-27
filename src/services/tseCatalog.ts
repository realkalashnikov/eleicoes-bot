import { CONFIG } from "#config";
import { saveIngestionRun, saveSource } from "#database";

interface CkanResource { name: string; url: string; format?: string; description?: string }
interface CkanPackage { result?: { title?: string; resources?: CkanResource[] } }

const ckanUrl = (year: string) => `https://dadosabertos.tse.jus.br/api/3/action/package_show?id=prestacao-de-contas-eleitorais-${year}`;

export async function syncTseFinanceCatalog(year = CONFIG.TSE_FINANCE_YEAR): Promise<number> {
  const url = ckanUrl(year);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`TSE catálogo retornou HTTP ${response.status}`);
  const payload = await response.json() as CkanPackage;
  const resources = payload.result?.resources || [];
  const selected = resources.filter(resource => /candidatos|fundo partidário|fefc/i.test(resource.name));

  for (const resource of selected) {
    await saveSource({
      url: resource.url,
      publisher: "Tribunal Superior Eleitoral",
      title: `${payload.result?.title || `Prestação de Contas ${year}`} — ${resource.name}`,
      kind: "official",
    });
    await saveIngestionRun({
      source: "tse-open-data",
      resourceUrl: resource.url,
      status: "cataloged",
      detail: resource.name,
      finishedAt: new Date(),
    });
  }
  return selected.length;
}
