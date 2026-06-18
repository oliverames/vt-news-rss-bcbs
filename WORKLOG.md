## 2026-06-18 - Expand Vermont local source coverage

**What changed**: Expanded `DEFAULT_SOURCES` from 39 to 81 rows by adding the missing Vermont Press Association and community-news outlets requested in the coverage audit. Used direct RSS or outlet search feeds where available, including Caledonian-Record, Barton Chronicle, Journal Opinion, Brandon Reporter, Charlotte News, County Courier, Hardwick Gazette, Hinesburg Record, Vermont Journal/The Shopper, The Bridge, The Islander, White River Valley Herald, Times Ink, Valley Reporter, Deerfield Valley News, Vermont Standard, Community News Service, Chester Telegraph, Newport Dispatch, Town Meeting TV, and iBrattleboro. Added site-scoped Google News sources for outlets with no reliable feed or stale/no-content web surfaces, including The Commons, The World, North Avenue News, Lakeside News & The Rutland Sun, Eagle Times, Vermont News Guide, Addison Eagle, Northfield News, Lakes Region Free Press, Mountain Gazette, Waterbury Roundabout, Cabot Chronicle, and East Montpelier Signpost.

**Decisions made**: Kept Vermont Journal and The Shopper as one source because the publisher exposes one combined feed. Used the Springfield Vermont News Blogspot RSS feed for the Springfield Reporter surface because the current Reporter web presence is subscription/Facebook oriented. Avoided directly fetching the Northfield News domain after the probe returned unrelated spam HTML, and covered it only through a site-scoped Google News search. Added the new TownNews-style sources to the shared `townnews-search` throttle group to preserve politeness and avoid recurring 429s.

**Left off at**: `npm test` passed with 61 tests, `node --check src/*.js test/index.test.js` passed, and a live-seeded scratch generate to `/tmp/vt-news-expanded-sources.XAONwM` with `RSS_ARTICLE_SCAN=false` fetched 81 source rows with zero failures. Only the closed Jan. 1-June 13 backfill source skipped as designed; the run wrote 318 audit items and 223 visible public items, and `xmllint --noout` validated the generated RSS.

**Open questions**: Some Google-only sources returned zero current search items. That is expected for stale, static, or lightly indexed local outlets, but the source rows are now present so any future Google-indexed health/Blue Cross results can be collected.

---

## 2026-06-16 - Harden crawling, caching, and deploy mode

**What changed**: Added persisted audit-only crawl state with per-source feed validators, primary-feed cooldowns, article-cache entries, and crawl metrics. Primary feeds with fallbacks now cool down after repeated 403/429/other failures instead of hammering a known-bad URL every run. Fetches now preserve `ETag` and `Last-Modified` headers and can handle 304 not-modified responses. Article enrichment now uses selective scan modes, skips no-signal article fetches, caches negative no-match decisions for a bounded TTL, and has domain-specific article text selectors for priority outlets. The publish workflow now distinguishes full feed-generation pushes from static-only site/docs pushes so static reader changes can deploy without recrawling every source.

**Decisions made**: Kept crawler state out of the public JSON feed and stored it only in `feed-audit.json`. Left the existing matched-item archive cache as the first positive cache layer so old summaries and accepted items continue to work. Used `smart` as the default article scan mode: fetch article pages only when feed text, topic text, search fallback metadata, or brand-required metadata gives the item a reason to be worth scraping. Kept source cooldown durations conservative: 24 hours for 403, `Retry-After` or two hours for 429, and one hour for other primary-feed errors.

**Left off at**: `npm test` passed with 61 tests, `node --check src/*.js test/index.test.js` passed, and `git diff --check` passed. A live-seeded scratch generate to `/tmp/vt-news-crawl.Ss6UhL` with `RSS_ARTICLE_SCAN=false` loaded 414 prior live items, fetched 39 configured sources with zero failures, skipped only the closed Jan. 1-June 13 backfill source, wrote 417 audit items and 286 public items, produced a well-formed RSS feed via `xmllint --noout`, and verified that crawler state/metrics are present in audit JSON but absent from public `feed.json`.

**Open questions**: None. The first production run with this commit should populate source cooldown state for any primary feeds blocked specifically on GitHub runners; the local scratch run did not hit those runner-only 403/429 cases.

---

## 2026-06-16 - Disable social collection, add article comments and icons

**What changed**: Parked the built-in Facebook/social sources behind `ENABLE_SOCIAL_SOURCES=true` and made env-configured Facebook post/page URLs inactive unless that flag is set. Archived Facebook/social items are now pruned when social collection is disabled, so old social posts do not carry forward from the live audit cache. Added conservative article comment extraction from server-rendered comment sections and JSON-LD `Comment` objects, then merged those comments into already-identified news items during enrichment. Added favicon, Apple touch icon, and web manifest icons generated from the BCBS profile asset at `the provided BCBS profile asset`.

**Decisions made**: Kept the existing Facebook parsers and reader Social fallback instead of deleting them, so a deliberate one-off social run remains possible with `ENABLE_SOCIAL_SOURCES=true`. Article comments enrich matched stories but do not create new relevance matches by themselves. Used the profile image directly for browser/iPhone assets because it is already square and brand-ready.

**Left off at**: `npm test` passed with 55 tests, `node --check test/index.test.js` and `node --check src/*.js` passed, `git diff --check` passed, `site/site.webmanifest` parsed as JSON, and ImageMagick verified the generated icon sizes (`16x16`, `32x32`, `180x180`, `192x192`, and `512x512`). A live-seeded scratch generate to `/tmp/vt-news-rss-bcbs-social-off*` with article scanning off loaded 168 archived items, wrote 278 audit items and 205 public items, and returned zero Facebook/social sources or items in both public and audit JSON. Implementation commit `a29ac13` was pushed to `main`; publish run `27643286441` had passed setup, install, tests, and archive seeding and was still in the live `Generate feed` step when wrap-up began.

**Open questions**: Live article-comment capture depends on each publisher rendering comments in the fetched article HTML. Iframe-only or client-rendered comment systems will not expose comments to this parser.

---

## 2026-06-16 - Reduce recurring source failures

**What changed**: Added per-source feed fallbacks so a blocked or rate-limited primary RSS feed can still collect through a site-scoped Google News search. Vermont Business Magazine and The Mountain Times keep their direct feeds as primary sources, but now fall back to Google News if the GitHub runner gets a 403. The TownNews search feeds also fall back to Google News when they hit 429. Added a shared `townnews-search` throttle group for the Rutland Herald, Times Argus, Bennington Banner, Brattleboro Reformer, VTCNG, Newport Daily Express, and St. Albans Messenger search feeds, with `RSS_TOWNNEWS_DELAY_MS` defaulting to eight seconds.

**Left off at**: `npm test` passed with 51 tests, `node --check src/fetching.js src/sources.js test/index.test.js` passed, and `git diff --check` passed. A live-seeded scratch generate to `/tmp/vt-news-failures.QfXfH0` with article scanning off loaded 390 prior live archive items, fetched all 45 sources with zero failures, wrote 393 audit items and 272 public items, produced a valid RSS feed via `xmllint --noout`, and returned zero obituary hits. A forced-403 check against the configured Vermont Business Magazine and The Mountain Times primary feeds proved both fall back to `news.google.com` and stay `ok: true`. After the next scheduled run showed fresh 429s from Times Argus and VTCNG, a forced-429 check verified every TownNews source also falls back to `news.google.com` and stays `ok: true`.

**Open questions**: The direct Vermont Business Magazine and Mountain Times feeds return 200 locally, so this targets the repeated GitHub Actions runner blocks shown in the live audit rather than a universal feed outage.

---

## 2026-06-16 - Exclude obituaries from collection and archive

**What changed**: Added a shared obituary exclusion filter that catches RSS obituary categories, obituary/death-notice URL and title patterns, and narrow obituary prose such as `passed away`, funeral-home/service language, celebration-of-life, and memorial-service wording. Feed parsers now preserve RSS/Atom categories as `sourceCategories` for filtering without adding category text to matcher evidence. The filter runs before source item bounds and again while loading the durable audit archive, so newly fetched obituaries are not collected and previously cached obituaries are purged on the next generation.

**Left off at**: `npm test` passed with 50 tests, `node --check src/*.js` passed, and `git diff --check` passed. A live-seeded scratch generate to `/tmp/vt-news-obits-final.5tWr6N` with article scanning off loaded 390 prior live archive items, wrote 393 audit items and 272 public items, produced a valid RSS feed via `xmllint --noout`, and returned zero public/audit obituary hits. Known live obituaries (`David Jon Bursey, 77, of Monkton`, `Michael Ray Jensen, 54, of Brandon`, and `Obituary: Dieter Gump, 1933-2026`) were absent from the generated public and audit JSON.

**Open questions**: None.

---

## 2026-06-16 - Align source searches with Kristina's Boolean list

**What changed**: Added Kristina's current Boolean search set directly to the Google News source queries: Blue Cross/BCBS variants paired with VT or Vermont, Vermont healthcare/health care/hospitals, health insurers, health care affordability, UVM Health, and MVP Health Care. Tightened local brand matching so `BCBS ... Vermont`, `BlueCross ... Vermont`, and `Blue Cross and Blue Shield ... Vermont/VT` are classified as Blue Cross VT evidence instead of relying only on search fallback. Documented the Boolean coverage in the README and added regression tests for source-query coverage and matcher behavior.

**Left off at**: `npm test` passed with 46 tests, `node --check src/*.js` passed, `git diff --check` passed, and the explicit Boolean comparison script returned YES for all 18 provided Boolean queries. A scratch live generate to `/tmp/vt-news-booleans.u0uqqb` with article scanning off fetched all 45 sources without failures, skipped only the closed Jan. 1-June 13 backfill source, wrote 277 audit items, 203 visible public items, and produced a well-formed RSS feed via `xmllint --noout`.

**Open questions**: None.

---

## 2026-06-13 - Apply branded README style

**What changed**: Reworked the public README around the `ames-writing:readme-style` structure: centered project mark, badges, strategic "Why This Exists" framing, quick start, source coverage, matching and relevance behavior, reader experience, configuration, architecture, development commands, and Oliver footer. Added `site/readme-icon.svg` as a small local header mark so the README does not depend on a missing external asset.

**Decisions made**: Used a "license not specified" badge rather than inventing a license file. Kept the README factual to the current implementation: 45 configured sources, GitHub Actions doing the hourly crawl, browser-side reader filtering only, BlueCrossVT.org/social hidden from All by default, direct Blue Cross VT mentions retained indefinitely, and the Jan. 1 through June 13, 2026 backfill carried by the audit archive after the bounded source closes.

**Left off at**: `npm test` passed with 45 tests, `node --check src/*.js` passed, `git diff --check` passed, README local asset and source count checks passed, and the link check confirmed the repo, shields, Repository, live reader, GitHub, and Bluesky profile. The commit `6fbf24d` was pushed to `main`; publish run `27466251060` built in 6m7s and deployed successfully.

**Open questions**: None. Automated fetches still warn on `an external site` and LinkedIn-style social pages, but the README keeps the required Oliver identity links from the README style guide.

---

## 2026-06-12 - Clear the review backlog: alerts, parallel fetch, module split

**What changed**: Implemented the remaining items from the morning hardening review. Webhook alerts now gate on per-source consecutive-failure streaks (`WEBHOOK_FAILURE_THRESHOLD`, default 24) persisted in the audit JSON's sources array, which doubles as source-rot visibility; the Gemini prompt marks article text as untrusted. Date-bounded sources are skipped automatically once `maxPubDate` passes, so the 2026 backfill search retires itself on June 13 with no scheduled cleanup. Snippet centering now blanks `strip` regions with same-length whitespace so it cannot center on transport idioms the matcher ignored. Sources fetch concurrently (`RSS_SOURCE_CONCURRENCY`, default 4) with results assembled in source order, and the per-domain throttle was rebuilt as a promise chain that cannot race; source-level and Facebook post fetches now throttle too. All five actions are SHA-pinned with tag comments, and a standalone `test.yml` runs the suite on pull requests. Finally, split the 3,181-line `src/index.js` into eleven flat modules plus a barrel `index.js` that keeps `generateFeed`, `main`, and explicit re-exports, so test imports and `npm run generate` are unchanged.

**Decisions made**: Auto-skip beats a calendar reminder for the backfill source: the window stays open through its last day and the mechanism generalizes. Alert exactly at the threshold crossing (once per outage) rather than repeatedly during an outage. Keep the module split purely mechanical and last in the commit sequence so functional diffs stayed reviewable; bodies were extracted verbatim by line range with a Python splitter, with only import headers authored. Skipped Dependabot again (two stable deps; recurring PR noise outweighs benefit) and left the committed `site/feed.*` artifacts, the Chrome UA, and the Facebook parsing approach as they are.

**Left off at**: 45 tests pass, `node --check` on all twelve `src/*.js` files, offline `generateFeed` smoke through the seeded archive (169 items merged, RSS well-formed, JSON valid), and two live-network generates to `/tmp` (45/45 sources ok, zero failures, 238 then 246 items) — one before the split on the parallel-fetch commit, one after the split. Both workflows parse as YAML.

**Open questions**: The throttle's promise-chain behavior is verified structurally and by the live runs, not by a dedicated unit test; a timing test would be flake-prone. Revisit if politeness complaints ever surface.

**Post-deploy finding**: The first CI run on these changes built in 9:10 versus ~2:15 for prior runs. Source collection itself dropped to 17 seconds (parallel fetching works); the added time is article scanning, because the old racy throttle never actually enforced its 1-second per-domain delay under concurrency, and the fixed one does. Prior runs were fast by accident of broken politeness. 9 minutes is comfortable against the hourly cadence and 30-minute timeout, so the delay stays at 1s, now tunable via `RSS_DOMAIN_DELAY_MS`. The deeper inefficiency, re-fetching article pages for items that did not match on earlier runs (only matches are cached), is a candidate for a negative-result cache with a TTL if run length ever becomes a problem. Source failures after the burst of runs: Vermont Business Magazine and The Mountain Times return HTTP 403 (streak 3 by end of day; if these persist toward the threshold it is durable bot-blocking, not noise), and the TownNews-platform outlets (Times Argus ×2, VTCNG, Newport Daily Express, St. Albans Messenger) returned clustered HTTP 429s from shared rate limiting after ~5 generates in two hours; those should clear at the normal hourly cadence. The streak counters in the live audit are the dashboard for both.

---

## 2026-06-12 - Harden fetch, workflow, and reader; fix site title

**What changed**: Changed the site title and h1 from `Blue Cross VT : News Mentions` to `Blue Cross VT: News Mentions`. Added a decompressed response size cap to all generator fetches (`RSS_MAX_RESPONSE_BYTES`, default 10 MB) with a non-retryable error path so an oversized body is not re-downloaded three times. Guarded the reader's `hashParam` against malformed percent-encoding that previously threw `URIError` and broke rendering on hashchange. Added `timeout-minutes` to both workflow jobs, `persist-credentials: false` on checkout, and `--max-time 60` on the archive seed curls. Refreshed the README source table to match `DEFAULT_SOURCES` (added BCBSA Association News, Vermont Daily Chronicle, St. Albans Messenger, ABC/CBS/CNN health feeds, the backfill and Kristina Google News searches) and documented `RSS_MAX_RESPONSE_BYTES`, `SUMMARY_REJUDGE_ALL`, `SLACK_WEBHOOK_URL`, and `DISCORD_WEBHOOK_URL`.

**Decisions made**: Count the size cap against decompressed bytes by reading the response stream, which also covers compression bombs; decode accumulated bytes with `TextDecoder` to match `response.text()` UTF-8 semantics. Cap build at 30 minutes because runs are serialized (`cancel-in-progress: false`) and GitHub's 360-minute default would let one hung run back up six hourly runs. Left feed channel titles (`Blue Cross VT News Mentions`, no colon) unchanged; only the reader page title used the spaced colon. Skipped Dependabot (two stable deps, solo project, recurring PR noise outweighs benefit) and kept serial source fetching (politeness and simplicity; runtime is not a constraint on the hourly schedule).

**Left off at**: `npm test` passed with 41 tests (40 existing plus a new `readResponseTextWithLimit` test), `node --check src/index.js` passed, workflow YAML parsed, and the local preview verified the new title, 25 rendered stories, zero console errors, and intact rendering with a mangled `#page=%` hash.

**Open questions**: None.

---

## 2026-06-12 - Add reader search, multiselect sections, and brand archive retention

**What changed**: Added a browser-side search field, replaced single section links with plain checkbox multiselect controls, moved pagination to the bottom only, and changed the footer divider to match the tricolor reader rule. Updated archive retention so direct Blue Cross VT mentions stay indefinitely while topic-only Vermont health care stories keep the rolling window. Simplified the dateline to user-facing "refreshed hourly" copy and removed the story-count language.

**Decisions made**: Keep source collection and summarization server-side in GitHub Actions because browser-side crawling would expose secrets and run into cross-origin limits. Put browser-side work where it fits: reader filtering, section toggles, search, and pagination. Keep BlueCrossVT.org and social posts available but off by default.

**Left off at**: `npm test` passed with 37 tests, `node --check src/index.js`, `git diff --check`, static site script parsing, local Playwright, and live Playwright verification passed. GitHub Actions runs `27441377646` and `27441758972` both deployed successfully. Live page verified with default checked sections `Blue Cross VT (16)` and `VT Health Care (98)`, optional unchecked sections `BlueCrossVT.org (19)` and `Social posts (1)`, bottom-only pager, visible search, no GitHub Actions copy in the reader, and tricolor footer rule.

**Open questions**: None.

---

## 2026-06-12 - Refine reader defaults and relevance outputs

**What changed**: Split the public JSON feed from the full audit/cache JSON, added a three-month rolling archive, paginated the text reader at 25 stories, moved the article date into the meta line above each headline, added access labels, collapsed comments by default, and hid BlueCrossVT.org plus social/Facebook posts from the default All view while keeping them available as sections. Tightened national relevance filtering, removed keyword clutter from public surfaces, added BlueCrossVT.org newsroom/blog listings, and deduped Google News wrappers when the originating outlet article exists.

**Decisions made**: Keep `feed.json` reader-safe and put rejected/cache details in `feed-audit.json`. Preserve a text.npr.org-style reader: simple links, sections, newest-first order only, and minimal controls. Treat BlueCrossVT.org and social posts as opt-in sections because they are useful audit/context sources but too noisy for the default feed.

**Left off at**: `npm test` passed with 37 tests, `node --check src/index.js`, `git diff --check`, site script syntax check, and `xmllint --noout site/feed.rss` passed. Local Playwright verified 25 rendered stories, `1-25 of 116 Older` pagination, no keyword/matched/posting clutter, source/social hidden from All, comments collapsed in the Social section, and date/source/access displayed above headlines. GitHub Actions run `27440191807` passed and deployed to GitHub Pages.

**Open questions**: None. Access labels are heuristic by domain and should be revisited if a source changes its paywall behavior.

---

## 2026-06-12 - Expand BCBS VT news monitor coverage

**What changed**: Expanded the news monitor from a narrow BCBS mention feed into a broader Blue Cross VT and Vermont health care monitor. Added News Export-driven coverage patterns, broader keyword aliases, JSON Feed output, nested Facebook comment extraction, configured Facebook post/page sources, future-date filtering, archive revalidation, conservative Gemini batching controls, and refreshed generated feeds.

**Decisions made**: Use the colleague news export as a coverage reference without storing full article bodies; keep summaries, inclusion reasons, matched keywords, and source links as the durable output. Treat Facebook page scanning as public post discovery, then enrich discovered posts from public post pages when available. Keep Gemini usage conservative by starting with `gemini-2.5-flash-lite`, caching successful summaries, batching requests, and capping requests per run.

**Left off at**: `npm test`, `node --check src/index.js`, `git diff --check`, and `npm run generate` passed. The generated JSON has 98 items, no future-dated items, no known product-marketing false positives, Facebook content with nested comments, Vermont Public coverage, and Burlington Free Press coverage.

**Open questions**: None for the shipped implementation. Facebook may change no-login HTML behavior over time, so configured public post URLs remain the most reliable Facebook path.

---
