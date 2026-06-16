// Source list: Vermont outlets, national health feeds, Google News searches,
// listing pages, and Facebook pages, plus env-configured Facebook sources.
import { parsePositiveInteger } from "./utils.js";

function googleNewsSearchUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });

  return `https://news.google.com/rss/search?${params.toString()}`;
}

const BLUE_CROSS_CURRENT_SEARCH_TERMS = [
  "bluecrossvt.org",
  "site:bcbs.com",
  "site:bluewebportal.bcbs.com",
  '"Blue Cross VT"',
  '"blue cross" AND VT',
  '"blue cross" AND Vermont',
  '"bluecross" AND VT',
  '"bluecross" AND Vermont',
  '"BCBS" AND VT',
  '"bcbs" AND Vermont',
  '"BCBSVT"',
  '"BCBS VT"',
  '"BlueCrossVT"',
  '"Blue CrossVT"',
  '"BlueCross VT"',
  '"Blue Cross Vermont"',
  '"Blue Cross and Blue Shield" AND Vermont',
  '"Blue Cross and Blue Shield" AND VT',
  '"Blue Cross and Blue Shield of Vermont"',
  '"Bluecross Blueshield" AND Vermont',
  '"BlueCross and BlueShield of Vermont"',
  '"BlueCross & BlueShield of Vermont"',
  '"Blue Cross of Vermont"',
  '"Blue Cross Blue Shield Association"',
  '"Vermont Blue Advantage"',
];

const BLUE_CROSS_VT_BACKFILL_TERMS = [
  "bluecrossvt.org",
  '"Blue Cross VT"',
  '"blue cross" AND VT',
  '"blue cross" AND Vermont',
  '"bluecross" AND VT',
  '"bluecross" AND Vermont',
  '"BCBS" AND VT',
  '"bcbs" AND Vermont',
  '"BCBSVT"',
  '"BCBS VT"',
  '"BlueCrossVT"',
  '"Blue CrossVT"',
  '"BlueCross VT"',
  '"Blue Cross Vermont"',
  '"Blue Cross and Blue Shield" AND Vermont',
  '"Blue Cross and Blue Shield" AND VT',
  '"Blue Cross and Blue Shield of Vermont"',
  '"Bluecross Blueshield" AND Vermont',
  '"BlueCross and BlueShield of Vermont"',
  '"BlueCross & BlueShield of Vermont"',
  '"Blue Cross of Vermont"',
  '"Vermont Blue Advantage"',
  '"Vermont Blues plan"',
  '"Vermont largest health insurer"',
  '"Vermont largest private insurer"',
];

const BLUE_CROSS_CURRENT_SEARCH_QUERY =
  BLUE_CROSS_CURRENT_SEARCH_TERMS.join(" OR ");
const BLUE_CROSS_VT_BACKFILL_QUERY =
  BLUE_CROSS_VT_BACKFILL_TERMS.join(" OR ");

const LOCAL_OUTLET_FALLBACK_TERMS = [
  '"Blue Cross VT"',
  '"blue cross" AND Vermont',
  '"BCBS" AND Vermont',
  'Vermont AND "healthcare"',
  'Vermont AND "health care"',
  'Vermont AND "hospitals"',
  '"health insurers"',
  '"health care" AND affordability',
  '"UVM Health"',
  '"MVP Health Care"',
  '"Green Mountain Care Board"',
  '"Vermont health care"',
  '"health insurance" AND Vermont',
];

const TOWNNEWS_SEARCH_THROTTLE = {
  throttleGroup: "townnews-search",
  throttleDelayMs: parsePositiveInteger(process.env.RSS_TOWNNEWS_DELAY_MS, 8000),
};

function localOutletFallbackFeed(site, days = 30) {
  return {
    feedUrl: googleNewsSearchUrl(
      `site:${site} (${LOCAL_OUTLET_FALLBACK_TERMS.join(" OR ")}) when:${days}d`,
    ),
    isSearchFeed: true,
    scanArticle: false,
    maxItems: 25,
  };
}

// Once maxPubDate passes, collectFeedItems skips this source automatically
// (see isSourceWindowClosed); its items persist via the archive. The
// definition is kept for provenance and can be deleted at leisure.
function blueCrossVtBackfillSource(name, minPubDate, maxPubDate) {
  return {
    name,
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(`(${BLUE_CROSS_VT_BACKFILL_QUERY}) when:180d`),
    isSearchFeed: true,
    searchFallbackTerms: ["Blue Cross"],
    scanArticle: false,
    minPubDate: `${minPubDate}T00:00:00Z`,
    maxPubDate: `${maxPubDate}T00:00:00Z`,
    maxItems: 100,
  };
}

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
    name: "Vermont Public",
    homepage: "https://www.vermontpublic.org/",
    feedUrl: "https://www.vermontpublic.org/local-news.rss",
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
    fallbackFeed: localOutletFallbackFeed("vermontbiz.com"),
  },
  {
    name: "UVM Health Newsroom",
    homepage: "https://www.uvmhealth.org/newsroom",
    listingUrl: "https://www.uvmhealth.org/newsroom",
    listingParser: "uvmHealthNewsroom",
    searchFallbackTerms: ["UVM Health"],
    scanArticle: false,
    maxItems: 10,
  },
  {
    name: "BlueCrossVT Newsroom",
    homepage: "https://www.bluecrossvt.org/health-community/news",
    listingUrl: "https://www.bluecrossvt.org/health-community/news",
    searchFallbackTerms: ["bluecrossvt.org"],
    scanArticle: false,
  },
  {
    name: "BlueCrossVT Be Well VT Blog",
    homepage: "https://www.bluecrossvt.org/health-community/blog/listing",
    listingUrl: "https://www.bluecrossvt.org/health-community/blog/listing",
    searchFallbackTerms: ["bluecrossvt.org"],
    scanArticle: false,
  },
  {
    name: "BCBSA Association News",
    homepage: "https://www.bcbs.com/about-us/association-news",
    listingUrl: "https://www.bcbs.com/about-us/association-news",
    listingParser: "bcbsAssociationNews",
    searchFallbackTerms: ["Blue Cross Blue Shield Association"],
    scanArticle: false,
    maxItems: 20,
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
    fallbackFeed: localOutletFallbackFeed("rutlandherald.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Times Argus",
    homepage: "https://www.timesargus.com/",
    feedUrl:
      "https://www.timesargus.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
    fallbackFeed: localOutletFallbackFeed("timesargus.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Times Argus UVM Health Search",
    homepage: "https://www.timesargus.com/",
    feedUrl:
      "https://www.timesargus.com/search/?q=%22UVM%20Health%22&f=rss&t=article&l=50&s=start_time&sd=desc",
    scanArticle: false,
    maxItems: 20,
    fallbackFeed: localOutletFallbackFeed("timesargus.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Bennington Banner",
    homepage: "https://www.benningtonbanner.com/",
    feedUrl:
      "https://www.benningtonbanner.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
    fallbackFeed: localOutletFallbackFeed("benningtonbanner.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Brattleboro Reformer",
    homepage: "https://www.reformer.com/",
    feedUrl:
      "https://www.reformer.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc",
    fallbackFeed: localOutletFallbackFeed("reformer.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Vermont Community Newspaper Group",
    homepage: "https://www.vtcng.com/",
    feedUrl:
      "https://www.vtcng.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
    fallbackFeed: localOutletFallbackFeed("vtcng.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
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
    fallbackFeed: localOutletFallbackFeed("mountaintimes.info"),
  },
  {
    name: "Newport Daily Express",
    homepage: "https://www.newportvermontdailyexpress.com/",
    feedUrl:
      "https://www.newportvermontdailyexpress.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
    fallbackFeed: localOutletFallbackFeed("newportvermontdailyexpress.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Vermont Daily Chronicle",
    homepage: "https://vermontdailychronicle.com/",
    feedUrl: "https://vermontdailychronicle.com/feed/",
  },
  {
    name: "St. Albans Messenger",
    homepage: "https://www.samessenger.com/",
    feedUrl:
      "https://www.samessenger.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
    fallbackFeed: localOutletFallbackFeed("samessenger.com"),
    ...TOWNNEWS_SEARCH_THROTTLE,
  },
  {
    name: "Google News Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(BLUE_CROSS_CURRENT_SEARCH_QUERY),
    isSearchFeed: true,
    searchFallbackTerms: ["Blue Cross"],
    maxItems: 50,
  },
  blueCrossVtBackfillSource(
    "Google News Blue Cross VT Backfill Since Jan 1 2026",
    "2026-01-01",
    "2026-06-13",
  ),
  {
    name: "Google News Vermont Health Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        'Vermont AND "healthcare"',
        'Vermont AND "health care"',
        'Vermont AND "hospitals"',
        '"health insurers"',
        '"health care" AND affordability',
        '"UVM Health"',
        '"MVP Health Care"',
        '"Green Mountain Care Board"',
        '"Vermont health care"',
        '"Vermont hospital"',
        '"Vermont Medicaid"',
        '"Vermont Health Connect"',
        '"DVHA"',
        '"Vermont Department of Health"',
        '"health insurance premiums" Vermont',
        '"Medicare Advantage" Vermont',
      ].join(" OR ") + " when:7d",
    ),
    isSearchFeed: true,
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "Google News Kristina Source Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        "(site:burlingtonfreepress.com OR site:wsj.com OR site:abcnews.go.com OR site:cbsnews.com OR site:cnn.com OR site:beckershospitalreview.com OR site:samessenger.com OR site:vermontdailychronicle.com)",
        '("Vermont" OR "Blue Cross" OR "health care" OR healthcare OR "health insurance" OR Medicare OR Medicaid OR hospital OR insurer OR payer)',
      ].join(" ") + " when:14d",
    ),
    isSearchFeed: true,
    scanArticle: false,
    maxItems: 75,
  },
  {
    name: "Google News Health Insurance Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        '"Medicare Advantage"',
        '"prior authorization"',
        '"medical debt"',
        '"health insurance premiums"',
        '"PBM"',
        '"No Surprises Act"',
        '"ACA coverage losses"',
        '"GLP-1 coverage"',
        '"payer issues"',
      ].join(" OR ") + " when:7d",
    ),
    isSearchFeed: true,
    scanArticle: false,
    maxItems: 30,
  },
  {
    name: "ABC News Health",
    homepage: "https://abcnews.go.com/Health",
    feedUrl: "https://abcnews.go.com/abcnews/healthheadlines",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "CBS News Health",
    homepage: "https://www.cbsnews.com/health/",
    feedUrl: "https://www.cbsnews.com/latest/rss/health",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "CNN Health",
    homepage: "https://www.cnn.com/health",
    feedUrl: "http://rss.cnn.com/rss/cnn_health.rss",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "STAT Health News",
    homepage: "https://www.statnews.com/",
    feedUrl: "https://www.statnews.com/feed/",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "Fierce Healthcare",
    homepage: "https://www.fiercehealthcare.com/",
    feedUrl: "https://www.fiercehealthcare.com/rss/xml",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "Healthcare Dive",
    homepage: "https://www.healthcaredive.com/",
    feedUrl: "https://www.healthcaredive.com/feeds/news/",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "KFF Health News",
    homepage: "https://kffhealthnews.org/",
    feedUrl: "https://kffhealthnews.org/feed/",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "The Hill Health Care",
    homepage: "https://thehill.com/policy/healthcare/",
    feedUrl: "https://thehill.com/policy/healthcare/feed/",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "NPR Health",
    homepage: "https://www.npr.org/sections/health/",
    feedUrl: "https://www.npr.org/rss/rss.php?id=1128",
    scanArticle: false,
    maxItems: 50,
  },
  {
    name: "Google News Health Trade Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        "(site:modernhealthcare.com OR site:beckerspayer.com OR site:beckershospitalreview.com OR site:fiercehealthcare.com OR site:statnews.com OR site:healthcaredive.com)",
        '("Medicare Advantage" OR "prior authorization" OR PBM OR "No Surprises Act" OR Medicaid OR Medicare OR "health insurers" OR "health plans" OR "medical debt" OR "GLP-1" OR payer OR "price transparency" OR "reimbursement cuts" OR "claim denials" OR "rural hospitals" OR physicians OR "340B")',
      ].join(" ") + " when:14d",
    ),
    isSearchFeed: true,
    scanArticle: false,
    maxItems: 75,
  },
  {
    name: "Google News National Health Policy Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        "(site:abcnews.go.com OR site:apnews.com OR site:cbsnews.com OR site:cnn.com OR site:nbcnews.com OR site:nytimes.com OR site:washingtonpost.com OR site:wsj.com OR site:axios.com OR site:npr.org OR site:thehill.com OR site:kffhealthnews.org OR site:newsfromthestates.com OR site:stateline.org)",
        '("Medicare Advantage" OR "prior authorization" OR Medicaid OR Medicare OR Obamacare OR ACA OR "medical debt" OR "No Surprises Act" OR GLP-1 OR vaccines OR "health insurance" OR "health care costs" OR "price transparency" OR menopause OR maternity OR "private equity")',
      ].join(" ") + " when:14d",
    ),
    isSearchFeed: true,
    scanArticle: false,
    maxItems: 75,
  },
  // Facebook pages of the major VT outlets. No-login HTML exposes each
  // page's most recent post; hourly runs accumulate posts in the archive.
  // Posts are kept only when they match a Blue Cross brand term (see
  // enrichAndFilterItems) so the feed doesn't fill with general news posts.
  {
    name: "VTDigger Facebook",
    homepage: "https://www.facebook.com/vtdigger",
    facebookPageUrl: "https://www.facebook.com/vtdigger",
    requireBrandMatch: true,
  },
  {
    name: "WCAX Facebook",
    homepage: "https://www.facebook.com/wcaxtv",
    facebookPageUrl: "https://www.facebook.com/wcaxtv",
    requireBrandMatch: true,
  },
  {
    name: "Seven Days Facebook",
    homepage: "https://www.facebook.com/sevendaysvt",
    facebookPageUrl: "https://www.facebook.com/sevendaysvt",
    requireBrandMatch: true,
  },
  {
    name: "Vermont Public Facebook",
    homepage: "https://www.facebook.com/vermontpublic",
    facebookPageUrl: "https://www.facebook.com/vermontpublic",
    requireBrandMatch: true,
  },
  {
    name: "MyNBC5 Facebook",
    homepage: "https://www.facebook.com/MyNBC5",
    facebookPageUrl: "https://www.facebook.com/MyNBC5",
    requireBrandMatch: true,
  },
  {
    name: "Vermont Business Magazine Facebook",
    homepage: "https://www.facebook.com/vermontbiz",
    facebookPageUrl: "https://www.facebook.com/vermontbiz",
    requireBrandMatch: true,
  },
];

function parseConfiguredUrlSources(value, buildSource) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [maybeName, maybeUrl] = entry.includes("|")
        ? entry.split("|", 2).map((part) => part.trim())
        : ["", entry];
      if (!maybeUrl) {
        return null;
      }

      try {
        const url = new URL(maybeUrl).toString();
        const name =
          maybeName ||
          `Configured Facebook ${index + 1}`;
        return buildSource(name, url);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function buildSourcesFromEnv(baseSources = DEFAULT_SOURCES) {
  const configuredPosts = parseConfiguredUrlSources(
    process.env.FACEBOOK_POST_URLS,
    (name, url) => ({
      name: `${name} Facebook post`,
      homepage: url,
      facebookPostUrl: url,
      requireBrandMatch: true,
    }),
  );

  const configuredPages = parseConfiguredUrlSources(
    process.env.FACEBOOK_PAGE_URLS,
    (name, url) => ({
      name: `${name} Facebook page`,
      homepage: url,
      facebookPageUrl: url,
      maxItems: parsePositiveInteger(process.env.FACEBOOK_PAGE_MAX_POSTS, 10),
      requireBrandMatch: true,
    }),
  );

  return [...baseSources, ...configuredPosts, ...configuredPages];
}

export const VERMONT_SOURCE_NAMES = new Set([
  "Addison Independent",
  "Bennington Banner",
  "Brattleboro Reformer",
  "MyChamplainValley",
  "MyNBC5",
  "Newport Daily Express",
  "Rutland Herald",
  "St. Albans Messenger",
  "Seven Days",
  "The Mountain Times",
  "Times Argus",
  "Valley News",
  "Vermont Business Magazine",
  "Vermont Community Newspaper Group",
  "Vermont Daily Chronicle",
  "Vermont Public",
  "VTDigger",
  "WCAX",
]);

export const BROAD_NATIONAL_SOURCE_NAMES = new Set([
  "ABC News Health",
  "CBS News Health",
  "CNN Health",
  "Fierce Healthcare",
  "Google News Health Insurance Search",
  "Google News Health Trade Search",
  "Google News Kristina Source Search",
  "Google News National Health Policy Search",
  "Healthcare Dive",
  "KFF Health News",
  "NPR Health",
  "STAT Health News",
  "The Hill Health Care",
]);
