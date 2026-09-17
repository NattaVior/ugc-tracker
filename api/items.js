import { prisma } from "../lib/db.js";
import { hasDatabase } from "../lib/env.js";

export default async function handler(req, res) {
  if (!hasDatabase()) return res.status(200).json({ ok: true, configured: false, items: [], count: 0 });
  try {
    const items = await prisma.item.findMany({ orderBy: { discoveredAt: "desc" }, take: 100 });
    return res.status(200).json({ ok: true, configured: true, count: items.length, items });
  } catch { return res.status(500).json({ ok: false, error: "Failed to load items" }); }
}
