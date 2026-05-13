import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";

export const DEFAULT_SOURCES = [
  {
    name: "WCAX",
    homepage: "https://www.wcax.com/",
    feedUrl:
      "https://www.wcax.com/arc/outboundfeeds/whiz-rss/category/news/?outputType=xml&size=50&sort=display_date%3Adesc",
  },
  {
    name: "VTDigger",
    homepage: "https://vtdigger.org/",
    feedUrl: "https://vtdigger.org/feed/",
  },
  {
    name: "Seven Days",
    homepage: "https://www.sevendaysvt.com/",
    feedUrl: "https://www.sevendaysvt.com/vermont/Rss.xml",
  },
  {
    name: "MyNBC5",
    homepage: "https://www.mynbc5.com/",
    feedUrl: "https://www.mynbc5.com/topstories-rss",
  },
  {
    name: "MyChamplainValley",
    homepage: "https://www.mychamplainvalley.com/",
    feedUrl: "https://www.mychamplainvalley.com/feed/",
  },
  {
    name: "Vermont Business Magazine",
    homepage: "https://vermontbiz.com/",
    feedUrl: "https://vermontbiz.com/rss.xml",
  },
  {
    name: "Addison Independent",
    homepage: "https://www.addisonindependent.com/",
    feedUrl: "https://www.addisonindependent.com/feed/",
  },
  {
    name: "Rutland Herald",
    homepage: "https://www.rutlandherald.com/",
    feedUrl:
      "https://www.rutlandherald.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
  },
  {
    name: "Times Argus",
    homepage: "https://www.timesargus.com/",
    feedUrl:
      "https://www.timesargus.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
  },
  {
    name: "Bennington Banner",
    homepage: "https://www.benningtonbanner.com/",
    feedUrl:
      "https://www.benningtonbanner.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
  },
  {
    name: "Brattleboro Reformer",
    homepage: "https://www.reformer.com/",
    feedUrl:
      "https://www.reformer.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
  },
  {
    name: "Vermont Community Newspaper Group",
    homepage: "https://www.vtcng.com/",
    feedUrl:
      "https://www.vtcng.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
  },
  {
    name: "Valley News",
    homepage: "https://vnews.com/",
    feedUrl: "https://vnews.com/feed/",
  },
  {
    name: "The Mountain Times",
    homepage: "https://mountaintimes.info/",
    feedUrl: "https://mountaintimes.info/feed/",
  },
  {
    name: "Newport Daily Express",
    homepage: "https://www.newportvermontdailyexpress.com/",
    feedUrl:
      "https://www.newportvermontdailyexpress.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
  },
];

export const MENTION_TERMS = [
  { label: "BCBSVT", pattern: /\bbcbs[\s-]?vt\b/i },
  { label: "BCBS of Vermont", pattern: /\bbcbs\s+(?:of\s+)?vermont\b/i },
  { label: "Blue Cross VT", pattern: /\bblue\s+cross\s+vt\b/i },
  { label: "Blue Cross Vermont", pattern: /\bblue\s+cross\s+vermont\b/i },
  {
    label: "Blue Cross and Blue Shield of Vermont",
    pattern:
      /\bblue\s+cross\s+(?:and|&)\s+blue\s+shield\s+(?:of\s+)?vermont\b/i,
  },
  {
    label: "Blue Cross Blue Shield of Vermont",
    pattern: /\bblue\s+cross\s+blue\s+shield\s+(?:of\s+)?vermont\b/i,
  },
  {
    label: "BlueCross BlueShield of Vermont",
    pattern: /\bbluecross\s+blueshield\s+(?:of\s+)?vermont\b/i,
  },
  {
    label: "Blue Cross/Blue Shield of Vermont",
    pattern: /\bblue\s+cross\s*\/\s*blue\s+shield\s+(?:of\s+)?vermont\b/i,
  },
  { label: "Blue Cross", pattern: /\bblue\s+cross\b/i },
];

const REQUEST_TIMEOUT_MS = parsePositiveInteger(
  process.env.RSS_TIMEOUT_MS,
  12000,
);
const CONCURRENCY = parsePositiveInteger(process.env.RSS_CONCURRENCY, 6);
const SCAN_ARTICLE_PAGES = process.env.RSS_ARTICLE_SCAN !== "false";
const SITE_URL = process.env.SITE_URL?.trim() || "";
const FEED_URL = resolveFeedUrl();
const USER_AGENT = "vt-news-rss-bcbs/1.0 (+https://github.com/oliverames)";
const MAX_FETCH_ATTEMPTS = parsePositiveInteger(
  process.env.RSS_FETCH_ATTEMPTS,
  3,
);

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveRssOutputPath() {
  if (process.env.RSS_OUTPUT_PATH) {
    return path.resolve(process.cwd(), process.env.RSS_OUTPUT_PATH);
  }

  return path.resolve(process.cwd(), "site", "feed.rss");
}

function resolveJsonOutputPath(rssOutputPath) {
  if (process.env.JSON_OUTPUT_PATH) {
    return path.resolve(process.cwd(), process.env.JSON_OUTPUT_PATH);
  }

  return path.join(path.dirname(rssOutputPath), "feed.json");
}

function resolveFeedUrl() {
  const explicitFeedUrl = process.env.FEED_URL?.trim();
  if (explicitFeedUrl) {
    return explicitFeedUrl;
  }

  if (!SITE_URL) {
    return "";
  }

  return new URL("feed.rss", `${SITE_URL.replace(/\/+$/, "")}/`).toString();
}

export function cleanText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function wrapCdata(value = "") {
  return `<![CDATA[${String(value).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function resolveUrl(value, baseUrl) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function getFirstText($item, selectors) {
  for (const selector of selectors) {
    const value = cleanText($item.find(selector).first().text());
    if (value) {
      return value;
    }
  }

  return "";
}

function getFirstHtml($item, selectors) {
  for (const selector of selectors) {
    const element = $item.find(selector).first();
    const value = element.html()?.trim() || element.text()?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function decodeFeedText(value = "") {
  const withoutCdata = String(value).replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
    "$1",
  );
  const firstPass = cleanText(cheerio.load(withoutCdata).text() || withoutCdata);

  if (/<[a-z][\s\S]*>/i.test(firstPass)) {
    return cleanText(cheerio.load(firstPass).text() || firstPass);
  }

  return firstPass;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function normalizeGuid(link, fallback) {
  const value = link || fallback || "";
  return value.trim();
}

export function parseFeedItems(feedXml, source) {
  const $ = cheerio.load(feedXml, { xmlMode: true });
  const rssItems = $("item")
    .map((_, element) => {
      const $item = $(element);
      const title = getFirstText($item, ["title"]);
      const rawLink = getFirstText($item, ["link"]);
      const link = resolveUrl(rawLink, source.homepage || source.feedUrl);
      const descriptionHtml = getFirstHtml($item, [
        "description",
        "summary",
        "content\\:encoded",
      ]);
      const description = decodeFeedText(descriptionHtml);
      const pubDateRaw = getFirstText($item, [
        "pubDate",
        "published",
        "updated",
        "dc\\:date",
      ]);
      const pubDate = parseDate(pubDateRaw);
      const guid = normalizeGuid(
        link,
        getFirstText($item, ["guid", "id"]) || `${source.name}:${title}`,
      );

      if (!title || !link) {
        return null;
      }

      return {
        sourceName: source.name,
        sourceFeedUrl: source.feedUrl,
        title,
        link,
        guid,
        pubDate,
        description,
        feedContent: cleanText(
          [title, description, decodeFeedText(descriptionHtml)]
            .filter(Boolean)
            .join(" "),
        ),
      };
    })
    .get()
    .filter(Boolean);

  const atomItems = $("entry")
    .map((_, element) => {
      const $item = $(element);
      const title = getFirstText($item, ["title"]);
      const href =
        $item.find("link[rel='alternate']").first().attr("href") ||
        $item.find("link").first().attr("href") ||
        getFirstText($item, ["link"]);
      const link = resolveUrl(href, source.homepage || source.feedUrl);
      const contentHtml = getFirstHtml($item, ["content", "summary"]);
      const description = decodeFeedText(contentHtml);
      const pubDate = parseDate(
        getFirstText($item, ["published", "updated", "dc\\:date"]),
      );
      const guid = normalizeGuid(
        link,
        getFirstText($item, ["id"]) || `${source.name}:${title}`,
      );

      if (!title || !link) {
        return null;
      }

      return {
        sourceName: source.name,
        sourceFeedUrl: source.feedUrl,
        title,
        link,
        guid,
        pubDate,
        description,
        feedContent: cleanText([title, description].filter(Boolean).join(" ")),
      };
    })
    .get()
    .filter(Boolean);

  return [...rssItems, ...atomItems];
}

export function findMentionTerms(text, terms = MENTION_TERMS) {
  const haystack = cleanText(text);
  const matches = [];

  for (const term of terms) {
    if (term.pattern.test(haystack)) {
      matches.push(term.label);
    }
  }

  return [...new Set(matches)];
}

function findFirstMentionIndex(text, terms = MENTION_TERMS) {
  let bestIndex = -1;

  for (const term of terms) {
    const match = term.pattern.exec(text);
    if (!match) {
      continue;
    }

    if (bestIndex === -1 || match.index < bestIndex) {
      bestIndex = match.index;
    }
  }

  return bestIndex;
}

export function buildSnippet(text, terms = MENTION_TERMS) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return "";
  }

  const index = findFirstMentionIndex(cleaned, terms);
  if (index === -1) {
    return cleaned.slice(0, 320);
  }

  const start = Math.max(0, index - 180);
  const end = Math.min(cleaned.length, index + 260);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < cleaned.length ? " ..." : "";

  return `${prefix}${cleaned.slice(start, end)}${suffix}`;
}

function htmlToArticleText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, form").remove();

  const candidates = [
    "article",
    "main",
    "[itemprop='articleBody']",
    ".article-body",
    ".story-body",
    ".entry-content",
    ".post-content",
    ".field--name-body",
    ".body-content",
  ];

  const texts = candidates
    .map((selector) => cleanText($(selector).text()))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  return texts[0] || cleanText($("body").text());
}

async function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url, accept) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept,
          "user-agent": USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} while fetching ${url}`);
        error.status = response.status;
        const retryAfter = Number.parseInt(
          response.headers.get("retry-after") ?? "",
          10,
        );
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          error.retryAfterMs = retryAfter * 1000;
        }
        throw error;
      }

      return await response.text();
    } catch (error) {
      lastError = error;

      const isRateLimited = error.status === 429;
      const isClientError =
        error.status >= 400 && error.status < 500 && !isRateLimited;
      if (isClientError || attempt === MAX_FETCH_ATTEMPTS) {
        break;
      }

      await sleep(error.retryAfterMs || 750 * attempt);
    }
  }

  throw lastError;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

function dedupeItems(items) {
  const byKey = new Map();

  for (const item of items) {
    const key = item.link || item.guid;
    if (!key || byKey.has(key)) {
      continue;
    }

    byKey.set(key, item);
  }

  return [...byKey.values()];
}

async function collectFeedItems(sources) {
  const sourceResults = [];
  const items = [];

  for (const source of sources) {
    try {
      const xml = await fetchText(
        source.feedUrl,
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      );
      const sourceItems = parseFeedItems(xml, source);
      sourceResults.push({
        name: source.name,
        feedUrl: source.feedUrl,
        ok: true,
        itemCount: sourceItems.length,
      });
      items.push(...sourceItems);
      console.log(`Fetched ${sourceItems.length} items from ${source.name}`);
    } catch (error) {
      sourceResults.push({
        name: source.name,
        feedUrl: source.feedUrl,
        ok: false,
        itemCount: 0,
        error: error.message,
      });
      console.warn(`Failed to fetch ${source.name}: ${error.message}`);
    }
  }

  return { items: dedupeItems(items), sourceResults };
}

async function enrichAndFilterItems(items) {
  const results = await mapWithConcurrency(items, CONCURRENCY, async (item) => {
    let articleText = "";
    let articleError = "";

    if (SCAN_ARTICLE_PAGES) {
      try {
        const html = await fetchText(
          item.link,
          "text/html, application/xhtml+xml, */*",
        );
        articleText = htmlToArticleText(html);
      } catch (error) {
        articleError = error.message;
      }
    }

    const feedMatches = findMentionTerms(item.feedContent);
    const articleMatches = findMentionTerms(articleText);
    const searchableText = cleanText(
      [item.feedContent, articleText].filter(Boolean).join(" "),
    );
    const matchedTerms = [...new Set([...feedMatches, ...articleMatches])];

    if (matchedTerms.length === 0) {
      return null;
    }

    const snippetSource = articleMatches.length > 0 ? articleText : item.feedContent;

    return {
      ...item,
      matchedTerms,
      snippet: buildSnippet(snippetSource),
      articleError,
    };
  });

  return results.filter(Boolean);
}

function sortItemsByDate(items) {
  return [...items].sort((a, b) => {
    const aTime = a.pubDate?.valueOf() ?? 0;
    const bTime = b.pubDate?.valueOf() ?? 0;
    return bTime - aTime;
  });
}

function formatPubDate(date) {
  return (date || new Date()).toUTCString();
}

function itemDescription(item) {
  const lines = [
    `<p><strong>Source:</strong> ${escapeXml(item.sourceName)}</p>`,
    `<p><strong>Matched terms:</strong> ${escapeXml(
      item.matchedTerms.join(", "),
    )}</p>`,
  ];

  if (item.snippet) {
    lines.push(`<p>${escapeXml(item.snippet)}</p>`);
  }

  lines.push(
    `<p><a href="${escapeXml(item.link)}">Read the original story</a></p>`,
  );

  if (item.articleError) {
    lines.push(
      `<p><em>Article body fetch warning: ${escapeXml(
        item.articleError,
      )}</em></p>`,
    );
  }

  return lines.join("\n");
}

export function buildRss(items, options = {}) {
  const now = options.now || new Date();
  const feedUrl = options.feedUrl || FEED_URL;
  const siteUrl = options.siteUrl || SITE_URL || feedUrl || "";
  const atomLink = feedUrl
    ? `\n    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`
    : "";

  const itemXml = sortItemsByDate(items)
    .map((item) => {
      const categories = item.matchedTerms
        .map((term) => `      <category>${escapeXml(term)}</category>`)
        .join("\n");

      return `    <item>
      <title>${escapeXml(`${item.sourceName}: ${item.title}`)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.guid || item.link)}</guid>
      <pubDate>${escapeXml(formatPubDate(item.pubDate || now))}</pubDate>
      <source url="${escapeXml(item.sourceFeedUrl)}">${escapeXml(
        item.sourceName,
      )}</source>
${categories}
      <description>${wrapCdata(itemDescription(item))}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blue Cross VT News Mentions</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Mentions of BCBSVT, Blue Cross VT, and Blue Cross and Blue Shield of Vermont from Vermont news outlets.</description>
    <language>en-us</language>
    <lastBuildDate>${escapeXml(formatPubDate(now))}</lastBuildDate>
    <generator>vt-news-rss-bcbs</generator>${atomLink}
${itemXml}
  </channel>
</rss>
`;
}

export function buildJsonSummary(items, sourceResults, now = new Date()) {
  return {
    title: "Blue Cross VT News Mentions",
    generatedAt: now.toISOString(),
    itemCount: items.length,
    sources: sourceResults,
    items: sortItemsByDate(items).map((item) => ({
      title: item.title,
      sourceName: item.sourceName,
      link: item.link,
      pubDate: item.pubDate?.toISOString() || null,
      matchedTerms: item.matchedTerms,
      snippet: item.snippet,
      articleError: item.articleError || "",
    })),
  };
}

async function writeOutput(rss, jsonSummary, rssOutputPath, jsonOutputPath) {
  await mkdir(path.dirname(rssOutputPath), { recursive: true });
  await writeFile(rssOutputPath, rss, "utf8");
  await writeFile(jsonOutputPath, `${JSON.stringify(jsonSummary, null, 2)}\n`);
}

export async function generateFeed({
  sources = DEFAULT_SOURCES,
  now = new Date(),
  rssOutputPath = resolveRssOutputPath(),
  jsonOutputPath = resolveJsonOutputPath(rssOutputPath),
} = {}) {
  const { items, sourceResults } = await collectFeedItems(sources);
  const matchedItems = sortItemsByDate(await enrichAndFilterItems(items));
  const rss = buildRss(matchedItems, { now });
  const jsonSummary = buildJsonSummary(matchedItems, sourceResults, now);

  await writeOutput(rss, jsonSummary, rssOutputPath, jsonOutputPath);

  return {
    rssOutputPath,
    jsonOutputPath,
    sourceResults,
    itemCount: matchedItems.length,
    items: matchedItems,
  };
}

async function main() {
  const result = await generateFeed();
  const healthySources = result.sourceResults.filter((source) => source.ok);

  if (healthySources.length === 0) {
    throw new Error("No source feeds were fetched successfully.");
  }

  console.log(`Wrote ${result.itemCount} matching items to ${result.rssOutputPath}`);
  console.log(`Wrote audit JSON to ${result.jsonOutputPath}`);
}

const currentFile = pathToFileURL(fileURLToPath(import.meta.url)).href;
const invokedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";

if (currentFile === invokedFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
