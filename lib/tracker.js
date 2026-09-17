import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { sendNotification } from "./discord.js";
import { getProvider } from "./providers/index.js";

const STATE = "singleton";
const expiry = () => new Date(Date.now() + env.TRACKER_LOCK_TTL_SECONDS * 1000);

async function acquireLock() {
  await prisma.trackerState.upsert({ where: { id: STATE }, create: { id: STATE, status: "IDLE" }, update: {} });
  const lockId = randomUUID();
  const now = new Date();
  const result = await prisma.trackerState.updateMany({
    where: { id: STATE, OR: [{ status: { not: "RUNNING" } }, { status: "RUNNING", lockExpiresAt: { lt: now } }, { status: "RUNNING", lockExpiresAt: null }] },
    data: { status: "RUNNING", lockId, lockExpiresAt: expiry(), lastError: null }
  });
  return result.count === 1 ? lockId : null;
}

async function releaseLock(lockId, status, data = {}) {
  await prisma.trackerState.updateMany({
    where: { id: STATE, lockId },
    data: { status, lockId: null, lockExpiresAt: null, lastScanAt: data.lastScanAt, itemsFound: data.itemsFound, itemsNotified: data.itemsNotified, lastError: data.lastError || null, nextScanAt: status === "ONLINE" ? new Date(Date.now() + env.TRACK_INTERVAL_MINUTES * 60000) : null }
  });
}

async function upsertItem(item, discoveredAt) {
  const existing = await prisma.item.findUnique({ where: { assetId: item.assetId } });
  if (existing) return { record: existing, created: false };
  try {
    const record = await prisma.item.create({ data: { ...item, discoveredAt } });
    return { record, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const record = await prisma.item.findUnique({ where: { assetId: item.assetId } });
      if (record) return { record, created: false };
    }
    throw error;
  }
}

export async function runTracker() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const lockId = await acquireLock();
  if (!lockId) return { success: false, error: "A tracker scan is already running" };
  let status = "ONLINE"; let lastError = null; let found = 0; let notified = 0;
  try {
    console.info("[TRACKER] Starting scan...");
    const provider = getProvider();
    const items = await provider.scan();
    found = items.length;
    let created = 0; let failures = 0; let skipped = 0;
    for (const item of items) {
      const result = await upsertItem(item, new Date());
      if (result.created) created += 1;
      const current = result.record;
      if (current.notifiedAt) { skipped += 1; continue; }
      const claimId = randomUUID();
      const claim = await prisma.item.updateMany({ where: { assetId: current.assetId, notifiedAt: null, OR: [{ notificationClaimExpiresAt: null }, { notificationClaimExpiresAt: { lt: new Date() } }] }, data: { notificationClaimId: claimId, notificationClaimExpiresAt: new Date(Date.now() + env.TRACKER_LOCK_TTL_SECONDS * 1000) } });
      if (claim.count !== 1) { skipped += 1; continue; }
      try {
        await sendNotification(current, current.discoveredAt);
        await prisma.item.updateMany({ where: { assetId: current.assetId, notificationClaimId: claimId }, data: { notifiedAt: new Date(), notificationError: null, notificationClaimId: null, notificationClaimExpiresAt: null } });
        notified += 1;
        console.info(`[DISCORD] Notification sent for ${current.assetId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Discord error";
        await prisma.item.updateMany({ where: { assetId: current.assetId, notificationClaimId: claimId }, data: { notificationError: message, notificationClaimId: null, notificationClaimExpiresAt: null } });
        failures += 1;
        console.error(`[DISCORD] Notification failed for ${current.assetId}: ${message}`);
      }
    }
    console.info("[TRACKER] Scan completed");
    return { success: true, provider: provider.name, retrieved: found, newItems: created, notified, notificationFailures: failures, skipped };
  } catch (error) {
    status = "ERROR"; lastError = error instanceof Error ? error.message : "Unknown tracker error";
    throw error;
  } finally {
    try { await releaseLock(lockId, status, { lastError, lastScanAt: new Date(), itemsFound: found, itemsNotified: notified }); }
    catch (error) { console.error("[TRACKER] Failed to release lock", error); }
  }
}
