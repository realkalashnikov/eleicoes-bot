import { CONFIG } from "../../config.js";
import { connectDatabase, getModels, getSnapshots } from "../models.js";
import type { ElectionSummary } from "../../services/tse.js";
import { saveSource } from "./observatoryRepo.js";

export async function saveElectionSnapshot(
  summary: ElectionSummary,
  election: string,
  cargo: string,
  sourceUrl: string,
): Promise<void> {
  if (!CONFIG.MONGO_URI) return;
  try {
    await connectDatabase();
    const snapshots = getSnapshots();
    if (!snapshots) return;

    await saveSource({
      url: sourceUrl,
      publisher: "Tribunal Superior Eleitoral",
      title: "Resultados oficiais de totalização do TSE",
      kind: "official",
    });

    const key = { election, uf: summary.uf.toLowerCase(), cargo, round: summary.round };
    const latest = await snapshots.findOne(key).sort({ fetchedAt: -1 }).lean();
    if (latest && latest.generatedTime === summary.generatedTime && latest.totalizedSections === summary.totalizedSections) return;

    await snapshots.create({
      ...key,
      generatedDate: summary.generatedDate,
      generatedTime: summary.generatedTime,
      totalizedSections: summary.totalizedSections,
      totalSections: summary.totalSections,
      totalizedPercent: summary.totalizedPercent,
      totalVotes: summary.totalVotes,
      validVotes: summary.validVotes,
      blankVotes: summary.blankVotes,
      nullVotes: summary.nullVotes,
      turnoutPercent: summary.turnoutPercent,
      abstentionPercent: summary.abstentionPercent,
      candidates: summary.candidates,
      sourceUrl,
      fetchedAt: new Date(),
    });

    const models = getModels();
    if (models?.candidates) {
      for (const candidate of summary.candidates) {
        await models.candidates.updateOne(
          { election, number: candidate.number, scope: summary.uf },
          {
            $set: {
              name: candidate.fullName,
              ballotName: candidate.ballotName,
              party: candidate.party,
              number: candidate.number,
              office: summary.cargoName,
              election,
              scope: summary.uf,
              updatedAt: new Date(),
            },
            $addToSet: { sourceUrls: sourceUrl },
          },
          { upsert: true },
        );
      }
    }
  } catch (error) {
    console.warn(`[MongoDB] Snapshot não salvo: ${(error as Error).message}`);
  }
}

export async function listSnapshots(election: string, uf: string, cargo: string, limit = 200): Promise<any[]> {
  if (!CONFIG.MONGO_URI) return [];
  await connectDatabase();
  const snapshots = getSnapshots();
  if (!snapshots) return [];
  const items = await snapshots.find({ election, uf: uf.toLowerCase(), cargo }).sort({ fetchedAt: -1 }).limit(limit).select("generatedTime totalizedPercent candidates fetchedAt").lean();
  return items.reverse();
}
