import { Client } from "discord.js";
import fs from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EMOJIS_DIR = path.resolve(process.cwd(), "assets", "emojis");
const EMOJIS_CACHE_FILE = path.resolve(process.cwd(), process.env.ENV === "dev" ? "emojis.dev.json" : "emojis.json");
let animated: Record<string, string> = {};

export async function syncApplicationEmojis(
  client: Client,
): Promise<Record<string, string>> {
  const emojiMap: Record<string, string> = {};

  // Carrega cache local prévio se existir
  if (fs.existsSync(EMOJIS_CACHE_FILE)) {
    try {
      const cached = JSON.parse(await readFile(EMOJIS_CACHE_FILE, "utf-8"));
      for (const [name, value] of Object.entries<string>(cached.static ?? {})) emojiMap[name] = value.match(/(\d+)\.\w+$/)?.[1] ?? value;
      animated = cached.animated ?? {};
    } catch {
      // Ignora erro de parse
    }
  }

  if (!fs.existsSync(EMOJIS_DIR)) {
    console.warn(`[EmojiSync] Pasta de assets ${EMOJIS_DIR} não encontrada.`);
    return emojiMap;
  }

  try {
    if (!client.application?.emojis) {
      console.warn(
        "[EmojiSync] client.application.emojis indisponível no momento.",
      );
      return emojiMap;
    }

    console.log("[EmojiSync] Verificando Application Emojis da aplicação...");
    const remoteEmojis = await client.application.emojis.fetch();
    const files = fs.readdirSync(EMOJIS_DIR).filter((f) => f.endsWith(".png"));
    const createdByName = new Map(
      remoteEmojis.map((emoji) => [emoji.name, emoji]),
    );
    const createdById = new Map(remoteEmojis.map((emoji) => [emoji.id, emoji]));
    const usedNames = new Set(createdByName.keys());

    for (const file of files) {
      const name = path.parse(file).name;
      const existing =
        createdByName.get(name) || createdById.get(emojiMap[name]);

      if (existing) {
        emojiMap[name] = existing.id;
        usedNames.add(existing.name);
      } else {
        let applicationName = name;
        if (usedNames.has(applicationName)) {
          const base = `bot_${name}`;
          applicationName = base;
          for (let suffix = 2; usedNames.has(applicationName); suffix++)
            applicationName = `${base}_${suffix}`;
        }
        console.log(
          `[EmojiSync] Enviando Application Emoji ${applicationName}...`,
        );
        try {
          const filePath = path.join(EMOJIS_DIR, file);
          const buffer = fs.readFileSync(filePath);
          const created = await client.application.emojis.create({
            attachment: buffer,
            name: applicationName,
          });
          emojiMap[name] = created.id;
          createdByName.set(applicationName, created);
          createdById.set(created.id, created);
          usedNames.add(applicationName);
          console.log(
            `[EmojiSync] Emoji ${applicationName} criado (ID: ${created.id}).`,
          );
        } catch (uploadErr) {
          console.warn(
            `[EmojiSync] Upload de ${name} falhou:`,
            (uploadErr as Error).message,
          );
        }
      }
    }

    await writeFile(
      EMOJIS_CACHE_FILE,
      `${JSON.stringify({
        static: Object.fromEntries(Object.entries(emojiMap).map(([name, id]) => [name, `https://cdn.discordapp.com/emojis/${id}.png`])),
        animated,
      }, null, 2)}\n`,
    );
    console.log(
      `[EmojiSync] Sincronização concluída (${Object.keys(emojiMap).length} ativos).`,
    );
  } catch (err) {
    console.warn(
      "[EmojiSync] Aviso ao sincronizar Application Emojis:",
      (err as Error).message,
    );
  }

  return emojiMap;
}
