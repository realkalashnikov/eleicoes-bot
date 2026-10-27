import { connectDatabase, saveCampaignFinances } from "#database";
import { readFile } from "node:fs/promises";

const [filePath, category, election, sourceUrl] = process.argv.slice(2);
const validCategories = new Set(["assets", "income", "expense", "fund"]);

if (!filePath || !validCategories.has(category) || !election || !sourceUrl) {
  throw new Error("Uso: bun run import:tse <arquivo.csv> <assets|income|expense|fund> <eleicao> <url-fonte-oficial>");
}

const text = await readFile(filePath, "utf8");
const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
const headers = headerLine.split(";").map((value: string) => value.replace(/^\uFEFF/, "").trim().toUpperCase());
const value = (row: string[], ...keys: string[]) => {
  const index = headers.findIndex((header: string) => keys.some(key => header.includes(key)));
  return index >= 0 ? row[index]?.trim() || "" : "";
};
const amount = (raw: string) => Number(raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;

const items = lines.flatMap((line: string) => {
  const row = line.split(";"); // ponytail: quoted CSV needs a parser; add only if TSE schema requires it.
  const candidateName = value(row, "NM_CANDIDATO", "NOME_CANDIDATO");
  const valueRaw = value(row, "VR_", "VALOR");
  if (!candidateName || !valueRaw) return [];
  return [{
    election,
    candidateName,
    candidateNumber: value(row, "NR_CANDIDATO"),
    party: value(row, "SG_PARTIDO"),
    office: value(row, "DS_CARGO", "NM_CARGO"),
    scope: value(row, "SG_UF", "NM_UE"),
    category: category as "assets" | "income" | "expense" | "fund",
    description: value(row, "DS_"),
    amount: amount(valueRaw),
    sourceUrl,
    recordKey: `${sourceUrl}:${category}:${candidateName}:${valueRaw}:${row.join("|").slice(0, 200)}`,
  }];
});

await connectDatabase();
console.log(`[TSE] ${await saveCampaignFinances(items)} registros importados.`);
