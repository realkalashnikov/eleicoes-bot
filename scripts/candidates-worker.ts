import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { CONFIG } from "#config";
import { connectDatabase, saveIngestionRun, saveOfficialCandidates } from "#database";

const exec = promisify(execFile);
const year = CONFIG.TSE_CANDIDATES_YEAR;
const root = resolve("data", "tse", "candidates", year);
const catalogUrl = `https://dadosabertos.tse.jus.br/api/3/action/package_show?id=candidatos-${year}`;
type Resource = { name: string; url: string; format?: string };

function csv(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') { if (quoted && line[index + 1] === '"') { value += char; index++; } else quoted = !quoted; }
    else if (char === ";" && !quoted) { values.push(value.trim()); value = ""; } else value += char;
  }
  values.push(value.trim()); return values;
}

function value(headers: string[], row: string[], name: string): string {
  const index = headers.indexOf(name); return index < 0 ? "" : row[index] || "";
}

async function download(url: string, destination: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`TSE retornou HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body as any), createWriteStream(destination));
}

async function extract(zipPath: string, output: string): Promise<void> {
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  if (process.platform !== "win32") throw new Error("Extração ZIP requer suporte nativo para este SO.");
  const quote = (path: string) => path.replace(/'/g, "''");
  await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath '${quote(zipPath)}' -DestinationPath '${quote(output)}' -Force`], { timeout: 15 * 60_000 });
}

async function findCsv(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? findCsv(join(directory, entry.name)) : entry.name.toLowerCase().endsWith(".csv") ? [join(directory, entry.name)] : []))).flat();
}

async function importCsv(filePath: string, sourceUrl: string): Promise<number> {
  // TSE CSV usa Windows-1252; UTF-8 troca acentos por �.
  const input = createInterface({ input: createReadStream(filePath, { encoding: "latin1" }), crlfDelay: Infinity });
  let headers: string[] = []; let batch: Parameters<typeof saveOfficialCandidates>[0] = []; let saved = 0;
  for await (const line of input) {
    if (!headers.length) { headers = csv(line).map(header => header.replace(/^\uFEFF/, "").toUpperCase()); continue; }
    const row = csv(line); const name = value(headers, row, "NM_CANDIDATO"); const sequence = value(headers, row, "SQ_CANDIDATO");
    if (!name || !sequence) continue;
    batch.push({ externalId: `${year}:${sequence}`, name, ballotName: value(headers, row, "NM_URNA_CANDIDATO"), party: value(headers, row, "SG_PARTIDO"), number: value(headers, row, "NR_CANDIDATO"), office: value(headers, row, "DS_CARGO"), election: year, scope: value(headers, row, "SG_UF"), sourceUrl });
    if (batch.length === 500) { saved += await saveOfficialCandidates(batch); batch = []; }
  }
  if (batch.length) saved += await saveOfficialCandidates(batch); return saved;
}

await connectDatabase();
const response = await fetch(catalogUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Catálogo TSE retornou HTTP ${response.status}`);
const payload = await response.json() as { result?: { resources?: Resource[] } };
const resource = payload.result?.resources?.find(item => item.name.trim().toLowerCase() === "candidatos" && item.format?.toLowerCase() === "csv");
if (!resource) throw new Error(`Recurso oficial de candidatos ${year} não encontrado.`);
await mkdir(root, { recursive: true });
const zipPath = join(root, `${createHash("sha1").update(resource.url).digest("hex")}.zip`); const output = zipPath.slice(0, -4);
try {
  await saveIngestionRun({ source: "tse-candidates-worker", resourceUrl: resource.url, status: "running", detail: resource.name });
  if (!(await stat(zipPath).catch(() => null))) await download(resource.url, zipPath);
  await extract(zipPath, output);
  let records = 0; for (const filePath of await findCsv(output)) records += await importCsv(filePath, resource.url);
  await saveIngestionRun({ source: "tse-candidates-worker", resourceUrl: resource.url, status: "complete", records, detail: resource.name, finishedAt: new Date() });
  console.log(`[TSE] Candidatos ${year}: ${records} registros atualizados.`);
} catch (error) {
  await saveIngestionRun({ source: "tse-candidates-worker", resourceUrl: resource.url, status: "failed", detail: `${resource.name}: ${(error as Error).message}`, finishedAt: new Date() }); throw error;
}
