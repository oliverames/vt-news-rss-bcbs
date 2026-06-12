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

The JSON output records source fetch failures, summaries, keyword matches, and comments when present, so a run can be checked before relying on it as complete. Stories are retained for a bounded archive window after they leave a source feed.

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
| Addison Independent | `https://www.addisonindependent.com/feed/` |
| Rutland Herald | `https://www.rutlandherald.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Times Argus | `https://www.timesargus.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Bennington Banner | `https://www.benningtonbanner.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Brattleboro Reformer | `https://www.reformer.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc` |
| Vermont Community Newspaper Group | `https://www.vtcng.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc` |
| Valley News | `https://vnews.com/feed/` |
| The Mountain Times | `https://mountaintimes.info/feed/` |
| Newport Daily Express | `https://www.newportvermontdailyexpress.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc` |
| Google News brand search | capped BCBSVT/Blue Cross VT search RSS |
| Google News Vermont health search | capped 7-day Vermont health care search RSS |
| Google News health insurance search | capped 7-day national payer/coverage search RSS |
| Facebook pages (VTDigger, WCAX, Seven Days, Vermont Public, MyNBC5, VermontBiz) | each page's latest public post, kept only on a Blue Cross brand match; comments included when parseable |

## Quick Start

```bash
npm install
npm run generate
```

The generated feed is written to `site/feed.rss`. A machine-readable audit file is written to `site/feed.json`.

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
| `JSON_OUTPUT_PATH` | output path next to RSS as `feed.json` | Output path for the audit JSON |
| `RSS_CONCURRENCY` | `6` | Number of article pages to fetch at once |
| `RSS_TIMEOUT_MS` | `12000` | Request timeout in milliseconds |
| `RSS_FETCH_ATTEMPTS` | `3` | Fetch attempts before a source or article is marked failed |
| `RSS_ARTICLE_SCAN` | `true` | Set to `false` to filter only RSS feed text |
| `RSS_MAX_FUTURE_HOURS` | `6` | Future-dated item tolerance before an item is excluded |
| `ARCHIVE_MAX_AGE_DAYS` | `365` | Maximum age for retained archived stories |
| `FEED_URL` | empty | Public URL for Atom self-link |
| `JSON_FEED_URL` | empty | Public URL for the JSON Feed |
| `SITE_URL` | empty | Public base URL for the channel link |
| `GEMINI_API_KEY` | empty | Optional Gemini key for one-time batched summaries and reasons |
| `SUMMARY_BATCH_SIZE` | `10` | Stories summarized per Gemini request |
| `SUMMARY_BATCH_DELAY_MS` | `5000` | Delay between Gemini summary requests |
| `SUMMARY_MAX_REQUESTS_PER_RUN` | `10` | Maximum Gemini summary requests per run |
| `FACEBOOK_POST_URLS` | empty | Optional comma- or newline-separated `Name\|URL` public Facebook posts to include |
| `FACEBOOK_PAGE_URLS` | empty | Optional comma- or newline-separated `Name\|URL` public Facebook pages to scan when Facebook exposes no-login post HTML |
| `FACEBOOK_PAGE_MAX_POSTS` | `10` | Maximum post links to read from each configured Facebook page |

Gemini's public docs say rate limits vary by project, model, and usage tier; use AI Studio as the source of truth for the active project. The default summarizer starts with `gemini-2.5-flash-lite`, batches stories, caches successful summaries in `feed.json`, and caps requests per run so hourly refreshes stay conservative.

Configured Facebook pages are used as public post discovery pages; when a post URL is exposed without a login, the generator opens the post page and nests any extracted comments under that story.

## Automation

The GitHub Actions workflow publishes `site/` to GitHub Pages on pushes to `main`, manual runs, and an hourly schedule. It runs tests first, seeds the local archive from the live `feed.json` when available, regenerates the feeds, then deploys.
