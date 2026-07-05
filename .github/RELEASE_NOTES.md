# v1.1.0 — Reliability sweep

A comprehensive review pass over the whole pipeline: crawler hardening, cache correctness, a much smaller persistence file, and small output/reader fixes. 70 tests (9 new), zero dependency vulnerabilities.

## Crawler & fetch layer
- `Retry-After` handling now understands the HTTP-date form as well as delta-seconds (only all-digit values parse as seconds, so ISO-date forms can't misread as a delta).
- When a server requests a backoff longer than 15 seconds, the fetch fails fast instead of hanging a worker or retrying early against a rate-limiter; the cross-run source cooldown honors the requested duration, capped at 24 hours so a clock-skewed server can't park a feed for months.
- HTTP 408 is retried like 429; other 4xx responses still fail fast.
- Response bodies are decoded using the `Content-Type` charset or the document's own XML/HTML declaration instead of assuming UTF-8, fixing mojibake from outlets serving ISO-8859-1/Windows-1252. Bytes that validate as UTF-8 (or carry a BOM) always win, so a mislabeled header can't mangle correct UTF-8 content.
- `RSS_DOMAIN_DELAY_MS=0` and `RSS_TOWNNEWS_DELAY_MS=0` now genuinely disable the politeness delay for local runs.

## Cache correctness & audit size
- A no-match verdict recorded because the article fetch itself failed (429, timeout, block) now expires after one day instead of the 14-day negative-cache TTL, so a transient failure can't suppress brand matching for two weeks.
- Expired article-cache entries without ETag/Last-Modified validators are dropped at expiry instead of lingering an extra TTL window, and the audit JSON is serialized compact. The live `feed-audit.json` — re-downloaded and re-uploaded every hourly run — drops from 19 MB to 14 MB in one pass and roughly halves at steady state.

## Pipeline robustness
- Gemini summary responses wrapped in markdown fences or lead-in prose are salvaged instead of dropping the whole batch.
- Slack/Discord failure-alert webhooks time out after 10 seconds.
- The publish workflow's archive seed step retries the download and requires valid JSON with an `items` array before replacing the checked-out archive, so a truncated download can no longer shrink the live history.

## Outputs & reader
- RSS: empty `<source url="">` elements are omitted; the channel advertises `<ttl>60</ttl>`.
- Reader page: a failed `feed.json` load now offers a Retry button.

## Dependencies
- Cleared the high-severity `undici` advisory; bumped `google-news-url-decoder` to 1.2.2.
