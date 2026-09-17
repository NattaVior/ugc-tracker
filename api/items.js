// api/items.js
// GET endpoint buat ngambil list item yang udah di-scrape

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
        return fallback;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const items = await kvGet('ugc_items', []);
        const lastScan = await kvGet('ugc_last_scan', null);

        return res.status(200).json({
            ok: true,
            count: items.length,
            lastScan,
            items,
        });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
