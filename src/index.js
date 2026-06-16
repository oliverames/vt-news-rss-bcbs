// Feed generator entry point: wires collection, enrichment, archive merge,
// relevance, summaries, alerts, and outputs together, and re-exports the
// public surface tests and tooling import from this module.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sortItemsByDate } from "./utils.js";
import { buildSourcesFromEnv } from "./sources.js";
import { collectFeedItems } from "./fetching.js";
import { enrichAndFilterItems } from "./enrich.js";
import { applyDeterministicRelevance } from "./relevance.js";
import {
  dedupeResolvedItems,
  loadPreviousState,
  mergeWithArchive,
} from "./archive.js";
import { summarizeItems } from "./summaries.js";
import {
  applyFailureStreaks,
  selectFailureAlerts,
  triggerWebhooks,
} from "./alerts.js";
import { buildJsonSummary, buildRss, writeOutput } from "./outputs.js";

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

function resolveAuditJsonOutputPath(rssOutputPath) {
  if (process.env.AUDIT_JSON_OUTPUT_PATH) {
    return path.resolve(process.cwd(), process.env.AUDIT_JSON_OUTPUT_PATH);
  }

  return path.join(path.dirname(rssOutputPath), "feed-audit.json");
}

export async function generateFeed({
  sources = buildSourcesFromEnv(),
  now = new Date(),
  rssOutputPath = resolveRssOutputPath(),
  jsonOutputPath = resolveJsonOutputPath(rssOutputPath),
  auditJsonOutputPath = resolveAuditJsonOutputPath(rssOutputPath),
} = {}) {
  const { cache, archivedItems, previousFailureStreaks } =
    await loadPreviousState(auditJsonOutputPath, jsonOutputPath);
  const collected = await collectFeedItems(sources, now);
  const items = collected.items;
  // Streaks ride along in the published sources array, so the audit JSON
  // doubles as the source-rot dashboard and the persistence layer.
  const sourceResults = applyFailureStreaks(
    collected.sourceResults,
    previousFailureStreaks,
  );

  // Alert (asynchronously) only for sources that just crossed the
  // consecutive-failure threshold.
  triggerWebhooks(selectFailureAlerts(sourceResults)).catch(err => console.error("Webhook trigger error:", err));

  const currentMatched = await enrichAndFilterItems(items, cache);
  const matchedItems = dedupeResolvedItems(
    sortItemsByDate(mergeWithArchive(currentMatched, archivedItems, now)),
  ).map(applyDeterministicRelevance);
  await summarizeItems(matchedItems);
  const rss = buildRss(matchedItems, { now });
  const jsonSummary = buildJsonSummary(matchedItems, sourceResults, now);
  const auditJsonSummary = buildJsonSummary(matchedItems, sourceResults, now, {
    includeRejected: true,
    feedUrl: "",
  });

  await writeOutput(
    rss,
    jsonSummary,
    auditJsonSummary,
    rssOutputPath,
    jsonOutputPath,
    auditJsonOutputPath,
  );

  return {
    rssOutputPath,
    jsonOutputPath,
    auditJsonOutputPath,
    sourceResults,
    itemCount: matchedItems.length,
    items: matchedItems,
  };
}

async function main() {
  const result = await generateFeed();
  // Skipped sources are ok-by-definition; don't let them mask a run where
  // every real fetch failed.
  const healthySources = result.sourceResults.filter(
    (source) => source.ok && !source.skipped,
  );

  if (healthySources.length === 0) {
    throw new Error("No source feeds were fetched successfully.");
  }

  console.log(`Wrote ${result.itemCount} matching items to ${result.rssOutputPath}`);
  console.log(`Wrote public JSON feed to ${result.jsonOutputPath}`);
  console.log(`Wrote audit JSON to ${result.auditJsonOutputPath}`);
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

// Re-exports: the public surface for tests and tooling.
export {
  cleanStorySnippet,
  cleanText,
  escapeXml,
  wrapCdata,
} from "./utils.js";
export {
  DEFAULT_SOURCES,
  buildSourcesFromEnv,
  isSocialSourceItem,
  socialSourcesEnabled,
} from "./sources.js";
export {
  buildSnippet,
  canonicalizeMatchedTerms,
  categorizeTerms,
  CATEGORY_BRAND,
  CATEGORY_TOPIC,
  findMentionTerms,
  MENTION_TERMS,
  TOPIC_TERMS,
} from "./matching.js";
export {
  extractArticleComments,
  htmlToArticleText,
  mergeFacebookPagePostItem,
  parseBcbsAssociationNewsItems,
  parseBlueCrossVtListingItems,
  parseFacebookEmbeddedComments,
  parseFacebookEmbeddedPosts,
  parseFacebookPageHtml,
  parseFacebookPostHtml,
  parseFeedItems,
  parseUvmHealthNewsroomItems,
} from "./parsers.js";
export {
  collectFeedItems,
  filterSourceItemsByDateWindow,
  isSourceWindowClosed,
  readResponseTextWithLimit,
} from "./fetching.js";
export { isObituaryItem } from "./filters.js";
export { enrichAndFilterItems } from "./enrich.js";
export { applyDeterministicRelevance } from "./relevance.js";
export { dedupeResolvedItems, mergeWithArchive } from "./archive.js";
export {
  buildSummaryPrompt,
  parseSummaryResponse,
  summarizeItems,
} from "./summaries.js";
export {
  applyFailureStreaks,
  selectFailureAlerts,
  triggerWebhooks,
} from "./alerts.js";
export { buildJsonSummary, buildRss } from "./outputs.js";
