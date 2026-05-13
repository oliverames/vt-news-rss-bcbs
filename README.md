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

This project fetches public RSS feeds from Vermont news outlets, fetches article pages from those feed items, searches for Blue Cross VT mention patterns, and writes a filtered RSS feed named **Blue Cross VT News Mentions**.

The generator scans title, RSS summary, feed content, and article-page text. That matters because a story can mention Blue Cross in the article body without putting it in the headline.

Coverage is limited to the items each outlet exposes through its public RSS feed at run time. The audit JSON records source fetch failures, for example temporary rate limits, so a run can be checked before relying on it as complete.

## Included Sources

The default source list includes:

| Outlet | Feed |
| --- | --- |
| WCAX | `https://www.wcax.com/arc/outboundfeeds/whiz-rss/category/news/?outputType=xml&size=50&sort=display_date%3Adesc` |
| VTDigger | `https://vtdigger.org/feed/` |
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
| `FEED_URL` | empty | Public URL for Atom self-link |
| `SITE_URL` | empty | Public base URL for the channel link |

## Automation

The GitHub Actions workflow publishes `site/` to GitHub Pages on pushes to `main`, manual runs, and a 6-hour schedule. It runs tests first, then regenerates the feed before deploying.
