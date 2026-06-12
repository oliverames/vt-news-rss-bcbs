import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJsonSummary,
  buildRss,
  DEFAULT_SOURCES,
  cleanStorySnippet,
  buildSourcesFromEnv,
  buildSnippet,
  buildSummaryPrompt,
  applyDeterministicRelevance,
  canonicalizeMatchedTerms,
  categorizeTerms,
  CATEGORY_BRAND,
  CATEGORY_TOPIC,
  findMentionTerms,
  dedupeResolvedItems,
  mergeWithArchive,
  mergeFacebookPagePostItem,
  parseBlueCrossVtListingItems,
  parseBcbsAssociationNewsItems,
  parseFeedItems,
  parseFacebookEmbeddedPosts,
  parseFacebookPageHtml,
  parseFacebookPostHtml,
  parseSummaryResponse,
  parseUvmHealthNewsroomItems,
  enrichAndFilterItems,
  filterSourceItemsByDateWindow,
  htmlToArticleText,
  readResponseTextWithLimit,
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

test("default sources cover recurring Kristina export outlets", () => {
  const sourceText = decodeURIComponent(
    DEFAULT_SOURCES.map((source) =>
      [
        source.name,
        source.homepage,
        source.feedUrl,
        source.listingUrl,
        source.minPubDate,
        source.maxPubDate,
      ]
        .filter(Boolean)
        .join(" "),
    ).join(" "),
  ).replaceAll("+", " ");
  const expectedHosts = [
    "bcbs.com",
    "burlingtonfreepress.com",
    "abcnews.go.com",
    "cbsnews.com",
    "wsj.com",
    "cnn.com",
    "vermontdailychronicle.com",
    "beckershospitalreview.com",
    "samessenger.com",
  ];

  for (const host of expectedHosts) {
    assert.match(sourceText, new RegExp(host.replaceAll(".", "\\.")));
  }
  assert.match(sourceText, /Google News Blue Cross VT Backfill Since Jan 1 2026/);
  assert.match(sourceText, /when:180d/);
  assert.match(sourceText, /2026-01-01T00:00:00Z/);
  assert.match(sourceText, /2026-06-13T00:00:00Z/);
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
    ["Payers build digital health records for members", "Health records & interoperability"],
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

test("transport idiom strip covers named facilities and treatment phrasing", () => {
  // The Townshend crash story that leaked into production
  assert.deepEqual(
    findMentionTerms(
      "Three injured, one seriously, in Townshend crash. One person was airlifted to Dartmouth-Hitchcock Medical Center.",
      TOPIC_TERMS,
    ).filter((t) => t.includes("hospital") || t.includes("Hospital")),
    [],
  );
  assert.deepEqual(
    findMentionTerms(
      "Driver treated at a nearby hospital after the collision.",
      TOPIC_TERMS,
    ).filter((t) => t === "Hospitals"),
    [],
  );
  assert.deepEqual(
    findMentionTerms(
      "DUI driver sends teen biker to hospital after crash.",
      TOPIC_TERMS,
    ).filter((t) => t === "Hospitals"),
    [],
  );
  // Real institutional coverage still matches
  assert.ok(
    findMentionTerms(
      "Dartmouth-Hitchcock Medical Center announces new birthing pavilion program",
      TOPIC_TERMS,
    ).includes("Vermont hospitals & providers"),
  );
});

test("dedupeResolvedItems drops same link and same title+domain, keeps cross-outlet copies", () => {
  const items = [
    { link: "https://news.yahoo.com/uvm-cuts-142", title: "UVM Health eliminates 142 positions - Yahoo" },
    { link: "https://news.yahoo.com/uvm-cuts-142", title: "UVM Health eliminates 142 positions - Yahoo" },
    { link: "https://news.yahoo.com/uvm-cuts-142-alt", title: "UVM Health eliminates 142 positions - Yahoo" },
    { link: "https://www.wptz.com/uvm-cuts", title: "UVM Health eliminates 142 positions" },
    { link: "https://www.wcax.com/uvm-cuts", title: "UVM Health eliminates 142 positions" },
  ];
  const deduped = dedupeResolvedItems(items);
  assert.deepEqual(
    deduped.map((item) => item.link),
    [
      "https://news.yahoo.com/uvm-cuts-142",
      "https://www.wptz.com/uvm-cuts",
      "https://www.wcax.com/uvm-cuts",
    ],
  );
});

test("dedupeResolvedItems drops Google News wrappers when the outlet item exists", () => {
  const items = [
    {
      sourceName: "Google News Health Insurance Search",
      link: "https://news.google.com/rss/articles/example",
      title:
        "Major Medicare Advantage insurers appear to deny care for profit, federal watchdog finds - Healthcare Dive",
    },
    {
      sourceName: "Healthcare Dive",
      link: "https://www.healthcaredive.com/news/medicare-advantage-denials/",
      title:
        "Major Medicare Advantage insurers appear to deny care for profit, federal watchdog finds",
    },
  ];

  assert.deepEqual(
    dedupeResolvedItems(items).map((item) => item.link),
    ["https://www.healthcaredive.com/news/medicare-advantage-denials/"],
  );
});

test("parseSummaryResponse applies the relevance verdict", () => {
  const batch = [
    { title: "Texas shooting", snippet: "x" },
    { title: "GMCB hearing", snippet: "y" },
    { title: "No verdict story", snippet: "z" },
  ];
  parseSummaryResponse(
    JSON.stringify([
      { id: 1, summary: "A shooting.", reason: "Not health care", relevant: false },
      { id: 2, summary: "Rate hearing.", reason: "Regulator action", relevant: true },
      { id: 3, summary: "Something.", reason: "..." },
    ]),
    batch,
  );
  assert.equal(batch[0].relevant, false);
  assert.equal(batch[1].relevant, true);
  // Missing verdict defaults to relevant — only explicit false excludes
  assert.equal(batch[2].relevant, true);
});

test("deterministic relevance rejects out-of-region low-priority false positives", () => {
  const rejected = [
    {
      sourceName: "MyNBC5",
      title: "Suspect dead after Texas shooting kills 1 and leaves 9 injured",
      description: "Those injured were taken to the hospital.",
      matchedTerms: ["Hospitals"],
      category: CATEGORY_TOPIC,
    },
    {
      sourceName: "MyChamplainValley",
      title: "Massive measles outbreak in Virginia county continues to grow",
      description: "Officials advise unvaccinated people to avoid gatherings.",
      matchedTerms: ["Vaccines"],
      category: CATEGORY_TOPIC,
    },
  ];

  for (const item of rejected) {
    assert.equal(applyDeterministicRelevance(item).relevant, false);
  }

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "Google News Health Insurance Search",
      title:
        "Major Medicare Advantage insurers appear to deny care for profit, federal watchdog finds",
      description: "The report concerns insurer practices.",
      matchedTerms: ["Medicare Advantage", "Health insurance"],
      category: CATEGORY_TOPIC,
    }).relevant,
    undefined,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "MyChamplainValley",
      title:
        "Northern Border Regional Commission grants announced for Vermont",
      description:
        "The awards support water, transportation, and healthcare improvements.",
      matchedTerms: ["Health care"],
      category: CATEGORY_TOPIC,
    }).relevant,
    false,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "Vermont Daily Chronicle",
      title:
        "Deadline approaches for Vermont to receive $195M for rural health care",
      description:
        "Federal funding would support rural health care access for patients.",
      matchedTerms: ["Rural health"],
      category: CATEGORY_TOPIC,
    }).relevant,
    undefined,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "Google News Health Trade Search",
      title: "CMS proposes new deadlines for prior authorizations for drugs",
      description: "Federal policy update affects coverage operations.",
      matchedTerms: ["Health care", "Prior authorization & claims"],
      category: CATEGORY_TOPIC,
      relevant: false,
      reason: "Low-priority health mention outside Vermont or New England.",
    }).relevant,
    undefined,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "CNN Health",
      title: "The best coupons at CVS Pharmacy",
      description: "A shopping coupon page.",
      matchedTerms: ["Prescription drugs & pharmacy"],
      category: CATEGORY_TOPIC,
    }).relevant,
    false,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "CBS News Health",
      title:
        'Americans on health insurance: "I pay a lot of money for and it covers very little"',
      description:
        "Consumers describe frustration with what their insurance covers.",
      matchedTerms: ["Health insurance"],
      category: CATEGORY_TOPIC,
    }).relevant,
    undefined,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "Fierce Healthcare",
      title: "Virtual care tech companies launch RPM tool for pharmacies",
      description:
        "The program helps pharmacies support chronic care patients between visits.",
      matchedTerms: ["Prescription drugs & pharmacy"],
      category: CATEGORY_TOPIC,
    }).relevant,
    false,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "KFF Health News",
      title:
        "California Health Worker Union, Hospital Association Tout Dueling Ballot Initiatives",
      description:
        "Get our weekly newsletter with a roundup of original coverage.",
      matchedTerms: ["Hospitals", "Hospital & nurse labor"],
      category: CATEGORY_TOPIC,
    }).relevant,
    false,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "Google News National Health Policy Search",
      title: "Surprising ways menopause can affect your mouth",
      description: "Wellness advice from a national outlet.",
      matchedTerms: ["Women's health"],
      category: CATEGORY_TOPIC,
    }).relevant,
    false,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "Fierce Healthcare",
      title:
        "AHIP 2026: Why Ascendiun CEO is bullish on building digital health records",
      description:
        "AHIP discussion of health records and interoperability for patients.",
      matchedTerms: ["Health records & interoperability"],
      category: CATEGORY_TOPIC,
    }).relevant,
    undefined,
  );

  assert.equal(
    applyDeterministicRelevance({
      sourceName: "MyChamplainValley",
      title: "Three injured, one seriously, in Townshend crash",
      description: "One person was airlifted to Dartmouth-Hitchcock Medical Center.",
      matchedTerms: ["Vermont hospitals & providers"],
      category: CATEGORY_TOPIC,
    }).relevant,
    undefined,
  );
});

test("buildRss excludes items marked not relevant", () => {
  const rss = buildRss(
    [
      {
        sourceName: "WCAX",
        sourceFeedUrl: "https://example.com/feed",
        title: "Texas shooting story",
        link: "https://example.com/shooting",
        guid: "https://example.com/shooting",
        pubDate: new Date("2026-06-12T12:00:00Z"),
        matchedTerms: ["Hospitals"],
        snippet: "",
        relevant: false,
      },
      {
        sourceName: "VTDigger",
        sourceFeedUrl: "https://example.com/feed",
        title: "GMCB story",
        link: "https://example.com/gmcb",
        guid: "https://example.com/gmcb",
        pubDate: new Date("2026-06-12T12:00:00Z"),
        matchedTerms: ["Green Mountain Care Board"],
        snippet: "",
        relevant: true,
      },
    ],
    { now: new Date("2026-06-12T13:00:00Z"), feedUrl: "https://example.com/feed.rss" },
  );
  assert.ok(!rss.includes("Texas shooting story"));
  assert.ok(rss.includes("GMCB story"));
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
      link: "https://example.com/ancient-brand",
      title: "Ancient Blue Cross VT story",
      pubDate: new Date("2024-01-01T12:00:00Z"),
      matchedTerms: ["BCBSVT"],
      summary: "kept indefinitely",
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
    "https://example.com/ancient-brand",
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

test("filterSourceItemsByDateWindow enforces backfill boundaries", () => {
  const source = {
    minPubDate: "2026-01-01T00:00:00Z",
    maxPubDate: "2026-06-13T00:00:00Z",
  };
  const items = [
    { title: "Too old", pubDate: new Date("2025-12-31T23:59:59Z") },
    { title: "In range", pubDate: new Date("2026-05-13T12:00:00Z") },
    { title: "Too new", pubDate: new Date("2026-06-13T00:00:00Z") },
    { title: "Undated" },
  ];

  assert.deepEqual(
    filterSourceItemsByDateWindow(items, source).map((item) => item.title),
    ["In range"],
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

test("parseBlueCrossVtListingItems extracts dated Newsroom and blog rows", () => {
  const html = `<!doctype html>
    <html>
      <body>
        <div class="views-row">
          <article class="node--type-news">
            <div class="news--date"><time datetime="2026-05-12T12:00:00Z">May 12, 2026</time></div>
            <h3><a href="/health-community/news/rate-request" class="link-arrow">Blue Cross and Blue Shield of Vermont Requests Lowest Premium Increase in Five Years</a></h3>
            <p>Rate reflects collective work across the state.</p>
            <div class="news--category">Company &amp; Industry News</div>
          </article>
        </div>
        <div class="views-row">
          <article class="node--type-blog">
            <div class="blog-post--date"><time datetime="2026-06-15T12:00:00Z">Jun 15, 2026</time></div>
            <h3><a href="/health-community/blog/listing/medicare-caregivers" class="link-arrow">What Caregivers Need to Know About Medicare</a></h3>
            <p>Helpful guidance for caregivers.</p>
            <div class="blog-post--category">Understanding Insurance</div>
          </article>
        </div>
      </body>
    </html>`;

  const items = parseBlueCrossVtListingItems(html, {
    name: "BlueCrossVT Newsroom",
    homepage: "https://www.bluecrossvt.org/health-community/news",
    listingUrl: "https://www.bluecrossvt.org/health-community/news",
    searchFallbackTerms: ["bluecrossvt.org"],
    scanArticle: false,
  });

  assert.equal(items.length, 2);
  assert.equal(
    items[0].link,
    "https://www.bluecrossvt.org/health-community/news/rate-request",
  );
  assert.equal(items[0].pubDate.toISOString(), "2026-05-12T12:00:00.000Z");
  assert.match(items[1].feedContent, /bluecrossvt\.org/);
  assert.deepEqual(items[1].searchFallbackTerms, ["bluecrossvt.org"]);
  assert.equal(items[1].scanArticle, false);
});

test("parseBcbsAssociationNewsItems extracts dated BCBSA listing cards", () => {
  const html = `<!doctype html>
    <html>
      <body>
        <article class="bcbs-news-item-listing-content">
          <ul class="bcbs-categories-chips">
            <li class="bcbs-categories-chips__item">Press Release</li>
          </ul>
          <h1 class="bcbs-news-item-listing-content__title">
            <a class="bcbs-news-item-listing-content__link" href="/about-us/association-news/prior-authorization-standardization">Health Plans Take Next Step to Streamline and Simplify Prior Authorization for Patients and Providers</a>
          </h1>
          <p class="bcbs-news-item-listing-content__text">Leading health plans announced a new initiative to accelerate patient access to care.</p>
          <time class="bcbs-news-item-listing-content__date" dateTime="2026-04-24">April 24, 2026</time>
        </article>
        <article class="bcbs-news-item-listing-content">
          <h1 class="bcbs-news-item-listing-content__title">
            <a class="bcbs-news-item-listing-content__link" href="/support-resources/terminology-glossary-dictionary">Glossary</a>
          </h1>
        </article>
      </body>
    </html>`;

  const items = parseBcbsAssociationNewsItems(html, {
    name: "BCBSA Association News",
    homepage: "https://www.bcbs.com/about-us/association-news",
    listingUrl: "https://www.bcbs.com/about-us/association-news",
    searchFallbackTerms: ["Blue Cross Blue Shield Association"],
    scanArticle: false,
  });

  assert.equal(items.length, 1);
  assert.equal(
    items[0].link,
    "https://www.bcbs.com/about-us/association-news/prior-authorization-standardization",
  );
  assert.equal(items[0].pubDate.toISOString().slice(0, 10), "2026-04-24");
  assert.match(items[0].feedContent, /Blue Cross Blue Shield Association/);
  assert.deepEqual(items[0].searchFallbackTerms, [
    "Blue Cross Blue Shield Association",
  ]);
  assert.equal(items[0].scanArticle, false);
});

test("parseUvmHealthNewsroomItems extracts dated newsroom cards", () => {
  const html = `<!doctype html>
    <html>
      <body>
        <outline-card-clickable>
          <h4><a href="/newsroom/uvm-health-announces-elimination-of-76-positions">UVM Health Announces Elimination of 76 Positions</a></h4>
          <img alt="Front entrance of the UVM Medical Center in Burlington, Vermont.">
          <div slot="date">June 9, 2026</div>
        </outline-card-clickable>
        <outline-card-clickable>
          <h4><a href="/newsroom/search">Explore more news</a></h4>
          <div slot="date">June 1, 2026</div>
        </outline-card-clickable>
      </body>
    </html>`;

  const items = parseUvmHealthNewsroomItems(html, {
    name: "UVM Health Newsroom",
    homepage: "https://www.uvmhealth.org/newsroom",
    listingUrl: "https://www.uvmhealth.org/newsroom",
    searchFallbackTerms: ["UVM Health"],
    scanArticle: false,
  });

  assert.equal(items.length, 1);
  assert.equal(
    items[0].link,
    "https://www.uvmhealth.org/newsroom/uvm-health-announces-elimination-of-76-positions",
  );
  assert.equal(items[0].pubDate.toISOString().slice(0, 10), "2026-06-09");
  assert.match(items[0].feedContent, /Vermont health care/);
  assert.deepEqual(items[0].searchFallbackTerms, ["UVM Health"]);
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
    {
      author: "Jane Reader",
      text: "This affects BCBS VT members.",
      date: null,
      replies: [],
    },
  ]);
  assert.match(item.feedContent, /BlueCross BlueShield/);
  assert.match(item.feedContent, /BCBS VT members/);
});

test("parseFacebookPostHtml uses embedded post dates and nested comments", () => {
  const html = `<!doctype html>
    <html>
      <head>
        <meta property="og:title" content="VTDigger">
        <meta property="og:description" content="BlueCross BlueShield wants to offer cheaper plans.">
        <meta property="og:url" content="https://www.facebook.com/vtdigger/posts/123">
      </head>
      <body>
        <script>{
          "creation_time":1781270103,
          "depth":0,
          "body":{"text":"Parent comment about BCBS VT."},
          "author":{"name":"Jane Reader"},
          "created_time":1781270200,
          "depth":1,
          "body":{"text":"Reply with more local detail."},
          "author":{"name":"Sam Reply"},
          "created_time":1781270300
        }</script>
      </body>
    </html>`;

  const item = parseFacebookPostHtml(html, {
    name: "VTDigger Facebook",
    facebookPostUrl: "https://m.facebook.com/vtdigger/posts/123",
  });

  assert.equal(
    item.pubDate.toISOString(),
    new Date(1781270103 * 1000).toISOString(),
  );
  assert.deepEqual(item.comments, [
    {
      author: "Jane Reader",
      text: "Parent comment about BCBS VT.",
      date: new Date(1781270200 * 1000).toISOString(),
      replies: [
        {
          author: "Sam Reply",
          text: "Reply with more local detail.",
          date: new Date(1781270300 * 1000).toISOString(),
        },
      ],
    },
  ]);
  assert.match(item.feedContent, /Reply with more local detail/);
});

test("parseFacebookPageHtml extracts public post links when page HTML exposes them", () => {
  const html = `<!doctype html>
    <html>
      <head><title>VTDigger</title></head>
      <body>
        <article>
          <p>VTDigger 3h · BlueCross BlueShield wants to offer cheaper health plans.</p>
          <a href="/vtdigger/posts/123?refid=52">Full Story</a>
        </article>
        <article>
          <p>Unrelated weather update.</p>
          <a href="https://www.facebook.com/vtdigger/posts/456?mibextid=abc">Full Story</a>
        </article>
      </body>
    </html>`;

  const items = parseFacebookPageHtml(html, {
    name: "VTDigger Facebook page",
    facebookPageUrl: "https://www.facebook.com/vtdigger",
    now: new Date("2026-06-12T18:00:00Z"),
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].sourceName, "VTDigger Facebook page");
  assert.equal(items[0].link, "https://www.facebook.com/vtdigger/posts/123");
  assert.match(items[0].description, /BlueCross BlueShield/);
  assert.match(items[0].feedContent, /cheaper health plans/);
  assert.equal(items[0].pubDate.toISOString(), "2026-06-12T15:00:00.000Z");
});

test("parseFacebookEmbeddedPosts extracts the server-rendered post from real page HTML", () => {
  // Facebook's no-login page HTML embeds the latest post as JSON-escaped
  // script data; there are no post links in anchor tags.
  const html = `<html><head><title>VTDigger</title></head><body>
    <script>requireLazy(["JSScheduler"],{"post_id":"1602446425217693",
    "message":{"text":"BlueCross BlueShield wants to offer a new suite of cheaper plans. \\u201cWe went hunting,\\u201d an executive said."},
    "creation_time":1781270103,"unpublished_content_type":"PUBLISHED",
    "wwwURL":"https:\\/\\/www.facebook.com\\/vtdigger\\/posts\\/pfbid02mozypSopS7PjQX3iFNX21rU8qKaVMk2aCvAL1qW3xTJg1gRMVE8B641tBJEorccCl",
    "comment_rendering_instance":{"comments":{"total_count":3}}}</script>
  </body></html>`;

  const source = {
    name: "VTDigger Facebook",
    facebookPageUrl: "https://www.facebook.com/vtdigger",
  };

  const embedded = parseFacebookEmbeddedPosts(html, source);
  assert.equal(embedded.length, 1);
  assert.equal(
    embedded[0].link,
    "https://www.facebook.com/vtdigger/posts/pfbid02mozypSopS7PjQX3iFNX21rU8qKaVMk2aCvAL1qW3xTJg1gRMVE8B641tBJEorccCl",
  );
  assert.match(embedded[0].description, /cheaper plans/);
  assert.match(embedded[0].description, /“We went hunting,”/);
  assert.equal(
    embedded[0].pubDate.toISOString(),
    new Date(1781270103 * 1000).toISOString(),
  );

  // parseFacebookPageHtml prefers the embedded path on the same HTML
  const items = parseFacebookPageHtml(html, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].link, embedded[0].link);
});

test("enrichAndFilterItems drops brand-required items without a brand match", async () => {
  const originalScan = process.env.RSS_ARTICLE_SCAN;
  process.env.RSS_ARTICLE_SCAN = "false";
  try {
    const items = [
      {
        sourceName: "WCAX Facebook",
        title: "WCAX post: Hospital announces new wing",
        link: "https://www.facebook.com/wcaxtv/posts/pfbid0aaa",
        feedContent: "Hospital announces new wing for primary care",
        requireBrandMatch: true,
      },
      {
        sourceName: "VTDigger Facebook",
        title: "VTDigger post: BlueCross BlueShield offers cheaper plans",
        link: "https://www.facebook.com/vtdigger/posts/pfbid0bbb",
        feedContent: "BlueCross BlueShield of Vermont offers cheaper plans",
        requireBrandMatch: true,
      },
    ];

    const filtered = await enrichAndFilterItems(items);
    assert.equal(filtered.length, 1);
    assert.match(filtered[0].link, /pfbid0bbb/);
  } finally {
    process.env.RSS_ARTICLE_SCAN = originalScan;
  }
});

test("mergeFacebookPagePostItem nests comments from enriched public posts", () => {
  const pageItem = {
    sourceName: "VTDigger Facebook page",
    sourceFeedUrl: "https://www.facebook.com/vtdigger",
    title: "VTDigger Facebook post: Blue Cross update",
    link: "https://www.facebook.com/vtdigger/posts/123",
    guid: "https://www.facebook.com/vtdigger/posts/123",
    pubDate: null,
    description: "Blue Cross update",
    comments: [],
    scanArticle: false,
    feedContent: "VTDigger Blue Cross update",
  };
  const postItem = {
    sourceName: "VTDigger Facebook page",
    sourceFeedUrl: "https://www.facebook.com/vtdigger/posts/123",
    title: "VTDigger Facebook post: Blue Cross update",
    link: "https://www.facebook.com/vtdigger/posts/123",
    guid: "https://www.facebook.com/vtdigger/posts/123",
    pubDate: new Date("2026-06-11T13:00:00Z"),
    description: "BlueCross BlueShield wants to offer cheaper plans.",
    comments: [{ author: "Jane Reader", text: "This affects BCBS VT members." }],
    scanArticle: false,
    feedContent: "BlueCross BlueShield wants to offer cheaper plans. This affects BCBS VT members.",
  };

  const merged = mergeFacebookPagePostItem(pageItem, postItem, {
    name: "VTDigger Facebook page",
    facebookPageUrl: "https://www.facebook.com/vtdigger",
  });

  assert.equal(merged.sourceFeedUrl, "https://www.facebook.com/vtdigger");
  assert.equal(merged.description, "BlueCross BlueShield wants to offer cheaper plans.");
  assert.deepEqual(merged.comments, [
    { author: "Jane Reader", text: "This affects BCBS VT members." },
  ]);
  assert.match(merged.feedContent, /BCBS VT members/);
});

test("buildSourcesFromEnv adds configured Facebook post and page sources", () => {
  const originalPosts = process.env.FACEBOOK_POST_URLS;
  const originalPages = process.env.FACEBOOK_PAGE_URLS;
  const originalMaxPosts = process.env.FACEBOOK_PAGE_MAX_POSTS;
  process.env.FACEBOOK_POST_URLS =
    "VTDigger|https://www.facebook.com/vtdigger/posts/123";
  process.env.FACEBOOK_PAGE_URLS =
    "WCAX|https://www.facebook.com/WCAXTV";
  process.env.FACEBOOK_PAGE_MAX_POSTS = "4";

  try {
    const sources = buildSourcesFromEnv([]);
    assert.deepEqual(sources, [
      {
        name: "VTDigger Facebook post",
        homepage: "https://www.facebook.com/vtdigger/posts/123",
        facebookPostUrl: "https://www.facebook.com/vtdigger/posts/123",
        requireBrandMatch: true,
      },
      {
        name: "WCAX Facebook page",
        homepage: "https://www.facebook.com/WCAXTV",
        facebookPageUrl: "https://www.facebook.com/WCAXTV",
        maxItems: 4,
        requireBrandMatch: true,
      },
    ]);
  } finally {
    if (originalPosts === undefined) {
      delete process.env.FACEBOOK_POST_URLS;
    } else {
      process.env.FACEBOOK_POST_URLS = originalPosts;
    }
    if (originalPages === undefined) {
      delete process.env.FACEBOOK_PAGE_URLS;
    } else {
      process.env.FACEBOOK_PAGE_URLS = originalPages;
    }
    if (originalMaxPosts === undefined) {
      delete process.env.FACEBOOK_PAGE_MAX_POSTS;
    } else {
      process.env.FACEBOOK_PAGE_MAX_POSTS = originalMaxPosts;
    }
  }
});

test("buildSnippet centers the first matched mention", () => {
  const snippet = buildSnippet(
    `${"before ".repeat(80)} Blue Cross and Blue Shield of Vermont filed testimony. ${"after ".repeat(80)}`,
  );

  assert.match(snippet, /Blue Cross and Blue Shield of Vermont/);
  assert.ok(snippet.startsWith("... "));
  assert.ok(snippet.endsWith(" ..."));
});

test("cleanStorySnippet drops repeated title-only snippets", () => {
  const title =
    "How a new Blue Cross CEO plans to revive financial performance - Modern Healthcare";
  const snippet = [
    title,
    "How a new Blue Cross CEO plans to revive financial performance Modern Healthcare",
    "How a new Blue Cross CEO plans to revive financial performance Modern Healthcare",
  ].join(" ");

  assert.equal(cleanStorySnippet(snippet, title), "");
  assert.equal(
    cleanStorySnippet(
      "The CEO said rate pressure and claims trends are priorities.",
      title,
    ),
    "The CEO said rate pressure and claims trends are priorities.",
  );
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
        comments: [
          {
            author: "Reader",
            text: "Useful context.",
            replies: [{ author: "Reply Reader", text: "More context." }],
          },
        ],
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
  assert.match(rss, /Reply Reader: More context\./);
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
        comments: [
          {
            author: "Reader",
            text: "Good catch.",
            replies: [{ author: "Reply Reader", text: "Subcomment catch." }],
          },
        ],
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
  assert.equal(summary.items[0].sourceType, "News");
  assert.equal(summary.items[0].access, "Access varies");
  assert.match(summary.items[0].content_text, /Good catch/);
  assert.match(summary.items[0].content_text, /Subcomment catch/);
});

test("buildJsonSummary keeps rejected items out of the public JSON feed", () => {
  const items = [
    {
      sourceName: "MyNBC5",
      title: "Texas shooting",
      link: "https://example.com/texas",
      pubDate: new Date("2026-06-12T12:00:00Z"),
      matchedTerms: ["Hospitals"],
      relevant: false,
      reason: "Mentions hospitals but not BCBSVT or Vermont.",
    },
    {
      sourceName: "VTDigger",
      title: "Blue Cross VT rate filing",
      link: "https://example.com/rate-filing",
      pubDate: new Date("2026-06-12T13:00:00Z"),
      matchedTerms: ["Blue Cross VT"],
      relevant: true,
      reason: "Blue Cross VT is the focus.",
    },
  ];

  const publicSummary = buildJsonSummary(
    items,
    [],
    new Date("2026-06-12T14:00:00Z"),
  );
  const auditSummary = buildJsonSummary(
    items,
    [],
    new Date("2026-06-12T14:00:00Z"),
    { includeRejected: true, feedUrl: "" },
  );

  assert.equal(publicSummary.itemCount, 1);
  assert.equal(publicSummary.totalItemCount, 2);
  assert.equal(publicSummary.rejectedItemCount, 1);
  assert.deepEqual(
    publicSummary.items.map((item) => item.title),
    ["Blue Cross VT rate filing"],
  );

  assert.equal(auditSummary.audit, true);
  assert.equal(auditSummary.itemCount, 2);
  assert.deepEqual(
    auditSummary.items.map((item) => item.title),
    ["Blue Cross VT rate filing", "Texas shooting"],
  );
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

test("readResponseTextWithLimit decodes normal bodies and rejects oversized ones", async () => {
  const small = new Response("Blue Cross VT update");
  assert.equal(
    await readResponseTextWithLimit(small, 1024),
    "Blue Cross VT update",
  );

  // Body larger than the cap is rejected mid-stream and marked non-retryable.
  const big = new Response("x".repeat(2048));
  await assert.rejects(
    () => readResponseTextWithLimit(big, 1024),
    (error) => /exceeds 1024 bytes/.test(error.message) && error.nonRetryable === true,
  );

  // A content-length header over the cap short-circuits before reading.
  const declared = new Response("tiny body", {
    headers: { "content-length": "999999" },
  });
  await assert.rejects(
    () => readResponseTextWithLimit(declared, 1024),
    (error) =>
      /content-length 999999/.test(error.message) && error.nonRetryable === true,
  );
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
        feedContent: "Prior authorization policy update for BCBSVT members.",
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
    assert.deepEqual(filtered[0].matchedTerms, [
      "BCBSVT",
      "Prior authorization & claims",
    ]);
    assert.equal(filtered[0].snippet, "Cached snippet about BCBSVT.");
    assert.equal(filtered[0].articleError, "No error");
  } finally {
    process.env.RSS_ARTICLE_SCAN = originalScan;
  }
});
