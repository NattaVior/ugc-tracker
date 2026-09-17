// api/scraper.js
// Cron handler: scrape UGC Limited gratis + kirim Discord

export const config = {
    maxDuration: 60, // 60 detik max (Vercel Pro: 300s, Hobby: 10s)
};

const CONFIG = {
    catalogSearchV2: 'https://catalog.roblox.com/v2/search/items/details',
    catalogSearchV1: 'https://catalog.roblox.com/v1/search/items',
    catalogDetails: 'https://catalog.roblox.com/v1/catalog/items/details',
    thumbApi: 'https://thumbnails.roblox.com/v1/assets',
    maxPages: 10,
    delayBetweenPages: 500,
    delayBetweenBatches: 300,
    detailsBatchSize: 100,
    discordEmbedsPerMsg: 10,
    discordDelay: 1200,
    kvKey: 'ugc_seen_ids',
    kvItemsKey: 'ugc_items',
    kvLastScanKey: 'ugc_last_scan',
    kvMaxItems: 5000, // max item yang disimpan (biar KV gak penuh)
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// ============================================
// KV STORAGE (Vercel KV / Upstash Redis)
// ============================================
async function kvGet(key, fallback = null) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) return fallback;
    try {
        const res = await fetch(`${url}/get/${key}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return fallback;
        const json = await res.json();
        return json.result ? JSON.parse(json.result) : fallback;
    } catch (e) {
        console.error('[KV] get error:', e.message);
        return fallback;
    }
}

async function kvSet(key, value) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) return false;
    try {
        const res = await fetch(`${url}/set/${key}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value: JSON.stringify(value) }),
        });
        return res.ok;
    } catch (e) {
        console.error('[KV] set error:', e.message);
        return false;
    }
}

// ============================================
// FETCH HELPERS
// ============================================
async function fetchRetry(url, opts = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, opts);
            if (res.status === 429) {
                await sleep(2000 * (i + 1));
                continue;
            }
            return res;
        } catch (e) {
            if (i === retries) throw e;
            await sleep(1000);
        }
    }
    throw new Error('Max retries');
}

// ============================================
// SCRAPER
// ============================================
async function fetchCatalogPage(cursor = null) {
    // Coba V2 POST dulu (endpoint baru 2024)
    const body = {
        category: 11,            // UGC
        limit: 120,
        sortType: 3,             // Recently Updated
        salesTypeFilter: 1,      // 1 = Limited
        creatorType: null,
    };
    if (cursor) body.cursor = cursor;

    try {
        const res = await fetchRetry(CONFIG.catalogSearchV2, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; UGC-Tracker/1.0)',
            },
            body: JSON.stringify(body),
        });
        if (res.ok) return await res.json();
        console.warn(`[V2] HTTP ${res.status}`);
    } catch (e) {
        console.warn(`[V2] error: ${e.message}`);
    }

    // Fallback V1 GET
    const params = new URLSearchParams({
        category: '11',
        limit: '120',
        sortType: '3',
        salesTypeFilter: '1',
    });
    if (cursor) params.set('cursor', cursor);

    const res = await fetchRetry(`${CONFIG.catalogSearchV1}?${params}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; UGC-Tracker/1.0)',
        },
    });
    if (!res.ok) throw new Error(`V1 HTTP ${res.status}`);
    return await res.json();
}

async function scrapeUGCLimited() {
    const allItems = [];
    let cursor = null;
    let page = 0;

    while (page < CONFIG.maxPages) {
        try {
            const json = await fetchCatalogPage(cursor);
            const list = json.data || json.items || [];
            if (!list.length) break;

            for (const it of list) {
                allItems.push({
                    id: String(it.id),
                    name: it.name || 'Unknown',
                    price: it.price ?? 0,
                    favoriteCount: it.favoriteCount || 0,
                    creatorName: it.creatorName || '',
                    creatorId: it.creatorTargetId || '',
                    createdUtc: it.createdUtc || '',
                    updatedUtc: it.updatedUtc || '',
                    totalQuantity: it.totalQuantity ?? 0,
                    unitsAvailableForConsumption: it.unitsAvailableForConsumption ?? 0,
                    itemRestrictions: it.itemRestrictions ?? [],
                    isOffSale: it.isOffSale ?? false,
                    saleLocation: it.saleLocation ?? null,
                });
            }

            cursor = json.nextPageCursor || null;
            page++;
            if (!cursor) break;
            await sleep(CONFIG.delayBetweenPages);
        } catch (e) {
            console.error(`[Scraper] page error: ${e.message}`);
            break;
        }
    }

    return allItems;
}

async function fetchDetails(items) {
    const batches = chunk(items, CONFIG.detailsBatchSize);
    for (const batch of batches) {
        try {
            const res = await fetchRetry(CONFIG.catalogDetails, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; UGC-Tracker/1.0)',
                },
                body: JSON.stringify({
                    items: batch.map(it => ({ itemType: 'Asset', id: parseInt(it.id) })),
                }),
            });
            if (res.ok) {
                const json = await res.json();
                const details = json.data || [];
                for (let i = 0; i < batch.length; i++) {
                    const det = details[i] || {};
                    Object.assign(batch[i], {
                        price: det.price ?? batch[i].price,
                        totalQuantity: det.totalQuantity ?? batch[i].totalQuantity,
                        unitsAvailableForConsumption: det.unitsAvailableForConsumption ?? batch[i].unitsAvailableForConsumption,
                        purchaseCount: det.purchaseCount ?? 0,
                        itemRestrictions: det.itemRestrictions ?? batch[i].itemRestrictions,
                        isPurchasable: det.isPurchasable ?? false,
                        isOffSale: det.isOffSale ?? batch[i].isOffSale,
                        saleLocation: det.saleLocation ?? batch[i].saleLocation,
                    });
                }
            }
        } catch (e) {
            console.warn(`[Details] error: ${e.message}`);
        }
        await sleep(CONFIG.delayBetweenBatches);
    }
    return items;
}

// ============================================
// FILTER + ENRICH
// ============================================
function filterFreeAvailable(items) {
    return items.filter(it => {
        const isFree = it.price === 0;
        const hasStock = (it.unitsAvailableForConsumption ?? 0) > 0;
        const isLimited = (it.itemRestrictions || []).includes('Limited');
        const notOffSale = !it.isOffSale;
        return isFree && hasStock && isLimited && notOffSale;
    });
}

function enrich(item) {
    let gameLink = null;
    if (item.saleLocation) {
        try {
            const loc = typeof item.saleLocation === 'string' ? JSON.parse(item.saleLocation) : item.saleLocation;
            if (loc.gameId) gameLink = `https://www.roblox.com/games/${loc.gameId}`;
            else if (loc.universeId) gameLink = `https://www.roblox.com/games/${loc.universeId}`;
        } catch (e) {}
    }
    return {
        ...item,
        thumbnail: {
            small: `${CONFIG.thumbApi}?assetIds=${item.id}&size=150x150&format=Png`,
            medium: `${CONFIG.thumbApi}?assetIds=${item.id}&size=420x420&format=Png`,
            large: `${CONFIG.thumbApi}?assetIds=${item.id}&size=720x720&format=Png`,
        },
        links: {
            catalog: `https://www.roblox.com/catalog/${item.id}`,
            rolimons: `https://www.rolimons.com/item/${item.id}`,
            creator: item.creatorId ? `https://www.roblox.com/users/${item.creatorId}/profile` : null,
            game: gameLink,
        },
    };
}

// ============================================
// DISCORD
// ============================================
async function sendDiscord(items, webhookUrl) {
    if (!webhookUrl || !items.length) return { sent: 0, failed: 0 };

    const chunks = chunk(items, CONFIG.discordEmbedsPerMsg);
    let sent = 0, failed = 0;

    for (const ch of chunks) {
        const embeds = ch.map(item => ({
            title: `🎁 ${item.name}`.slice(0, 250),
            url: item.links.catalog,
            color: 0x00b894,
            thumbnail: { url: item.thumbnail.medium },
            fields: [
                { name: '💰 Harga', value: '**GRATIS** (0 R$)', inline: true },
                { name: '📦 Sisa', value: `${item.unitsAvailableForConsumption}/${item.totalQuantity}`, inline: true },
                { name: '👤 Creator', value: (item.creatorName || '-').slice(0, 100), inline: true },
                { name: '🔗 Link',
                  value: `[Catalog](${item.links.catalog})${item.links.rolimons ? ` | [Rolimons](${item.links.rolimons})` : ''}${item.links.game ? ` | [🎮 Game](${item.links.game})` : ''}${item.links.creator ? ` | [👤 Creator](${item.links.creator})` : ''}` },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'UGC Limited Tracker' },
        }));

        const payload = {
            content: `🔥 **${items.length} UGC Limited gratis BARU!**`,
            embeds,
        };

        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok || res.status === 204) {
                sent += ch.length;
            } else if (res.status === 429) {
                const retryAfter = parseInt(res.headers.get('retry-after') || '5');
                await sleep(retryAfter * 1000 + 500);
                // retry once
                const res2 = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (res2.ok || res2.status === 204) sent += ch.length;
                else failed += ch.length;
            } else {
                failed += ch.length;
            }
        } catch (e) {
            failed += ch.length;
        }

        await sleep(CONFIG.discordDelay);
    }

    return { sent, failed };
}

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
    // Cek auth (opsional, pakai secret token)
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const auth = req.headers.authorization || req.query.secret;
        if (auth !== `Bearer ${secret}` && auth !== secret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const startTime = Date.now();
    const log = (...args) => console.log('[Scraper]', ...args);

    try {
        log('Starting scan...');

        // === 1. SCRAPE ===
        const raw = await scrapeUGCLimited();
        log(`Scraped ${raw.length} raw items`);

        if (!raw.length) {
            return res.status(200).json({
                ok: true,
                message: 'No items found',
                duration: Date.now() - startTime,
            });
        }

        // === 2. DETAILS ===
        const detailed = await fetchDetails(raw);
        log(`Fetched details`);

        // === 3. FILTER ===
        const filtered = filterFreeAvailable(detailed);
        log(`Filtered: ${filtered.length} free+stock items`);

        const enriched = filtered.map(enrich);

        // === 4. DETEKSI BARU ===
        const seenIds = await kvGet(CONFIG.kvKey, []);
        const seenSet = new Set(seenIds);
        const newItems = enriched.filter(it => !seenSet.has(it.id));
        log(`New items: ${newItems.length}`);

        // === 5. SIMPAN KE KV ===
        const allSeen = [...seenIds, ...newItems.map(i => i.id)];
        const trimmedSeen = allSeen.slice(-CONFIG.kvMaxItems);
        await kvSet(CONFIG.kvKey, trimmedSeen);

        // Simpan item lengkap buat dashboard
        await kvSet(CONFIG.kvItemsKey, enriched.slice(0, CONFIG.kvMaxItems));
        await kvSet(CONFIG.kvLastScanKey, {
            timestamp: Date.now(),
            total: enriched.length,
            newCount: newItems.length,
        });

        // === 6. KIRIM DISCORD ===
        const webhook = process.env.DISCORD_WEBHOOK;
        let discordResult = { sent: 0, failed: 0 };
        if (webhook && newItems.length > 0) {
            log(`Sending ${newItems.length} new items to Discord...`);
            discordResult = await sendDiscord(newItems, webhook);
            log(`Discord: ${discordResult.sent} sent, ${discordResult.failed} failed`);
        }

        const duration = Date.now() - startTime;
        log(`Done in ${duration}ms`);

        return res.status(200).json({
            ok: true,
            total: enriched.length,
            newItems: newItems.length,
            discord: discordResult,
            duration,
        });
    } catch (e) {
        console.error('[Scraper] Fatal error:', e);
        return res.status(500).json({
            ok: false,
            error: e.message,
            duration: Date.now() - startTime,
        });
    }
}
