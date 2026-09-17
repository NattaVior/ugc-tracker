// api/test.js
// GET endpoint buat test Discord webhook

export default async function handler(req, res) {
    const webhook = process.env.DISCORD_WEBHOOK;
    if (!webhook) {
        return res.status(400).json({ ok: false, error: 'DISCORD_WEBHOOK not set' });
    }

    try {
        const testRes = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: '✅ **UGC Tracker** berhasil terhubung! Notif bakal dikirim ke channel ini.',
            }),
        });
        return res.status(200).json({
            ok: testRes.ok || testRes.status === 204,
            status: testRes.status,
        });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
