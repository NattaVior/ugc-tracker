import { authorized } from "../lib/security.js";
import { runTracker } from "../lib/tracker.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req, "cron")) return res.status(401).json({ error: "Unauthorized" });
  try { return res.status(200).json(await runTracker()); }
  catch { return res.status(500).json({ success: false, error: "Tracker execution failed" }); }
}
