// Source-failure alerting: consecutive-failure streaks and webhook pings.
import { parsePositiveInteger } from "./utils.js";

// One-off fetch failures are routine (Facebook especially), so webhook
// alerts fire only when a source crosses this many consecutive failed runs
// (~a day at the hourly cadence). Streaks persist in the audit JSON.
const WEBHOOK_FAILURE_THRESHOLD = parsePositiveInteger(
  process.env.WEBHOOK_FAILURE_THRESHOLD,
  24,
);

export function applyFailureStreaks(sourceResults, previousStreaks = new Map()) {
  return sourceResults.map((result) => ({
    ...result,
    consecutiveFailures: result.ok
      ? 0
      : (previousStreaks.get(result.name) || 0) + 1,
  }));
}

// Alert exactly when a source crosses the threshold — once per outage, not
// once per hour for the rest of the outage.
export function selectFailureAlerts(
  sourceResults,
  threshold = WEBHOOK_FAILURE_THRESHOLD,
) {
  return sourceResults.filter(
    (result) => !result.ok && result.consecutiveFailures === threshold,
  );
}

export async function triggerWebhooks(failedSources) {
  if (failedSources.length === 0) return;

  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!slackUrl && !discordUrl) return;

  const message = `⚠️ *Blue Cross VT News Mention Monitor Alert*\nSources failing for ${WEBHOOK_FAILURE_THRESHOLD}+ consecutive runs:\n` +
    failedSources.map(s => `- *${s.name}*: ${s.consecutiveFailures ?? "?"} consecutive failures (${s.error})`).join("\n");

  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      console.log("Successfully sent Slack alert.");
    } catch (err) {
      console.error("Failed to send Slack alert:", err.message);
    }
  }

  if (discordUrl) {
    try {
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      console.log("Successfully sent Discord alert.");
    } catch (err) {
      console.error("Failed to send Discord alert:", err.message);
    }
  }
}
