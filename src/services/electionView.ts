import { CONFIG } from "../config.js";
import { saveElectionSnapshot } from "../database/index.js";
import { buildElectionPanel } from "../menus/electionPanel.js";
import { fetchElectionResults } from "./tse.js";

export function electionSourceUrl(uf: string, cargo: string, election: string): string {
  const paddedCargo = cargo.padStart(4, "0");
  const paddedElection = election.padStart(6, "0");
  return `${CONFIG.TSE_BASE_URL}/${CONFIG.CYCLE}/${election}/dados/${uf}/${uf}-c${paddedCargo}-e${paddedElection}-u.json`;
}

// Painel automático do canal: só leitura, sem botões nem menus (type 1 = ActionRow, em qualquer profundidade).
// nextUpdateAt: carimbo unix do próximo ciclo — o Discord mostra a contagem regressiva ao vivo com <t:...:R>.
export function toStaticPanel<R = any>(panel: any, nextUpdateAt?: number): R {
  // Primeiro converte builders para JSON cru: spread em instância perde getters (ex.: `type`) e o Discord rejeita.
  const toRaw = (node: any): any => {
    if (node && typeof node.toJSON === "function") node = node.toJSON();
    if (Array.isArray(node)) return node.map(toRaw);
    if (node && typeof node === "object") {
      const raw: any = {};
      for (const [key, value] of Object.entries(node)) raw[key] = toRaw(value);
      return raw;
    }
    return node;
  };
  const strip = (node: any): any => {
    if (Array.isArray(node)) return node.map(strip).filter((item: any) => item?.type !== 1);
    if (node && typeof node === "object" && Array.isArray(node.components)) return { ...node, components: strip(node.components) };
    return node;
  };
  const components = strip(toRaw(panel.components ?? []));
  if (nextUpdateAt) {
    const countdown = { type: 10, content: `-# ⏱️ Próxima atualização: <t:${Math.floor(nextUpdateAt / 1000)}:R>` };
    const index = components.findIndex((item: any) => item?.type === 17);
    if (index >= 0) components[index] = { ...components[index], components: [...components[index].components, countdown] };
    else components.push(countdown);
  }
  return { ...panel, components } as R;
}

export async function getElectionPanel(uf = "br", cargo = "1", election = CONFIG.FED_ELECTION, page = 0) {  let resolvedElection = election;
  let panelNotice: string | undefined;
  let summary;
  try {
    summary = await fetchElectionResults(uf, cargo, resolvedElection);
  } catch (error) {
    const noStateRunoff = uf !== "br" && uf !== "zz" && cargo === "3" && election === "6260"
      && error instanceof Error && error.message.includes("HTTP 404");
    if (!noStateRunoff) throw error;
    resolvedElection = "6259";
    summary = await fetchElectionResults(uf, cargo, resolvedElection);
    summary.round = 1;
    summary.sourceUrl = electionSourceUrl(uf, cargo, resolvedElection);
  }
  await saveElectionSnapshot(summary, resolvedElection, cargo, electionSourceUrl(uf, cargo, resolvedElection));
  if (resolvedElection !== election) panelNotice = `TSE sem disputa de governador neste turno; exibindo resultado oficial do 1º turno.`;
  return buildElectionPanel(summary, uf, cargo, resolvedElection, panelNotice, page);
}
