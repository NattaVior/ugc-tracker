import "server-only";

const bool = (value) => value === "1" || value === "true";

export const env = Object.freeze({
  DATABASE_URL: process.env.DATABASE_URL || "",
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",
  FREE_UGC_PROVIDER: process.env.FREE_UGC_PROVIDER || "mock",
  ROLIMONS_API_URL: process.env.ROLIMONS_API_URL || "",
  ROLIMONS_API_TOKEN: process.env.ROLIMONS_API_TOKEN || "",
  TRACK_INTERVAL_MINUTES: Number(process.env.TRACK_INTERVAL_MINUTES || 10),
  TRACKER_LOCK_TTL_SECONDS: Number(process.env.TRACKER_LOCK_TTL_SECONDS || 300),
  LEGACY_ROBLOX_PROVIDER_ENABLED: bool(process.env.LEGACY_ROBLOX_PROVIDER_ENABLED)
});

export function hasDatabase() {
  return Boolean(env.DATABASE_URL);
}
