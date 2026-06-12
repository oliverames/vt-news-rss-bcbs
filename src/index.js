import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import { GoogleDecoder } from "google-news-url-decoder";

const googleDecoder = new GoogleDecoder();

function googleNewsSearchUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });

  return `https://news.google.com/rss/search?${params.toString()}`;
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
  {
    name: "Google News Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        "bluecrossvt.org",
        '"BCBSVT"',
        '"BCBS VT"',
        '"BlueCrossVT"',
        '"Blue CrossVT"',
        '"BlueCross VT"',
        '"Blue Cross VT"',
        '"Blue Cross Vermont"',
        '"Blue Cross and Blue Shield of Vermont"',
        '"BlueCross and BlueShield of Vermont"',
        '"BlueCross & BlueShield of Vermont"',
        '"Blue Cross of Vermont"',
        '"Vermont Blue Advantage"',
      ].join(" OR "),
    ),
    isSearchFeed: true,
    searchFallbackTerms: ["Blue Cross"],
    maxItems: 50,
  },
  {
    name: "Google News Vermont Health Search",
    homepage: "https://news.google.com/",
    feedUrl: googleNewsSearchUrl(
      [
        '"UVM Health"',
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
    maxItems: 30,
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

export const MENTION_TERMS = [
  { label: "BCBSVT", pattern: /\bbcbs[\s-]?vt\b/i },
  { label: "BCBS of Vermont", pattern: /\bbcbs\s+(?:of\s+)?vermont\b|\bbcbs\s+of\s+vt\b/i },
  { label: "Blue Cross VT", pattern: /\bblue\s*cross\s*(?:vt|vermont)\b/i },
  {
    label: "Blue Cross and Blue Shield of Vermont",
    pattern:
      /\bblue\s*cross\s*(?:(?:and|&|\/)\s*)?blue\s*shield\s*(?:of\s*)?(?:vermont|vt)\b/i,
  },
  {
    label: "Blue Cross of Vermont",
    pattern: /\bblue\s*cross\s+of\s+(?:vermont|vt)\b/i,
  },
  {
    label: "Vermont Blue Advantage",
    pattern: /\bvermont\s+blue\s+advantage\b/i,
  },
  {
    label: "Vermont Blues plan",
    pattern: /\bvermont\s+blues?\s+plans?\b/i,
  },
  {
    label: "Vermont's largest health insurer",
    pattern: /\bvermont[’']s\s+largest\s+(?:private\s+)?(?:health\s+)?insurer\b/i,
  },
  {
    label: "Blue Cross",
    pattern:
      /\bblue\s+cross\b(?!\s*(?:vt\b|vermont\b|of\s+(?:vt|vermont)\b|(?:and|&|\/)?\s*blue\s*shield))/i,
  },
  { label: "bluecrossvt.org", pattern: /\bbluecrossvt\.org\b/i },
  // BCBSVT sponsorship properties — community items the comms team tracks
  { label: "Girls on the Run", pattern: /\bgirls\s+on\s+the\s+run\b/i },
  { label: "Mountain Days", pattern: /\bmountain\s+days\b/i },
  { label: "Walk@Lunch", pattern: /\bwalk\s*@\s*lunch\b/i },
];

// Vermont healthcare topic terms. These mirror the broader stories the
// communications team pulls manually: regulators, hospitals, legislature
// health bills, coverage programs, and recurring health topics. They are
// matched against feed title + description only (not full article text),
// because nearly every article mentions "health care" somewhere in its body.
// Transport/treatment idiom from crime and accident briefs. Covers both
// generic ("taken to the hospital") and named facilities ("airlifted to
// Dartmouth-Hitchcock Medical Center"). Stripped from text before testing
// hospital-related terms so accident stories don't read as health news.
const TRANSPORT_IDIOM =
  /\b(?:taken|airlifted|transported|rushed|flown|brought|treated|died)\s+(?:to|at)\s+(?:(?:a|the|an)\s+)?(?:(?:area|local|nearby)\s+)?(?:[\w'’.-]+\s+){0,4}?(?:hospitals?\b|medical\s+cent(?:er|re)\b)/gi;

export const TOPIC_TERMS = [
  // Regulators, agencies, and associations
  {
    label: "Green Mountain Care Board",
    pattern: /\bgreen\s+mountain\s+care\s+board\b|\bGMCB\b/i,
  },
  {
    label: "Vermont health agencies",
    pattern:
      /\bdepartment\s+of\s+vermont\s+health\s+access\b|\bDVHA\b|\bvermont\s+department\s+of\s+health\b|\bagency\s+of\s+human\s+services\b|\bhealth\s+commissioner\b|\bdepartment\s+of\s+financial\s+regulation\b/i,
  },
  {
    label: "Vermont Health Connect",
    pattern: /\bvermont\s+health\s+connect\b/i,
  },
  { label: "OneCare Vermont", pattern: /\bonecare\b/i },
  {
    label: "VAHHS",
    pattern: /\bVAHHS\b|\bvermont\s+association\s+of\s+hospitals\b/i,
  },
  // Payers and coverage programs
  { label: "MVP Health Care", pattern: /\bmvp\s+health\b/i },
  { label: "Medicare Advantage", pattern: /\bmedicare\s+advantage\b/i },
  { label: "Medicare", pattern: /\bmedicare\b/i },
  { label: "Medicaid", pattern: /\bmedicaid\b/i },
  {
    label: "Health insurance",
    pattern:
      /\bhealth\s+insur\w*|\binsurers?\b|\bhealth\s+plans?\b|\bhealth\s+coverage\b|\buninsured\b/i,
  },
  {
    label: "ACA & marketplace",
    pattern: /\baffordable\s+care\s+act\b|\bobamacare\b|\bACA\b/i,
  },
  // Providers
  {
    label: "UVM Health",
    pattern:
      /\buvm\s+(?:health|medical\s+center|cancer\s+center)\b|\buvmmc\b|\buvmhn?\b|\buniversity\s+of\s+vermont\s+(?:health|medical)\b/i,
  },
  {
    label: "Vermont hospitals & providers",
    pattern:
      /\bbrattleboro\s+(?:memorial|retreat|hospital)\b|\brutland\s+regional\b|\bcopley\s+hospital\b|\bgifford\s+(?:medical|health)\b|\bporter\s+(?:medical|hospital)\b|\bgrace\s+cottage\b|\bspringfield\s+hospital\b|\bnorth\s+country\s+hospital\b|\bnortheastern\s+vermont\s+regional\b|\bNVRH\b|\bnorthwestern\s+medical\s+center\b|\bcentral\s+vermont\s+medical\s+center\b|\bCVMC\b|\bmt\.?\s+ascutney\b|\bsouthwestern\s+vermont\s+(?:medical|health)\b|\bSVMC\b|\bchamplain\s+valley\s+physicians\b|\bCVPH\b|\balice\s+hyde\b|\bdartmouth[\s-]+(?:hitchcock|health)\b|\bhoward\s+center\b|\bnortheast\s+kingdom\s+human\s+services\b|\blamoille\s+health\b|\bbattenkill\s+valley\b/i,
    strip: TRANSPORT_IDIOM,
  },
  {
    label: "Hospitals",
    pattern: /\bhospitals?\b/i,
    // Crime/accident briefs ("taken to the hospital", "airlifted to
    // Dartmouth-Hitchcock Medical Center", "treated at a nearby hospital")
    // are not healthcare coverage; strip the transport/treatment idiom —
    // including named facilities — before testing.
    strip: TRANSPORT_IDIOM,
  },
  // Topics
  { label: "Health care", pattern: /\bhealth\s*care\b/i },
  {
    label: "Primary care",
    pattern: /\bprimary\s+care\b|\bconcierge\s+(?:medicine|care|doctor)/i,
  },
  {
    label: "Mental health",
    pattern: /\bmental\s+health\b|\bbehavioral\s+health\b|\bpsychiatric\b/i,
  },
  {
    label: "Prescription drugs & pharmacy",
    pattern:
      /\bprescription\s+drug\w*|\bpharmac(?:y|ies|ist)\b|\bPBM\b|\bpharmacy\s+benefit\w*|\bArrayRx\b|\bdrug\s+(?:prices?|costs?|discounts?|shortages?)\b|\bmedicine\s+shortages?\b|\bshortages?\s+of\s+(?:many\s+)?medicines?\b/i,
  },
  {
    label: "Prior authorization & claims",
    pattern:
      /\bprior\s+authorization\b|\bclaim\s+denial\w*|\bcoverage\s+denial\w*|\bdenied\s+claims?\b/i,
  },
  {
    label: "Premiums & rate review",
    pattern:
      /\b(?:health\s+insurance|insurance|health\s+plan|coverage)\s+premiums?\b|\bpremiums?\s+(?:for|on)\s+(?:health\s+insurance|insurance|health\s+plans?|coverage)\b|\b(?:rate|premium)\s+(?:filing|review|increase|decrease|request)s?\b/i,
  },
  { label: "Vaccines", pattern: /\bvaccin\w*|\bimmuniz\w*/i },
  {
    label: "Hospital & nurse labor",
    pattern:
      /\b(?:nurses?|hospital|medical\s+center)\b[^.!?]{0,60}\b(?:union\w*|strike\w*|picket\w*|contract)\b|\b(?:union|strike)\w*\b[^.!?]{0,60}\b(?:nurses?|hospital|medical\s+center)\b/i,
  },
  {
    label: "Rural health",
    pattern: /\brural\s+(?:health|hospital|medical)\w*|\bcritical\s+access\b/i,
  },
  {
    label: "Universal health care",
    pattern:
      /\buniversal\s+(?:health|primary)\s*care\b|\bsingle[-\s]payer\b|\ball-payer\b/i,
  },
  {
    label: "Medical costs & billing",
    pattern:
      /\bmedical\s+(?:debt|bills?|billing)\b|\bbilling\s+(?:abuse|disputes?)\b|\bsurprise\s+bill\w*|\bno\s+surprises\s+act\b|\bhealth\s+(?:care\s+)?costs?\b|\bhealth\s+care\s+affordability\b|\bhospital\s+pric\w*|\breference[-\s]based\s+pricing\b|\bhealth\s+care\s+spending\b/i,
  },
  { label: "Telehealth", pattern: /\btelehealth\b|\btelemedicine\b/i },
  { label: "Public health", pattern: /\bpublic\s+health\b/i },
  {
    label: "Maternity & birthing",
    pattern: /\bbirthing\b|\bmaternity\b|\bmidwi(?:fe|ves|fery)\b|\bOB-?\s?GYNs?\b/i,
  },
  {
    label: "Opioids & addiction",
    pattern:
      /\bopioids?\b|\boverdoses?\b|\bsubstance\s+(?:ab)?use\b|\baddiction\b/i,
  },
  {
    label: "GLP-1 & weight-loss drugs",
    pattern:
      /\bGLP-?1s?\b|\bozempic\b|\bwegovy\b|\bzepbound\b|\bweight[-\s]loss\s+drugs?\b/i,
  },
  {
    label: "Reproductive health",
    pattern:
      /\babortion\w*|\breproductive\s+(?:health|care)\b|\bgender-affirming\b/i,
  },
  {
    label: "Women's health",
    pattern: /\bmenopause\b|\bwomen'?s\s+health\b/i,
  },
  {
    label: "Federal health agencies",
    pattern: /\bfederal\s+health\s+agenc(?:y|ies)\b/i,
  },
  {
    label: "Health care AI",
    pattern:
      /\b(?:clinical|medical|health\s+care|healthcare|medical-billing)\s+AI\b|\bAI\s+(?:doctors?|in\s+(?:health\s+care|healthcare|medicine))\b|\bWISeR\b/i,
  },
  {
    label: "Physician workforce",
    pattern:
      /\bphysicians?\b|\bdoctor\s+shortage\b|\bnurse\s+practitioners?\b|\bphysician\s+assistants?\b|\bscope\s+of\s+practice\b|\bmedical\s+residen\w*/i,
  },
  {
    label: "Private equity in health care",
    pattern: /\bprivate\s+equity\b/i,
  },
  {
    label: "Senior & long-term care",
    pattern:
      /\bnursing\s+homes?\b|\blong-?term\s+care\b|\bhome\s+health\b|\bassisted\s+living\b|\bhospice\b|\bsenior\s+(?:care|health)\b/i,
  },
  { label: "Dental care", pattern: /\bdental\s+clinics?\b|\bdentists?\b/i },
  {
    label: "Certificate of need",
    pattern: /\bcertificate\s+of\s+need\b/i,
  },
];

export const CATEGORY_BRAND = "Blue Cross VT";
export const CATEGORY_TOPIC = "VT Health Care";

const TERM_LABEL_ALIASES = new Map([
  ["Blue Cross Vermont", "Blue Cross VT"],
  ["BlueCrossVT", "Blue Cross VT"],
  ["Blue CrossVT", "Blue Cross VT"],
  ["BlueCross VT", "Blue Cross VT"],
  ["Blue Cross Blue Shield of Vermont", "Blue Cross and Blue Shield of Vermont"],
  ["BlueCross BlueShield of Vermont", "Blue Cross and Blue Shield of Vermont"],
  ["Blue Cross/Blue Shield of Vermont", "Blue Cross and Blue Shield of Vermont"],
  ["BlueCross and BlueShield of Vermont", "Blue Cross and Blue Shield of Vermont"],
  ["BlueCross and BlueShield of VT", "Blue Cross and Blue Shield of Vermont"],
  ["BlueCross & BlueShield of Vermont", "Blue Cross and Blue Shield of Vermont"],
  ["BlueCross & BlueShield of VT", "Blue Cross and Blue Shield of Vermont"],
]);

const REQUEST_TIMEOUT_MS = parsePositiveInteger(
  process.env.RSS_TIMEOUT_MS,
  12000,
);
const CONCURRENCY = parsePositiveInteger(process.env.RSS_CONCURRENCY, 6);
const SCAN_ARTICLE_PAGES = process.env.RSS_ARTICLE_SCAN !== "false";
const SITE_URL = process.env.SITE_URL?.trim() || "";
const FEED_URL = resolveFeedUrl();
const JSON_FEED_URL = resolveJsonFeedUrl();
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
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

function resolveJsonFeedUrl() {
  const explicitJsonFeedUrl = process.env.JSON_FEED_URL?.trim();
  if (explicitJsonFeedUrl) {
    return explicitJsonFeedUrl;
  }

  if (!SITE_URL) {
    return "";
  }

  return new URL("feed.json", `${SITE_URL.replace(/\/+$/, "")}/`).toString();
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
        isSearchFeed: !!source.isSearchFeed,
        searchFallbackTerms: source.searchFallbackTerms || [],
        scanArticle: source.scanArticle !== false,
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
        isSearchFeed: !!source.isSearchFeed,
        searchFallbackTerms: source.searchFallbackTerms || [],
        scanArticle: source.scanArticle !== false,
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
  const pubDate = parseDate(source.pubDate || publishedAt);
  const comments = extractFacebookComments($);

  if (!description && comments.length === 0) {
    return null;
  }

  const title = cleanText(
    source.title ||
      `${pageTitle} Facebook post${description ? `: ${description.slice(0, 80)}` : ""}`,
  );
  const commentText = comments.map((comment) => comment.text).join(" ");

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
      pubDate: null,
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
  const commentText = comments.map((comment) => comment.text).join(" ");

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

export function findMentionTerms(text, terms = MENTION_TERMS) {
  const haystack = cleanText(text);
  const matches = [];

  for (const term of terms) {
    const subject = term.strip ? haystack.replace(term.strip, " ") : haystack;
    if (term.pattern.test(subject)) {
      matches.push(term.label);
    }
  }

  return canonicalizeMatchedTerms(matches);
}

export function canonicalizeMatchedTerms(matchedTerms = []) {
  return [
    ...new Set(
      matchedTerms
        .map((label) => TERM_LABEL_ALIASES.get(label) || label)
        .filter(Boolean),
    ),
  ];
}

export function categorizeTerms(matchedTerms) {
  const brandLabels = new Set(MENTION_TERMS.map((term) => term.label));
  const hasBrand = canonicalizeMatchedTerms(matchedTerms).some((label) =>
    brandLabels.has(label),
  );
  return hasBrand ? CATEGORY_BRAND : CATEGORY_TOPIC;
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

async function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const DOMAIN_DELAYS = new Map();
const PER_DOMAIN_DELAY_MS = 1000; // 1 second politeness delay

async function throttleRequest(url) {
  try {
    const hostname = new URL(url).hostname;
    const now = Date.now();
    const lastTime = DOMAIN_DELAYS.get(hostname) || 0;
    const elapsed = now - lastTime;
    if (elapsed < PER_DOMAIN_DELAY_MS) {
      const delay = PER_DOMAIN_DELAY_MS - elapsed;
      await sleep(delay);
    }
    DOMAIN_DELAYS.set(hostname, Date.now());
  } catch {
    // If URL parsing fails, ignore throttling
  }
}

async function fetchText(url, accept) {
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
        text: await response.text(),
        url: response.url,
      };
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

async function enrichFacebookPageItemsFromPosts(pageItems, source) {
  return mapWithConcurrency(pageItems, 2, async (pageItem) => {
    try {
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

async function collectFeedItems(sources) {
  const sourceResults = [];
  const items = [];

  for (const source of sources) {
    try {
      if (source.facebookPostUrl) {
        const { text: html } = await fetchText(
          source.facebookPostUrl,
          "text/html, application/xhtml+xml, */*",
        );
        const facebookItem = parseFacebookPostHtml(html, source);
        const sourceItems = (facebookItem ? [facebookItem] : []).map(
          (item) => ({ ...item, requireBrandMatch: !!source.requireBrandMatch }),
        );
        sourceResults.push({
          name: source.name,
          feedUrl: source.facebookPostUrl,
          ok: true,
          itemCount: sourceItems.length,
        });
        items.push(...sourceItems);
        console.log(`Fetched ${sourceItems.length} items from ${source.name}`);
        continue;
      }

      if (source.facebookPageUrl) {
        const { text: html } = await fetchText(
          source.facebookPageUrl,
          "text/html, application/xhtml+xml, */*",
        );
        let sourceItems = parseFacebookPageHtml(html, source);
        if (source.maxItems) {
          sourceItems = sourceItems.slice(0, source.maxItems);
        }
        sourceItems = await enrichFacebookPageItemsFromPosts(sourceItems, source);
        sourceItems = sourceItems.map((item) => ({
          ...item,
          requireBrandMatch: !!source.requireBrandMatch,
        }));
        sourceResults.push({
          name: source.name,
          feedUrl: source.facebookPageUrl,
          ok: true,
          itemCount: sourceItems.length,
        });
        items.push(...sourceItems);
        console.log(`Fetched ${sourceItems.length} items from ${source.name}`);
        continue;
      }

      const { text: xml } = await fetchText(
        source.feedUrl,
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      );
      let sourceItems = parseFeedItems(xml, source);
      if (source.maxItems) {
        sourceItems = sourceItems.slice(0, source.maxItems);
      }
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
        feedUrl: source.feedUrl || source.facebookPostUrl || source.facebookPageUrl,
        ok: false,
        itemCount: 0,
        error: error.message,
      });
      console.warn(`Failed to fetch ${source.name}: ${error.message}`);
    }
  }

  return { items: dedupeItems(items), sourceResults };
}

async function loadPreviousState(jsonOutputPath) {
  const cache = new Map();
  const archivedItems = [];
  try {
    const raw = await readFile(jsonOutputPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        if (!item.link) {
          continue;
        }
        const matchedTerms = canonicalizeMatchedTerms(item.matchedTerms || []);
        // `relevant` stays undefined (not false) when absent so items
        // summarized before the relevance gate existed get re-judged once.
        const relevant =
          typeof item.relevant === "boolean" ? item.relevant : undefined;
        cache.set(item.link, {
          matchedTerms,
          category: item.category || categorizeTerms(matchedTerms),
          snippet: item.snippet,
          summary: item.summary || "",
          reason: item.reason || "",
          relevant,
          comments: Array.isArray(item.comments) ? item.comments : [],
          articleError: item.articleError || "",
          matchSource: item.matchSource || "",
        });
        archivedItems.push({
          sourceName: item.sourceName,
          sourceFeedUrl: item.sourceFeedUrl || "",
          title: item.title,
          link: item.link,
          guid: item.guid || item.link,
          pubDate: parseDate(item.pubDate),
          matchedTerms,
          category: item.category || categorizeTerms(matchedTerms),
          snippet: item.snippet || "",
          summary: item.summary || "",
          reason: item.reason || "",
          relevant,
          comments: Array.isArray(item.comments) ? item.comments : [],
          articleError: item.articleError || "",
          matchSource: item.matchSource || "",
        });
      }
    }
    console.log(`Loaded ${cache.size} previously matched items from ${jsonOutputPath}`);
  } catch {
    console.log("No existing feed found to populate cache, starting fresh.");
  }
  return { cache, archivedItems };
}

// Stories stay in the archive even after they fall out of their source
// feeds, so the page can look back in time. Bounded to keep the JSON sane.
const ARCHIVE_MAX_AGE_DAYS = parsePositiveInteger(
  process.env.ARCHIVE_MAX_AGE_DAYS,
  365,
);
const MAX_FUTURE_SKEW_HOURS = parsePositiveInteger(
  process.env.RSS_MAX_FUTURE_HOURS,
  6,
);

function isRejectedBySummary(item) {
  const reason = cleanText(item.reason || "").toLowerCase();
  return reason.includes("false positive") || reason === "irrelevant";
}

function isRejectedBySourceShape(item) {
  const isPressReleaseWire = /\/press_releases?\//i.test(item.link || "");
  return (
    isPressReleaseWire &&
    categorizeTerms(item.matchedTerms || []) !== CATEGORY_BRAND
  );
}

function hasCurrentMatchingEvidence(item) {
  if (item.matchSource === "searchFallback") {
    return true;
  }

  const evidence = cleanText(
    [item.title, item.snippet, item.summary, item.reason]
      .filter(Boolean)
      .join(" "),
  );
  return findMentionTerms(evidence, [...MENTION_TERMS, ...TOPIC_TERMS]).length > 0;
}

// Post-enrichment dedupe. Link-level dupes happen when the same article is
// archived under its resolved URL but rediscovered under a raw Google News
// URL; title+domain dupes happen when two Google News search feeds surface
// the same syndicated copy. The same headline from *different* outlets is
// kept on purpose — the comms team tracks coverage spread.
export function dedupeResolvedItems(items) {
  const seenLinks = new Set();
  const seenTitleDomain = new Set();
  const result = [];

  for (const item of items) {
    const link = item.link || item.guid || "";
    if (seenLinks.has(link)) {
      continue;
    }

    let domain = "";
    try {
      domain = new URL(link).hostname.replace(/^www\./, "");
    } catch {
      domain = "";
    }
    const normalizedTitle = cleanText(item.title || "")
      .toLowerCase()
      .replace(/\s+-\s+[^-]+$/, "") // strip trailing "- Outlet" suffix
      .trim();
    const titleKey = domain && normalizedTitle ? `${domain}|${normalizedTitle}` : "";

    if (titleKey && seenTitleDomain.has(titleKey)) {
      continue;
    }

    seenLinks.add(link);
    if (titleKey) {
      seenTitleDomain.add(titleKey);
    }
    result.push(item);
  }

  return result;
}

export function mergeWithArchive(currentItems, archivedItems, now = new Date()) {
  const byLink = new Map();
  for (const item of archivedItems) {
    byLink.set(item.link, item);
  }
  // Current items win: they carry fresh enrichment.
  for (const item of currentItems) {
    byLink.set(item.link, item);
  }

  const cutoff = now.valueOf() - ARCHIVE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const maxFutureTime = now.valueOf() + MAX_FUTURE_SKEW_HOURS * 60 * 60 * 1000;
  return [...byLink.values()].filter((item) => {
    if (isRejectedBySummary(item) || isRejectedBySourceShape(item)) {
      return false;
    }
    if (!hasCurrentMatchingEvidence(item)) {
      return false;
    }

    const time = item.pubDate?.valueOf();
    // Keep undated items; they are rare and usually recent.
    return (
      time === undefined ||
      time === null ||
      Number.isNaN(time) ||
      (time >= cutoff && time <= maxFutureTime)
    );
  });
}

// ---------------------------------------------------------------------------
// AI summaries (Gemini). Each story is summarized exactly once — results are
// cached in feed.json — so the request volume stays far below free-tier
// daily quotas (~1-3 batched requests/day in steady state).
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || "";
// Fallback chain: start with the current stable Flash-Lite model because it is
// the lowest-cost/free-tier-friendly option. Active project limits still vary
// and should be checked in AI Studio; a model that 404s or 429s passes through.
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];
const SUMMARY_BATCH_SIZE = parsePositiveInteger(process.env.SUMMARY_BATCH_SIZE, 10);
const SUMMARY_BATCH_DELAY_MS = parsePositiveInteger(
  process.env.SUMMARY_BATCH_DELAY_MS,
  5000,
);
const SUMMARY_MAX_REQUESTS_PER_RUN = parsePositiveInteger(
  process.env.SUMMARY_MAX_REQUESTS_PER_RUN,
  10,
);

export function buildSummaryPrompt(batch) {
  const articles = batch
    .map((item, index) => {
      const excerpt = cleanText(item.snippet || "").slice(0, 700);
      return [
        `ARTICLE ${index + 1}`,
        `TITLE: ${item.title}`,
        `OUTLET: ${item.sourceName}`,
        `MATCHED KEYWORDS: ${(item.matchedTerms || []).join(", ")}`,
        `EXCERPT: ${excerpt}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "You support the communications team at Blue Cross and Blue Shield of Vermont (BCBSVT).",
    "They monitor Vermont news for stories about BCBSVT and about Vermont health care generally (hospitals, regulators, legislature, coverage programs, public health).",
    "For each article below, write:",
    '- "summary": 1-2 plain sentences describing what the story reports. Use only the title and excerpt; do not invent facts.',
    '- "reason": under 14 words, why this story matters to the team (e.g. "Names BCBSVT directly", "Hospital cost pressure affects premiums", "Legislative action on coverage").',
    '- "relevant": true or false. false ONLY when the story is clearly not about health care, health coverage, health policy, hospitals as institutions, public health, or BCBSVT — for example crime, accident, or weather stories that merely mention someone being taken to a hospital. When in doubt, use true.',
    "",
    "Respond with a JSON array of objects: [{\"id\": <article number>, \"summary\": \"...\", \"reason\": \"...\", \"relevant\": true}].",
    "",
    articles,
  ].join("\n");
}

export function parseSummaryResponse(text, batch) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 0;
  }
  if (!Array.isArray(parsed)) {
    return 0;
  }

  let applied = 0;
  for (const entry of parsed) {
    const index = Number.parseInt(entry?.id, 10) - 1;
    const item = batch[index];
    if (!item || typeof entry.summary !== "string" || !entry.summary.trim()) {
      continue;
    }
    item.summary = cleanText(entry.summary);
    item.reason = cleanText(String(entry.reason || ""));
    // Only an explicit false excludes; missing/odd values keep the story.
    item.relevant = entry.relevant !== false;
    // Log the pairing so a model id slip is visible in Actions logs.
    console.log(
      `  summary -> [${entry.id}] ${String(item.title).slice(0, 60)}${item.relevant ? "" : " (marked NOT relevant)"}`,
    );
    applied += 1;
  }
  return applied;
}

async function geminiGenerate(prompt) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
          signal: AbortSignal.timeout(90000),
        },
      );

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} from ${model}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new Error(`Empty response from ${model}`);
        continue;
      }
      return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

export async function summarizeItems(items) {
  if (!GEMINI_API_KEY) {
    console.log("GEMINI_API_KEY not set; skipping AI summaries.");
    return;
  }

  // Items need a Gemini pass when unsummarized OR not yet relevance-judged
  // (items summarized before the relevance gate existed).
  const pending = items.filter(
    (item) => !item.summary || item.relevant === undefined,
  );
  if (pending.length === 0) {
    return;
  }
  console.log(`Summarizing ${pending.length} new items with Gemini...`);

  const maxItemsThisRun = SUMMARY_BATCH_SIZE * SUMMARY_MAX_REQUESTS_PER_RUN;
  const runItems = pending.slice(0, maxItemsThisRun);
  if (pending.length > runItems.length) {
    console.log(
      `Summary cap: processing ${runItems.length}/${pending.length} new items this run.`,
    );
  }

  for (let i = 0; i < runItems.length; i += SUMMARY_BATCH_SIZE) {
    const batch = runItems.slice(i, i + SUMMARY_BATCH_SIZE);
    try {
      const text = await geminiGenerate(buildSummaryPrompt(batch));
      const applied = parseSummaryResponse(text, batch);
      console.log(`Summarized ${applied}/${batch.length} items in batch.`);
    } catch (error) {
      // Likely a quota error. Unsummarized items keep summary === "" and
      // are retried automatically on the next scheduled run.
      console.warn(`Summary batch failed, will retry next run: ${error.message}`);
      break;
    }
    if (i + SUMMARY_BATCH_SIZE < runItems.length) {
      await sleep(SUMMARY_BATCH_DELAY_MS);
    }
  }
}

export async function triggerWebhooks(failedSources) {
  if (failedSources.length === 0) return;

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!slackUrl && !discordUrl) return;

  const message = `⚠️ *Blue Cross VT News Mention Monitor Alert*\nSome news feeds failed to fetch in the latest run:\n` +
    failedSources.map(s => `- *${s.name}*: ${s.error}`).join("\n");

  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      console.log("Successfully sent Slack alert.");
    } catch (err) {
      console.error("Failed to send Slack alert:", err.message);
    }
  }

  if (discordUrl) {
    try {
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      console.log("Successfully sent Discord alert.");
    } catch (err) {
      console.error("Failed to send Discord alert:", err.message);
    }
  }
}

export async function enrichAndFilterItems(items, cache = new Map()) {
  const results = await mapWithConcurrency(items, CONCURRENCY, async (item) => {
    let articleText = "";
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

    if (cache.has(resolvedLink)) {
      const cached = cache.get(resolvedLink);
      const matchedTerms = canonicalizeMatchedTerms(cached.matchedTerms || []);
      console.log(`Cache Hit: Skipping fetch/scrape for ${resolvedLink}`);
      return {
        ...item,
        link: resolvedLink,
        matchedTerms,
        category: cached.category || categorizeTerms(matchedTerms),
        snippet: cached.snippet,
        summary: cached.summary || "",
        reason: cached.reason || "",
        relevant: cached.relevant,
        comments:
          Array.isArray(item.comments) && item.comments.length > 0
            ? item.comments
            : cached.comments || [],
        articleError: cached.articleError,
        matchSource: cached.matchSource || "",
      };
    }

    if (SCAN_ARTICLE_PAGES && item.scanArticle !== false) {
      await throttleRequest(resolvedLink);
      try {
        const { text: html, url: finalUrl } = await fetchText(
          resolvedLink,
          "text/html, application/xhtml+xml, */*",
        );
        articleText = htmlToArticleText(html);
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
    const feedBrandMatches = findMentionTerms(item.feedContent, MENTION_TERMS);
    const articleBrandMatches = findMentionTerms(articleText, MENTION_TERMS);
    const topicMatches = findMentionTerms(item.feedContent, TOPIC_TERMS);

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
      snippet: buildSnippet(snippetSource, [...MENTION_TERMS, ...TOPIC_TERMS]),
      comments: item.comments || [],
      articleError,
      matchSource,
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

  if (item.summary) {
    lines.push(`<p>${escapeXml(item.summary)}</p>`);
  }

  if (item.reason) {
    lines.push(`<p><em>Why included: ${escapeXml(item.reason)}</em></p>`);
  }

  if (!item.summary && item.snippet) {
    lines.push(`<p>${escapeXml(item.snippet)}</p>`);
  }

  if (Array.isArray(item.comments) && item.comments.length > 0) {
    lines.push("<p><strong>Comments:</strong></p>");
    lines.push("<ul>");
    for (const comment of item.comments) {
      const author = comment.author ? `${comment.author}: ` : "";
      lines.push(
        `<li>${escapeXml(`${author}${comment.text || ""}`)}</li>`,
      );
    }
    lines.push("</ul>");
  }

  lines.push(
    `<p><a href="${escapeXml(item.link)}">Read the original story</a></p>`,
  );

  if (item.articleError) {
    // The raw error message can leak fetch URLs/details; a generic note
    // is enough for feed readers.
    lines.push(
      "<p><em>Note: the full article text could not be fetched; matching used the feed text only.</em></p>",
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

  // The JSON archive keeps everything; the RSS feed stays reader-friendly.
  // Items the relevance gate rejected stay in the JSON audit but are
  // excluded from the feed people read.
  const itemXml = sortItemsByDate(items)
    .filter((item) => item.relevant !== false)
    .slice(0, 100)
    .map((item) => {
      const categories = item.matchedTerms
        .map((term) => `      <category>${escapeXml(term)}</category>`)
        .join("\n");

      const pubDate = item.pubDate
        ? `\n      <pubDate>${escapeXml(formatPubDate(item.pubDate))}</pubDate>`
        : "";

      return `    <item>
      <title>${escapeXml(`${item.sourceName}: ${item.title}`)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.guid || item.link)}</guid>${pubDate}
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
    version: "https://jsonfeed.org/version/1.1",
    title: "Blue Cross VT News Mentions",
    home_page_url: SITE_URL || "",
    feed_url: JSON_FEED_URL || "",
    generatedAt: now.toISOString(),
    itemCount: items.length,
    sources: sourceResults,
    items: sortItemsByDate(items).map((item) => {
      const matchedTerms = canonicalizeMatchedTerms(item.matchedTerms || []);
      const comments = Array.isArray(item.comments) ? item.comments : [];
      const contentText = cleanText(
        [
          item.summary || item.snippet || item.description || "",
          item.reason ? `Why included: ${item.reason}` : "",
          comments.length > 0
            ? `Comments: ${comments
                .map((comment) =>
                  cleanText(
                    `${comment.author ? `${comment.author}: ` : ""}${comment.text || ""}`,
                  ),
                )
                .join(" | ")}`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );

      return {
        id: item.guid || item.link,
        url: item.link,
        title: item.title,
        content_text: contentText,
        date_published: item.pubDate?.toISOString() || undefined,
        tags: matchedTerms,
        sourceName: item.sourceName,
        sourceFeedUrl: item.sourceFeedUrl || "",
        link: item.link,
        guid: item.guid || item.link,
        pubDate: item.pubDate?.toISOString() || null,
        matchedTerms,
        category: item.category || categorizeTerms(matchedTerms),
        snippet: item.snippet,
        summary: item.summary || "",
        reason: item.reason || "",
        // undefined (not yet judged) is omitted by JSON.stringify, which
        // marks the item for a relevance pass on the next run.
        relevant: typeof item.relevant === "boolean" ? item.relevant : undefined,
        comments,
        // Public output gets a boolean, not the raw fetch error message.
        articleFetchFailed: Boolean(item.articleError),
        matchSource: item.matchSource || "",
      };
    }),
  };
}

async function writeOutput(rss, jsonSummary, rssOutputPath, jsonOutputPath) {
  await mkdir(path.dirname(rssOutputPath), { recursive: true });
  await writeFile(rssOutputPath, rss, "utf8");
  await writeFile(jsonOutputPath, `${JSON.stringify(jsonSummary, null, 2)}\n`);
}

export async function generateFeed({
  sources = buildSourcesFromEnv(),
  now = new Date(),
  rssOutputPath = resolveRssOutputPath(),
  jsonOutputPath = resolveJsonOutputPath(rssOutputPath),
} = {}) {
  const { cache, archivedItems } = await loadPreviousState(jsonOutputPath);
  const { items, sourceResults } = await collectFeedItems(sources);

  // Trigger alerts for failed feeds asynchronously
  const failedSources = sourceResults.filter(s => !s.ok);
  triggerWebhooks(failedSources).catch(err => console.error("Webhook trigger error:", err));

  const currentMatched = await enrichAndFilterItems(items, cache);
  const matchedItems = dedupeResolvedItems(
    sortItemsByDate(mergeWithArchive(currentMatched, archivedItems, now)),
  );
  await summarizeItems(matchedItems);
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
