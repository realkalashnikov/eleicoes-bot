import { CONFIG } from "#config";
import { connectDatabase } from "#database";
import { refreshNewsFeeds } from "#services";

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

await connectDatabase();
console.log(`[News] Worker ativo: ${CONFIG.NEWS_FEEDS.length} feeds, intervalo de ${Math.round(CONFIG.NEWS_REFRESH_INTERVAL_MS / 60_000)} min.`);

for (;;) {
  try {
    const saved = await refreshNewsFeeds();
    console.log(`[News] ${new Date().toLocaleString("pt-BR")}: ${saved} item(ns) novo(s).`);
  } catch (error) {
    console.error(`[News] Falha no ciclo: ${(error as Error).message}`);
  }
  await wait(CONFIG.NEWS_REFRESH_INTERVAL_MS);
}
