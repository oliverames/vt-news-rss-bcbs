// Article-page enrichment: resolve Google News links, scan article text for
// brand mentions, and attach matched terms, snippets, and categories.
import { GoogleDecoder } from "google-news-url-decoder";
import {
  cleanStorySnippet,
  cleanText,
  mapWithConcurrency,
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

function scanArticlePages() {
  return process.env.RSS_ARTICLE_SCAN !== "false";
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

export async function enrichAndFilterItems(items, cache = new Map()) {
  const results = await mapWithConcurrency(items, CONCURRENCY, async (item) => {
    let articleText = "";
    let articleComments = [];
    let articleError = "";
    let resolvedLink = item.link;

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

    if (cache.has(resolvedLink)) {
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

    if (scanArticlePages() && item.scanArticle !== false) {
      await throttleRequest(resolvedLink);
      try {
        const { text: html, url: finalUrl } = await fetchText(
          resolvedLink,
          "text/html, application/xhtml+xml, */*",
        );
        articleText = htmlToArticleText(html);
        articleComments = extractArticleComments(html);
        if (finalUrl) {
          resolvedLink = finalUrl;
        }
      } catch (error) {
        articleError = error.message;
      }
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
        return null;
      }
      finalMatchedTerms = fallbackTerms;
      matchSource = "searchFallback";
    }

    const snippetSource =
      articleBrandMatches.length > 0 ? articleText : item.feedContent;

    return {
      ...item,
      link: resolvedLink,
      matchedTerms: finalMatchedTerms,
      category: categorizeTerms(finalMatchedTerms),
      snippet: cleanStorySnippet(
        buildSnippet(snippetSource, [...MENTION_TERMS, ...TOPIC_TERMS]),
        item.title,
      ),
      comments: mergeComments(item.comments, articleComments),
      articleError,
      matchSource,
    };
  });

  return results.filter(Boolean);
}
