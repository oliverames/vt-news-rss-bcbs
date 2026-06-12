import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJsonSummary,
  buildRss,
  buildSnippet,
  findMentionTerms,
  parseFeedItems,
  enrichAndFilterItems,
  htmlToArticleText,
} from "../src/index.js";

test("findMentionTerms catches requested and similar Blue Cross VT variants", () => {
  const text = [
    "BCBSVT requested a rate increase.",
    "Blue Cross VT filed documents.",
    "Blue Cross and Blue Shield of Vermont responded.",
    "BCBS of Vermont is another shorthand.",
    "Visit bluecrossvt.org for more information.",
  ].join(" ");

  assert.deepEqual(findMentionTerms(text), [
    "BCBSVT",
    "BCBS of Vermont",
    "Blue Cross VT",
    "Blue Cross and Blue Shield of Vermont",
    "Blue Cross",
    "bluecrossvt.org",
  ]);
});

test("findMentionTerms catches indirect and branded variants", () => {
  assert.deepEqual(findMentionTerms("Blue Cross of Vermont announced a plan."), [
    "Blue Cross of Vermont",
    "Blue Cross",
  ]);
  assert.deepEqual(findMentionTerms("Enrollment opened for Vermont Blue Advantage."), [
    "Vermont Blue Advantage",
  ]);
  assert.deepEqual(
    findMentionTerms("Michigan, Vermont Blues plans finalize merger."),
    ["Vermont Blues plan"],
  );
  // Curly apostrophe, as published by VTDigger
  assert.deepEqual(
    findMentionTerms("Vermont’s largest health insurer wants to offer a cheaper plan."),
    ["Vermont's largest health insurer"],
  );
  // Straight apostrophe variant
  assert.deepEqual(
    findMentionTerms("Vermont's largest private insurer filed for rates."),
    ["Vermont's largest health insurer"],
  );
});

test("findMentionTerms ignores unrelated text", () => {
  assert.deepEqual(
    findMentionTerms("The Vermont blues festival drew a crowd in Burlington."),
    [],
  );
  assert.deepEqual(findMentionTerms("New England's largest insurer reported earnings."), []);
});

test("parseFeedItems parses RSS items", () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Blue Cross Blue Shield of Vermont files rates</title>
          <link>/story</link>
          <guid>story-1</guid>
          <pubDate>Tue, 12 May 2026 12:00:00 GMT</pubDate>
          <description><![CDATA[Regulators received the filing.]]></description>
        </item>
      </channel>
    </rss>`;

  const items = parseFeedItems(xml, {
    name: "Example",
    feedUrl: "https://example.com/feed.xml",
    homepage: "https://example.com/",
  });

  assert.equal(items.length, 1);
  assert.equal(
    items[0].link,
    "https://example.com/story",
  );
  assert.equal(items[0].sourceName, "Example");
  assert.equal(items[0].description, "Regulators received the filing.");
});

test("parseFeedItems parses Atom entries", () => {
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Health care story</title>
        <link rel="alternate" href="https://example.com/atom-story" />
        <id>tag:example.com,2026:1</id>
        <updated>2026-05-12T12:00:00Z</updated>
        <summary>Blue Cross VT appears in the body.</summary>
      </entry>
    </feed>`;

  const items = parseFeedItems(xml, {
    name: "Atom Example",
    feedUrl: "https://example.com/atom.xml",
    homepage: "https://example.com/",
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Health care story");
  assert.equal(items[0].link, "https://example.com/atom-story");
});

test("buildSnippet centers the first matched mention", () => {
  const snippet = buildSnippet(
    `${"before ".repeat(80)} Blue Cross and Blue Shield of Vermont filed testimony. ${"after ".repeat(80)}`,
  );

  assert.match(snippet, /Blue Cross and Blue Shield of Vermont/);
  assert.ok(snippet.startsWith("... "));
  assert.ok(snippet.endsWith(" ..."));
});

test("buildRss emits valid channel and escaped item fields", () => {
  const rss = buildRss(
    [
      {
        sourceName: "WCAX",
        sourceFeedUrl: "https://www.wcax.com/feed.xml",
        title: "Blue Cross & rates",
        link: "https://www.wcax.com/story",
        guid: "https://www.wcax.com/story",
        pubDate: new Date("2026-05-12T12:00:00Z"),
        matchedTerms: ["Blue Cross"],
        snippet: "Blue Cross filed rates.",
      },
    ],
    {
      now: new Date("2026-05-13T12:00:00Z"),
      feedUrl: "https://example.com/feed.rss",
      siteUrl: "https://example.com/",
    },
  );

  assert.match(rss, /<rss version="2.0"/);
  assert.match(rss, /<title>Blue Cross VT News Mentions<\/title>/);
  assert.match(rss, /WCAX: Blue Cross &amp; rates/);
  assert.match(rss, /<category>Blue Cross<\/category>/);
  assert.match(rss, /atom:link href="https:\/\/example.com\/feed.rss"/);
});

test("buildJsonSummary creates auditable item output", () => {
  const summary = buildJsonSummary(
    [
      {
        sourceName: "Seven Days",
        title: "Insurance story",
        link: "https://example.com/story",
        pubDate: new Date("2026-05-12T12:00:00Z"),
        matchedTerms: ["BCBSVT"],
        snippet: "BCBSVT mention.",
      },
    ],
    [{ name: "Seven Days", ok: true, itemCount: 1 }],
    new Date("2026-05-13T12:00:00Z"),
  );

  assert.equal(summary.itemCount, 1);
  assert.equal(summary.sources[0].name, "Seven Days");
  assert.equal(summary.items[0].matchedTerms[0], "BCBSVT");
});

test("parseFeedItems supports isSearchFeed property", () => {
  const xml = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Web mention</title>
          <link>https://example.com/story</link>
          <description>Mention found by search engine</description>
        </item>
      </channel>
    </rss>`;

  const items = parseFeedItems(xml, {
    name: "Google News Search",
    feedUrl: "https://news.google.com/rss/...",
    isSearchFeed: true,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].isSearchFeed, true);
});

test("enrichAndFilterItems retains search feed item with fallback matching term when no explicit mentions are found in text", async () => {
  const originalScan = process.env.RSS_ARTICLE_SCAN;
  process.env.RSS_ARTICLE_SCAN = "false";
  try {
    const { enrichAndFilterItems } = await import("../src/index.js");
    const items = [
      {
        sourceName: "Google News Search",
        isSearchFeed: true,
        title: "Implicit news item",
        link: "https://example.com/implicit-story",
        feedContent: "This text does not mention any target keywords directly but was indexed by Google News.",
      }
    ];

    const filtered = await enrichAndFilterItems(items);
    assert.equal(filtered.length, 1);
    assert.deepEqual(filtered[0].matchedTerms, ["Blue Cross"]);
  } finally {
    process.env.RSS_ARTICLE_SCAN = originalScan;
  }
});

test("htmlToArticleText extracts clean editorial text ignoring boilerplates", () => {
  const html = `
    <!doctype html>
    <html>
      <head><title>Test Page</title></head>
      <body>
        <header>
          <nav><a href="/">Home</a> | <a href="/about">About Us</a></nav>
        </header>
        <aside class="sidebar">
          <h3>Trending Articles</h3>
          <p>Unrelated sidebar mention of Blue Cross</p>
        </aside>
        <main>
          <article>
            <h1>Main Editorial Story</h1>
            <p>This is the actual news content of the story.</p>
            <p>It has multiple paragraphs representing the article body.</p>
          </article>
        </main>
        <footer>
          <p>&copy; 2026 Publisher. All rights reserved.</p>
        </footer>
      </body>
    </html>
  `;

  const text = htmlToArticleText(html);
  assert.match(text, /This is the actual news content/);
  assert.match(text, /multiple paragraphs/);
  assert.ok(!text.includes("Trending Articles"));
  assert.ok(!text.includes("About Us"));
  assert.ok(!text.includes("Publisher"));
});

test("enrichAndFilterItems skips network fetches on cache hits", async () => {
  const originalScan = process.env.RSS_ARTICLE_SCAN;
  process.env.RSS_ARTICLE_SCAN = "true";
  
  try {
    const items = [
      {
        sourceName: "Cached Outlet",
        title: "News story",
        link: "https://example.com/cached-article",
        feedContent: "Implicit content",
      }
    ];

    const cache = new Map([
      ["https://example.com/cached-article", {
        matchedTerms: ["BCBSVT"],
        snippet: "Cached snippet about BCBSVT.",
        articleError: "No error"
      }]
    ]);

    const filtered = await enrichAndFilterItems(items, cache);
    assert.equal(filtered.length, 1);
    assert.deepEqual(filtered[0].matchedTerms, ["BCBSVT"]);
    assert.equal(filtered[0].snippet, "Cached snippet about BCBSVT.");
    assert.equal(filtered[0].articleError, "No error");
  } finally {
    process.env.RSS_ARTICLE_SCAN = originalScan;
  }
});
