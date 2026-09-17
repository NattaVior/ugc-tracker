import { authorized } from "../lib/security.js";
import { testWebhook } from "../lib/discord.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req, "manual")) return res.status(401).json({ error: "Unauthorized" });
  try { await testWebhook(); return res.status(200).json({ ok: true }); }
  catch { return res.status(500).json({ ok: false, error: "Webhook test failed" }); }
}
