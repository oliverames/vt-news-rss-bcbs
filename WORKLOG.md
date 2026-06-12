## 2026-06-12 - Expand BCBS VT news monitor coverage

**What changed**: Expanded the news monitor from a narrow BCBS mention feed into a broader Blue Cross VT and Vermont health care monitor. Added News Export-driven coverage patterns, broader keyword aliases, JSON Feed output, nested Facebook comment extraction, configured Facebook post/page sources, future-date filtering, archive revalidation, conservative Gemini batching controls, and refreshed generated feeds.

**Decisions made**: Use the colleague news export as a coverage reference without storing full article bodies; keep summaries, inclusion reasons, matched keywords, and source links as the durable output. Treat Facebook page scanning as public post discovery, then enrich discovered posts from public post pages when available. Keep Gemini usage conservative by starting with `gemini-2.5-flash-lite`, caching successful summaries, batching requests, and capping requests per run.

**Left off at**: `npm test`, `node --check src/index.js`, `git diff --check`, and `npm run generate` passed. The generated JSON has 98 items, no future-dated items, no known product-marketing false positives, Facebook content with nested comments, Vermont Public coverage, and Burlington Free Press coverage.

**Open questions**: None for the shipped implementation. Facebook may change no-login HTML behavior over time, so configured public post URLs remain the most reliable Facebook path.

---
