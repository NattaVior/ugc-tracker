import "server-only";
import { env } from "./env.js";
import { retryAfterFrom, RetryableHttpError, withRetry } from "./retry.js";

function embed(item, detectedAt) {
  const links = [`[Roblox](${item.itemUrl})`];
  if (item.rolimonsUrl) links.push(`[Rolimon's](${item.rolimonsUrl})`);
  return {
    title: "🎁 FREE UGC DETECTED",
    description: `**${String(item.name).slice(0, 200)}**`,
    color: 0x8b5cf6,
    fields: [
      { name: "Creator", value: item.creatorName ? `@${item.creatorName}` : "Unknown", inline: true },
      { name: "Price", value: "FREE", inline: true },
      { name: "Asset ID", value: item.assetId, inline: true },
      { name: "Links", value: links.join("\n"), inline: false },
      { name: "Detected", value: detectedAt.toISOString(), inline: false }
    ],
    thumbnail: item.thumbnailUrl ? { url: item.thumbnailUrl } : undefined,
    timestamp: detectedAt.toISOString(),
    footer: { text: "UGC Free Tracker" }
  };
}

export async function sendNotification(item, detectedAt) {
  if (!env.DISCORD_WEBHOOK_URL) throw new Error("DISCORD_WEBHOOK_URL is not configured");
  await withRetry(async () => {
    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Free UGC Tracker", embeds: [embed(item, detectedAt)] })
    });
    if (response.ok || response.status === 204) return;
    if (response.status === 429 || response.status >= 500) {
      throw new RetryableHttpError(`Discord HTTP ${response.status}`, retryAfterFrom(response));
    }
    throw new Error(`Discord HTTP ${response.status}`);
  });
}

export async function testWebhook() {
  if (!env.DISCORD_WEBHOOK_URL) throw new Error("DISCORD_WEBHOOK_URL is not configured");
  const response = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: "✅ UGC Tracker webhook test berhasil." })
  });
  if (!response.ok && response.status !== 204) throw new Error(`Discord HTTP ${response.status}`);
}
