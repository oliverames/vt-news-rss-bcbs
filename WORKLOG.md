## 2026-06-12 - Clear the review backlog: alerts, parallel fetch, module split

**What changed**: Implemented the remaining items from the morning hardening review. Webhook alerts now gate on per-source consecutive-failure streaks (`WEBHOOK_FAILURE_THRESHOLD`, default 24) persisted in the audit JSON's sources array, which doubles as source-rot visibility; the Gemini prompt marks article text as untrusted. Date-bounded sources are skipped automatically once `maxPubDate` passes, so the 2026 backfill search retires itself on June 13 with no scheduled cleanup. Snippet centering now blanks `strip` regions with same-length whitespace so it cannot center on transport idioms the matcher ignored. Sources fetch concurrently (`RSS_SOURCE_CONCURRENCY`, default 4) with results assembled in source order, and the per-domain throttle was rebuilt as a promise chain that cannot race; source-level and Facebook post fetches now throttle too. All five actions are SHA-pinned with tag comments, and a standalone `test.yml` runs the suite on pull requests. Finally, split the 3,181-line `src/index.js` into eleven flat modules plus a barrel `index.js` that keeps `generateFeed`, `main`, and explicit re-exports, so test imports and `npm run generate` are unchanged.

**Decisions made**: Auto-skip beats a calendar reminder for the backfill source: the window stays open through its last day and the mechanism generalizes. Alert exactly at the threshold crossing (once per outage) rather than repeatedly during an outage. Keep the module split purely mechanical and last in the commit sequence so functional diffs stayed reviewable; bodies were extracted verbatim by line range with a Python splitter, with only import headers authored. Skipped Dependabot again (two stable deps; recurring PR noise outweighs benefit) and left the committed `site/feed.*` artifacts, the Chrome UA, and the Facebook parsing approach as they are.

**Left off at**: 45 tests pass, `node --check` on all twelve `src/*.js` files, offline `generateFeed` smoke through the seeded archive (169 items merged, RSS well-formed, JSON valid), and two live-network generates to `/tmp` (45/45 sources ok, zero failures, 238 then 246 items) — one before the split on the parallel-fetch commit, one after the split. Both workflows parse as YAML.

**Open questions**: The throttle's promise-chain behavior is verified structurally and by the live runs, not by a dedicated unit test; PER_DOMAIN_DELAY_MS is not injectable and a timing test would be flake-prone. Revisit if politeness complaints ever surface.

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
