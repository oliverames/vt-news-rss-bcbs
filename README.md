<p align="center">
  <img src="site/logo.png" width="80" height="80" alt="Blue Cross VT News Mentions">
</p>

<h1 align="center">Blue Cross VT News Mentions</h1>

<p align="center">
  <strong>A text-first news monitor for Blue Cross VT mentions and Vermont health care coverage.</strong>
</p>

<p align="center">
  <code>39 default sources</code> &bull;
  <code>RSS + JSON Feed</code> &bull;
  <code>hourly GitHub Pages refresh</code>
</p>

<p align="center">
  <a href="https://github.com/oliverames/vt-news-rss-bcbs/actions/workflows/publish-feed.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/oliverames/vt-news-rss-bcbs/publish-feed.yml?branch=main&style=flat-square&label=publish&color=f5a542" alt="Publish workflow">
  </a>
  <img src="https://img.shields.io/badge/license-not_specified-f5a542?style=flat-square" alt="License not specified">
  <a href="https://www.buymeacoffee.com/oliverames">
    <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-f5a542?style=flat-square&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me a Coffee">
  </a>
  <a href="https://oliverames.github.io/vt-news-rss-bcbs/">
    <img src="https://img.shields.io/badge/live-reader-f5a542?style=flat-square" alt="Live reader">
  </a>
</p>

---

Blue Cross VT News Mentions collects public news items that matter to a Vermont health care communications team: direct Blue Cross VT mentions first, Vermont health care coverage second, then regional and national policy stories when they have a clear payer, coverage, or system angle. It publishes a plain reader, RSS feed, JSON Feed, and audit feed from a scheduled GitHub Actions workflow.

The project is intentionally text-heavy. It follows the spirit of `text.npr.org`: fast, readable, useful, and clear about what was collected.

## Why This Exists

News monitoring gets messy when the search target is both narrow and broad. A direct BCBSVT mention is obvious. A hospital budget story, rate review hearing, Vermont Medicaid update, or Medicare Advantage policy story can matter just as much, but only when it fits the team’s actual geography and business context.

This monitor is built around that judgment. It prioritizes Vermont and Blue Cross VT, keeps official BlueCrossVT.org posts available without letting them flood the default view, and archives direct Blue Cross VT mentions indefinitely so important coverage does not disappear when a source feed rolls over.

It also keeps an audit trail. Rejected items, source failures, matched terms, summary reasons, comments, and failure streaks all live in `feed-audit.json`, which makes the system inspectable instead of mysterious.

## Quick Start

```bash
npm install
npm run generate
```

The generator writes:

| Output | Path | Purpose |
| --- | --- | --- |
| RSS | `site/feed.rss` | Subscriber-friendly RSS 2.0 feed |
| JSON Feed | `site/feed.json` | Public reader data and machine-readable feed |
| Audit JSON | `site/feed-audit.json` | Rejected items, source status, summary cache, and archive state |
| Reader | `site/index.html` | Text-only browser with search, sections, and paging |

The live reader is published at [oliverames.github.io/vt-news-rss-bcbs](https://oliverames.github.io/vt-news-rss-bcbs/).

## What It Watches

The default source list combines Vermont outlets, official Blue Cross and health system pages, national health policy feeds, and Google News searches. Some direct outlet feeds also have site-scoped Google News fallbacks for GitHub runner blocks or rate limits.

| Category | Coverage | Notes |
| --- | --- | --- |
| Vermont news outlets | WCAX, VTDigger, Vermont Public, Seven Days, MyNBC5, MyChamplainValley, Addison Independent, Valley News, and more | RSS or search feeds, depending on what each outlet exposes; blocked primary feeds can fall back to site-scoped Google News |
| Official pages | BlueCrossVT Newsroom, BlueCrossVT Be Well VT Blog, UVM Health Newsroom, BCBSA Association News | Public listing pages are parsed because normal RSS feeds are not available |
| Search feeds | Blue Cross VT brand search, Jan. 1, 2026 Blue Cross VT backfill, Vermont health search, Kristina source search, health insurance search, trade search, national policy search, outlet fallbacks | Search feeds are capped and bounded to avoid turning the reader into generic health news |
| National health feeds | ABC Health, CBS Health, CNN Health, STAT, Fierce Healthcare, Healthcare Dive, KFF Health News, The Hill, NPR Health | Broad national items are filtered unless they have a payer, policy, coverage, or regional angle |
| Social surfaces | Public Facebook pages for selected Vermont outlets | Parked by default; set `ENABLE_SOCIAL_SOURCES=true` for a deliberate one-off Facebook collection run |

Direct Blue Cross VT mentions are kept indefinitely. Other stories are kept for three months. The 2026 backfill source is bounded to Jan. 1 through June 13, 2026; after that window closes, the source skips itself and the archive carries those items forward.

## How Matching Works

The matcher scans feed titles, descriptions, source text, and, when enabled, article pages. Brand terms scan both feed text and article body text. Topic terms scan feed text only, because full article bodies mention health care too often for that to be precise.

The brand matcher includes common variants:

| Canonical area | Examples |
| --- | --- |
| BCBSVT shorthand | `BCBSVT`, `BCBS VT`, `BCBS of Vermont` |
| Blue Cross VT variants | `Blue Cross VT`, `BlueCrossVT`, `Blue Cross Vermont` |
| Full legal name | `Blue Cross and Blue Shield of Vermont`, `BlueCross & BlueShield of Vermont` |
| Related products and references | `Vermont Blue Advantage`, `Vermont Blues plan`, `Vermont's largest health insurer` |
| Community properties | `Girls on the Run`, `Mountain Days`, `Walk@Lunch` |

Topic matching covers Vermont health care agencies, hospitals, providers, coverage programs, rate review, Medicaid, Medicare, prior authorization, pharmacy, rural health, mental health, public health, medical costs, and related policy areas.

The Google News search feeds also carry Kristina's current Boolean set directly: Blue Cross and BCBS variants paired with VT/Vermont, Vermont healthcare/health care/hospitals, health insurers, health care affordability, UVM Health, and MVP Health Care.

The relevance gate then removes common false positives:

| False positive pattern | How it is handled |
| --- | --- |
| Crime, crash, and incident briefs | Hospital transport language is stripped before hospital matching |
| Obituaries | RSS categories, obituary URLs/titles, and narrow obituary prose are excluded before matching and archive merge |
| Broad national health lifestyle stories | Rejected unless they include payer, policy, coverage, or regional signals |
| Out-of-region outbreaks | Rejected unless they include policy, payer, or regional relevance |
| Infrastructure or grant stories | Rejected when health care is only an incidental phrase |
| BlueCrossVT.org posts | Available as a section but hidden from the default All view |
| Social posts | Not collected by default; archived social items are pruned unless `ENABLE_SOCIAL_SOURCES=true` is set |

## Reader Experience

The reader is a static HTML page that loads `feed.json` in the browser. It shows the newest 25 stories first, supports simple search, uses plain checkbox sections for multi-select filtering, and keeps comments hidden behind a per-story button.

Each story can include:

| Field | Purpose |
| --- | --- |
| Date | Publication date from the source feed, listing page, or post HTML |
| Access label | `Free to read`, `Paywall likely`, `May require login`, or `Access varies` |
| Summary | AI-generated one or two sentence summary when Gemini is configured |
| Why it is here | Short relevance reason for a reader who wants to skim quickly |
| Comments | Publicly parseable article or post comments, hidden by default |

The browser does not recrawl sources. GitHub Actions does the collection and deploys the latest feed hourly; reloading the page loads the latest published feed.

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `RSS_OUTPUT_PATH` | No | `site/feed.rss` | Output path for the RSS file |
| `JSON_OUTPUT_PATH` | No | next to RSS as `feed.json` | Output path for the public JSON feed |
| `AUDIT_JSON_OUTPUT_PATH` | No | next to RSS as `feed-audit.json` | Output path for the audit JSON and summary cache |
| `RSS_CONCURRENCY` | No | `6` | Number of article pages to fetch at once |
| `RSS_SOURCE_CONCURRENCY` | No | `4` | Number of sources to fetch at once |
| `RSS_DOMAIN_DELAY_MS` | No | `1000` | Politeness delay between requests to the same domain |
| `RSS_TOWNNEWS_DELAY_MS` | No | `8000` | Shared delay between TownNews search-feed requests across outlet domains |
| `RSS_TIMEOUT_MS` | No | `12000` | Request timeout in milliseconds |
| `RSS_FETCH_ATTEMPTS` | No | `3` | Fetch attempts before a source or article is marked failed |
| `RSS_MAX_RESPONSE_BYTES` | No | `10485760` | Maximum decompressed response size before a fetch is abandoned |
| `RSS_ARTICLE_SCAN` | No | `true` | Set to `false` to filter only RSS feed text |
| `RSS_MAX_FUTURE_HOURS` | No | `6` | Future-dated item tolerance before exclusion |
| `ARCHIVE_MAX_AGE_DAYS` | No | `92` | Maximum age for topic-only archived stories |
| `FEED_URL` | No | empty | Public URL for the RSS self-link |
| `JSON_FEED_URL` | No | empty | Public URL for the JSON Feed |
| `SITE_URL` | No | empty | Public base URL for the channel link |
| `GEMINI_API_KEY` | No | empty | Optional Gemini key for batched summaries and reasons |
| `SUMMARY_BATCH_SIZE` | No | `10` | Stories summarized per Gemini request |
| `SUMMARY_BATCH_DELAY_MS` | No | `5000` | Delay between Gemini summary requests |
| `SUMMARY_MAX_REQUESTS_PER_RUN` | No | `10` | Maximum Gemini summary requests per run |
| `SUMMARY_REJUDGE_ALL` | No | empty | Set to `true` for one run after changing the relevance rubric |
| `SLACK_WEBHOOK_URL` | No | empty | Optional Slack webhook for source failure alerts |
| `DISCORD_WEBHOOK_URL` | No | empty | Optional Discord webhook for source failure alerts |
| `WEBHOOK_FAILURE_THRESHOLD` | No | `24` | Consecutive failed runs before a source triggers an alert |
| `ENABLE_SOCIAL_SOURCES` | No | `false` | Set to `true` to include the parked built-in Facebook pages and configured Facebook URLs |
| `FACEBOOK_POST_URLS` | No | empty | Optional comma- or newline-separated `Name\|URL` public Facebook posts, used only when social sources are enabled |
| `FACEBOOK_PAGE_URLS` | No | empty | Optional comma- or newline-separated `Name\|URL` public Facebook pages, used only when social sources are enabled |
| `FACEBOOK_PAGE_MAX_POSTS` | No | `10` | Maximum post links to read from each configured Facebook page when social sources are enabled |

Gemini rate limits vary by project, model, and usage tier. The summarizer starts with `gemini-2.5-flash-lite`, batches stories, caches successful summaries in `feed-audit.json`, and caps requests per run so hourly refreshes stay conservative.

## Architecture

```text
src/index.js       Entry point, generator orchestration, public re-export surface
src/sources.js     Default source list, Google News queries, parked Facebook sources
src/matching.js    Brand terms, topic terms, canonical labels, snippets
src/parsers.js     RSS, Atom, listing pages, article text and comments, Facebook public HTML
src/fetching.js    Fetch retries, size caps, source collection, domain throttling
src/enrich.js      Google News decoding, article scanning, match enrichment
src/relevance.js   Deterministic relevance, source type, access labels
src/archive.js     Audit loading, archive retention, dedupe rules
src/summaries.js   Gemini prompt, batching, parsing, summary cache behavior
src/alerts.js      Failure streaks and optional webhook alerts
src/outputs.js     RSS, JSON Feed, audit JSON, file writes
src/utils.js       Shared text, date, URL, and concurrency helpers
site/index.html    Static text reader
test/index.test.js Node test suite
```

The workflow is deliberately simple:

1. Fetch source feeds and listing pages.
2. Resolve and enrich matching items.
3. Merge with the live audit archive.
4. Apply deterministic relevance rules.
5. Add summaries when Gemini is configured.
6. Write RSS, JSON Feed, and audit JSON.
7. Publish `site/` to GitHub Pages.

## Development

```bash
npm test
for file in src/*.js; do node --check "$file"; done
```

For a local run that does not touch committed outputs, write to a temporary directory:

```bash
mkdir -p /tmp/vt-news-rss-bcbs
cp site/feed-audit.json /tmp/vt-news-rss-bcbs/feed-audit.json

RSS_OUTPUT_PATH=/tmp/vt-news-rss-bcbs/feed.rss \
JSON_OUTPUT_PATH=/tmp/vt-news-rss-bcbs/feed.json \
AUDIT_JSON_OUTPUT_PATH=/tmp/vt-news-rss-bcbs/feed-audit.json \
RSS_ARTICLE_SCAN=false \
npm run generate
```

The publish workflow runs on pushes to `main`, manual dispatches, and an hourly schedule. It runs tests, seeds the archive from the live `feed-audit.json`, regenerates the feeds, uploads the Pages artifact, and deploys.

## License

No license file is currently included in this repository.

---

<p align="center">
  <a href="https://www.buymeacoffee.com/oliverames">
    <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-f5a542?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me a Coffee">
  </a>
</p>

<p align="center">
  <sub>
    Built by <a href="https://ames.consulting">Oliver Ames</a> in Vermont
    &bull; <a href="https://github.com/oliverames">GitHub</a>
    &bull; <a href="https://linkedin.com/in/oliverames">LinkedIn</a>
    &bull; <a href="https://bsky.app/profile/oliverames.bsky.social">Bluesky</a>
  </sub>
</p>
