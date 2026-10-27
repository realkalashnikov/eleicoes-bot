import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { CONFIG } from "#config";
import { connectDatabase, saveCampaignFinances, saveIngestionRun } from "#database";

const exec = promisify(execFile);
const root = resolve("data", "tse", CONFIG.TSE_FINANCE_YEAR);
const catalogUrl = `https://dadosabertos.tse.jus.br/api/3/action/package_show?id=prestacao-de-contas-eleitorais-${CONFIG.TSE_FINANCE_YEAR}`;
type Category = "assets" | "income" | "expense" | "fund";
type Resource = { name: string; url: string };

function classify(name: string): Category | null {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("fefc") || normalized.includes("fundo partidario")) return "fund";
  if (normalized.includes("receita")) return "income";
  if (normalized.includes("despesa")) return "expense";
  if (normalized.includes("bem")) return "assets";
  return null;
}

function csv(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += char; index++; } else quoted = !quoted;
    } else if (char === ";" && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

function field(headers: string[], row: string[], ...keys: string[]): string {
  const index = headers.findIndex(header => keys.some(key => header.includes(key)));
  return index < 0 ? "" : row[index] || "";
}

function money(raw: string): number {
  return Number(raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error("TSE retornou arquivo sem conteúdo.");
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destination));
}

async function extract(zipPath: string, output: string): Promise<void> {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  if (process.platform !== "win32") throw new Error("Worker de ZIP ainda suporta Windows; adicione unzip nativo para outro SO.");
  await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${output.replace(/'/g, "''")}' -Force`], { timeout: 300_000 });
}

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

async function importCsv(filePath: string, category: Category, sourceUrl: string): Promise<number> {
  const input = createInterface({ input: createReadStream(filePath, { encoding: "utf8" }), crlfDelay: Infinity });
  let headers: string[] = [];
  let imported = 0;
  let batch: any[] = [];
  for await (const line of input) {
    if (!headers.length) { headers = csv(line).map(value => value.replace(/^\uFEFF/, "").toUpperCase()); continue; }
    const row = csv(line);
    const candidateName = field(headers, row, "NM_CANDIDATO", "NOME_CANDIDATO");
    const rawAmount = field(headers, row, "VR_", "VALOR");
    if (!candidateName || !rawAmount) continue;
    const digest = createHash("sha256").update(`${sourceUrl}|${category}|${line}`).digest("hex");
    batch.push({
      election: CONFIG.TSE_FINANCE_YEAR,
      candidateName,
      candidateNumber: field(headers, row, "NR_CANDIDATO"),
      party: field(headers, row, "SG_PARTIDO"),
      office: field(headers, row, "DS_CARGO", "NM_CARGO"),
      scope: field(headers, row, "SG_UF", "NM_UE"),
      category,
      description: field(headers, row, "DS_"),
      amount: money(rawAmount),
      sourceUrl,
      recordKey: digest,
    });
    if (batch.length === 500) { imported += await saveCampaignFinances(batch); batch = []; }
  }
  if (batch.length) imported += await saveCampaignFinances(batch);
  return imported;
}

await connectDatabase();
await mkdir(root, { recursive: true });
const payload = await (await fetch(catalogUrl, { signal: AbortSignal.timeout(30_000) })).json() as { result?: { resources?: Resource[] } };
const resources = (payload.result?.resources || []).filter(resource => /presta[çc][aã]o de contas de candidatos/i.test(resource.name));

for (const resource of resources) {
  const zipPath = join(root, `${createHash("sha1").update(resource.url).digest("hex")}.zip`);
  const output = zipPath.slice(0, -4);
  try {
    if (!(await stat(zipPath).catch(() => null))) await download(resource.url, zipPath);
    await extract(zipPath, output);
    let records = 0;
    for (const filePath of await files(output)) {
      const category = classify(filePath);
      if (category) records += await importCsv(filePath, category, resource.url);
    }
    await saveIngestionRun({ source: "tse-worker", resourceUrl: resource.url, status: "complete", records, detail: resource.name, finishedAt: new Date() });
    console.log(`[TSE] ${resource.name}: ${records} registros.`);
  } catch (error) {
    await saveIngestionRun({ source: "tse-worker", resourceUrl: resource.url, status: "failed", detail: `${resource.name}: ${(error as Error).message}`, finishedAt: new Date() });
    console.error(`[TSE] ${resource.name}:`, error);
  }
}
