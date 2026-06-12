<h1 align="center">Blue Cross VT News Mentions</h1>

<p align="center">
  <strong>RSS feed for mentions of BCBSVT, Blue Cross VT, and Blue Cross and Blue Shield of Vermont in Vermont news outlets</strong>
</p>

<p align="center">
  <code>RSS 2.0</code> &bull;
  <code>Vermont news monitoring</code> &bull;
  <code>GitHub Pages</code>
</p>

## What It Does

This project fetches public RSS feeds from Vermont news outlets, fetches article pages from those feed items, searches for Blue Cross VT and Vermont health care topic patterns, and writes **RSS** and **JSON Feed** outputs named **Blue Cross VT News Mentions**.

The generator scans title, RSS summary, feed content, and article-page text. That matters because a story can mention Blue Cross in the article body without putting it in the headline.

Coverage is limited to the items each outlet exposes through its public RSS feed at run time, plus the major outlets' public Facebook pages. Facebook's no-login HTML exposes each page's most recent post, so the hourly schedule accumulates posts over time; posts are kept only when they mention Blue Cross. Facebook comments are included only when a public HTML response exposes parseable comment text; availability can vary by Facebook response and may be incomplete.

The JSON output records source fetch failures, summaries, keyword matches, and comments when present, so a run can be checked before relying on it as complete. Direct Blue Cross VT mentions are retained indefinitely after they leave a source feed; other stories are retained for a bounded archive window.

## Included Sources

The default source list includes:

| Outlet | Feed |
| --- | --- |
| WCAX | `https://www.wcax.com/arc/outboundfeeds/whiz-rss/category/news/?outputType=xml&size=50&sort=display_date%3Adesc` |
| VTDigger | `https://vtdigger.org/feed/` |
| Vermont Public | `https://www.vermontpublic.org/local-news.rss` |
| Seven Days | `https://www.sevendaysvt.com/vermont/Rss.xml` |
| MyNBC5 | `https://www.mynbc5.com/topstories-rss` |
| MyChamplainValley | `https://www.mychamplainvalley.com/feed/` |
| Vermont Business Magazine | `https://vermontbiz.com/rss.xml` |
| UVM Health Newsroom | `https://www.uvmhealth.org/newsroom` listing page |
| BlueCrossVT Newsroom | `https://www.bluecrossvt.org/health-community/news` listing page |
| BlueCrossVT Be Well VT Blog | `https://www.bluecrossvt.org/health-community/blog/listing` listing page |
| BCBSA Association News | `https://www.bcbs.com/about-us/association-news` listing page |
| Addison Independent | `https://www.addisonindependent.com/feed/` |
| Rutland Herald | `https://www.rutlandherald.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Times Argus | `https://www.timesargus.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Times Argus UVM Health search | `https://www.timesargus.com/search/?q=%22UVM%20Health%22&f=rss&t=article&l=50&s=start_time&sd=desc` |
| Bennington Banner | `https://www.benningtonbanner.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Brattleboro Reformer | `https://www.reformer.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Vermont Community Newspaper Group | `https://www.vtcng.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc` |
| Valley News | `https://vnews.com/feed/` |
| The Mountain Times | `https://mountaintimes.info/feed/` |
| Newport Daily Express | `https://www.newportvermontdailyexpress.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc` |
| Vermont Daily Chronicle | `https://vermontdailychronicle.com/feed/` |
| St. Albans Messenger | `https://www.samessenger.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc` |
| Google News brand search | capped BCBSVT/Blue Cross VT search RSS |
| Google News Blue Cross VT backfill | capped 180-day brand search RSS, bounded to Jan 1 - Jun 13, 2026 |
| Google News Vermont health search | capped 7-day Vermont health care search RSS |
| Google News Kristina source search | capped 14-day search RSS over recurring News Export outlets (Burlington Free Press, WSJ, ABC, CBS, CNN, Becker's, St. Albans Messenger, Vermont Daily Chronicle) |
| Google News health insurance search | capped 7-day national payer/coverage search RSS |
| ABC News Health | `https://abcnews.go.com/abcnews/healthheadlines` |
| CBS News Health | `https://www.cbsnews.com/latest/rss/health` |
| CNN Health | `http://rss.cnn.com/rss/cnn_health.rss` |
| STAT Health News | `https://www.statnews.com/feed/` |
| Fierce Healthcare | `https://www.fiercehealthcare.com/rss/xml` |
| Healthcare Dive | `https://www.healthcaredive.com/feeds/news/` |
| KFF Health News | `https://kffhealthnews.org/feed/` |
| The Hill Health Care | `https://thehill.com/policy/healthcare/feed/` |
| NPR Health | `https://www.npr.org/rss/rss.php?id=1128` |
| Google News health trade search | capped 14-day Modern Healthcare/Becker's payer search RSS |
| Google News national health policy search | capped 14-day AP/NBC/NYT/Washington Post/Axios health policy search RSS |
| Facebook pages (VTDigger, WCAX, Seven Days, Vermont Public, MyNBC5, VermontBiz) | each page's latest public post, kept only on a Blue Cross brand match; comments included when parseable |

BlueCrossVT.org, UVM Health, and BCBSA do not expose RSS/Atom at the usual feed URLs for these pages, so the generator parses the public dated listing rows on their newsroom/blog pages.

Date-bounded sources (like the 2026 backfill search) are skipped automatically once their `maxPubDate` passes; their items persist in the archive, and the skip is recorded per source in the output JSON.

## Quick Start

```bash
npm install
npm run generate
```

The generated reader feeds are written to `site/feed.rss` and `site/feed.json`. A machine-readable audit file, including rejected items and cache metadata, is written to `site/feed-audit.json`. The web page shows 25 stories per page, newest first; BlueCrossVT.org posts and social posts are available as sections but hidden from All by default.

## Mention Matching

The matcher includes exact and similar variants, including:

- `BCBSVT`
- `BCBS VT`
- `BCBS of Vermont`
- `Blue Cross VT`
- `BlueCrossVT`
- `Blue CrossVT`
- `BlueCross VT`
- `Blue Cross Vermont`
- `Blue Cross and Blue Shield of Vermont`
- `Blue Cross Blue Shield of Vermont`
- `BlueCross BlueShield of Vermont`
- `Blue Cross`

`Blue Cross` alone is intentionally included for recall. If it creates noise, remove that term in `src/index.js`.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `RSS_OUTPUT_PATH` | `site/feed.rss` | Output path for the RSS file |
| `JSON_OUTPUT_PATH` | output path next to RSS as `feed.json` | Output path for the public JSON feed |
| `AUDIT_JSON_OUTPUT_PATH` | output path next to RSS as `feed-audit.json` | Output path for the audit JSON and summary cache |
| `RSS_CONCURRENCY` | `6` | Number of article pages to fetch at once |
| `RSS_SOURCE_CONCURRENCY` | `4` | Number of sources to fetch at once (same-domain requests stay 1s apart) |
| `RSS_TIMEOUT_MS` | `12000` | Request timeout in milliseconds |
| `RSS_FETCH_ATTEMPTS` | `3` | Fetch attempts before a source or article is marked failed |
| `RSS_MAX_RESPONSE_BYTES` | `10485760` (10 MB) | Maximum decompressed response size before a fetch is abandoned |
| `RSS_ARTICLE_SCAN` | `true` | Set to `false` to filter only RSS feed text |
| `RSS_MAX_FUTURE_HOURS` | `6` | Future-dated item tolerance before an item is excluded |
| `ARCHIVE_MAX_AGE_DAYS` | `92` | Maximum age for topic-only archived stories; direct Blue Cross VT mentions are retained indefinitely |
| `FEED_URL` | empty | Public URL for Atom self-link |
| `JSON_FEED_URL` | empty | Public URL for the JSON Feed |
| `SITE_URL` | empty | Public base URL for the channel link |
| `GEMINI_API_KEY` | empty | Optional Gemini key for one-time batched summaries and reasons |
| `SUMMARY_BATCH_SIZE` | `10` | Stories summarized per Gemini request |
| `SUMMARY_BATCH_DELAY_MS` | `5000` | Delay between Gemini summary requests |
| `SUMMARY_MAX_REQUESTS_PER_RUN` | `10` | Maximum Gemini summary requests per run |
| `SUMMARY_REJUDGE_ALL` | empty | Set to `true` for one run after changing the relevance rubric to re-judge every item |
| `SLACK_WEBHOOK_URL` | empty | Optional Slack webhook pinged when a source crosses the failure threshold |
| `DISCORD_WEBHOOK_URL` | empty | Optional Discord webhook pinged when a source crosses the failure threshold |
| `WEBHOOK_FAILURE_THRESHOLD` | `24` | Consecutive failed runs before a source triggers a webhook alert |
| `FACEBOOK_POST_URLS` | empty | Optional comma- or newline-separated `Name\|URL` public Facebook posts to include |
| `FACEBOOK_PAGE_URLS` | empty | Optional comma- or newline-separated `Name\|URL` public Facebook pages to scan when Facebook exposes no-login post HTML |
| `FACEBOOK_PAGE_MAX_POSTS` | `10` | Maximum post links to read from each configured Facebook page |

Gemini's public docs say rate limits vary by project, model, and usage tier; use AI Studio as the source of truth for the active project. The default summarizer starts with `gemini-2.5-flash-lite`, batches stories, caches successful summaries in `feed-audit.json`, and caps requests per run so hourly refreshes stay conservative.

Configured Facebook pages are used as public post discovery pages; when a post URL is exposed without a login, the generator opens the post page and nests any extracted comments under that story.

## Automation

The GitHub Actions workflow publishes `site/` to GitHub Pages on pushes to `main`, manual runs, and an hourly schedule. It runs tests first, seeds the local archive from the live `feed-audit.json` when available, regenerates the feeds, then deploys.
