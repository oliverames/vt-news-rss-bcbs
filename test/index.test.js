import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJsonSummary,
  buildRss,
  buildSnippet,
  buildSummaryPrompt,
  canonicalizeMatchedTerms,
  categorizeTerms,
  CATEGORY_BRAND,
  CATEGORY_TOPIC,
  findMentionTerms,
  mergeWithArchive,
  parseFeedItems,
  parseFacebookPostHtml,
  parseSummaryResponse,
  enrichAndFilterItems,
  htmlToArticleText,
  TOPIC_TERMS,
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
    "bluecrossvt.org",
  ]);
});

test("findMentionTerms groups close Blue Cross spelling variants under canonical labels", () => {
  assert.deepEqual(findMentionTerms("BCBS VT filed documents."), ["BCBSVT"]);

  const blueCrossVtVariants = [
    "Blue Cross VT filed documents.",
    "BlueCrossVT filed documents.",
    "Blue CrossVT filed documents.",
    "BlueCross VT filed documents.",
    "Blue Cross Vermont filed documents.",
  ];

  for (const text of blueCrossVtVariants) {
    assert.deepEqual(findMentionTerms(text), ["Blue Cross VT"]);
  }

  const blueShieldVariants = [
    "BlueCross and BlueShield of Vermont responded.",
    "BlueCross and BlueShield of VT responded.",
    "BlueCross & BlueShield of Vermont responded.",
    "BlueCross & BlueShield of VT responded.",
    "Blue Cross Blue Shield of Vermont responded.",
  ];

  for (const text of blueShieldVariants) {
    assert.deepEqual(findMentionTerms(text), [
      "Blue Cross and Blue Shield of Vermont",
    ]);
  }

  assert.deepEqual(
    canonicalizeMatchedTerms([
      "BlueCrossVT",
      "Blue CrossVT",
      "BlueCross BlueShield of Vermont",
    ]),
    ["Blue Cross VT", "Blue Cross and Blue Shield of Vermont"],
  );
});

test("findMentionTerms catches indirect and branded variants", () => {
  assert.deepEqual(findMentionTerms("Blue Cross of Vermont announced a plan."), [
    "Blue Cross of Vermont",
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

test("topic terms catch the healthcare stories the comms team pulls", () => {
  const cases = [
    ["UVM Health cuts 142 jobs as budget strains continue", "UVM Health"],
    ["Green Mountain Care Board reviews hospital budgets", "Green Mountain Care Board"],
    ["Regulators signal they aren't done asking hospitals to cut costs", "Hospitals"],
    ["Lawmakers Pass Bill Targeting Health Care Costs", "Health care"],
    ["Brattleboro hospital nurses vote to strike", "Hospital & nurse labor"],
    ["Vermont lawmakers advance limits on AI in mental health care", "Mental health"],
    ["Legislature approves prescription drug discount card proposal", "Prescription drugs & pharmacy"],
    ["Vermonters adjust to a landscape without Medicare Advantage", "Medicare Advantage"],
    ["Some Vermont doctors embrace the new direct primary care model", "Primary care"],
    ["BCBS, MVP Health Care request lower premium increases", "MVP Health Care"],
    ["Deadline approaches for Vermont to receive $195M for rural health care", "Rural health"],
    ["New community mental health center planned for Montpelier", "Mental health"],
    ["More than half of states have taken up menopause legislation", "Women's health"],
    ["The shortage of many medicines in the U.S. remains a systemic problem", "Prescription drugs & pharmacy"],
    ["Poll: Trust in federal health agencies dropped sharply", "Federal health agencies"],
    ["Inside the push to bring AI doctors into American medicine", "Health care AI"],
  ];

  for (const [headline, expectedTerm] of cases) {
    const matches = findMentionTerms(headline, TOPIC_TERMS);
    assert.ok(
      matches.includes(expectedTerm),
      `"${headline}" should match "${expectedTerm}", got: ${matches.join(", ")}`,
    );
  }
});

test("topic terms avoid product-marketing false positives", () => {
  const cases = [
    "Shenzhen Haiyuncheng Showcases Premium Waterproof Connector Solutions",
    "Forlong Medical Rolls Out Premium Certified Gauze Roll Series for Global Medical Wound Care Applications",
  ];

  for (const headline of cases) {
    assert.deepEqual(findMentionTerms(headline, TOPIC_TERMS), []);
  }
});

test("hospital term ignores crime/accident transport briefs", () => {
  assert.deepEqual(
    findMentionTerms(
      "Driver taken to the hospital after Route 7 crash",
      TOPIC_TERMS,
    ).filter((t) => t === "Hospitals"),
    [],
  );
  // But a real hospital story still matches even with the idiom present
  assert.ok(
    findMentionTerms(
      "Patient taken to the hospital sues hospital over billing practices",
      TOPIC_TERMS,
    ).includes("Hospitals"),
  );
});

test("categorizeTerms separates brand from topic stories", () => {
  assert.equal(categorizeTerms(["BCBSVT", "Health care"]), CATEGORY_BRAND);
  assert.equal(categorizeTerms(["Hospitals", "Medicaid"]), CATEGORY_TOPIC);
});

test("summary prompt and response round-trip applies summaries", () => {
  const batch = [
    {
      title: "UVM Health cuts 142 jobs",
      sourceName: "VTDigger",
      matchedTerms: ["UVM Health"],
      snippet: "The network said the cuts save $9 million.",
    },
    {
      title: "Rate filing story",
      sourceName: "WCAX",
      matchedTerms: ["BCBSVT"],
      snippet: "Blue Cross filed rates.",
    },
  ];

  const prompt = buildSummaryPrompt(batch);
  assert.match(prompt, /ARTICLE 1/);
  assert.match(prompt, /UVM Health cuts 142 jobs/);
  assert.match(prompt, /ARTICLE 2/);

  const applied = parseSummaryResponse(
    JSON.stringify([
      { id: 1, summary: "UVM cut jobs.", reason: "Provider cost pressure" },
      { id: 2, summary: "Rates filed.", reason: "Names BCBSVT" },
    ]),
    batch,
  );
  assert.equal(applied, 2);
  assert.equal(batch[0].summary, "UVM cut jobs.");
  assert.equal(batch[1].reason, "Names BCBSVT");

  // Malformed responses apply nothing and don't throw
  assert.equal(parseSummaryResponse("not json", batch), 0);
  assert.equal(parseSummaryResponse('{"a":1}', batch), 0);
});

test("mergeWithArchive keeps stories that left their source feeds", () => {
  const now = new Date("2026-06-12T12:00:00Z");
  const current = [
    {
      link: "https://example.com/new",
      title: "Blue Cross new story",
      pubDate: new Date("2026-06-11T12:00:00Z"),
      summary: "",
    },
    {
      link: "https://example.com/shared",
      title: "Updated Blue Cross story",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      summary: "fresh",
    },
  ];
  const archived = [
    {
      link: "https://example.com/shared",
      title: "Old Blue Cross version",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      summary: "stale",
    },
    {
      link: "https://example.com/old-but-kept",
      title: "UVM Health story fell out of feed",
      pubDate: new Date("2026-05-01T12:00:00Z"),
      summary: "kept",
    },
    {
      link: "https://example.com/ancient",
      title: "Ancient UVM Health story",
      pubDate: new Date("2024-01-01T12:00:00Z"),
      summary: "pruned",
    },
    {
      link: "https://example.com/false-positive",
      title: "Premium connector",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      reason: "Irrelevant; keyword match is a false positive.",
    },
    {
      link: "https://example.com/online_features/press_releases/topic-wire.html",
      title: "Medical product wire",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      matchedTerms: ["Health care"],
    },
    {
      link: "https://example.com/online_features/press_releases/brand-wire.html",
      title: "BCBSVT wire",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      matchedTerms: ["BCBSVT"],
    },
    {
      link: "https://example.com/stale-federal-agency-match",
      title: "FDA issues emergency use authorization to treat dogs and cats",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      matchedTerms: ["Federal health agencies"],
    },
    {
      link: "https://example.com/search-fallback",
      title: "Implicit brand search result",
      pubDate: new Date("2026-06-10T12:00:00Z"),
      matchedTerms: ["Blue Cross"],
      matchSource: "searchFallback",
    },
  ];

  const merged = mergeWithArchive(current, archived, now);
  const links = merged.map((item) => item.link).sort();
  assert.deepEqual(links, [
    "https://example.com/new",
    "https://example.com/old-but-kept",
    "https://example.com/online_features/press_releases/brand-wire.html",
    "https://example.com/search-fallback",
    "https://example.com/shared",
  ]);
  const shared = merged.find((item) => item.link === "https://example.com/shared");
  assert.equal(shared.summary, "fresh");
});

test("mergeWithArchive drops future-dated stories beyond clock skew", () => {
  const now = new Date("2026-06-12T12:00:00Z");
  const merged = mergeWithArchive(
    [
      {
        link: "https://example.com/future",
        title: "Future Blue Cross story",
        pubDate: new Date("2026-06-14T12:00:00Z"),
      },
      {
        link: "https://example.com/current",
        title: "Current Blue Cross story",
        pubDate: new Date("2026-06-12T12:00:00Z"),
      },
    ],
    [
      {
        link: "https://example.com/archived-future",
        title: "Archived future Blue Cross story",
        pubDate: new Date("2026-06-15T12:00:00Z"),
      },
    ],
    now,
  );

  assert.deepEqual(
    merged.map((item) => item.link),
    ["https://example.com/current"],
  );
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

test("parseFacebookPostHtml extracts public post metadata and comments when present", () => {
  const html = `<!doctype html>
    <html>
      <head>
        <meta property="og:title" content="VTDigger">
        <meta property="og:description" content="BlueCross BlueShield wants to offer cheaper plans.">
        <meta property="og:url" content="https://www.facebook.com/vtdigger/posts/123">
        <meta property="article:published_time" content="2026-06-11T13:00:00Z">
      </head>
      <body>
        <div aria-label="Comment by Jane Reader">This affects BCBS VT members.</div>
      </body>
    </html>`;

  const item = parseFacebookPostHtml(html, {
    name: "VTDigger Facebook",
    facebookPostUrl: "https://m.facebook.com/vtdigger/posts/123",
  });

  assert.equal(item.sourceName, "VTDigger Facebook");
  assert.equal(item.link, "https://www.facebook.com/vtdigger/posts/123");
  assert.equal(item.description, "BlueCross BlueShield wants to offer cheaper plans.");
  assert.deepEqual(item.comments, [
    { author: "Jane Reader", text: "This affects BCBS VT members." },
  ]);
  assert.match(item.feedContent, /BlueCross BlueShield/);
  assert.match(item.feedContent, /BCBS VT members/);
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
        comments: [{ author: "Reader", text: "Useful context." }],
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
  assert.match(rss, /<strong>Comments:<\/strong>/);
  assert.match(rss, /Reader: Useful context\./);
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
        comments: [{ author: "Reader", text: "Good catch." }],
      },
    ],
    [{ name: "Seven Days", ok: true, itemCount: 1 }],
    new Date("2026-05-13T12:00:00Z"),
  );

  assert.equal(summary.itemCount, 1);
  assert.equal(summary.version, "https://jsonfeed.org/version/1.1");
  assert.equal(summary.sources[0].name, "Seven Days");
  assert.equal(summary.items[0].id, "https://example.com/story");
  assert.equal(summary.items[0].url, "https://example.com/story");
  assert.equal(summary.items[0].tags[0], "BCBSVT");
  assert.equal(summary.items[0].matchedTerms[0], "BCBSVT");
  assert.match(summary.items[0].content_text, /Good catch/);
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
    searchFallbackTerms: ["Blue Cross"],
    scanArticle: false,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].isSearchFeed, true);
  assert.deepEqual(items[0].searchFallbackTerms, ["Blue Cross"]);
  assert.equal(items[0].scanArticle, false);
});

test("enrichAndFilterItems only uses fallback terms when the source declares them", async () => {
  const items = [
    {
      sourceName: "Google News Brand Search",
      isSearchFeed: true,
      searchFallbackTerms: ["Blue Cross"],
      scanArticle: false,
      title: "Implicit news item",
      link: "https://example.com/implicit-story",
      feedContent:
        "This text does not mention any target keywords directly but was indexed by a narrow brand search.",
    },
    {
      sourceName: "Google News Broad Health Search",
      isSearchFeed: true,
      scanArticle: false,
      title: "Unrelated broad search item",
      link: "https://example.com/unrelated-story",
      feedContent:
        "This text does not mention target keywords and should not inherit a broad search label.",
    },
  ];

  const filtered = await enrichAndFilterItems(items);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].link, "https://example.com/implicit-story");
  assert.deepEqual(filtered[0].matchedTerms, ["Blue Cross"]);
  assert.equal(filtered[0].matchSource, "searchFallback");
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
