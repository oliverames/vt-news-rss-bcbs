// Parsers for RSS/Atom XML, newsroom listing pages, article HTML, and
// Facebook's no-login post and page HTML.
import * as cheerio from "cheerio";
import { cleanText, parseDate, resolveUrl } from "./utils.js";

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
      const sourceCategories = cleanText(
        $item
          .find("category")
          .map((__, category) => $(category).text())
          .get()
          .join(" "),
      );
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
        isSearchFeed: !!source.isSearchFeed,
        searchFallbackTerms: source.searchFallbackTerms || [],
        scanArticle: source.scanArticle !== false,
        title,
        link,
        guid,
        pubDate,
        description,
        sourceCategories,
        feedContent: cleanText(
          [title, description].filter(Boolean).join(" "),
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
      const sourceCategories = cleanText(
        $item
          .find("category")
          .map((__, category) => {
            const $category = $(category);
            return $category.attr("term") || $category.text();
          })
          .get()
          .join(" "),
      );
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
        isSearchFeed: !!source.isSearchFeed,
        searchFallbackTerms: source.searchFallbackTerms || [],
        scanArticle: source.scanArticle !== false,
        title,
        link,
        guid,
        pubDate,
        description,
        sourceCategories,
        feedContent: cleanText([title, description].filter(Boolean).join(" ")),
      };
    })
    .get()
    .filter(Boolean);

  return [...rssItems, ...atomItems];
}

export function parseBlueCrossVtListingItems(html, source) {
  const $ = cheerio.load(html);
  const items = [];

  $(".views-row article").each((_, element) => {
    const article = $(element);
    const linkElement = article.find("a.link-arrow").first();
    const title = cleanText(linkElement.text());
    const href = linkElement.attr("href");
    const link = resolveUrl(href, source.homepage || source.listingUrl);
    const dateText =
      article.find("time[datetime]").first().attr("datetime") ||
      article.find("time").first().text();
    const pubDate = parseDate(dateText);
    const description = cleanText(
      article
        .find("p")
        .map((__, paragraph) => $(paragraph).text())
        .get()
        .join(" "),
    );
    const category = cleanText(
      article
        .find(".news--category, .blog-post--category")
        .first()
        .text(),
    );

    if (!title || !link) {
      return;
    }

    items.push({
      sourceName: source.name,
      sourceFeedUrl: source.listingUrl,
      searchFallbackTerms: source.searchFallbackTerms || [],
      scanArticle: source.scanArticle !== false,
      title,
      link,
      guid: link,
      pubDate,
      description,
      feedContent: cleanText(
        [title, description, category, "bluecrossvt.org"]
          .filter(Boolean)
          .join(" "),
      ),
    });
  });

  return items;
}

export function parseBcbsAssociationNewsItems(html, source) {
  const $ = cheerio.load(html);
  const items = [];

  $(".bcbs-news-item-listing-content").each((_, element) => {
    const card = $(element);
    const linkElement = card
      .find("a.bcbs-news-item-listing-content__link")
      .first();
    const title = cleanText(linkElement.text());
    const href = linkElement.attr("href");
    const link = resolveUrl(href, source.homepage || source.listingUrl);
    const dateText =
      card.find("time[datetime]").first().attr("datetime") ||
      card.find("time").first().text();
    const pubDate = parseDate(dateText);
    const description = cleanText(
      card.find(".bcbs-news-item-listing-content__text").first().text(),
    );
    const categories = cleanText(
      card
        .find(".bcbs-categories-chips__item")
        .map((__, category) => $(category).text())
        .get()
        .join(" "),
    );

    if (!title || !link || !/bcbs\.com\/about-us\/association-news\//i.test(link)) {
      return;
    }

    items.push({
      sourceName: source.name,
      sourceFeedUrl: source.listingUrl,
      searchFallbackTerms: source.searchFallbackTerms || [],
      scanArticle: source.scanArticle !== false,
      title,
      link,
      guid: link,
      pubDate,
      description,
      feedContent: cleanText(
        [
          title,
          description,
          categories,
          "bcbs.com",
          "Blue Cross Blue Shield Association",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    });
  });

  return items;
}

export function parseUvmHealthNewsroomItems(html, source) {
  const $ = cheerio.load(html);
  const items = [];

  $("outline-card-clickable").each((_, element) => {
    const card = $(element);
    const linkElement = card.find('a[href^="/newsroom/"]').first();
    const title = cleanText(linkElement.text());
    const href = linkElement.attr("href");
    const link = resolveUrl(href, source.homepage || source.listingUrl);

    if (
      !title ||
      !link ||
      /\/newsroom\/(?:search|media-center)$/.test(new URL(link).pathname)
    ) {
      return;
    }

    const dateText = cleanText(card.find("[slot='date']").first().text());
    const pubDate = parseDate(dateText);
    const imageAlt = cleanText(card.find("img[alt]").first().attr("alt") || "");

    items.push({
      sourceName: source.name,
      sourceFeedUrl: source.listingUrl,
      searchFallbackTerms: source.searchFallbackTerms || [],
      scanArticle: source.scanArticle !== false,
      title,
      link,
      guid: link,
      pubDate,
      description: imageAlt,
      feedContent: cleanText(
        [title, imageAlt, "UVM Health", "Vermont health care"]
          .filter(Boolean)
          .join(" "),
      ),
    });
  });

  return items;
}

function getMetaContent($, names) {
  for (const name of names) {
    const propertyValue = $(`meta[property="${name}"]`).attr("content");
    if (propertyValue) {
      return decodeFeedText(propertyValue);
    }

    const nameValue = $(`meta[name="${name}"]`).attr("content");
    if (nameValue) {
      return decodeFeedText(nameValue);
    }
  }

  return "";
}

function parseFacebookCommentAuthor(ariaLabel) {
  return cleanText(ariaLabel)
    .replace(/^Comment by\s+/i, "")
    .replace(
      /\s+(?:about\s+)?(?:an?\s+hour|\d+\s+(?:minutes?|hours?|days?))\s+ago$/i,
      "",
    );
}

function parseFacebookPostTimestamp(html) {
  const match = /"(?:creation_time|publish_time)":(\d{9,12})\b/.exec(html);
  if (!match) {
    return null;
  }

  return new Date(Number.parseInt(match[1], 10) * 1000);
}

export function parseFacebookRelativeDate(text, now = new Date()) {
  const cleaned = cleanText(text);
  const match =
    /\b(?:(\d+)\s*([mhd])|(\d+)\s+(minutes?|hours?|days?)|an?\s+hour)\s*·/i.exec(
      cleaned,
    );
  if (!match) {
    return null;
  }

  let amount = 1;
  let unit = "hour";
  if (match[1] && match[2]) {
    amount = Number.parseInt(match[1], 10);
    unit = match[2].toLowerCase();
  } else if (match[3] && match[4]) {
    amount = Number.parseInt(match[3], 10);
    unit = match[4].toLowerCase();
  }

  const multipliers = {
    m: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    h: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };
  const multiplier = multipliers[unit];
  if (!multiplier || !Number.isFinite(amount)) {
    return null;
  }

  return new Date(now.valueOf() - amount * multiplier);
}

function cleanFacebookCommentText(text, author) {
  let cleaned = cleanText(text).replace(/^Top fan/i, "");
  if (author && cleaned.toLowerCase().startsWith(author.toLowerCase())) {
    cleaned = cleaned.slice(author.length);
  }
  return cleanText(cleaned)
    .replace(/^Top fan/i, "")
    .replace(/\b(?:\d+[mhd](?:\d+)?|(?:about\s+)?(?:an?\s+hour|\d+\s+(?:minutes?|hours?|days?))\s+ago)$/i, "")
    .replace(/\d+[mhd](?:\d+)?$/i, "")
    .trim();
}

function extractFacebookComments($) {
  const comments = [];
  const seen = new Set();
  const selectors = [
    '[aria-label^="Comment by"]',
    '[aria-label*=" comment by"]',
    '[data-testid="UFI2Comment/body"]',
    ".UFICommentBody",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const container = $(element);
      const aria = container.attr("aria-label") || "";
      const author = parseFacebookCommentAuthor(aria);
      const text = cleanFacebookCommentText(container.text(), author);
      if (!text || seen.has(`${author}:${text}`)) {
        return;
      }
      seen.add(`${author}:${text}`);
      comments.push({ author, text });
    });
  }

  return comments;
}

// Comments live in the same JSON-escaped preload blobs as posts: each node
// carries depth (0 = top-level, >0 = reply), body.text, then the author
// name and created_time shortly after. Replies nest under the preceding
// top-level comment, matching thread order in the HTML.
export function parseFacebookEmbeddedComments(html) {
  const comments = [];
  const seen = new Set();
  const bodyPattern = /"body":\{"text":"((?:[^"\\]|\\.)*)"/g;

  let match;
  while ((match = bodyPattern.exec(html)) !== null) {
    const text = cleanText(decodeFacebookJsonString(match[1]));
    if (!text) {
      continue;
    }

    const before = html.slice(Math.max(0, match.index - 600), match.index);
    const after = html.slice(match.index, match.index + 6000);
    const authorMatch = /"name":"((?:[^"\\]|\\.)*)"/.exec(after);
    const author = authorMatch
      ? cleanText(decodeFacebookJsonString(authorMatch[1]))
      : "";

    // The HTML repeats each comment in a second preload blob; keep the
    // first copy (the one preceded by its depth field).
    const key = `${author}:${text}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const depthMatches = [...before.matchAll(/"depth":(\d+)/g)];
    const depthMatch = depthMatches.at(-1);
    const depth = depthMatch ? Number.parseInt(depthMatch[1], 10) : 0;
    const timeMatch = /"created_time":(\d{9,12})/.exec(after);
    const date = timeMatch
      ? new Date(Number.parseInt(timeMatch[1], 10) * 1000).toISOString()
      : null;

    if (depth > 0 && comments.length > 0) {
      comments[comments.length - 1].replies.push({ author, text, date });
    } else {
      comments.push({ author, text, date, replies: [] });
    }
  }

  return comments;
}

export function parseFacebookPostHtml(html, source) {
  const $ = cheerio.load(html);
  const description = getMetaContent($, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const pageTitle = getMetaContent($, ["og:title", "twitter:title"]) || source.name;
  const canonicalUrl =
    $('link[rel="canonical"]').attr("href") ||
    getMetaContent($, ["og:url"]) ||
    source.facebookPostUrl;
  const publishedAt = getMetaContent($, [
    "article:published_time",
    "article:modified_time",
  ]);
  const pubDate =
    parseDate(source.pubDate || publishedAt) || parseFacebookPostTimestamp(html);
  const embeddedComments = parseFacebookEmbeddedComments(html);
  const comments =
    embeddedComments.length > 0
      ? embeddedComments
      : extractFacebookComments($).map((comment) => ({
          ...comment,
          date: null,
          replies: [],
        }));

  if (!description && comments.length === 0) {
    return null;
  }

  const title = cleanText(
    source.title ||
      `${pageTitle} Facebook post${description ? `: ${description.slice(0, 80)}` : ""}`,
  );
  const commentText = comments
    .map((comment) =>
      [comment.text, ...(comment.replies || []).map((reply) => reply.text)].join(" "),
    )
    .join(" ");

  return {
    sourceName: source.name,
    sourceFeedUrl: source.facebookPostUrl,
    title,
    link: canonicalUrl,
    guid: canonicalUrl || source.facebookPostUrl,
    pubDate,
    description,
    comments,
    scanArticle: false,
    feedContent: cleanText([title, description, commentText].filter(Boolean).join(" ")),
  };
}

function normalizeFacebookUrl(value, baseUrl = "https://www.facebook.com/") {
  const url = resolveUrl(value?.replaceAll("&amp;", "&") || "", baseUrl);
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (
        key.startsWith("__") ||
        ["refid", "ref", "mibextid", "paipv", "eav"].includes(key)
      ) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function isFacebookPostLink(href = "") {
  return /\/posts\/|story\.php|permalink\.php/i.test(href);
}

function decodeFacebookJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replace(/\\\//g, "/");
  }
}

// Facebook's no-login page HTML does not link posts in anchor tags — the
// timeline is rendered client-side. But the server preloads the most recent
// post as JSON-escaped script data containing the post permalink (wwwURL),
// message text, creation_time, and comment count. Each hourly run captures
// the page's current top post; the archive accumulates them over time.
export function parseFacebookEmbeddedPosts(html, source) {
  const items = [];
  const seen = new Set();
  const urlPattern =
    /"wwwURL":"(https:\\\/\\\/www\.facebook\.com\\\/[^"]*?\\\/posts\\\/[^"]+?)"/g;

  let match;
  while ((match = urlPattern.exec(html)) !== null) {
    const link = decodeFacebookJsonString(match[1]);
    if (!link || seen.has(link)) {
      continue;
    }
    seen.add(link);

    // The post's fields live near its wwwURL in the same preloaded blob.
    const windowStart = Math.max(0, match.index - 30000);
    const windowText = html.slice(windowStart, match.index + 30000);
    const messageMatch = /"message":\{"text":"((?:[^"\\]|\\.)*)"/.exec(
      windowText,
    );
    const message = messageMatch
      ? cleanText(decodeFacebookJsonString(messageMatch[1]))
      : "";
    if (!message) {
      continue;
    }

    const timeMatch = /"creation_time":(\d{9,12})\b/.exec(windowText);
    const pubDate = timeMatch
      ? new Date(Number.parseInt(timeMatch[1], 10) * 1000)
      : null;

    items.push({
      sourceName: source.name,
      sourceFeedUrl: source.facebookPageUrl,
      title: `${source.name} post: ${message.slice(0, 90)}`,
      link,
      guid: link,
      pubDate,
      description: message,
      comments: [],
      scanArticle: false,
      feedContent: cleanText([source.name, message].join(" ")),
    });
  }

  return items;
}

export function parseFacebookPageHtml(html, source) {
  const embedded = parseFacebookEmbeddedPosts(html, source);
  if (embedded.length > 0) {
    return embedded;
  }

  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();
  const pageTitle = cleanText($("title").first().text()) || source.name;

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    if (!isFacebookPostLink(href)) {
      return;
    }

    const link = normalizeFacebookUrl(href, source.facebookPageUrl);
    if (!link || seen.has(link)) {
      return;
    }

    const container = $(element).closest("article, section, div, li");
    const rawText = cleanText(container.text() || $(element).text());
    const description = rawText
      .replace(/\b(?:Like|Comment|Share|Full Story)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!description) {
      return;
    }

    seen.add(link);
    const titleText = description.slice(0, 90);
    items.push({
      sourceName: source.name,
      sourceFeedUrl: source.facebookPageUrl,
      title: `${pageTitle} Facebook post: ${titleText}`,
      link,
      guid: link,
      pubDate: parseFacebookRelativeDate(description, source.now || new Date()),
      description,
      comments: [],
      scanArticle: false,
      feedContent: cleanText([pageTitle, description].join(" ")),
    });
  });

  return items;
}

export function mergeFacebookPagePostItem(pageItem, postItem, source) {
  if (!postItem) {
    return pageItem;
  }

  const comments =
    postItem.comments && postItem.comments.length > 0
      ? postItem.comments
      : pageItem.comments || [];
  const description = postItem.description || pageItem.description;
  const commentText = comments
    .map((comment) =>
      [comment.text, ...(comment.replies || []).map((reply) => reply.text)].join(" "),
    )
    .join(" ");

  return {
    ...pageItem,
    ...postItem,
    sourceName: source.name,
    sourceFeedUrl: source.facebookPageUrl,
    title: postItem.title || pageItem.title,
    link: postItem.link || pageItem.link,
    guid: postItem.guid || pageItem.guid,
    pubDate: postItem.pubDate || pageItem.pubDate,
    description,
    comments,
    scanArticle: false,
    feedContent: cleanText(
      [
        postItem.feedContent,
        pageItem.feedContent,
        commentText,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

export function htmlToArticleText(html) {
  const $ = cheerio.load(html);
  // Remove navigation, sidebar, ads, and header/footer elements
  $("script, style, noscript, svg, iframe, form, nav, footer, header, aside, .sidebar, #sidebar, .nav, .menu, .ads, .ad, .advertisement, [role='banner'], [role='navigation'], [role='contentinfo']").remove();

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

  for (const selector of candidates) {
    const element = $(selector);
    if (element.length > 0) {
      const paragraphs = element
        .find("p")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
      if (paragraphs.length > 0) {
        return cleanText(paragraphs.join(" "));
      }
      const text = cleanText(element.text());
      if (text) {
        return text;
      }
    }
  }

  const paragraphs = $("body p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  if (paragraphs.length > 0) {
    return cleanText(paragraphs.join(" "));
  }

  return cleanText($("body").text());
}
