// HTTP fetching with retries, size caps, per-domain politeness, and the
// per-source collection pipeline.
import {
  mapWithConcurrency,
  parseDate,
  parsePositiveInteger,
  sleep,
} from "./utils.js";
import { isObituaryItem } from "./filters.js";
import {
  mergeFacebookPagePostItem,
  parseBcbsAssociationNewsItems,
  parseBlueCrossVtListingItems,
  parseFacebookPageHtml,
  parseFacebookPostHtml,
  parseFeedItems,
  parseUvmHealthNewsroomItems,
} from "./parsers.js";

const REQUEST_TIMEOUT_MS = parsePositiveInteger(
  process.env.RSS_TIMEOUT_MS,
  12000,
);
// Sources fetched in parallel. Kept modest: most sources are distinct
// domains, and throttleRequest keeps same-domain requests (the Google News
// searches, the Facebook pages) a second apart regardless.
const SOURCE_CONCURRENCY = parsePositiveInteger(
  process.env.RSS_SOURCE_CONCURRENCY,
  4,
);
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_FETCH_ATTEMPTS = parsePositiveInteger(
  process.env.RSS_FETCH_ATTEMPTS,
  3,
);
// Cap on decompressed response bytes. Feeds and article pages from these
// outlets run well under 10 MB; the cap keeps one misbehaving or compromised
// source from exhausting the Actions runner's memory mid-run.
const MAX_RESPONSE_BYTES = parsePositiveInteger(
  process.env.RSS_MAX_RESPONSE_BYTES,
  10 * 1024 * 1024,
);

const DOMAIN_QUEUES = new Map();
// Politeness delay between request starts on the same domain. Note: before
// the promise-chain rewrite this delay was unenforced under concurrency (a
// race let workers slip through), which is why older runs looked faster.
// Now that it works, it dominates run time when many uncached articles share
// a domain; lower it here if run length ever matters more than politeness.
const PER_DOMAIN_DELAY_MS = parsePositiveInteger(
  process.env.RSS_DOMAIN_DELAY_MS,
  1000,
);

// Serialize request starts per domain: each caller awaits the previous
// caller's slot, and the next slot opens one delay later. The get/set pair
// below runs synchronously (no await between them), so concurrent callers
// cannot grab the same slot — the previous timestamp-based check raced when
// multiple workers hit the same domain at once.
export async function throttleRequest(url) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    return; // Unparseable URL: skip throttling, the fetch will fail anyway
  }

  const previousSlot = DOMAIN_QUEUES.get(hostname) || Promise.resolve();
  DOMAIN_QUEUES.set(
    hostname,
    previousSlot.then(() => sleep(PER_DOMAIN_DELAY_MS)),
  );
  await previousSlot;
}

// Equivalent to response.text() (UTF-8 decode, BOM handled by TextDecoder)
// but aborts once the body exceeds maxBytes. Size errors are marked
// nonRetryable: a too-large body will be too large on the next attempt too.
export async function readResponseTextWithLimit(
  response,
  maxBytes = MAX_RESPONSE_BYTES,
) {
  function oversizedError(detail) {
    const error = new Error(`Response body exceeds ${maxBytes} bytes${detail}`);
    error.nonRetryable = true;
    return error;
  }

  const declaredLength = Number.parseInt(
    response.headers?.get?.("content-length") ?? "",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw oversizedError(` (content-length ${declaredLength})`);
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw oversizedError("");
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks, receivedBytes));
}

export async function fetchText(url, accept) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept,
          "user-agent": USER_AGENT,
          "accept-language": "en-US,en;q=0.9",
          "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
          "sec-fetch-user": "?1",
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

      return {
        text: await readResponseTextWithLimit(response),
        url: response.url,
      };
    } catch (error) {
      lastError = error;

      const isRateLimited = error.status === 429;
      const isClientError =
        error.status >= 400 && error.status < 500 && !isRateLimited;
      if (isClientError || error.nonRetryable || attempt === MAX_FETCH_ATTEMPTS) {
        break;
      }

      await sleep(error.retryAfterMs || 750 * attempt);
    }
  }

  throw lastError;
}

async function enrichFacebookPageItemsFromPosts(pageItems, source) {
  return mapWithConcurrency(pageItems, 2, async (pageItem) => {
    try {
      await throttleRequest(pageItem.link);
      const { text: postHtml } = await fetchText(
        pageItem.link,
        "text/html, application/xhtml+xml, */*",
      );
      const postItem = parseFacebookPostHtml(postHtml, {
        ...source,
        title: pageItem.title,
        pubDate: pageItem.pubDate,
        facebookPostUrl: pageItem.link,
      });
      return mergeFacebookPagePostItem(pageItem, postItem, source);
    } catch (error) {
      console.warn(
        `Failed to enrich Facebook post ${pageItem.link}: ${error.message}`,
      );
      return pageItem;
    }
  });
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

export function filterSourceItemsByDateWindow(items, source) {
  if (!source.minPubDate && !source.maxPubDate) {
    return items;
  }

  const minDate = parseDate(source.minPubDate);
  const maxDate = parseDate(source.maxPubDate);
  return items.filter((item) => {
    const time = item.pubDate?.valueOf();
    if (time === undefined || time === null || Number.isNaN(time)) {
      return false;
    }
    if (minDate && time < minDate.valueOf()) {
      return false;
    }
    if (maxDate && time >= maxDate.valueOf()) {
      return false;
    }
    return true;
  });
}

function applySourceItemBounds(items, source) {
  const datedItems = filterSourceItemsByDateWindow(items, source);
  const filteredItems = datedItems.filter((item) => !isObituaryItem(item));
  return source.maxItems ? filteredItems.slice(0, source.maxItems) : filteredItems;
}

// A bounded source (e.g. the 2026 backfill search) whose maxPubDate has
// passed can never contribute a new item: filterSourceItemsByDateWindow
// would drop everything it returns, and everything inside the window is
// already in the durable archive. Skip the fetch instead of making a dead
// request every run.
export function isSourceWindowClosed(source, now = new Date()) {
  const maxDate = parseDate(source.maxPubDate);
  return Boolean(maxDate) && maxDate.valueOf() <= now.valueOf();
}

// Fetch one source and return its items plus a result row. Never throws:
// failures become an ok:false result so one broken source cannot stop a run.
async function fetchItemsForSource(source, now) {
  if (isSourceWindowClosed(source, now)) {
    console.log(`Skipped ${source.name}: date window closed`);
    return {
      sourceResult: {
        name: source.name,
        feedUrl: source.feedUrl || source.facebookPostUrl || source.facebookPageUrl,
        ok: true,
        skipped: true,
        itemCount: 0,
        note: `Date window closed ${source.maxPubDate}; archived items are retained.`,
      },
      items: [],
    };
  }

  try {
    let feedUrl;
    let sourceItems;

    if (source.facebookPostUrl) {
      feedUrl = source.facebookPostUrl;
      await throttleRequest(feedUrl);
      const { text: html } = await fetchText(
        feedUrl,
        "text/html, application/xhtml+xml, */*",
      );
      const facebookItem = parseFacebookPostHtml(html, source);
      sourceItems = (facebookItem ? [facebookItem] : []).map(
        (item) => ({ ...item, requireBrandMatch: !!source.requireBrandMatch }),
      );
    } else if (source.facebookPageUrl) {
      feedUrl = source.facebookPageUrl;
      await throttleRequest(feedUrl);
      const { text: html } = await fetchText(
        feedUrl,
        "text/html, application/xhtml+xml, */*",
      );
      sourceItems = parseFacebookPageHtml(html, source);
      sourceItems = applySourceItemBounds(sourceItems, source);
      sourceItems = await enrichFacebookPageItemsFromPosts(sourceItems, source);
      sourceItems = sourceItems.map((item) => ({
        ...item,
        requireBrandMatch: !!source.requireBrandMatch,
      }));
    } else if (source.listingUrl) {
      feedUrl = source.listingUrl;
      await throttleRequest(feedUrl);
      const { text: html } = await fetchText(
        feedUrl,
        "text/html, application/xhtml+xml, */*",
      );
      if (source.listingParser === "uvmHealthNewsroom") {
        sourceItems = parseUvmHealthNewsroomItems(html, source);
      } else if (source.listingParser === "bcbsAssociationNews") {
        sourceItems = parseBcbsAssociationNewsItems(html, source);
      } else {
        sourceItems = parseBlueCrossVtListingItems(html, source);
      }
      sourceItems = applySourceItemBounds(sourceItems, source);
    } else {
      feedUrl = source.feedUrl;
      await throttleRequest(feedUrl);
      const { text: xml } = await fetchText(
        feedUrl,
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      );
      sourceItems = parseFeedItems(xml, source);
      sourceItems = applySourceItemBounds(sourceItems, source);
    }

    console.log(`Fetched ${sourceItems.length} items from ${source.name}`);
    return {
      sourceResult: {
        name: source.name,
        feedUrl,
        ok: true,
        itemCount: sourceItems.length,
      },
      items: sourceItems,
    };
  } catch (error) {
    console.warn(`Failed to fetch ${source.name}: ${error.message}`);
    return {
      sourceResult: {
        name: source.name,
        feedUrl: source.feedUrl || source.facebookPostUrl || source.facebookPageUrl,
        ok: false,
        itemCount: 0,
        error: error.message,
      },
      items: [],
    };
  }
}

// Sources fetch concurrently (most are independent domains; throttleRequest
// keeps same-domain requests a second apart), but results are assembled in
// source-list order so dedupeItems keeps the same first-seen winner
// regardless of completion timing.
export async function collectFeedItems(sources, now = new Date()) {
  const results = await mapWithConcurrency(
    sources,
    SOURCE_CONCURRENCY,
    (source) => fetchItemsForSource(source, now),
  );

  return {
    items: dedupeItems(results.flatMap((result) => result.items)),
    sourceResults: results.map((result) => result.sourceResult),
  };
}
