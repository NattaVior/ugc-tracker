import "server-only";
import { env } from "../env.js";
import { validateItems } from "./validation.js";

export class MockProvider {
  name = "mock";
  async scan() {
    return validateItems([
      { assetId: "123456789", name: "Example Free UGC One", creatorName: "Example Creator", creatorId: "123", itemUrl: "https://www.roblox.com/catalog/123456789", price: 0 },
      { assetId: "123456790", name: "Example Free UGC Two", creatorName: "Another Creator", creatorId: "124", itemUrl: "https://www.roblox.com/catalog/123456790", price: 0 },
      { assetId: "123456791", name: "Example Free UGC Three", creatorName: "Third Creator", creatorId: "125", itemUrl: "https://www.roblox.com/catalog/123456791", price: 0 }
    ]);
  }
}

function field(row, keys) {
  for (const key of keys) if (key in row) return row[key];
  return undefined;
}

export class RolimonsProvider {
  name = "rolimons";
  async scan() {
    if (!env.ROLIMONS_API_URL) {
      console.warn("[ROLIMONS] No authorized endpoint configured.");
      return [];
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const headers = { accept: "application/json", "user-agent": "UGC-Tracker/2.0" };
      if (env.ROLIMONS_API_TOKEN) headers.authorization = `Bearer ${env.ROLIMONS_API_TOKEN}`;
      const response = await fetch(env.ROLIMONS_API_URL, { headers, signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Authorized provider HTTP ${response.status}`);
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
      return validateItems(rows.map((row) => ({
        assetId: field(row, ["assetId", "asset_id", "id"]),
        name: field(row, ["name", "itemName", "item_name"]),
        creatorName: field(row, ["creatorName", "creator_name", "creator"]),
        creatorId: field(row, ["creatorId", "creator_id"]),
        itemUrl: field(row, ["itemUrl", "item_url", "url"]),
        rolimonsUrl: field(row, ["rolimonsUrl", "rolimons_url"]),
        thumbnailUrl: field(row, ["thumbnailUrl", "thumbnail_url", "image"]),
        price: field(row, ["price", "robuxPrice", "robux_price"])
      })));
    } catch (error) {
      console.error(`[ROLIMONS] Provider request failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return [];
    } finally { clearTimeout(timeout); }
  }
}

export function getProvider() {
  if (env.FREE_UGC_PROVIDER === "mock") return new MockProvider();
  if (env.FREE_UGC_PROVIDER === "rolimons") return new RolimonsProvider();
  throw new Error(`Unsupported FREE_UGC_PROVIDER: ${env.FREE_UGC_PROVIDER}`);
}
