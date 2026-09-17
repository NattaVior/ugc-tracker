import "server-only";

export function validateItem(item) {
  if (!item || typeof item !== "object") return null;
  const assetId = String(item.assetId || "");
  const name = String(item.name || "").trim();
  const price = Number(item.price);
  const itemUrl = String(item.itemUrl || "");
  if (!/^\d+$/.test(assetId) || !name || !/^https?:\/\//.test(itemUrl) || price !== 0) return null;
  return {
    assetId, name,
    creatorName: item.creatorName ? String(item.creatorName) : null,
    creatorId: item.creatorId ? String(item.creatorId) : null,
    itemUrl,
    rolimonsUrl: item.rolimonsUrl ? String(item.rolimonsUrl) : null,
    thumbnailUrl: item.thumbnailUrl ? String(item.thumbnailUrl) : null,
    price: 0
  };
}

export function validateItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).map(validateItem).filter((item) => {
    if (!item || seen.has(item.assetId)) return false;
    seen.add(item.assetId);
    return true;
  });
}
