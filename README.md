# 🎁 UGC Limited Tracker

Track UGC Limited **gratis** dari Roblox Catalog, auto-kirim notif ke Discord. Jalan 24/7 di Vercel.

## Fitur

- ✅ Scan UGC Limited gratis tiap 10 menit (atau sesuai cron)
- ✅ Filter: gratis (0 R$) + masih ada stok
- ✅ Auto-kirim Discord notif (cuma item baru)
- ✅ Deteksi item baru (gak spam)
- ✅ REST API buat dashboard
- ✅ Test endpoint buat cek webhook
- ✅ Jalan 24/7 tanpa buka browser

## Setup (15 Menit)

### 1. Bikin Discord Webhook

1. Discord → Server Settings → Integrations → Webhooks
2. New Webhook → pilih channel → Copy URL

### 2. Fork / Clone Repo

```bash
git clone https://github.com/USERNAME/ugc-tracker.git
cd ugc-tracker
npm install
