import { CONFIG } from "../config.js";
import { saveNewsItem, saveSource } from "../database/index.js";

type FeedItem = { title: string; url: string; summary?: string; publishedAt?: Date };

function clean(value: string): string {
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function feedText(response: Response): Promise<string> {
  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const declared = response.headers.get("content-type") || "";
  if (/charset\s*=\s*(iso-8859-1|windows-1252)/i.test(declared) || utf8.includes("�")) return new TextDecoder("windows-1252").decode(bytes);
  return utf8;
}

function tag(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? clean(match[1]) : "";
}

function parseFeed(xml: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)];
  return blocks.flatMap(([, block]) => {
    const title = tag(block, "title");
    const linkMatch = block.match(/<link(?:\s[^>]*)?(?:href=["']([^"']+)["'][^>]*)?\/?>(?:([^<]+)<\/link>)?/i);
    const url = linkMatch?.[1] || clean(linkMatch?.[2] || "");
    if (!title || !url) return [];
    const dateText = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
    return [{
      title,
      url,
      summary: tag(block, "description") || tag(block, "summary"),
      publishedAt: dateText ? new Date(dateText) : undefined,
    }];
  });
}

export async function refreshNewsFeeds(): Promise<number> {
  if (!CONFIG.MONGO_URI || !CONFIG.NEWS_FEEDS.length) return 0;
  let saved = 0;
  for (const feedUrl of CONFIG.NEWS_FEEDS) {
    try {
      const response = await fetch(feedUrl, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
       const xml = await feedText(response);
      const publisher = new URL(feedUrl).hostname;
      await saveSource({ url: feedUrl, publisher, title: `Feed RSS ${publisher}`, kind: "news" });
      for (const item of parseFeed(xml).slice(0, 30)) {
        if (await saveNewsItem({ ...item, publisher, sourceUrl: feedUrl })) saved++;
      }
    } catch (error) {
      console.warn(`[News] Feed indisponível ${feedUrl}: ${(error as Error).message}`);
    }
  }
  return saved;
}
