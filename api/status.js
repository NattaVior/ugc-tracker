import { prisma } from "../lib/db.js";
import { env, hasDatabase } from "../lib/env.js";

export default async function handler(req, res) {
  if (!hasDatabase()) return res.status(200).json({ configured: false, status: "ERROR", provider: env.FREE_UGC_PROVIDER, error: "DATABASE NOT CONFIGURED" });
  try {
    const [state, totalTracked] = await Promise.all([prisma.trackerState.findUnique({ where: { id: "singleton" } }), prisma.item.count()]);
    return res.status(200).json({ configured: true, status: state?.status || "IDLE", provider: env.FREE_UGC_PROVIDER, lastScanAt: state?.lastScanAt || null, nextScanAt: state?.nextScanAt || null, itemsFound: state?.itemsFound || 0, itemsNotified: state?.itemsNotified || 0, totalTracked });
  } catch { return res.status(500).json({ configured: true, status: "ERROR", error: "Failed to load status" }); }
}
