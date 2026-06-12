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
