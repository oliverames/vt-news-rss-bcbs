// Cross-pipeline item exclusions. These run before matching and again when
// loading archived audit items, so stale cached stories cannot persist.
import { cleanText } from "./utils.js";

const OBITUARY_PATH_PATTERN =
  /(?:^|\/)(?:obituaries?|obits?|death-notices?|life-lines\/obituaries?)(?:\/|$)/i;
const OBITUARY_CATEGORY_PATTERN =
  /\b(?:obituaries?|obits?|death notices?)\b/i;
const OBITUARY_TITLE_PATTERN =
  /^(?:obituaries?|obits?|obituary|death notices?|in memoriam)\b|(?:\bobituary:|\bdeath notice:)/i;
const OBITUARY_TEXT_PATTERN =
  /\b(?:obituary|obituaries|death notices?)\b/i;
const OBITUARY_PROSE_PATTERN =
  /\b(?:passed away|died peacefully|funeral (?:service|home)|celebration of life|memorial service)\b/i;

export function isObituaryItem(item) {
  const title = cleanText(item.title || "");
  const description = cleanText(item.description || "");
  const categories = cleanText(item.sourceCategories || "");
  const archivedText = cleanText(
    [item.summary, item.snippet, item.content_text].filter(Boolean).join(" "),
  );

  if (OBITUARY_CATEGORY_PATTERN.test(categories)) {
    return true;
  }

  if (OBITUARY_TITLE_PATTERN.test(title)) {
    return true;
  }

  try {
    const { pathname } = new URL(item.link || "");
    if (OBITUARY_PATH_PATTERN.test(pathname)) {
      return true;
    }
  } catch {
    // Unparseable links will be handled elsewhere; they are not obituary
    // evidence by themselves.
  }

  const textEvidence = cleanText([description, archivedText].join(" "));
  return (
    OBITUARY_TEXT_PATTERN.test(textEvidence) ||
    OBITUARY_PROSE_PATTERN.test(textEvidence)
  );
}
