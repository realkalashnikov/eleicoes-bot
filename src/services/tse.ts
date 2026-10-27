import { CONFIG } from "../config.js";
import { progressBarEmojis } from "./progressbar.js";

export interface CandidateResult {
  number: string;
  ballotName: string;
  fullName: string;
  party: string;
  rank: number;
  votes: number;
  votesFormatted: string;
  percentage: number;
  percentageStr: string;
  isElected: boolean;
  status: string;
  runningMate?: string;
  photoUrl?: string;
}

export interface ElectionSummary {
  uf: string;
  round: number;
  cargoName: string;
  generatedDate: string;
  generatedTime: string;
  fetchedAt: number;
  stale: boolean;
  totalSections: number;
  totalizedSections: number;
  totalizedPercent: string;
  totalVotes: number;
  totalVotesFormatted: string;
  validVotes: number;
  validVotesFormatted: string;
  validPercent: string;
  blankVotes: number;
  blankPercent: string;
  nullVotes: number;
  nullPercent: string;
  turnoutPercent: string;
  abstentionPercent: string;
  isComplete: boolean;
  candidates: CandidateResult[];
  sourceUrl: string;
}

const memoryCache = new Map<string, { data: ElectionSummary; timestamp: number }>();

export function createProgressBar(percent: number, size = 10): string {
  const emojiBar = progressBarEmojis(percent, 100, size);
  if (emojiBar) return emojiBar;
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * size);
  const empty = size - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export function formatNumberBr(num: number | string): string {
  const n = typeof num === "string" ? Number(num) : num;
  if (isNaN(n)) return String(num);
  return n.toLocaleString("pt-BR");
}

export async function fetchElectionResults(
  uf = "br",
  cargo = "1",
  election = CONFIG.FED_ELECTION
): Promise<ElectionSummary> {
  const cacheKey = `${uf}-${cargo}-${election}`;
  const paddedCargo = cargo.padStart(4, "0");
  const paddedElection = election.padStart(6, "0");
    const url = `${CONFIG.TSE_BASE_URL}/${CONFIG.CYCLE}/${election}/dados/${uf}/${uf}-c${paddedCargo}-e${paddedElection}-u.json`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "DiscordEleicoesBot/1.0",
      },
      // 5s timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        console.warn(`[TSE] Falha HTTP ${res.status}. Usando cache prévio para ${cacheKey}`);
        return { ...cached.data, stale: true };
      }
      throw new Error(`TSE API retornou HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json() as any;
    if (!json?.carg?.length || !json?.s || !json?.v) throw new Error("Resposta do TSE sem dados de totalização válidos");

    const cargoInfo = json.carg?.[0];
    const cargoName = cargoInfo?.nmn || (cargo === "1" ? "Presidente" : "Governador");

    const candidates: CandidateResult[] = [];

    if (cargoInfo?.agr) {
      for (const coligacao of cargoInfo.agr) {
        for (const partido of coligacao.par || []) {
          for (const cand of partido.cand || []) {
            const votes = Number(cand.vap || 0);
            const percentage = Number((cand.pvap || "0").replace(",", "."));
            const runningMate = cand.vs?.[0]?.nmu || cand.vs?.[0]?.nm;

            candidates.push({
              number: cand.n,
              ballotName: cand.nmu || cand.nm,
              fullName: cand.nm,
              party: partido.sg || "",
              rank: Number(cand.seq || 999),
              votes,
              votesFormatted: formatNumberBr(votes),
              percentage,
              percentageStr: cand.pvap || "0,00",
              isElected: cand.e === "s",
              status: cand.st || "",
              runningMate,
              photoUrl: `${CONFIG.TSE_BASE_URL}/${CONFIG.CYCLE}/${election}/fotos/${uf}/${cand.sqcand}.jpeg`,
            });
          }
        }
      }
    }

    // Ordena por classificação oficial (seq) ou por votos apurados decrescente
    candidates.sort((a, b) => a.rank - b.rank);

    const sectionsTotal = Number(json.s?.ts || 0);
    const sectionsCounted = Number(json.s?.st || 0);
    const totalVotes = Number(json.v?.tv || 0);
    const validVotes = Number(json.v?.vv || 0);
    const blankVotes = Number(json.v?.vb || 0);
    const nullVotes = Number(json.v?.tvn || 0);

    const summary: ElectionSummary = {
      uf: uf.toUpperCase(),
      round: Number(json.t || 1),
      cargoName,
      generatedDate: json.dg || "",
      generatedTime: json.hg || "",
      fetchedAt: Date.now(),
      stale: false,
      totalSections: sectionsTotal,
      totalizedSections: sectionsCounted,
      totalizedPercent: json.s?.pst || "0,00",
      totalVotes,
      totalVotesFormatted: formatNumberBr(totalVotes),
      validVotes,
      validVotesFormatted: formatNumberBr(validVotes),
      validPercent: json.v?.pvvc || "0,00",
      blankVotes,
      blankPercent: json.v?.pvb || "0,00",
      nullVotes,
      nullPercent: json.v?.ptvn || "0,00",
      turnoutPercent: json.e?.pc || "0,00",
      abstentionPercent: json.e?.pa || "0,00",
      isComplete: json.tf === "s" || json.and === "f",
      candidates,
      sourceUrl: url,
    };

    memoryCache.set(cacheKey, { data: summary, timestamp: Date.now() });
    return summary;
  } catch (error) {
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.warn(`[TSE] Erro na requisição (${(error as Error).message}). Retornando cache.`);
      return { ...cached.data, stale: true };
    }
    throw error;
  }
}
