// Article-page enrichment: resolve Google News links, scan article text for
// brand mentions, and attach matched terms, snippets, and categories.
import { GoogleDecoder } from "google-news-url-decoder";
import {
  cleanStorySnippet,
  cleanText,
  mapWithConcurrency,
  parseDate,
  parsePositiveInteger,
} from "./utils.js";
import {
  buildSnippet,
  canonicalizeMatchedTerms,
  categorizeTerms,
  findMentionTerms,
  MENTION_TERMS,
  TOPIC_TERMS,
} from "./matching.js";
import { extractArticleComments, htmlToArticleText } from "./parsers.js";
import { fetchText, throttleRequest } from "./fetching.js";

const googleDecoder = new GoogleDecoder();

const CONCURRENCY = parsePositiveInteger(process.env.RSS_CONCURRENCY, 6);
const NEGATIVE_CACHE_TTL_MS =
  parsePositiveInteger(process.env.RSS_NEGATIVE_CACHE_TTL_DAYS, 14) *
  24 *
  60 *
  60 *
  1000;
// A no-match verdict reached because the article fetch itself failed (429,
// timeout, block) is unreliable evidence — expire it after a day so the
// article gets re-checked, instead of suppressing matches for two weeks.
const ERROR_ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

function scanArticlePages() {
  return process.env.RSS_ARTICLE_SCAN !== "false";
}

function bumpMetric(metrics, key, amount = 1) {
  if (!metrics?.enrichment) {
    return;
  }
  metrics.enrichment[key] = (metrics.enrichment[key] || 0) + amount;
}

function trackScanMode(metrics, mode) {
  if (!metrics?.enrichment) {
    return;
  }
  if (!metrics.enrichment.scanModes) {
    metrics.enrichment.scanModes = {};
  }
  metrics.enrichment.scanModes[mode] =
    (metrics.enrichment.scanModes[mode] || 0) + 1;
}

function articleCacheExpiresAt(now, ttlMs) {
  return new Date(now.valueOf() + ttlMs).toISOString();
}

function articleCacheKeys(originalLink, resolvedLink) {
  return [...new Set([originalLink, resolvedLink].filter(Boolean))];
}

function isFreshArticleCacheEntry(entry, now) {
  if (!entry) {
    return false;
  }
  const expiresAt = parseDate(entry.expiresAt);
  return Boolean(expiresAt) && expiresAt.valueOf() > now.valueOf();
}

function findArticleCacheEntry(articleCache, keys) {
  for (const key of keys) {
    const entry = articleCache[key];
    if (entry) {
      return entry;
    }
  }
  return null;
}

function findFreshArticleCacheEntry(articleCache, keys, now) {
  const entry = findArticleCacheEntry(articleCache, keys);
  return isFreshArticleCacheEntry(entry, now) ? entry : null;
}

// Expired entries that carry ETag/Last-Modified validators are kept for one
// extra TTL window so the revalidation fetch can still send If-None-Match.
// Validator-less entries have no residual value once expired — dropping them
// at expiry keeps the audit JSON (the persistence layer, re-downloaded every
// run) from accumulating weeks of dead negative verdicts.
function pruneExpiredArticleCache(articleCache, now) {
  const staleCutoff = now.valueOf() - NEGATIVE_CACHE_TTL_MS;
  for (const [url, entry] of Object.entries(articleCache)) {
    const expiresAt = parseDate(entry.expiresAt);
    if (!expiresAt) {
      delete articleCache[url];
      continue;
    }
    const hasValidators = Boolean(
      entry.articleHeaders?.etag || entry.articleHeaders?.lastModified,
    );
    const cutoff = hasValidators ? staleCutoff : now.valueOf();
    if (expiresAt.valueOf() <= cutoff) {
      delete articleCache[url];
    }
  }
}

function shouldFetchArticle(item, feedBrandMatches, topicMatches) {
  if (!scanArticlePages() || item.scanArticle === false) {
    return false;
  }

  const mode = item.articleScanMode || "smart";
  if (mode === "feedOnly") {
    return false;
  }
  if (mode === "always") {
    return true;
  }
  if (mode === "brandBody") {
    return feedBrandMatches.length === 0;
  }

  return (
    feedBrandMatches.length > 0 ||
    topicMatches.length > 0 ||
    (item.searchFallbackTerms || []).length > 0 ||
    item.requireBrandMatch
  );
}

function writeArticleCache(articleCache, keys, item, resolvedLink, details, now) {
  const matchedTerms = canonicalizeMatchedTerms(details.matchedTerms || []);
  const isErrorOnlyEntry =
    Boolean(details.articleError) && matchedTerms.length === 0;
  const cacheEntry = {
    url: item.link,
    resolvedUrl: resolvedLink,
    title: item.title || "",
    sourceName: item.sourceName || "",
    checkedAt: now.toISOString(),
    expiresAt: articleCacheExpiresAt(
      now,
      isErrorOnlyEntry ? ERROR_ENTRY_TTL_MS : NEGATIVE_CACHE_TTL_MS,
    ),
    matchedTerms,
    snippet: cleanStorySnippet(details.snippet || "", item.title),
    articleError: details.articleError || "",
    comments: Array.isArray(details.comments) ? details.comments : [],
    matchSource: details.matchSource || "",
    articleHeaders: {
      etag: details.articleHeaders?.etag || "",
      lastModified: details.articleHeaders?.lastModified || "",
    },
  };

  for (const key of keys) {
    articleCache[key] = cacheEntry;
  }
}

function itemFromArticleCache(
  item,
  resolvedLink,
  cached,
  feedBrandMatches,
  topicMatches,
) {
  let matchedTerms = canonicalizeMatchedTerms([
    ...(cached.matchedTerms || []),
    ...feedBrandMatches,
    ...topicMatches,
  ]);
  let matchSource = cached.matchSource || "articleCache";
  if (matchedTerms.length === 0) {
    const fallbackTerms = canonicalizeMatchedTerms(item.searchFallbackTerms || []);
    if (fallbackTerms.length === 0) {
      return null;
    }
    matchedTerms = fallbackTerms;
    matchSource = "searchFallback";
  }

  return {
    ...item,
    link: cached.resolvedUrl || resolvedLink || item.link,
    matchedTerms,
    category: categorizeTerms(matchedTerms),
    snippet: cleanStorySnippet(cached.snippet || item.description || "", item.title),
    comments: mergeComments(item.comments, cached.comments),
    articleError: cached.articleError || "",
    matchSource,
  };
}

function mergeComments(...commentLists) {
  const merged = [];
  const seen = new Set();

  for (const comments of commentLists) {
    if (!Array.isArray(comments)) {
      continue;
    }

    for (const comment of comments) {
      const text = cleanText(comment?.text || "");
      if (!text) {
        continue;
      }
      const author = cleanText(comment.author || "");
      const key = `${author.toLowerCase()}|${text.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push({
        ...comment,
        author,
        text,
        date: comment.date || null,
        replies: Array.isArray(comment.replies) ? comment.replies : [],
      });
    }
  }

  return merged;
}

export async function enrichAndFilterItems(items, cache = new Map(), options = {}) {
  const articleCache = options.articleCache || {};
  const metrics = options.metrics || {};
  const now = options.now || new Date();
  if (metrics.enrichment) {
    metrics.enrichment.itemsSeen = items.length;
  }
  pruneExpiredArticleCache(articleCache, now);

  const results = await mapWithConcurrency(items, CONCURRENCY, async (item) => {
    let articleText = "";
    let articleComments = [];
    let articleError = "";
    let resolvedLink = item.link;
    const originalLink = item.link;

    if (resolvedLink.includes("news.google.com/rss/articles")) {
      try {
        const decoded = await googleDecoder.decode(resolvedLink);
        if (decoded && decoded.status && decoded.decoded_url) {
          resolvedLink = decoded.decoded_url;
        }
      } catch (error) {
        console.warn(`Failed to decode Google News link ${resolvedLink}: ${error.message}`);
      }
    }

    const feedBrandMatches = findMentionTerms(item.feedContent, MENTION_TERMS);
    const topicMatches = findMentionTerms(item.feedContent, TOPIC_TERMS);
    const cacheKeys = articleCacheKeys(originalLink, resolvedLink);
    const freshArticleCache = findFreshArticleCacheEntry(
      articleCache,
      cacheKeys,
      now,
    );

    if (cache.has(resolvedLink)) {
      bumpMetric(metrics, "matchedCacheHits");
      const cached = cache.get(resolvedLink);
      let matchedTerms = canonicalizeMatchedTerms([
        ...(cached.matchedTerms || []),
        ...feedBrandMatches,
        ...topicMatches,
      ]);
      if (matchedTerms.length === 0) {
        matchedTerms = canonicalizeMatchedTerms(item.searchFallbackTerms || []);
      }
      console.log(`Cache Hit: Skipping fetch/scrape for ${resolvedLink}`);
      return {
        ...item,
        link: resolvedLink,
        matchedTerms,
        category: categorizeTerms(matchedTerms),
        pubDate: item.pubDate || cached.pubDate || null,
        snippet: cleanStorySnippet(cached.snippet, item.title),
        summary: cached.summary || "",
        reason: cached.reason || "",
        relevant: cached.relevant,
        comments: mergeComments(item.comments, cached.comments),
        articleError: cached.articleError,
        matchSource: cached.matchSource || "",
      };
    }

    if (freshArticleCache) {
      const cachedItem = itemFromArticleCache(
        item,
        resolvedLink,
        freshArticleCache,
        feedBrandMatches,
        topicMatches,
      );
      if (!cachedItem) {
        bumpMetric(metrics, "negativeCacheHits");
        return null;
      }
      bumpMetric(metrics, "articleCacheHits");
      return cachedItem;
    }

    const scanMode = item.articleScanMode || (item.scanArticle === false ? "feedOnly" : "smart");
    trackScanMode(metrics, scanMode);
    const fetchArticle = shouldFetchArticle(item, feedBrandMatches, topicMatches);
    if (fetchArticle) {
      await throttleRequest(resolvedLink);
      try {
        bumpMetric(metrics, "articleFetches");
        const staleArticleCache = findArticleCacheEntry(articleCache, cacheKeys);
        const {
          text: html,
          url: finalUrl,
          notModified,
          etag,
          lastModified,
        } = await fetchText(
          resolvedLink,
          "text/html, application/xhtml+xml, */*",
          { conditionalHeaders: staleArticleCache?.articleHeaders || {} },
        );
        if (notModified && staleArticleCache) {
          bumpMetric(metrics, "articleNotModified");
          const cachedItem = itemFromArticleCache(
            item,
            resolvedLink,
            staleArticleCache,
            feedBrandMatches,
            topicMatches,
          );
          writeArticleCache(
            articleCache,
            cacheKeys,
            item,
            resolvedLink,
            staleArticleCache,
            now,
          );
          return cachedItem;
        }

        if (finalUrl) {
          resolvedLink = finalUrl;
        }
        articleText = htmlToArticleText(html, finalUrl || resolvedLink);
        articleComments = extractArticleComments(html);
        if (articleComments.length > 0) {
          bumpMetric(metrics, "commentsFound", articleComments.length);
        }
        item.articleHeaders = { etag, lastModified };
      } catch (error) {
        articleError = error.message;
        bumpMetric(metrics, "articleErrors");
      }
    } else {
      bumpMetric(metrics, "articleFetchSkipped");
    }

    // Brand terms scan everything (feed text + full article body) so we
    // catch stories that never name the insurer in the headline. Topic
    // terms scan feed title/description only — article bodies mention
    // "health care" too incidentally for body-matching to stay precise.
    const articleBrandMatches = findMentionTerms(articleText, MENTION_TERMS);

    // Facebook posts (and any source flagged requireBrandMatch) are only
    // kept when they mention Blue Cross itself — outlets post dozens of
    // general health stories that would otherwise flood the feed.
    if (
      item.requireBrandMatch &&
      feedBrandMatches.length === 0 &&
      articleBrandMatches.length === 0
    ) {
      writeArticleCache(
        articleCache,
        articleCacheKeys(originalLink, resolvedLink),
        item,
        resolvedLink,
        {
          matchedTerms: [],
          snippet: "",
          comments: mergeComments(item.comments, articleComments),
          articleError,
          matchSource: "",
          articleHeaders: item.articleHeaders,
        },
        now,
      );
      return null;
    }

    const matchedTerms = [
      ...new Set([...feedBrandMatches, ...articleBrandMatches, ...topicMatches]),
    ];

    let finalMatchedTerms = canonicalizeMatchedTerms(matchedTerms);
    let matchSource = "text";
    if (finalMatchedTerms.length === 0) {
      const fallbackTerms = canonicalizeMatchedTerms(item.searchFallbackTerms || []);
      if (fallbackTerms.length === 0) {
        writeArticleCache(
          articleCache,
          articleCacheKeys(originalLink, resolvedLink),
          item,
          resolvedLink,
          {
            matchedTerms: [],
            snippet: "",
            comments: mergeComments(item.comments, articleComments),
            articleError,
            matchSource: "",
            articleHeaders: item.articleHeaders,
          },
          now,
        );
        return null;
      }
      finalMatchedTerms = fallbackTerms;
      matchSource = "searchFallback";
    }

    const snippetSource =
      articleBrandMatches.length > 0 ? articleText : item.feedContent;
    const snippet = cleanStorySnippet(
      buildSnippet(snippetSource, [...MENTION_TERMS, ...TOPIC_TERMS]),
      item.title,
    );
    const comments = mergeComments(item.comments, articleComments);
    writeArticleCache(
      articleCache,
      articleCacheKeys(originalLink, resolvedLink),
      item,
      resolvedLink,
      {
        matchedTerms: finalMatchedTerms,
        snippet,
        comments,
        articleError,
        matchSource,
        articleHeaders: item.articleHeaders,
      },
      now,
    );

    return {
      ...item,
      link: resolvedLink,
      matchedTerms: finalMatchedTerms,
      category: categorizeTerms(finalMatchedTerms),
      snippet,
      comments,
      articleError,
      matchSource,
    };
  });

  return results.filter(Boolean);
}
