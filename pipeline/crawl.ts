import { chromium } from "playwright-core";
import { firecrawl, browserbase } from "./clients.js";
import { config } from "./config.js";
import type { EntityInput } from "./schemas.js";

export interface CrawledPage {
  url: string;
  title: string | null;
  markdown: string;
  publishedAt: string | null; // ISO, if discoverable from metadata
  via: "firecrawl_search" | "firecrawl_scrape" | "browserbase";
}

/** Discovery queries derived from the entity. Open-web only (no logged-in social). */
export function buildQueries(entity: EntityInput): string[] {
  const subject = entity.company ? `${entity.name} ${entity.company}` : entity.name;
  if (entity.type === "person") {
    return [
      `${subject} announcement`,
      `${subject} interview`,
      `${subject} news`,
    ];
  }
  return [
    `${entity.name} announcement`,
    `${entity.name} product launch`,
    `${entity.name} funding OR partnership OR expansion`,
    `${entity.name} hiring`,
  ];
}

function metaPublishedAt(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  const raw =
    (metadata.publishedTime as string) ||
    (metadata.modifiedTime as string) ||
    (metadata.dcDate as string) ||
    (metadata["article:published_time"] as string);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const MIN_CONTENT_CHARS = 200;

/**
 * Collect candidate pages for an entity: Firecrawl Search (with inline scrape)
 * over discovery queries, plus direct Scrape of each seed URL. Any URL that
 * Firecrawl returns empty/blocked is retried through Browserbase.
 */
export async function collectPages(entity: EntityInput): Promise<CrawledPage[]> {
  const fc = firecrawl();
  const byUrl = new Map<string, CrawledPage>();
  const failedUrls = new Set<string>();

  // 1) Discovery search
  for (const query of buildQueries(entity)) {
    try {
      const res = await fc.search(query, {
        limit: config.tuning.searchResultsPerQuery,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      });
      for (const doc of res.data ?? []) {
        const url = doc.url || doc.metadata?.sourceURL;
        if (!url) continue;
        const markdown = doc.markdown ?? "";
        if (markdown.length < MIN_CONTENT_CHARS) {
          failedUrls.add(url);
          continue;
        }
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url,
            title: doc.metadata?.title ?? null,
            markdown,
            publishedAt: metaPublishedAt(doc.metadata),
            via: "firecrawl_search",
          });
        }
      }
    } catch (err) {
      console.warn(`  [crawl] search failed for "${query}": ${(err as Error).message}`);
    }
  }

  // 2) Seed URLs (owned sources) — direct scrape
  for (const url of entity.seed_urls) {
    if (byUrl.has(url)) continue;
    try {
      const doc = await fc.scrapeUrl(url, { formats: ["markdown"], onlyMainContent: true });
      if (doc.success && (doc.markdown ?? "").length >= MIN_CONTENT_CHARS) {
        byUrl.set(url, {
          url,
          title: doc.metadata?.title ?? null,
          markdown: doc.markdown ?? "",
          publishedAt: metaPublishedAt(doc.metadata),
          via: "firecrawl_scrape",
        });
      } else {
        failedUrls.add(url);
      }
    } catch (err) {
      console.warn(`  [crawl] scrape failed for ${url}: ${(err as Error).message}`);
      failedUrls.add(url);
    }
  }

  // 3) Browserbase fallback for hard / JS-heavy pages Firecrawl couldn't read
  if (config.browserbase.enabled) {
    for (const url of failedUrls) {
      if (byUrl.has(url)) continue;
      try {
        const page = await browserbaseFetch(url);
        if (page && page.markdown.length >= MIN_CONTENT_CHARS) byUrl.set(url, page);
      } catch (err) {
        console.warn(`  [crawl] browserbase fallback failed for ${url}: ${(err as Error).message}`);
      }
    }
  }

  return [...byUrl.values()];
}

/** Drive a remote Browserbase Chromium over CDP and return readable page text. */
async function browserbaseFetch(url: string): Promise<CrawledPage | null> {
  const bb = browserbase();
  const session = await bb.sessions.create({ projectId: config.browserbase.projectId });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const title = await page.title();
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    return {
      url,
      title: title || null,
      markdown: text.trim(),
      publishedAt: null,
      via: "browserbase",
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
